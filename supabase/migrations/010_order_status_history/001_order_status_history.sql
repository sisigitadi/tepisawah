-- =============================================================================
-- Tepi Sawah — Migration 010 (part 1): Order status history.
--
-- Source: docs/database/DATABASE_SCHEMA.md §23 (order_status_history),
-- docs/database/DATABASE_MIGRATION_PLAN.md §24 (Migration 019 — Order Status
-- History: "immutable-oriented audit trail untuk lifecycle order"; "Jangan
-- menghapus history hanya karena order selesai"),
-- docs/security/AUTH_RBAC_RLS.md §29 (RLS Pattern: Order Status History —
-- append-oriented; "Users should not directly edit historical transitions"),
-- §30 (audit events are append-only).
--
-- Every status change appends one row; the current status lives on
-- `orders.status`. Nothing here is ever UPDATEd or DELETEd from the client —
-- there are no grants for it. The first row of every order is
-- `from_status = null, to_status = 'DRAFT'`, written by the create command
-- itself so an order's birth is part of its trail.
--
-- `actor_role` records the role the actor used, not the actor's current role:
-- if a cashier is later demoted, the audit still says a cashier confirmed.
-- =============================================================================
create table if not exists public.order_status_history (
  id          uuid         primary key default gen_random_uuid(),
  order_id    uuid         not null references public.orders(id) on delete cascade,
  from_status text         null,
  to_status   text         not null,
  actor_id    uuid         null references public.profiles(id),
  actor_role  text         null,
  reason      text         null,
  created_at  timestamptz not null default now()
);

create index if not exists order_status_history_order_id_created_at_idx
  on public.order_status_history (order_id, created_at);

alter table public.order_status_history enable row level security;

-- Append-oriented reads: staff with `orders.read` may follow an order's trail.
-- (AUTH_RBAC_RLS.md §46: audit visibility is limited; the customer projection
-- never includes history — that is §30's "audit details" exclusion.)
create policy order_status_history_staff_read on public.order_status_history
  for select to authenticated
  using (
    public.current_user_is_active()
    and public.has_permission('orders.read')
  );

-- INSERT/UPDATE/DELETE are never granted. History is written only by the
-- server-side transition commands, each of which is SECURITY DEFINER and
-- re-checks its own authorization (AUTH_RBAC_RLS.md §29). No client can
-- rewrite or delete the past.
revoke insert, update, delete on public.order_status_history from anon, authenticated;
