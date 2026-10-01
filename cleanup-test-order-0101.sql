-- =============================================================================
-- Tepi Sawah — Remove checkout + confirmation-queue + serve E2E test orders
--
-- Created by the live-pipeline E2E runs and the order-chain smoke test
-- (2026-09-30 / 2026-10-01):
--   TS-20260930-0101  checkout E2E, DRAFT -> PAID  (lifecycle proof)
--   TS-20261001-0102  confirmation-queue E2E, REJECTED with reason
--   TS-20261001-0103  full-chain E2E: confirm -> READY -> SERVED from the UIs
--                     (customer note: "Tanpa sambal, makanan untuk anak")
--   TS-20261001-0104  live-pipeline E2E, left mid-PREPARING
--   TS-20261001-0105  order-chain smoke test, DRAFT -> PAID
--   TS-20261001-0106  order-chain smoke test, DRAFT -> PAID
--
-- The database design (deliberately) grants no DELETE on the order tables to
-- any client role — creation, transitions and exception handling are all
-- SECURITY DEFINER RPCs — so this cleanup runs in the Supabase SQL Editor,
-- same pattern as cleanup-qa-rows.sql.
--
-- Scope guard: every statement targets the three order numbers above. The ids
-- are resolved from the numbers so the script stays correct even if the
-- sequence is reused.
--
-- Plain SQL only. Idempotent: re-running deletes nothing and reports zeros.
-- =============================================================================

create temp table _cleanup_order on commit drop as
  select id from public.orders
  where order_number in (
    'TS-20260930-0101',
    'TS-20261001-0102',
    'TS-20261001-0103',
    'TS-20261001-0104',
    'TS-20261001-0105',
    'TS-20261001-0106'
  );

-- Children first, parent last (FK direction).
delete from public.order_item_modifiers
where order_item_id in (select id from public.order_items where order_id in (select id from _cleanup_order));

delete from public.order_items
where order_id in (select id from _cleanup_order);

delete from public.order_status_history
where order_id in (select id from _cleanup_order);

delete from public.orders
where id in (select id from _cleanup_order);

drop table _cleanup_order;

-- =============================================================================
-- Verification. Expected: the three test orders count 0, no orphan child rows.
-- The seed's own demo orders (TS-20260927-*, TS-20260929-*) are untouched.
-- Every smoke order number starts with TS-20261001-, so the guard below also
-- proves the smoke runs left nothing behind.
-- =============================================================================
select
  (select count(*) from public.orders where order_number like 'TS-2026%' and source = 'CUSTOMER_QR') as remaining_test_orders,
  (select count(*) from public.order_items where order_id not in (select id from public.orders)) as orphan_items,
  (select count(*) from public.order_item_modifiers m where not exists (select 1 from public.order_items i where i.id = m.order_item_id)) as orphan_modifiers,
  (select count(*) from public.orders) as remaining_orders;
