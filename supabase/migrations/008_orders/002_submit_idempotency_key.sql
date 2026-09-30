-- =============================================================================
-- Tepi Sawah — Migration 008 (part 2): Submit idempotency key.
--
-- Source: docs/api/API_CONTRACT.md §10.2 (Submit Order — the request carries
-- its own `idempotencyKey`), §2.3 (Idempotency-Key), §14 (idempotency),
-- docs/security/AUTH_RBAC_RLS.md §46 (idempotency),
-- docs/implementation/CLINE_IMPLEMENTATION_PLAN.md §14 (Phase 8B).
--
-- The create command already owns `orders.idempotency_key` (migration 008 part
-- 1), unique across the whole table. Submission is a *second* deduplicated
-- command on the same row: a customer taps submit, the network stutters, the
-- tap is retried. That retry must land on the already-submitted order, not be
-- rejected as a duplicate create and not be accepted as a second submission.
--
-- Reusing the create column is not possible — its unique index is keyed to the
-- create command's key space, and one row can carry at most one of each. So
-- submission gets its own column, with its own unique index, on the same row.
-- The two keys never collide: they are minted by different commands with
-- different scopes (API_CONTRACT.md §14).
--
-- NULL is allowed and simply not deduplicated, mirroring the create column.
-- =============================================================================
alter table public.orders
  add column if not exists submit_idempotency_key text null;

-- Unique when present. A retried submit with the same key is turned into a
-- read of the first result by `submit_order()` (migration 010 part 3); a
-- second submit with a *different* key on an already-submitted order is a
-- genuine conflict and is refused (API_CONTRACT.md §26).
create unique index if not exists orders_submit_idempotency_key_unique
  on public.orders (submit_idempotency_key)
  where submit_idempotency_key is not null;
