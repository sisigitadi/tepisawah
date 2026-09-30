-- =============================================================================
-- Tepi Sawah — Migration 007 (part 2): Table session order links.
--
-- Purpose: the "attach order" half of the one-session-has-many-orders relation
-- (DATABASE_SCHEMA.md §19, API_CONTRACT.md §10.1: create order carries
-- tableSessionId). Phase 8 builds `orders` with its own `table_session_id`
-- foreign key; this lightweight link is the Phase 7 side of the same invariant
-- and is the thing the order-creation flow posts against to register an order
-- with its session.
--
-- Why a link table instead of a counter: the phase requires tests for multiple
-- orders, concurrent order creation and duplicate actions, which need order
-- identity. A counter cannot tell a duplicate attach from a genuine second
-- order; the unique constraint on `order_id` can.
--
-- Unique on `order_id` — one order belongs to at most one session (an attach to
-- a second session is rejected, not redirected). Idempotent by construction:
-- attaching the same order/session pair twice touches no rows, so a retried
-- request after a network drop cannot corrupt the session.
-- =============================================================================
create table if not exists public.table_session_order_links (
  id          uuid        primary key default gen_random_uuid(),
  session_id  uuid        not null references public.table_sessions(id) on delete cascade,
  order_id    uuid        not null,
  order_code  text        not null,
  attached_at timestamptz not null default now(),
  constraint table_session_order_links_order_once unique (order_id)
);

create index if not exists table_session_order_links_session_idx
  on public.table_session_order_links (session_id);

-- -----------------------------------------------------------------------------
-- RLS — read-only like its parent table.
--
-- SELECT: active staff holding `table_sessions.read` (the same module
--          permission that governs the session itself).
-- INSERT / UPDATE / DELETE: never granted. `attach_order_to_session()` in
--          part 3 is the only write path; it validates the session is OPEN and
--          the table is active before inserting.
--
-- The customer order app reaches this through the resolve projection, not by
-- reading the table, and the projection exposes no order detail.
-- -----------------------------------------------------------------------------
alter table public.table_session_order_links enable row level security;

drop policy if exists "table_session_order_links_select_authorized"
  on public.table_session_order_links;
create policy "table_session_order_links_select_authorized"
  on public.table_session_order_links
  for select
  to authenticated
  using (
    public.auth_user_id() is not null
    and public.current_user_is_active()
    and public.has_permission('table_sessions.read')
  );

revoke insert, update, delete on public.table_session_order_links from anon;
revoke insert, update, delete on public.table_session_order_links from authenticated;

comment on table public.table_session_order_links is
  'Links one order into its table session. Unique on order_id; only attach_order_to_session() may insert.';
