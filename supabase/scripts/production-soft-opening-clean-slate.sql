-- =============================================================================
-- TEPI SAWAH RESTO & CAFE — PEMBERSIHAN DATA FINAL SOFT OPENING
-- =============================================================================
-- Tanggal: 18 Oktober 2026
--
-- TUJUAN:
-- Menyiapkan sistem dalam kondisi 100% bersih untuk hari peluncuran (Soft Opening):
--   1. Menghapus seluruh transaksi, pesanan, riwayat pembayaran, & sesi meja uji coba.
--   2. Menghapus seluruh shift kasir & pergerakan laci kas uji coba.
--   3. Menghapus seluruh data reservasi tamu uji coba.
--   4. Menghapus seluruh riwayat bantuan (service_requests), notifikasi, & audit logs.
--   5. Menghapus seluruh katalog produk & modifier uji coba (siap input menu baru).
--   6. Menyiapkan 4 wadah kategori dasar (Makanan, Minuman, Camilan, Promo & Paket) tanpa produk.
--   7. Mereset nomor antrean pesanan (order_number_seq) kembali ke 1.
--   8. Mereset status seluruh meja menjadi 'AVAILABLE' (Siap Digunakan).
--
-- YANG 100% DIPERTAHANKAN & AMAN (TIDAK DIHAPUS — KECUALI STAFF):
--   ✓ SELURUH AKUN STAF & OWNER (auth.users, public.profiles, public.user_roles):
--     Semua akun kasir, waiter, dapur, admin, dan owner tetap tersimpan dan bisa langsung
--     login menggunakan email/password atau PIN masing-masing tanpa registrasi ulang.
--   ✓ Peran & Izin Sistem (public.roles, public.permissions, public.role_permissions).
--   ✓ Pengaturan Keuangan Restoran (PB1 10%, Service Charge, QRIS, Rekening Bank, Printer).
--   ✓ Denah Meja & Nomor Meja Saung / Lesehan (public.tables tetap utuh, status direset ke hijau).
--   ✓ Konten CMS Website Publik, Foto Suasana & Google Maps (public.landing_content).
--
-- CARA PENGGUNAAN:
--   1. Buka Supabase Dashboard -> Menu "SQL Editor" -> Buat Query Baru ("New Query").
--   2. Salin dan tempel seluruh isi skrip ini.
--   3. Klik tombol "Run" untuk mengeksekusi secara transaksional.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Bersihkan Seluruh Transaksi, Pesanan, & Riwayat Pembayaran Uji Coba
-- -----------------------------------------------------------------------------
DELETE FROM public.order_item_modifiers;
DELETE FROM public.order_items;
DELETE FROM public.order_status_history;
DELETE FROM public.table_session_order_links;
DELETE FROM public.orders;
DELETE FROM public.table_sessions;

-- -----------------------------------------------------------------------------
-- 2. Bersihkan Seluruh Shift Kasir & Riwayat Laci Kas (Cash Drawer)
-- -----------------------------------------------------------------------------
DELETE FROM public.cash_transactions;
DELETE FROM public.cash_shifts;

-- -----------------------------------------------------------------------------
-- 3. Bersihkan Layanan Tambahan (Permintaan Panggilan, Notifikasi, Reservasi)
-- -----------------------------------------------------------------------------
DELETE FROM public.service_requests;
DELETE FROM public.notifications;
DELETE FROM public.reservations;

-- Bersihkan riwayat audit pengujian (jika tabel ada)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'audit_logs') THEN
    DELETE FROM public.audit_logs;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 4. Bersihkan Seluruh Produk & Modifier (Sesuai Permintaan untuk Input Data Baru)
-- -----------------------------------------------------------------------------
DELETE FROM public.product_modifiers;
DELETE FROM public.products;
DELETE FROM public.modifiers;

-- Bersihkan kategori lama agar bersih total
DELETE FROM public.categories;

-- Sediakan 4 wadah kategori dasar (bersih / 0 produk) agar staf admin bisa langsung input produk:
INSERT INTO public.categories (id, name, description, sort_order, is_active)
VALUES
  ('00000000-0000-4000-8000-100000000004', 'Promo & Paket', 'Paket hemat santap bersama, keluarga, dan hidangan komplit spesial Tepi Sawah', 5, true),
  ('00000000-0000-4000-8000-100000000001', 'Makanan', 'Aneka olahan ayam, bebek, gurame, dan masakan khas Sunda', 10, true),
  ('00000000-0000-4000-8000-100000000002', 'Minuman', 'Kopi senja sawah, es kelapa muda, jus buah segar, dan aneka teh', 20, true),
  ('00000000-0000-4000-8000-100000000003', 'Camilan', 'Pisang goreng keju, mendoan, cireng rujak, dan kudapan santai', 30, true)
ON CONFLICT (id) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  sort_order  = EXCLUDED.sort_order,
  is_active   = EXCLUDED.is_active;

-- -----------------------------------------------------------------------------
-- 5. Reset Nomor Urut Pesanan (Agar Pesanan Pertama Hari Ini Dimulai dari 1)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_class WHERE relkind = 'S' AND relname = 'order_number_seq') THEN
    ALTER SEQUENCE public.order_number_seq RESTART WITH 1;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 6. Kembalikan Status Seluruh Meja Restoran Menjadi 'AVAILABLE'
-- -----------------------------------------------------------------------------
UPDATE public.tables 
SET status = 'AVAILABLE'
WHERE is_active = true;

COMMIT;

-- -----------------------------------------------------------------------------
-- 7. Verifikasi Status Sistem Pasca Pembersihan
-- -----------------------------------------------------------------------------
SELECT
  (SELECT count(*) FROM auth.users) AS total_akun_staf_terlindungi,
  (SELECT count(*) FROM public.profiles) AS total_profil_staf_terlindungi,
  (SELECT count(*) FROM public.user_roles) AS total_penugasan_role_aktif,
  (SELECT count(*) FROM public.tables WHERE status = 'AVAILABLE') AS total_meja_siap_pakai,
  (SELECT count(*) FROM public.orders) AS sisa_orders,
  (SELECT count(*) FROM public.cash_shifts) AS sisa_shift_kasir,
  (SELECT count(*) FROM public.categories) AS total_kategori_tersedia,
  (SELECT count(*) FROM public.products) AS sisa_produk,
  (SELECT count(*) FROM public.modifiers) AS sisa_modifier;
