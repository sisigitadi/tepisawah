-- =============================================================================
-- Tepi Sawah — Migration 010 (part 2): Draft order creation command.
--
-- Source: docs/api/API_CONTRACT.md §10.1 (Create Draft Order), §11.1 (Create
-- Waiter Order), §2.2 (Security — never trust client price/total/role/status),
-- §2.3 (Idempotency-Key), §13 (order state machine: DRAFT is the entry state),
-- docs/database/DATABASE_SCHEMA.md §20-§23, §20 rules ("inactive products
-- cannot be ordered", "unavailable products cannot be ordered", "frontend
-- price is never authoritative", "Order totals must be calculated/validated
-- server-side"), §16 ("Selection behavior must be validated server-side"),
-- docs/security/AUTH_RBAC_RLS.md §27 (orders), §28 (items/modifiers inherit),
-- §34 (SECURITY DEFINER rules), §46 (idempotency), §47 (validate before
-- mutate), docs/implementation/CLINE_IMPLEMENTATION_PLAN.md §14 (Phase 8A).
--
-- =============================================================================
-- WHAT THIS COMMAND IS
-- =============================================================================
--
-- The single authority for order creation. A caller may send ONLY:
--
--     source          CUSTOMER_QR | WAITER | POS
--     tableId         which table this order belongs to
--     tableSessionId  the OPEN session this order joins
--     items[]         { productId, quantity, modifierIds[], notes }
--     customerNote    order-level note from the customer
--     internalNote    staff-only note (WAITER/POS only; never shown to
--                     customers — AUTH_RBAC_RLS.md §46)
--     idempotencyKey  the client's dedup key
--
-- It may NOT send, and this function does not accept, any money value: no
-- unit price, no line total, no subtotal, discount, tax or total, and no
-- status or payment field (API_CONTRACT.md §10.1, §2.2). Prices are looked up
-- from the live catalog inside this transaction and snapshotted onto the item
-- rows; totals are computed and written here. The client cannot tamper with a
-- price because there is no parameter to tamper with.
--
-- Authorization is re-checked inside the transaction (AUTH_RBAC_RLS.md §47):
-- a customer draft may be created anonymously, but ONLY through a validated
-- table context — the table must be active and the session must be OPEN and
-- must belong to that table. An anonymous caller cannot create an order for a
-- table they have no valid context for. A waiter/POS draft additionally
-- requires an authenticated, active staff account holding
-- `orders.create_manual`.
--
-- Idempotency (§2.3, §46): the client's key is stored on the order under a
-- unique index. A repeat create with the same key returns the order that the
-- first create produced — the same id, the same number, the same totals. Two
-- concurrent creates with the same key race on the unique index: the loser's
-- INSERT is absorbed by `on conflict do nothing` and the RPC then reads the
-- winner's order and serves it, so a double-tap or a network retry yields one
-- order, not two.
--
-- Validation happens BEFORE any write (§47): the whole item list is validated
-- and priced first, and only then does a single INSERT run. A rejected create
-- leaves no order row, no item rows, no history, and no consumed order number
-- that has to be explained away on a receipt.
--
-- Table session association: the order is linked to its session via
-- `orders.table_session_id`, the canonical relationship in DATABASE_SCHEMA.md
-- §20. `attach_order_to_session()` (migration 007 part 3) is NOT called: that
-- path requires `table_sessions.manage`, which a customer cannot hold, and the
-- gate review for Phase 7 flagged the separate link table as a second
-- representation of the same fact. Orders now carry the relationship directly.
--
-- Note on tax and discount: both are written as 0 for a draft. Tax is a
-- business rule the project has deliberately not fixed (payment/tax rules are
-- undecided; the prototype's PB1 must not become a production rule), and a
-- discount engine does not exist yet. The totals still reconcile because the
-- CHECK on `orders` enforces `total = subtotal - discount + tax`; when a real
-- rule arrives it will be applied here, server-side, and existing orders will
-- be unaffected (their snapshots are already frozen).
-- =============================================================================
create or replace function public.create_draft_order(
  p_source          text,
  p_table_id        uuid,
  p_table_session_id uuid,
  p_items           jsonb,
  p_customer_note   text default null,
  p_internal_note   text default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order        public.orders%rowtype;
  v_table        public.tables%rowtype;
  v_session      public.table_sessions%rowtype;
  v_product      public.products%rowtype;
  v_modifier     public.modifiers%rowtype;
  v_items        jsonb;
  v_item         jsonb;
  v_mod_ids      uuid[];
  v_mod_id       uuid;
  v_product_mods record;
  v_selected     int;
  v_unit_price   numeric(12,2);
  v_line_total   numeric(12,2);
  v_subtotal     numeric(12,2) := 0;
  v_new_id       uuid := gen_random_uuid();
  v_item_id      uuid;
  v_order_number text;
  v_actor_id     uuid;
  v_actor_role   text;
  v_max          int;
  v_i            int;
begin
  -- ===========================================================================
  -- 1. Authorize.
  -- ===========================================================================
  -- Source must be a known value; an unknown source is never silently coerced
  -- (DATABASE_MIGRATION_PLAN.md §21: no arbitrary strings).
  if p_source is null or not (p_source in ('CUSTOMER_QR', 'WAITER', 'POS')) then
    raise exception 'Sumber order tidak valid' using errcode = '22023';
  end if;

  if p_source in ('WAITER', 'POS') then
    -- Staff manual order: must be an authenticated, active account holding the
    -- manual-order permission (API_CONTRACT.md §11.1, AUTH_RBAC_RLS.md §8).
    -- The role is recorded from the effective grant, not trusted from input.
    if public.auth_user_id() is null or not public.current_user_is_active()
       or not public.has_permission('orders.create_manual')
    then
      raise exception 'Not authorized to create manual orders'
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
    -- Customer QR draft: anonymous is allowed (API_CONTRACT.md §3), but the
    -- table context below must still validate. No staff actor is recorded.
    v_actor_id := null;
    v_actor_role := null;
  end if;

  -- ===========================================================================
  -- 2. Validate the table context before mutating anything (AUTH_RBAC_RLS.md
  --    §47). This is the controlled-public-access boundary for an anonymous
  --    caller: the table must exist and be active, and the session must be
  --    OPEN and must belong to this table (AUTH_RBAC_RLS.md §18 — a QR/token
  --    grants its own table context, nothing more).
  -- ===========================================================================
  select * into v_table
  from public.tables
  where id = p_table_id
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
  where id = p_table_session_id
  for update;

  if not found then
    raise exception 'Sesi meja tidak ditemukan' using errcode = 'P0002';
  end if;

  if v_session.status <> 'OPEN' then
    raise exception 'Sesi meja sudah ditutup' using errcode = '23003';
  end if;

  if v_session.table_id <> p_table_id then
    raise exception 'Sesi tidak terhubung ke meja ini' using errcode = '23003';
  end if;

  -- An order must contain something. `jsonb_typeof` is checked first because a
  -- non-array payload (an object or a scalar) makes `jsonb_array_length` NULL,
  -- which would neither trip this guard nor iterate the loop (a client that
  -- sends `p_items: {"a": 1}` is not a valid request, and must not fall through
  -- to an empty order). An empty items array is a client bug, not an order.
  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0
  then
    raise exception 'Order harus memiliki minimal satu item'
      using errcode = '22023';
  end if;

  -- ===========================================================================
  -- 3. Idempotency — check before mutate (AUTH_RBAC_RLS.md §46). A repeat with
  --    the same key returns the first result verbatim (API_CONTRACT.md §2.3:
  --    "Backend harus mengembalikan hasil yang sama"), including its snapshot
  --    lines, assembled by `order_create_payload()` below.
  -- ===========================================================================
  if p_idempotency_key is not null then
    select * into v_order
    from public.orders
    where idempotency_key = p_idempotency_key;

    if found then
      return public.order_create_payload(v_order.id);
    end if;
  end if;

  -- ===========================================================================
  -- 4. Validate and price EVERY item from the authoritative catalog, before
  --    writing a single row. The client sent references only; the prices come
  --    from `products` and `modifiers` (DATABASE_SCHEMA.md §20 rules).
  -- ===========================================================================
  v_items := coalesce(p_items, '[]'::jsonb);

  for v_i in 0..jsonb_array_length(v_items) - 1 loop
    v_item := v_items->v_i;

    -- ---- quantity ----------------------------------------------------------
    -- Positive, and capped so a stray client value cannot produce an absurd
    -- line. The schema allows fractional quantity (numeric(12,3)); it just
    -- must be > 0 and sane.
    if (v_item->>'quantity')::numeric is null
       or (v_item->>'quantity')::numeric <= 0
       or (v_item->>'quantity')::numeric > 999
    then
      raise exception 'Jumlah item tidak valid' using errcode = '22023';
    end if;

    -- ---- product -----------------------------------------------------------
    select * into v_product
    from public.products
    where id = (v_item->>'productId')::uuid
    for update;

    if not found then
      raise exception 'Produk tidak ditemukan' using errcode = 'P0002';
    end if;

    -- Inactive = archived from the menu; unavailable = temporarily 86'd. Neither
    -- can be ordered (DATABASE_SCHEMA.md §20 rules).
    if not v_product.is_active then
      raise exception 'Produk % tidak aktif', v_product.name
        using errcode = '23003';
    end if;

    if not v_product.is_available then
      raise exception 'Produk % sedang tidak tersedia', v_product.name
        using errcode = 'P0003';
    end if;

    v_unit_price := v_product.price;
    v_line_total := v_unit_price * (v_item->>'quantity')::numeric;

    -- ---- modifiers ---------------------------------------------------------
    -- Each id must exist, be active, and be genuinely applicable to THIS
    -- product via `product_modifiers` (DATABASE_SCHEMA.md §16). A modifier
    -- from a different product is an invalid modifier, refused rather than
    -- priced (API_CONTRACT.md test list: "invalid modifier").
    v_mod_ids := coalesce(
      array(select (jsonb_array_elements_text(v_item->'modifierIds'))::uuid),
      array[]::uuid[]
    );

    foreach v_mod_id in array v_mod_ids loop
      select * into v_modifier
      from public.modifiers
      where id = v_mod_id;

      if not found then
        raise exception 'Modifier tidak ditemukan' using errcode = 'P0002';
      end if;

      if not v_modifier.is_active then
        raise exception 'Modifier % tidak aktif', v_modifier.name
          using errcode = '23003';
      end if;

      if not exists (
        select 1 from public.product_modifiers pm
        where pm.product_id = v_product.id and pm.modifier_id = v_mod_id
      ) then
        raise exception 'Modifier % tidak tersedia untuk produk ini', v_modifier.name
          using errcode = '23003';
      end if;

      -- The authoritative delta, multiplied by the item quantity — the
      -- snapshot row below records exactly this contribution.
      v_line_total := v_line_total
        + v_modifier.price_delta * (v_item->>'quantity')::numeric;
    end loop;

    -- ---- selection rules per modifier group (DATABASE_SCHEMA.md §16:
    --      "Selection behavior must be validated server-side") -------------
    -- A required group must receive at least its minimum; a bounded group must
    -- not exceed its maximum. Both are enforced here, not in the UI.
    for v_product_mods in
      select pm.modifier_id, m.name, pm.is_required, pm.min_select, pm.max_select
      from public.product_modifiers pm
      join public.modifiers m on m.id = pm.modifier_id
      where pm.product_id = v_product.id
        and m.is_active
    loop
      v_selected := (
        select count(*) from unnest(v_mod_ids) as sel(id)
        where sel.id = v_product_mods.modifier_id
      );

      if v_product_mods.is_required and v_selected < v_product_mods.min_select then
        raise exception 'Modifier % wajib dipilih untuk produk ini',
          v_product_mods.name
          using errcode = '23003';
      end if;

      v_max := coalesce(v_product_mods.max_select, 0);
      if v_max > 0 and v_selected > v_max then
        raise exception 'Modifier % melebihi jumlah maksimal', v_product_mods.name
          using errcode = '23003';
      end if;
    end loop;

    v_subtotal := v_subtotal + v_line_total;
  end loop;

  -- ===========================================================================
  -- 5. Mutate — one transaction, all rows or none.
  -- ===========================================================================
  v_order_number := 'TS-' || to_char(now(), 'YYYYMMDD')
                    || '-' || lpad(nextval('order_number_seq')::text, 4, '0');

  insert into public.orders (
    id, order_number, table_id, table_session_id, source, status,
    notes, subtotal, discount, tax, total, idempotency_key, created_by
  )
  values (
    v_new_id, v_order_number, p_table_id, p_table_session_id, p_source, 'DRAFT',
    -- Staff internal note is never merged into the customer-visible note
    -- (AUTH_RBAC_RLS.md §46: customer note is own/context, internal is staff).
    p_customer_note,
    v_subtotal, 0, 0, v_subtotal,
    p_idempotency_key, v_actor_id
  )
  -- A concurrent create with the same key already won the unique index; this
  -- insert does nothing and the block below serves that winner instead. The
  -- conflict is turned into a read of the winner, never surfaced as an error
  -- (API_CONTRACT.md §2.3: same key must yield the same result).
  on conflict (idempotency_key) do nothing
  returning * into v_order;

  -- This create lost the race for the key. `v_order` is untouched by the
  -- no-op insert, so serve the order the winner wrote — same id, same totals,
  -- same snapshot lines — and leave the caller none the wiser about the race.
  if v_order.id is null then
    select * into v_order
    from public.orders
    where idempotency_key = p_idempotency_key;

    if not found then
      raise exception 'Order tidak dapat dibuat' using errcode = 'P0003';
    end if;

    return public.order_create_payload(v_order.id);
  end if;

  -- Items + their modifier selections, snapshotted from the catalog values
  -- read above. The client never sees these columns being written from its
  -- own input — it sent ids, and the server wrote the prices (§21, §22).
  for v_i in 0..jsonb_array_length(v_items) - 1 loop
    v_item := v_items->v_i;

    select * into v_product
    from public.products
    where id = (v_item->>'productId')::uuid;

    v_unit_price := v_product.price;
    v_line_total := v_unit_price * (v_item->>'quantity')::numeric;

    v_mod_ids := coalesce(
      array(select (jsonb_array_elements_text(v_item->'modifierIds'))::uuid),
      array[]::uuid[]
    );

    foreach v_mod_id in array v_mod_ids loop
      select * into v_modifier from public.modifiers where id = v_mod_id;
      v_line_total := v_line_total
        + v_modifier.price_delta * (v_item->>'quantity')::numeric;
    end loop;

    insert into public.order_items (
      order_id, product_id, product_name_snapshot, unit_price_snapshot,
      quantity, notes, line_total
    )
    values (
      v_new_id, v_product.id, v_product.name, v_unit_price,
      (v_item->>'quantity')::numeric, v_item->>'notes', v_line_total
    )
    returning id into v_item_id;

    foreach v_mod_id in array v_mod_ids loop
      select * into v_modifier from public.modifiers where id = v_mod_id;

      insert into public.order_item_modifiers (
        order_item_id, modifier_id, modifier_name_snapshot,
        price_delta_snapshot, quantity
      )
      values (
        v_item_id, v_modifier.id, v_modifier.name, v_modifier.price_delta,
        (v_item->>'quantity')::numeric
      );
    end loop;
  end loop;

  -- Birth event of the audit trail (DATABASE_SCHEMA.md §23).
  insert into public.order_status_history (
    order_id, from_status, to_status, actor_id, actor_role, reason
  )
  values (v_new_id, null, 'DRAFT', v_actor_id, v_actor_role, null);

  return public.order_create_payload(v_new_id);
end;
$$;

-- =============================================================================
-- order_create_payload(): assemble the create result.
--
-- The created order's snapshot lines live in `order_items` /
-- `order_item_modifiers`, whose read policies are granted to `authenticated`
-- only (migration 009). An anonymous customer holds no read grant there, so a
-- second, RLS-gated round trip after the create would come back silently empty —
-- exactly the partial record this command must never produce. Reading the lines
-- inside this SECURITY DEFINER frame and returning them with the order gives
-- every caller — anonymous customer included — the complete order the server
-- just wrote (AUTH_RBAC_RLS.md §27: customers reach orders only through this
-- controlled public path; §28: items inherit from the order).
--
-- The function is internal: EXECUTE is revoked from every client role below,
-- so the only caller is `create_draft_order()`. It cannot be used to read an
-- arbitrary order by id.
-- =============================================================================
create or replace function public.order_create_payload(p_order_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'order', to_jsonb(o),
    'items', coalesce((
      select jsonb_agg(to_jsonb(i) order by i.created_at, i.id)
      from public.order_items i
      where i.order_id = p_order_id
    ), '[]'::jsonb),
    'modifiers', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.created_at, m.id)
      from public.order_item_modifiers m
      where m.order_item_id in (
        select i.id from public.order_items i where i.order_id = p_order_id
      )
    ), '[]'::jsonb)
  )
  from public.orders o
  where o.id = p_order_id;
$$;

revoke execute on function public.order_create_payload(uuid)
  from public, anon, authenticated;

grant execute on function public.create_draft_order(
  text, uuid, uuid, jsonb, text, text, text
) to anon, authenticated;
