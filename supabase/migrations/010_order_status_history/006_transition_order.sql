-- =============================================================================
-- Tepi Sawah — Migration 010 (part 6): The centralized order state transition
-- engine.
--
-- Source: docs/api/API_CONTRACT.md §13 (Order State Transition API:
-- "Gunakan satu command terpusat" — POST /orders/:id/transition; the backend
-- must determine the actor from the authenticated session and check current
-- status, requested status, actor role, permission, business rule,
-- concurrency/version and idempotency), §26 (Concurrency Control: row-level
-- lock + optimistic version + atomic conditional update + idempotency; a
-- duplicate returns the idempotent result, a conflict receives 409),
-- §33 (transaction boundaries), §2.2 (never trust client status),
-- docs/security/AUTH_RBAC_RLS.md §21-§22 (authorization helpers),
-- §29 (history is append-only and is written only by server-side transition
-- commands), §34 (SECURITY DEFINER rules: pinned search_path, no dynamic SQL),
-- §47 (validate before you mutate), docs/implementation/
-- CLINE_IMPLEMENTATION_PLAN.md §17 (Phase 8C — one transition command).
--
-- =============================================================================
-- WHY ONE COMMAND
-- =============================================================================
--
-- Order status is a state machine, and the machine lives here. Before this,
-- the only status mutation was the atomic hop inside `submit_order()`; every
-- later hop — confirm, reject, start, ready, serve, paid, complete, cancel,
-- refund — funnels through `transition_order()` instead. There is no other
-- server-side writer of `orders.status` and no client-side path at all:
-- `orders` has no anon update grant (migration 008 part 1) and staff RLS is
-- read-only on orders. A module that wants to move an order calls this
-- command; it never re-implements a guard, so a rule change is one edit here
-- and reaches every actor surface (API_CONTRACT.md §13: "Gunakan satu command
-- terpusat").
--
-- The one deliberate exception is the DRAFT exit. Leaving DRAFT means
-- submitting, and submitting means re-deriving the total from the live catalog
-- to refuse a stale price (API_CONTRACT.md §27). That validation belongs to
-- `submit_order()`, so DRAFT -> SUBMITTED stays there and this engine has no
-- such rule: calling it on a DRAFT fails closed, and there is no way to skip
-- the price check. The SUBMITTED -> PENDING_CONFIRMATION hop the submit command
-- writes atomically IS in this engine's rule table, because a rest order must
-- never get stuck in a state the machine cannot describe.
--
-- =============================================================================
-- WHAT THE COMMAND ENFORCES, IN ORDER
-- =============================================================================
--
--   1. ACTOR (API_CONTRACT.md §13: "Backend harus menentukan actor berdasarkan
--      authenticated session"). Anonymous cannot transition an order. The
--      caller must be authenticated AND active (AUTH_RBAC_RLS.md §14: an
--      inactive account holds no permissions, so this fails closed).
--   2. TARGET VOCABULARY. The requested status must be a real state in the
--      machine; an unknown string is refused, never coerced
--      (DATABASE_MIGRATION_PLAN.md §21).
--   3. LOAD AND LOCK. SELECT ... FOR UPDATE serializes concurrent transitions
--      of the same order (API_CONTRACT.md §26).
--   4. IDEMPOTENCY. An order already at the requested status is a no-op
--      success: the current order is returned and NO new history row is
--      written. A double-tap, a retry after a network blur, and two staff
--      clients that both pressed the same button all resolve to one
--      transition and one audit entry.
--   5. CONCURRENCY/VERSION. When the caller sends the version it rendered, a
--      mismatch is a 409 (§26): someone else moved the order first, and the
--      caller must reload.
--   6. THE RULE. The (current -> requested) pair must exist in the rule table
--      below. Backward transitions, self-transitions other than the idempotent
--      no-op above, hops out of terminal states, and every pair the machine
--      does not know are refused. There is no backward path by default.
--   7. PERMISSION. Each rule carries the permission that authorizes it. The
--      check goes through `has_permission()`, which is the union over the
--      caller's roles gated by the active-profile check — so a revoked role or
--      a disabled account stops authorizing immediately (AUTH_RBAC_RLS.md
--      §12, §14, §22).
--   8. REASON. Every exceptional transition (cancel, refund) requires a
--      non-empty reason and an audit row (API_CONTRACT.md §13:
--      "Every exceptional transition requires reason and audit").
--   9. MUTATE. One conditional UPDATE moves the status and bumps the version;
--      if it matches nothing, the order changed under the caller and it is a
--      409. The history row is appended in the same transaction, so a
--      partially-committed transition is impossible (§33).
--
-- The returned payload is the same `{order, items, modifiers}` shape the create
-- and submit commands return, so every caller renders one order shape.
-- =============================================================================
-- The rule table: every (from, to) pair the machine permits, with the
-- permission that authorizes it and whether a reason is mandatory. This is the
-- single source of the graph — the engine is its only reader, and no client
-- module re-declares any of it (API_CONTRACT.md §13; MASTER prompt: "Do not
-- duplicate state transition rules in frontend modules").
--
-- Permission mapping follows the actor table in API_CONTRACT.md §13 against the
-- seeded baseline (AUTH_RBAC_RLS.md §9): confirm/reject for the cashier line,
-- kitchen.start/ready for the kitchen line, orders.serve for the service line,
-- payments.create for the payment line, orders.cancel / payments.refund for the
-- exceptional line. `orders.serve` is the permission for the §9 "Mark Served"
-- grant.
-- =============================================================================
create or replace function public.order_transition_rule(
  p_from text,
  p_to   text,
  out required_permission text,
  out requires_reason     boolean
)
returns record
language sql
stable
security definer
set search_path = public
as $$
  select required_permission, requires_reason
  from (values
    -- Normal forward flow (API_CONTRACT.md §13, ORDER STATE in MASTER prompt).
    -- DRAFT -> SUBMITTED is deliberately absent: it belongs to submit_order(),
    -- which re-derives the price first (API_CONTRACT.md §27).
    ('SUBMITTED',           'PENDING_CONFIRMATION', 'orders.transition', false),
    ('PENDING_CONFIRMATION','CONFIRMED',            'orders.confirm',    false),
    ('PENDING_CONFIRMATION','REJECTED',             'orders.reject',     false),
    ('CONFIRMED',           'PREPARING',            'kitchen.start',     false),
    ('PREPARING',           'READY',                'kitchen.ready',     false),
    ('READY',               'SERVED',               'orders.serve',      false),
    ('SERVED',              'PAID',                 'payments.create',   false),
    ('PAID',                'COMPLETED',            'payments.create',   false),
    -- Exceptional flow: reason + audit are mandatory for each of these
    -- (API_CONTRACT.md §13 "Exceptional").
    ('CONFIRMED',           'CANCELLED',            'orders.cancel',     true),
    ('PREPARING',           'CANCELLED',            'orders.cancel',     true),
    ('PAID',                'REFUNDED',             'payments.refund',   true)
  ) as t(from_status, to_status, required_permission, requires_reason)
  where t.from_status = p_from
    and t.to_status   = p_to
$$;

comment on function public.order_transition_rule(text, text) is
  'The order state machine: the single (from, to) -> permission/reason table the transition engine enforces. NULL for any pair the machine does not permit, including every backward hop.';

-- =============================================================================
-- The command.
-- =============================================================================
create or replace function public.transition_order(
  p_order_id         uuid,
  p_to_status        text,
  p_reason           text default null,
  p_expected_version bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule        record;
  v_order       public.orders%rowtype;
  v_updated     public.orders%rowtype;
  v_prev_status text;
  v_actor_id    uuid := public.auth_user_id();
  v_actor_role  text;
  v_reason      text;
begin
  -- ===========================================================================
  -- 1. ACTOR — an authenticated, active staff member. Anonymous has no path to
  --    this command; the anonymous order path is the context-authorized
  --    `submit_order()` and it never reaches the transition engine
  --    (API_CONTRACT.md §13, §30; AUTH_RBAC_RLS.md §14, §34).
  -- ===========================================================================
  if v_actor_id is null or not public.current_user_is_active() then
    raise exception 'Not authorized to transition orders'
      using errcode = '42501';
  end if;

  -- ===========================================================================
  -- 2. TARGET VOCABULARY — the requested status must be a state the machine
  --    knows (DATABASE_MIGRATION_PLAN.md §21: no arbitrary status strings).
  -- ===========================================================================
  if p_to_status is null or p_to_status not in (
       'DRAFT', 'SUBMITTED', 'PENDING_CONFIRMATION', 'CONFIRMED', 'PREPARING',
       'READY', 'SERVED', 'PAID', 'COMPLETED',
       'CANCELLED', 'REJECTED', 'VOID', 'REFUNDED'
     )
  then
    raise exception 'Status tujuan tidak valid' using errcode = '22023';
  end if;

  -- ===========================================================================
  -- 3. LOAD AND LOCK the row (API_CONTRACT.md §26: row-level lock). Two
  --    concurrent transitions of the same order serialize here; the second one
  --    observes the first one's result instead of racing it.
  -- ===========================================================================
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order tidak ditemukan' using errcode = 'P0002';
  end if;

  -- ===========================================================================
  -- 4. IDEMPOTENCY (API_CONTRACT.md §13, §26: "duplicate request returns
  --    idempotent result"). An order already at the requested status is a
  --    no-op: return the current order, append nothing, bump nothing. A
  --    double-tap by the same actor and a race where the other caller won
  --    both land here.
  -- ===========================================================================
  if v_order.status = p_to_status then
    return public.order_create_payload(v_order.id);
  end if;

  -- ===========================================================================
  -- 5. CONCURRENCY / VERSION (API_CONTRACT.md §13 item 6, §26: optimistic
  --    version). The caller that rendered this order sends the version it saw;
  --    a mismatch means the order moved since and this request is stale. It is
  --    refused as a conflict rather than blindly applied over the newer state.
  -- ===========================================================================
  if p_expected_version is not null
     and v_order.version is distinct from p_expected_version
  then
    raise exception 'Versi order telah berubah, mohon muat ulang order'
      using errcode = '40001';
  end if;

  -- ===========================================================================
  -- 6. THE RULE — the (current -> requested) pair must be permitted. This is
  --    where backward transitions, hops out of terminal states, and every pair
  --    the machine does not describe are refused. There is no backward path
  --    and no implicit superuser bypass.
  -- ===========================================================================
  select * into v_rule
  from public.order_transition_rule(v_order.status, p_to_status);

  if v_rule.required_permission is null then
    raise exception 'Transisi % -> % tidak diizinkan', v_order.status, p_to_status
      using errcode = '23003';
  end if;

  -- ===========================================================================
  -- 7. PERMISSION (AUTH_RBAC_RLS.md §22, §38). `has_permission()` resolves the
  --    union over the caller's roles with the active-profile gate built in, so
  --    this is the authority — not a role name the client sent (API_CONTRACT.md
  --    §2.2: never trust a client role).
  -- ===========================================================================
  if not public.has_permission(v_rule.required_permission) then
    raise exception 'Not authorized untuk transisi % -> %', v_order.status, p_to_status
      using errcode = '42501';
  end if;

  -- ===========================================================================
  -- 8. REASON where required (API_CONTRACT.md §13: "Every exceptional
  --    transition requires reason and audit"). A whitespace-only reason is no
  --    reason at all.
  -- ===========================================================================
  v_reason := nullif(btrim(coalesce(p_reason, '')), '');

  if v_rule.requires_reason and v_reason is null then
    raise exception 'Alasan wajib untuk transisi % -> %', v_order.status, p_to_status
      using errcode = '22023';
  end if;

  -- The audit row records the role the actor used, not the actor's current
  -- role (migration 010 part 1): if a cashier is later demoted, the trail
  -- still says a cashier confirmed.
  select r.code into v_actor_role
  from public.role_permissions rp
  join public.permissions p on p.id = rp.permission_id
  join public.roles r on r.id = rp.role_id
  where p.code = v_rule.required_permission
    and rp.role_id in (
          select ur.role_id from public.user_roles ur
          where ur.user_id = v_actor_id
        )
  order by r.code
  limit 1;

  -- ===========================================================================
  -- 9. MUTATE — one atomic conditional update (API_CONTRACT.md §26, §33).
  --    The status + version guards are belt-and-braces under the row lock: if
  --    they match nothing, the order changed under this caller and the whole
  --    transaction aborts as a conflict rather than committing a partial
  --    transition.
  -- ===========================================================================
  v_prev_status := v_order.status;

  update public.orders
  set status     = p_to_status,
      version    = version + 1,
      updated_at = now()
  where id = v_order.id
    and status = v_prev_status
    and version = v_order.version
  returning * into v_updated;

  if v_updated.id is null then
    raise exception 'Order sudah berubah, mohon muat ulang order'
      using errcode = '40001';
  end if;

  -- Append-only audit (AUTH_RBAC_RLS.md §29: history is written only by the
  -- server-side transition commands; no client grant exists on this table).
  -- A reason supplied on a normal transition is recorded too — it is useful
  -- context and the caller sent it voluntarily.
  insert into public.order_status_history (
    order_id, from_status, to_status, actor_id, actor_role, reason
  )
  values (
    v_updated.id, v_prev_status, p_to_status, v_actor_id, v_actor_role, v_reason
  );

  return public.order_create_payload(v_updated.id);
end;
$$;

comment on function public.transition_order(uuid, text, text, bigint) is
  'The single authority for order state transitions. Derives the actor from the authenticated session, checks current status, requested status, permission, reason-where-required, version/concurrency and idempotency, then moves the row and appends the audit history atomically. No backward transitions; no client-side status writes exist.';

-- Staff call this command; anonymous customers never can (their order path is
-- submit_order()). The grant is wide, the logic inside is the gate
-- (AUTH_RBAC_RLS.md §34: expose minimum capability).
grant execute on function public.transition_order(uuid, text, text, bigint)
  to authenticated;

-- The rule table is callable for staff tooling (e.g. deciding which actions to
-- offer); it answers a question about the machine, never about row data.
grant execute on function public.order_transition_rule(text, text)
  to authenticated;
