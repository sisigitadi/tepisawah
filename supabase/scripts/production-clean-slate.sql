-- =============================================================================
-- TEPI SAWAH RESTO & CAFE — PEMBERSIHAN TOTAL DATA PRODUKSI & SETUP PERTAMA
-- =============================================================================
-- CARA PENGGUNAAN:
-- 1. Buka Supabase Dashboard -> Menu "SQL Editor" -> Buat Query Baru ("New Query").
-- 2. Salin (copy) dan tempel (paste) seluruh isi skrip ini.
-- 3. Klik tombol "Run" untuk mengeksekusi.
--
-- YANG DILAKUKAN SKRIP INI:
--   - Memastikan tabel public.reservations & RLS terpasang dengan benar.
--   - Menghapus seluruh data transaksi uji coba & pesanan lama.
--   - Mengosongkan akun staf uji coba (0 user di auth.users & profiles).
--   - Mereset seluruh meja saung menjadi AVAILABLE (Siap Digunakan).
--   - Memasang fungsi RPC bootstrap public.claim_first_owner() agar pendaftaran
--     pemilik pertama di web langsung memiliki peran 'owner' secara aman.
--
-- DATA YANG TETAP AMAN & TIDAK DIHAPUS:
--   - Katalog Menu, Kategori, Varian, Foto Makanan/Minuman (public.products, etc.)
--   - Denah Meja & QR Code Meja (public.tables)
--   - Pengaturan CMS Website Publik (public.landing_content)
--   - Definisi Peran & Izin Sistem (public.roles, public.permissions)
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Pastikan tabel public.reservations ada dan memiliki RLS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  phone text NOT NULL,
  reservation_date date NOT NULL,
  reservation_time text NOT NULL,
  guests_count integer NOT NULL DEFAULT 2,
  seating_area text DEFAULT 'Bebas / Tersedia',
  notes text DEFAULT '',
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- Policy baca: staf berwenang atau pengguna terautentikasi
DROP POLICY IF EXISTS "reservations_staff_select" ON public.reservations;
CREATE POLICY "reservations_staff_select"
  ON public.reservations
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy buat: publik (anon) atau staf bisa kirim permohonan reservasi
DROP POLICY IF EXISTS "reservations_insert_any" ON public.reservations;
CREATE POLICY "reservations_insert_any"
  ON public.reservations
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Policy perbarui status: staf terautentikasi
DROP POLICY IF EXISTS "reservations_staff_update" ON public.reservations;
CREATE POLICY "reservations_staff_update"
  ON public.reservations
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 2. Bersihkan seluruh data transaksi dan reservasi uji coba
-- -----------------------------------------------------------------------------
DELETE FROM public.order_item_modifiers;
DELETE FROM public.order_items;
DELETE FROM public.order_status_history;
DELETE FROM public.table_session_order_links;
DELETE FROM public.orders;
DELETE FROM public.table_sessions;
DELETE FROM public.reservations;

-- -----------------------------------------------------------------------------
-- 3. Bersihkan seluruh penugasan peran staf dan profil lama
-- -----------------------------------------------------------------------------
DELETE FROM public.user_roles;
DELETE FROM public.profiles;

-- -----------------------------------------------------------------------------
-- 4. Bersihkan seluruh akun otentikasi di skema auth
-- -----------------------------------------------------------------------------
DELETE FROM auth.users;

-- -----------------------------------------------------------------------------
-- 5. Kembalikan status seluruh meja menjadi AVAILABLE
-- -----------------------------------------------------------------------------
UPDATE public.tables SET status = 'AVAILABLE' WHERE is_active = true;

-- -----------------------------------------------------------------------------
-- 6. Pasang fungsi RPC RPC claim_first_owner()
--    Fungsi ini memiliki SECURITY DEFINER: jika belum ada staf yang memiliki peran
--    di user_roles (0 staf), pengguna pertama yang mendaftar langsung diberikan
--    peran 'owner' secara aman tanpa diblokir RLS.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_first_owner()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_owner_role_id uuid;
  v_staff_count int;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Pengguna belum terautentikasi.';
  END IF;

  -- Pastikan sistem benar-benar baru diinisialisasi (hanya berlaku jika user_roles kosong)
  SELECT count(*) INTO v_staff_count FROM public.user_roles;
  IF v_staff_count > 0 THEN
    RAISE EXCEPTION 'Sistem restoran sudah memiliki akun pemilik aktif. Hubungi Owner untuk penugasan peran baru.';
  END IF;

  -- Cari role_id untuk peran 'owner'
  SELECT id INTO v_owner_role_id FROM public.roles WHERE code = 'owner' LIMIT 1;
  IF v_owner_role_id IS NULL THEN
    RAISE EXCEPTION 'Peran owner tidak ditemukan di basis data.';
  END IF;

  -- Pastikan profil aktif
  INSERT INTO public.profiles (id, display_name, is_active)
  VALUES (v_user_id, 'Pemilik (Owner)', true)
  ON CONFLICT (id) DO UPDATE SET is_active = true;

  -- Berikan peran 'owner'
  INSERT INTO public.user_roles (user_id, role_id)
  VALUES (v_user_id, v_owner_role_id)
  ON CONFLICT DO NOTHING;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_first_owner() TO authenticated;

COMMIT;

-- =============================================================================
-- Verifikasi Status Bersih Total:
-- Seluruh angka di bawah ini harus bernilai 0
-- =============================================================================
SELECT 
  (SELECT count(*) FROM auth.users)           AS sisa_auth_users,
  (SELECT count(*) FROM public.profiles)      AS sisa_profiles,
  (SELECT count(*) FROM public.user_roles)    AS sisa_user_roles,
  (SELECT count(*) FROM public.orders)        AS sisa_pesanan,
  (SELECT count(*) FROM public.reservations)  AS sisa_reservasi;
