-- =============================================================================
-- Tepi Sawah — Skrip Pembersihan Produk & Modifier untuk Input Data Baru
--
-- Tujuan:
-- 1. Melepaskan referensi Foreign Key di order_items dan order_item_modifiers (diset NULL)
--    agar riwayat pesanan (jika ada) tidak rusak dan tidak memicu constraint violation.
-- 2. Menghapus seluruh relasi penghubung produk-modifier (product_modifiers).
-- 3. Menghapus seluruh baris produk lama (products).
-- 4. Menghapus seluruh baris modifier lama (modifiers).
-- 5. Kategori (categories) dipertahankan agar grup menu tetap tersedia untuk diisi produk baru.
--    (Jika ingin menghapus kategori juga, hilangkan tanda komentar pada bagian bawah).
--
-- Jalankan skrip ini di Supabase SQL Editor (role postgres/service_role).
-- =============================================================================

BEGIN;

-- 1. Putuskan relasi foreign key dari riwayat order agar tidak memicu FK constraint error
UPDATE public.order_item_modifiers
SET modifier_id = NULL
WHERE modifier_id IS NOT NULL;

UPDATE public.order_items
SET product_id = NULL
WHERE product_id IS NOT NULL;

-- 2. Hapus seluruh relasi produk ke modifier
DELETE FROM public.product_modifiers;

-- 3. Hapus seluruh produk
DELETE FROM public.products;

-- 4. Hapus seluruh modifier
DELETE FROM public.modifiers;

-- Optional: Jika ingin menghapus semua kategori juga (uncomment baris berikut):
-- DELETE FROM public.categories;

COMMIT;

-- Tampilkan status verifikasi jumlah data setelah pembersihan
SELECT
  (SELECT count(*) FROM public.categories) AS total_kategori_tersisa,
  (SELECT count(*) FROM public.products) AS total_produk_tersisa,
  (SELECT count(*) FROM public.modifiers) AS total_modifier_tersisa,
  (SELECT count(*) FROM public.product_modifiers) AS total_relasi_modifier_tersisa;
