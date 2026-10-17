-- =============================================================================
-- TEPI SAWAH RESTO & CAFE — PEMBERSIHAN DATA BERSIH PRODUKSI (PRESERVE ADMIN)
-- =============================================================================
-- Skrip ini digunakan untuk membersihkan seluruh data transaksi dan pengujian
-- menjelang hari peluncuran resmi (Grand Opening).
--
-- YANG DIBERSIHKAN:
--   1. Seluruh transaksi pesanan uji coba (orders, items, modifiers, history, session links).
--   2. Seluruh shift laci kasir & transaksi kas operasional (cash_shifts, cash_transactions).
--   3. Seluruh permohonan reservasi tamu uji coba (reservations).
--   4. Akun staf pengujian (kasir/waiter/dapur non-admin).
--   5. Status seluruh meja dikembalikan ke 'AVAILABLE' (Siap Digunakan).
--
-- YANG DIPERTAHANKAN (100% AMAN & TIDAK DIHAPUS):
--   ✓ Akun Pemilik / Administrator (admin@tepisawah.id dan role 'owner').
--   ✓ Katalog Menu, Kategori, Varian & Modifier (products, categories, etc.).
--   ✓ Denah Meja & Nomor Meja Saung (tables).
--   ✓ Pengaturan Keuangan Restoran: Pajak PB1, Service Charge, QRIS, Rekening Bank, Printer (tax_settings).
--   ✓ Konten CMS Website Publik & Foto Suasana (landing_content).
--   ✓ Definisi Peran & Izin Sistem (roles, permissions).
--
-- CARA PENGGUNAAN:
--   1. Buka Supabase Dashboard -> Menu "SQL Editor" -> Buat Query Baru ("New Query").
--   2. Salin dan tempel seluruh isi skrip ini.
--   3. Klik tombol "Run" untuk mengeksekusi secara transaksional.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Bersihkan Seluruh Transaksi Pesanan & Pembayaran Uji Coba
-- -----------------------------------------------------------------------------
DELETE FROM public.order_item_modifiers;
DELETE FROM public.order_items;
DELETE FROM public.order_status_history;
DELETE FROM public.table_session_order_links;
DELETE FROM public.orders;
DELETE FROM public.table_sessions;

-- -----------------------------------------------------------------------------
-- 2. Bersihkan Seluruh Data Laci Kasir (Cash Shifts & Cash Transactions)
-- -----------------------------------------------------------------------------
DELETE FROM public.cash_transactions;
DELETE FROM public.cash_shifts;

-- -----------------------------------------------------------------------------
-- 3. Bersihkan Data Reservasi Uji Coba
-- -----------------------------------------------------------------------------
DELETE FROM public.reservations;

-- -----------------------------------------------------------------------------
-- 4. Kembalikan Status Seluruh Meja Restoran Menjadi 'AVAILABLE'
-- -----------------------------------------------------------------------------
UPDATE public.tables 
SET status = 'AVAILABLE',
    current_session_id = NULL
WHERE is_active = true;

-- -----------------------------------------------------------------------------
-- 5. Bersihkan Akun Staf Uji Coba — HANYA PERTAHANKAN AKUN ADMIN (OWNER)
-- -----------------------------------------------------------------------------
-- Buat temporary table untuk mencatat user ID admin/owner yang dilindungi
CREATE TEMP TABLE preserved_admin_users ON COMMIT DROP AS
SELECT u.id 
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
LEFT JOIN public.roles r ON r.id = ur.role_id
WHERE lower(u.email) = 'admin@tepisawah.id' 
   OR r.name IN ('owner', 'superadmin', 'admin')
GROUP BY u.id;

-- Jika tidak ada yang cocok dengan kriteria di atas, amankan user pertama yang terdaftar
INSERT INTO preserved_admin_users (id)
SELECT id FROM auth.users 
ORDER BY created_at ASC 
LIMIT 1
ON CONFLICT DO NOTHING;

-- Hapus penugasan peran staf non-admin
DELETE FROM public.user_roles
WHERE user_id NOT IN (SELECT id FROM preserved_admin_users);

-- Hapus profil staf non-admin
DELETE FROM public.profiles
WHERE id NOT IN (SELECT id FROM preserved_admin_users);

-- Hapus akun otentikasi staf non-admin di schema auth
DELETE FROM auth.users
WHERE id NOT IN (SELECT id FROM preserved_admin_users);

-- Pastikan admin yang tersisa memiliki peran 'owner' di user_roles
DO $$
DECLARE
  v_admin_id uuid;
  v_owner_role_id uuid;
BEGIN
  SELECT id INTO v_admin_id FROM preserved_admin_users LIMIT 1;
  SELECT id INTO v_owner_role_id FROM public.roles WHERE name = 'owner' LIMIT 1;

  IF v_admin_id IS NOT NULL AND v_owner_role_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (v_admin_id, v_owner_role_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;

    -- Pastikan profil admin berstatus aktif
    UPDATE public.profiles
    SET is_active = true,
        display_name = COALESCE(NULLIF(display_name, ''), 'Administrator Tepi Sawah'),
        updated_at = now()
    WHERE id = v_admin_id;
  END IF;
END $$;

COMMIT;

-- =============================================================================
-- LAPORAN RINGKASAN DATA PASCA-PEMBERSIHAN
-- =============================================================================
SELECT 
  (SELECT count(*) FROM public.orders) AS sisa_orders,
  (SELECT count(*) FROM public.cash_shifts) AS sisa_shifts,
  (SELECT count(*) FROM public.reservations) AS sisa_reservations,
  (SELECT count(*) FROM public.tables WHERE status != 'AVAILABLE') AS meja_belum_available,
  (SELECT count(*) FROM auth.users) AS jumlah_admin_tersisa,
  (SELECT email FROM auth.users LIMIT 1) AS email_admin_aktif;
