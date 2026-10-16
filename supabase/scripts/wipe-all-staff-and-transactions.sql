-- =============================================================================
-- TEPI SAWAH RESTO & CAFE — PEMBERSIHAN TOTAL DATA STAF & TRANSAKSI UJI COBA
-- =============================================================================
-- PERINGATAN:
-- Skrip ini menghapus seluruh akun staf (auth.users, profiles, user_roles) dan
-- seluruh data pesanan uji coba (orders, items, history, sessions).
--
-- Data yang TETAP AMAN & TIDAK DIHAPUS:
--   - Katalog Menu, Kategori, Foto WebP (public.products, public.categories)
--   - Denah Meja & QR Meja (public.tables)
--   - Konten Website CMS (public.landing_content)
--
-- CARA MENJALANKAN:
-- Buka Supabase Dashboard -> Menu "SQL Editor" -> Buat Query Baru -> Jalankan skrip ini.
-- =============================================================================

BEGIN;

-- 1. Bersihkan seluruh data transaksi uji coba agar foreign key tidak terkunci
DELETE FROM public.order_item_modifiers;
DELETE FROM public.order_items;
DELETE FROM public.order_status_history;
DELETE FROM public.table_session_order_links;
DELETE FROM public.orders;
DELETE FROM public.table_sessions;

-- 2. Bersihkan seluruh penugasan peran dan data profil staf
DELETE FROM public.user_roles;
DELETE FROM public.profiles;

-- 3. Bersihkan seluruh akun otentikasi di schema auth
DELETE FROM auth.users;

-- 4. Kembalikan status seluruh meja saung menjadi AVAILABLE
UPDATE public.tables SET status = 'AVAILABLE' WHERE is_active = true;

COMMIT;

-- =============================================================================
-- Verifikasi Hasil Pembersihan:
-- Hasil di bawah ini harus bernilai 0 untuk menandakan sistem bersih total (clean slate).
-- =============================================================================
SELECT 
  (SELECT count(*) FROM auth.users) AS sisa_akun_auth,
  (SELECT count(*) FROM public.profiles) AS sisa_profil,
  (SELECT count(*) FROM public.user_roles) AS sisa_peran_staf,
  (SELECT count(*) FROM public.orders) AS sisa_pesanan,
  (SELECT count(*) FROM public.table_sessions) AS sisa_sesi_meja;
