-- =============================================================================
-- Tepi Sawah — Migration 008 (part 1): Orders.
--
-- Source: docs/database/DATABASE_SCHEMA.md §20 (orders),
-- docs/database/DATABASE_MIGRATION_PLAN.md §21 (Migration 016 — Orders:
-- "Jangan mengizinkan arbitrary status string tanpa validation"),
-- docs/api/API_CONTRACT.md §10.1 (Create Draft Order), §13 (order state
-- machine), §2.3 (Idempotency-Key),
-- docs/security/AUTH_RBAC_RLS.md §20 (RLS list), §21 (six questions),
-- §27 (RLS Pattern: Orders — customers reach orders only through controlled
-- public ordering paths), §34 (SECURITY DEFINER rules), §46 (idempotency),
-- §47 (validate before mutate),
-- docs/implementation/CLINE_IMPLEMENTATION_PLAN.md §14 (Phase 8A).
--
-- CRITICAL — the whole point of this table (API_CONTRACT.md §10.1):
-- `subtotal`, `discount`, `tax` and `total` are computed by the backend from
-- authoritative catalog data. A client may send only product/modifier
-- references, quantity and notes. The `create_draft_order()` RPC in
-- migration 010 part 2 is the only INSERT path: it reads `products.price` and
-- `modifiers.price_delta` itself, snapshots them onto the item rows, and sums
-- the totals here. No client-supplied money value is ever written, so there is
-- no column to tamper with — the columns simply are not in the grant list and
-- the RPC never accepts them as parameters.
--
-- The totals are additionally constrained by a CHECK: `total = subtotal -
-- discount + tax`. Even a buggy caller cannot store an inconsistent order.
--
-- `idempotency_key` makes a retried create return the same order instead of a
-- duplicate (API_CONTRACT.md §2.3). It is the client's key, stored once, with a
-- unique index so a second create with the same key fails the index and the
-- RPC turns that into a reuse of the winner — the same race-proof shape used
-- for table sessions in migration 007.
-- =============================================================================
create sequence if not exists public.order_number_seq as bigint start 1;

create table if not exists public.orders (
  id               uuid          primary key default gen_random_uuid(),
  order_number     text          not null,
  table_id         uuid          not null references public.tables(id),
  table_session_id uuid          not null references public.table_sessions(id),
  source           text          not null,
  status           text          not null default 'DRAFT',
  notes            text          null,
  subtotal         numeric(12,2) not null default 0,
  discount         numeric(12,2) not null default 0,
  tax              numeric(12,2) not null default 0,
  total            numeric(12,2) not null default 0,
  idempotency_key  text          null,
  created_by       uuid          null references public.profiles(id),
  created_at       timestamptz  not null default now(),
  updated_at       timestamptz  not null default now(),

  -- The order number is the human-facing handle (TS-YYYYMMDD-NNNN); the id is
  -- the join key. Only order_number is unique-constrained for display.
  constraint orders_order_number_unique unique (order_number),

  -- The idempotency key is unique when present. NULL keys (a client that did
  -- not send one) are allowed and are simply not deduplicated.
  constraint orders_idempotency_key_unique unique (idempotency_key),

  -- Source vocabulary (DATABASE_SCHEMA.md §20). POS drafts share the waiter
  -- command path; a customer draft is always CUSTOMER_QR.
  constraint orders_source_vocabulary check (
    source in ('CUSTOMER_QR', 'WAITER', 'POS')
  ),

  -- The full order state machine, including the exception states. A draft
  -- order may only be born here; every later transition is a guarded command.
  constraint orders_status_vocabulary check (
    status in ('DRAFT', 'SUBMITTED', 'PENDING_CONFIRMATION', 'CONFIRMED',
               'PREPARING', 'READY', 'SERVED', 'PAID', 'COMPLETED',
               'CANCELLED', 'REJECTED', 'VOID', 'REFUNDED')
  ),

  -- Money is never negative, and the total always reconciles with its parts.
  -- A caller can never store a total it invented.
  constraint orders_money_non_negative check (
    subtotal >= 0 and discount >= 0 and tax >= 0 and total >= 0
  ),
  constraint orders_total_reconciles check (
    total = subtotal - discount + tax
  )
);

create index if not exists orders_table_session_id_idx
  on public.orders (table_session_id);

create index if not exists orders_status_idx
  on public.orders (status);

create index if not exists orders_table_id_idx
  on public.orders (table_id);

alter table public.orders enable row level security;

-- -----------------------------------------------------------------------------
-- RLS (AUTH_RBAC_RLS.md §27).
--
-- Customers never read this table directly: they see an order only through the
-- controlled public order path in migration 010 part 3, which re-validates the
-- table context the QR established. That is why there is no `anon` policy here
-- at all — an anonymous browser cannot enumerate or guess orders by id
-- (§47: "customer cannot read arbitrary orders").
--
-- Staff read their operational orders through the `orders.read` grant, which
-- the role matrix gives to waiter / cashier / kitchen / supervisor / admin /
-- owner (AUTH_RBAC_RLS.md §8). Kitchen reads the kitchen projection from a
-- dedicated function in a later migration, never payment details (§46).
-- -----------------------------------------------------------------------------
create policy orders_staff_read on public.orders
  for select to authenticated
  using (
    public.current_user_is_active()
    and public.has_permission('orders.read')
  );

-- No INSERT / UPDATE / DELETE policy, and no grants. Order creation, status
-- transitions and exception handling are all SECURITY DEFINER RPCs in
-- migration 010 (and later phases), each re-checking authorization and
-- permission inside its own transaction. There is no client-side path that can
-- create an order, set a status, or rewrite totals — by construction, not by
-- cooperation (AUTH_RBAC_RLS.md §34: "critical mutation harus server-side,
-- authorized, atomic, idempotent, auditable").

revoke insert, update, delete on public.orders from anon, authenticated;
