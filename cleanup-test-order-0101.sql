-- =============================================================================
-- Tepi Sawah — Remove the checkout E2E test order from the live database
--
-- The order-app checkout E2E (2026-09-30) created exactly one order through
-- the real UI flow: TS-20260930-0101 (2× Nasi Liwet Sawah + Level Pedas,
-- 1× Es Kelapa Muda, Rp 105.000), driven DRAFT → PAID to prove the
-- create_draft_order / submit_order / transition_order pipeline end to end.
--
-- The database design (deliberately) grants no DELETE on the order tables to
-- any client role — creation, transitions and exception handling are all
-- SECURITY DEFINER RPCs — so this cleanup runs in the Supabase SQL Editor,
-- same pattern as cleanup-qa-rows.sql.
--
-- Scope guard: every statement targets the single order by its number / id.
-- The id is resolved from the order number so the script stays correct even
-- if the sequence is reused.
--
-- Plain SQL only. Idempotent: re-running deletes nothing and reports zeros.
-- =============================================================================

create temp table _cleanup_order on commit drop as
  select id from public.orders where order_number = 'TS-20260930-0101';

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
-- Verification. Expected: all four counts are 0 — the order and every child
-- row are gone; the remaining orders count reflects whatever the live DB
-- legitimately holds afterwards.
-- =============================================================================
select
  (select count(*) from public.orders where order_number = 'TS-20260930-0101') as target_order,
  (select count(*) from public.order_items where order_id not in (select id from public.orders)) as orphan_items,
  (select count(*) from public.order_item_modifiers m where not exists (select 1 from public.order_items i where i.id = m.order_item_id)) as orphan_modifiers,
  (select count(*) from public.orders) as remaining_orders;
