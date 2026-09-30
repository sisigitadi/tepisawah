-- =============================================================================
-- Tepi Sawah — Migration 010 (part 5): Order version (optimistic concurrency).
--
-- Source: docs/api/API_CONTRACT.md §13 (Order State Transition: the backend
-- must check "concurrency/version"), §26 (Concurrency Control: "optimistic
-- version", "atomic conditional update", "An order currently PREPARING cannot
-- be changed to READY by two kitchen clients simultaneously in a way that
-- creates duplicate transition records"; a conflicting request receives
-- 409 CONFLICT), docs/database/DATABASE_MIGRATION_PLAN.md §24 (history is the
-- immutable trail; the current state lives on `orders`).
--
-- A row-level lock alone is not enough for the transition command: a lock
-- serializes two concurrent calls, but the loser must still be *told* it lost
-- rather than silently overwriting the winner's result. A monotonic version
-- gives every caller a cheap read handle — they hold the version they rendered,
-- send it back as their expectation, and the conditional UPDATE either moves
-- the row (version bumps) or matches nothing (409, "order changed under you").
--
-- The column is internal: no client may set it, and the customer projection
-- (migration 010 part 4) deliberately does not return it. Existing rows backfill
-- to 1 — they were never transitioned by this engine, and every first
-- transition away from their seeded state is a valid first hop.
-- =============================================================================
alter table public.orders
  add column if not exists version bigint not null default 1;

comment on column public.orders.version is
  'Monotonic optimistic-concurrency handle, bumped by every transition_order() call. Clients send the version they rendered as their expectation; a mismatch is a 409 conflict (API_CONTRACT.md §26).';
