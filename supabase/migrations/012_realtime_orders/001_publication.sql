-- =============================================================================
-- Tepi Sawah — Migration 012: Realtime for the orders table (part 1)
--
-- The staff boards (kitchen KDS, cashier confirmation queue, cashier payment
-- terminal, waiter ready board) subscribe to `orders` through Supabase
-- Realtime's Postgres Changes, replacing their 15-second polling with instant
-- debounced refreshes. Postgres Changes only delivers events for tables in
-- the `supabase_realtime` publication, so this migration adds it.
--
-- Security semantics (Supabase docs, Postgres Changes → Security):
-- - RLS is respected: a subscriber receives an event only when its role's
--   SELECT policies let it read the row. `orders` has no anon policy
--   (migration 008) by design, so anonymous customers receive nothing —
--   their order-status screens already go through get_customer_order() and
--   do NOT need this publication.
-- - A session that cannot read the row at all fails closed (CHANNEL_ERROR),
--   never a data leak.
--
-- The client half (useOrderBoardChannel in @tepisawah/database) treats events
-- as signals only and re-reads through the same RLS-gated queries as before —
-- nothing about the wire contract changes for the apps.
--
-- Idempotent: re-running is a no-op. Run in the Supabase SQL Editor.
-- =============================================================================

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end
$$;

-- =============================================================================
-- Verification. Expected: one row listing public.orders.
-- =============================================================================
select pubname, schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime' and tablename = 'orders';
