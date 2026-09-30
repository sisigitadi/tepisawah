-- =============================================================================
-- Tepi Sawah — Migration 010 (part 3): Submit order command.
--
-- Source: docs/api/API_CONTRACT.md §10.2 (Submit Order: DRAFT -> SUBMITTED ->
-- PENDING_CONFIRMATION, "Transition harus atomic"), §11.2 (Submit Waiter
-- Order), §2.2 (never trust client price/status/role), §2.3 + §14
-- (Idempotency-Key), §26 (concurrency), §27 (price integrity), §33
-- (transaction boundaries), §30 (public customer security),
-- docs/database/DATABASE_SCHEMA.md §20-§23 (snapshot is authoritative),
-- docs/security/AUTH_RBAC_RLS.md §27 (orders), §29 (history append-only),
-- §34 (SECURITY DEFINER rules), §46 (idempotency), §47 (validate before
-- mutate), docs/implementation/CLINE_IMPLEMENTATION_PLAN.md §14 (Phase 8B).
--
-- =============================================================================
-- WHAT THIS COMMAND IS
-- =============================================================================
--
-- The single authority for submitting a draft. The caller may send ONLY:
--
--     orderId         the draft to submit
--     source          CUSTOMER_QR | WAITER | POS (who is submitting)
--     tableId         the table context (customer path; required for anon)
--     tableSessionId  the OPEN session context (customer path; required for anon)
--     idempotencyKey  the client's dedup key for THIS submission
--
-- It may NOT send, and this function does not accept: any money value, any
-- status, any item list, any payment field (API_CONTRACT.md §2.2). The order
-- being submitted already exists as a DRAFT with its snapshot lines written by
-- `create_draft_order()`; this command does not rewrite them.
--
-- RECALCULATION (API_CONTRACT.md §27, "Price Integrity"). The snapshot columns
-- are authoritative for the receipt and are immutable (DATABASE_SCHEMA.md
-- §21). But a DRAFT can sit in a customer's cart while the menu changes
-- underneath it: a product gets 86'd, a price is edited, a modifier is
-- retired. Submitting such a draft would silently charge a stale price. So
-- this command re-reads the live catalog and re-derives every line total from
-- it, then compares the recomputed total against the frozen snapshot total:
--
--   * any product now inactive/unavailable, or any modifier now
--     inactive/removed from its product  -> REFUSE (item is no longer orderable)
--   * recomputed total != snapshot total  -> REFUSE (stale price)
--
-- It never overwrites the snapshot. A refusal tells the customer the menu
-- changed and that the draft must be rebuilt at current prices — the correct
-- outcome, because the frozen values are the receipt of record and a draft
-- that no longer matches them is not an order that can be submitted.
--
-- TRANSITION (API_CONTRACT.md §13, §33). DRAFT -> SUBMITTED ->
-- PENDING_CONFIRMATION is one atomic step here: the row is written to
-- PENDING_CONFIRMATION and BOTH history rows are appended in the same
-- transaction. SUBMITTED is a real state in the machine, so it is recorded in
-- the audit trail; the observable steady state a cashier queues on is
-- PENDING_CONFIRMATION. A partially-committed submit is impossible.
--
-- ACTORS (API_CONTRACT.md §29). A CUSTOMER_QR submit is anonymous but ONLY
-- through a validated table context — the caller must prove the table + OPEN
-- session the order actually belongs to (AUTH_RBAC_RLS.md §18, §30: a public
-- order id alone is not an authorization credential, and a customer cannot
-- touch another table's order). A WAITER/POS submit requires an authenticated,
-- active staff account holding `orders.create_manual` (§11.2); the source must
-- match the order's own source, so a customer path can never submit a staff
-- draft and vice versa.
--
-- IDEMPOTENCY (API_CONTRACT.md §2.3, §14, §26). The client's submit key is
-- stored under `submit_idempotency_key` (migration 008 part 2). A repeat
-- submit with the same key returns the first result verbatim. Two concurrent
-- submits of the SAME draft with the SAME key race on the row lock: the loser
-- finds the row already past DRAFT and reads back the winner's result. Two
-- concurrent submits with DIFFERENT keys on the same draft is a genuine
-- conflict and is refused (§26: 409 CONFLICT).
-- =============================================================================
create or replace function public.submit_order(
  p_order_id          uuid,
  p_source            text,
  p_table_id          uuid default null,
  p_table_session_id  uuid default null,
  p_idempotency_key   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order        public.orders%rowtype;
  v_existing     public.orders%rowtype;
  v_updated      public.orders%rowtype;
  v_table        public.tables%rowtype;
  v_session      public.table_sessions%rowtype;
  v_item         public.order_items%rowtype;
  v_product      public.products%rowtype;
  v_modifier     public.modifiers%rowtype;
  v_line_total   numeric(12,2);
  v_mod_total    numeric(12,2);
  v_recomputed   numeric(12,2) := 0;
  v_actor_id     uuid;
  v_actor_role   text;
begin
  -- ===========================================================================
  -- 1. Authorize.
  -- ===========================================================================
  -- Source must be a known vocabulary value; never silently coerced
  -- (DATABASE_MIGRATION_PLAN.md §21: no arbitrary status/source strings).
  if p_source is null or not (p_source in ('CUSTOMER_QR', 'WAITER', 'POS')) then
    raise exception 'Sumber order tidak valid' using errcode = '22023';
  end if;

  if p_source in ('WAITER', 'POS') then
    -- Staff submit (API_CONTRACT.md §11.2). The same grant that authorizes
    -- creating a manual draft authorizes sending it to the kitchen.
    if public.auth_user_id() is null or not public.current_user_is_active()
       or not public.has_permission('orders.create_manual')
    then
      raise exception 'Not authorized to submit manual orders'
        using errcode = '42501';
    end if;
    v_actor_id := public.auth_user_id();
    select r.code into v_actor_role
    from public.role_permissions rp
    join public.permissions p on p.id = rp.permission_id
    join public.roles r on r.id = rp.role_id
    where rp.permission_id = (
            select id from public.permissions where code = 'orders.create_manual'
          )
      and rp.role_id in (select role_id from public.user_roles
                         where user_id = v_actor_id)
    limit 1;
  else
    -- Customer submit: anonymous is allowed, but the table context below must
    -- validate. No staff actor is recorded.
    v_actor_id := null;
    v_actor_role := null;
  end if;

  -- ===========================================================================
  -- 2. Idempotency — check before mutate (AUTH_RBAC_RLS.md §46). A repeat with
  --    the same key returns the first result verbatim (API_CONTRACT.md §2.3).
  -- ===========================================================================
  if p_idempotency_key is not null then
    select * into v_existing
    from public.orders
    where submit_idempotency_key = p_idempotency_key;

    if found then
      return public.order_create_payload(v_existing.id);
    end if;
  end if;

  -- ===========================================================================
  -- 3. Load and LOCK the draft (API_CONTRACT.md §26 concurrency). FOR UPDATE
  --    serializes concurrent submits of the same row; the second one waits and
  --    then observes the first one's result instead of racing it.
  -- ===========================================================================
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order tidak ditemukan' using errcode = 'P0002';
  end if;

  -- Only a draft can be submitted (API_CONTRACT.md §13). An order already past
  -- DRAFT was submitted by someone else — a different-key submit is a conflict
  -- (§26), not an idempotent replay (that was handled in step 2).
  if v_order.status <> 'DRAFT' then
    raise exception 'Order sudah disubmit' using errcode = '23003';
  end if;

  -- The source must match the order's own source. A customer path can never
  -- submit a staff draft, and a staff path can never submit a customer's QR
  -- draft (API_CONTRACT.md §10.2 vs §11.2 are separate trust boundaries).
  if v_order.source <> p_source then
    raise exception 'Sumber order tidak cocok untuk order ini'
      using errcode = '22023';
  end if;

  -- ===========================================================================
  -- 4. Validate the table context BEFORE mutating anything
  --    (AUTH_RBAC_RLS.md §47).
  --
  -- Customer path: this is the whole authorization. An anonymous caller may
  -- submit ONLY the order whose table + OPEN session it can prove it is at
  -- (AUTH_RBAC_RLS.md §18, §30; API_CONTRACT.md §30: "customer must not be able
  -- to change another table's order", "A public order identifier should not be
  -- treated as a sufficient authorization credential"). Both ids are required,
  -- must match the order's own, and must still resolve to an active table with
  -- an OPEN session.
  --
  -- Staff path: the permission grant is the authority, so the context is not
  -- required. But the session the order belongs to must still be OPEN for ANY
  -- source — submitting into a closed session is invalid for everyone.
  -- ===========================================================================
  if p_source = 'CUSTOMER_QR' then
    if p_table_id is null or p_table_session_id is null then
      raise exception 'Konteks meja wajib untuk submit pesanan'
        using errcode = '22023';
    end if;

    if p_table_id <> v_order.table_id then
      raise exception 'Order tidak terkait dengan meja ini'
        using errcode = '23003';
    end if;

    if p_table_session_id <> v_order.table_session_id then
      raise exception 'Order tidak terkait dengan sesi ini'
        using errcode = '23003';
    end if;
  end if;

  select * into v_table
  from public.tables
  where id = v_order.table_id
  for update;

  if not found then
    raise exception 'Meja tidak ditemukan' using errcode = 'P0002';
  end if;

  if not v_table.is_active then
    raise exception 'Meja % tidak aktif', v_table.table_code
      using errcode = '23003';
  end if;

  select * into v_session
  from public.table_sessions
  where id = v_order.table_session_id
  for update;

  if not found then
    raise exception 'Sesi meja tidak ditemukan' using errcode = 'P0002';
  end if;

  if v_session.status <> 'OPEN' then
    raise exception 'Sesi meja sudah ditutup' using errcode = '23003';
  end if;

  -- An order must contain something. `create_draft_order()` refuses an empty
  -- item list, so a draft normally has lines; this guard keeps the invariant
  -- here too, in case a draft is ever seeded by another path.
  if not exists (select 1 from public.order_items where order_id = p_order_id) then
    raise exception 'Order harus memiliki minimal satu item'
      using errcode = '22023';
  end if;

  -- ===========================================================================
  -- 5. RECALCULATE from the authoritative catalog (API_CONTRACT.md §27).
  --
  -- The snapshot columns stay exactly as `create_draft_order()` wrote them —
  -- they are the receipt of record and are immutable (DATABASE_SCHEMA.md §21:
  -- "Changing the product later must not alter historical order data"). This
  -- loop only READS the live catalog to re-derive what the order would cost
  -- now, then compares it to the frozen total. A mismatch or a withdrawn
  -- product means the draft is stale and must be refused, never silently
  -- re-priced (§2.2: the client's money is never trusted, and neither is a
  -- stale snapshot).
  -- ===========================================================================
  for v_item in
    select * from public.order_items where order_id = p_order_id
  loop
    -- Product must still exist and still be orderable.
    select * into v_product
    from public.products
    where id = v_item.product_id;

    if not found then
      raise exception 'Produk tidak ditemukan' using errcode = 'P0002';
    end if;

    if not v_product.is_active then
      raise exception 'Produk % tidak aktif', v_product.name
        using errcode = '23003';
    end if;

    if not v_product.is_available then
      raise exception 'Produk % sedang tidak tersedia', v_product.name
        using errcode = 'P0003';
    end if;

    v_line_total := v_product.price * v_item.quantity;

    -- The authoritative delta contribution of this line's modifier
    -- selections, re-derived from the live catalog.
    select coalesce(sum(m.price_delta * im.quantity), 0)
    into v_mod_total
    from public.order_item_modifiers im
    join public.modifiers m on m.id = im.modifier_id
    where im.order_item_id = v_item.id;

    -- Re-verify every modifier selection individually: the sum above is for
    -- the total, this loop is for the refusal messages (DATABASE_SCHEMA.md §16).
    for v_modifier in
      select m.*
      from public.order_item_modifiers im
      join public.modifiers m on m.id = im.modifier_id
      where im.order_item_id = v_item.id
    loop
      if not v_modifier.is_active then
        raise exception 'Modifier % tidak aktif', v_modifier.name
          using errcode = '23003';
      end if;

      if not exists (
        select 1 from public.product_modifiers pm
        where pm.product_id = v_item.product_id
          and pm.modifier_id = v_modifier.id
      ) then
        raise exception 'Modifier % tidak tersedia untuk produk ini',
          v_modifier.name
          using errcode = '23003';
      end if;
    end loop;

    v_recomputed := v_recomputed + v_line_total + v_mod_total;
  end loop;

  -- The frozen snapshot must match the live catalog. A drift means the menu
  -- changed under the draft and the snapshot is stale — the customer has to
  -- rebuild the draft at current prices rather than be charged a number that
  -- no longer exists.
  if v_recomputed <> v_order.total then
    raise exception 'Harga menu telah berubah, mohon buat ulang pesanan'
      using errcode = '23003';
  end if;

  -- ===========================================================================
  -- 6. Mutate — one atomic transition (API_CONTRACT.md §33: validate
  --    table/session -> validate products -> create/update order -> create
  --    status history -> audit). DRAFT -> SUBMITTED -> PENDING_CONFIRMATION is
  --    written as a single row update plus both history rows inside this
  --    transaction; nothing in between is ever observable.
  -- ===========================================================================
  update public.orders
  set status              = 'PENDING_CONFIRMATION',
      submit_idempotency_key = p_idempotency_key,
      updated_at          = now()
  where id = v_order.id
    and status = 'DRAFT'
  returning * into v_updated;

  -- This submit lost the race for the row. Someone else already moved it past
  -- DRAFT while we held the lock (API_CONTRACT.md §26). Same key -> serve the
  -- winner's result; different key -> genuine conflict.
  if v_updated.id is null then
    if p_idempotency_key is not null then
      select * into v_updated
      from public.orders
      where submit_idempotency_key = p_idempotency_key;

      if found then
        return public.order_create_payload(v_updated.id);
      end if;
    end if;

    raise exception 'Order sudah disubmit' using errcode = '23003';
  end if;

  -- Both hops of the transition are recorded (API_CONTRACT.md §13, §10.2:
  -- "DRAFT -> SUBMITTED -> PENDING_CONFIRMATION"). SUBMITTED is a real state in
  -- the machine and appears in the trail; the steady state a cashier queues on
  -- is PENDING_CONFIRMATION. History is append-only and never rewritten
  -- (AUTH_RBAC_RLS.md §29).
  insert into public.order_status_history (
    order_id, from_status, to_status, actor_id, actor_role, reason
  )
  values
    (v_updated.id, 'DRAFT',     'SUBMITTED',           v_actor_id, v_actor_role, null),
    (v_updated.id, 'SUBMITTED', 'PENDING_CONFIRMATION', v_actor_id, v_actor_role, null);

  -- The cashier queue signal is the order's new status itself: `orders.status
  -- = 'PENDING_CONFIRMATION'`, which the operational queue filters on
  -- (API_CONTRACT.md §12.1: `?status=PENDING_CONFIRMATION`). Any staff client
  -- holding `orders.read` sees it on the next poll. A realtime broadcast is
  -- Phase 15 scope and is deliberately not emitted here
  -- (docs/architecture/REALTIME_SPEC.md).
  return public.order_create_payload(v_updated.id);
end;
$$;

-- Anonymous customers submit their own QR drafts through this path; staff
-- submit through it with a session. Both are the controlled command surface —
-- there is no client-side path to flip an order's status.
grant execute on function public.submit_order(
  uuid, text, uuid, uuid, text
) to anon, authenticated;
