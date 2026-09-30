-- =============================================================================
-- Tepi Sawah — Remove QA test rows from the live database
--
-- The end-to-end admin QA created three rows to exercise create/edit/archive.
-- The database design (deliberately) grants no DELETE to client roles — the UI
-- can only archive — so this cleanup runs in the SQL Editor.
--
-- Checked first: no product_modifiers rows reference either QA id, so the
-- deletes below cannot violate a foreign key.
--
-- Plain SQL only. Idempotent: re-running deletes nothing and reports zeros.
-- =============================================================================

delete from public.products   where id = '5fe892a0-f9b4-4e0f-999c-a252bef408a6'; -- Test QA Produk
delete from public.modifiers  where id = '49e7233f-923a-4aee-a11a-c1f093fffc30'; -- Test QA Modifier
delete from public.categories where id = 'bed7be64-af97-475d-840e-03f84e85fc69'; -- Test QA Kategori (Revisi)

-- =============================================================================
-- Verification. Expected: the three qa_* counts are 0 and the totals match the
-- original seed — 3 categories, 6 products, 4 modifiers.
-- =============================================================================
select
  (select count(*) from public.categories where name like 'Test QA%') as qa_categories,
  (select count(*) from public.products  where name like 'Test QA%') as qa_products,
  (select count(*) from public.modifiers where name like 'Test QA%') as qa_modifiers,
  (select count(*) from public.categories) as total_categories,
  (select count(*) from public.products)   as total_products,
  (select count(*) from public.modifiers)  as total_modifiers;
