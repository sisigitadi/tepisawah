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

-- -----------------------------------------------------------------------------
-- 7. Pastikan katalog izin (permissions) terisi baseline
-- -----------------------------------------------------------------------------
INSERT INTO public.permissions (code, resource, action, description)
VALUES
  ('catalog.read', 'catalog', 'read', 'View menu catalog and items'),
  ('catalog.create', 'catalog', 'create', 'Add items or categories'),
  ('catalog.update', 'catalog', 'update', 'Edit catalog items or prices'),
  ('catalog.archive', 'catalog', 'archive', 'Archive catalog items'),
  ('categories.manage', 'categories', 'manage', 'Create or reorder categories'),
  ('modifiers.manage', 'modifiers', 'manage', 'Configure item modifiers and options'),
  ('tables.read', 'tables', 'read', 'View table list and status'),
  ('tables.create', 'tables', 'create', 'Add restaurant tables or zones'),
  ('tables.update', 'tables', 'update', 'Edit tables or seat capacity'),
  ('tables.archive', 'tables', 'archive', 'Archive or deactivate tables'),
  ('tables.qr_manage', 'tables', 'qr_manage', 'Generate or rotate table QR codes'),
  ('table_sessions.read', 'table_sessions', 'read', 'View active table sessions'),
  ('table_sessions.manage', 'table_sessions', 'manage', 'Open, close, or clear table sessions'),
  ('orders.create_manual', 'orders', 'create_manual', 'Create manual orders via POS or Waiter'),
  ('orders.read', 'orders', 'read', 'Read order queue and tickets'),
  ('orders.confirm', 'orders', 'confirm', 'Confirm customer QR orders'),
  ('orders.reject', 'orders', 'reject', 'Reject customer QR orders'),
  ('orders.transition', 'orders', 'transition', 'Advance order status lifecycle'),
  ('orders.cancel', 'orders', 'cancel', 'Cancel confirmed orders'),
  ('orders.recall', 'orders', 'recall', 'Recall order transitions'),
  ('orders.serve', 'orders', 'serve', 'Mark orders as served to guest'),
  ('kitchen.read', 'kitchen', 'read', 'View KDS kitchen order queue'),
  ('kitchen.start', 'kitchen', 'start', 'Mark cooking started on KDS ticket'),
  ('kitchen.ready', 'kitchen', 'ready', 'Mark food ready on KDS ticket'),
  ('kitchen.recall', 'kitchen', 'recall', 'Recall kitchen ticket state'),
  ('service_requests.read', 'service_requests', 'read', 'View guest table calls/requests'),
  ('service_requests.create', 'service_requests', 'create', 'Create table service call'),
  ('service_requests.acknowledge', 'service_requests', 'acknowledge', 'Acknowledge table call'),
  ('service_requests.resolve', 'service_requests', 'resolve', 'Mark table call completed'),
  ('payments.read', 'payments', 'read', 'View payment receipts and totals'),
  ('payments.create', 'payments', 'create', 'Process payments (QRIS, cash, transfer)'),
  ('payments.refund', 'payments', 'refund', 'Issue payment refund'),
  ('payments.void', 'payments', 'void', 'Void unpaid transactions'),
  ('users.read', 'users', 'read', 'View staff user list and roles'),
  ('users.create', 'users', 'create', 'Register new staff accounts'),
  ('users.update', 'users', 'update', 'Update staff profile and active flag'),
  ('users.disable', 'users', 'disable', 'Deactivate staff account'),
  ('users.roles_manage', 'users', 'roles_manage', 'Assign or remove operational tasks/roles'),
  ('roles.read', 'roles', 'read', 'View system roles'),
  ('roles.manage', 'roles', 'manage', 'Configure roles and task associations'),
  ('permissions.read', 'permissions', 'read', 'View system permissions list'),
  ('audit.read', 'audit', 'read', 'Read system audit logs'),
  ('settings.read', 'settings', 'read', 'Read operational restaurant settings'),
  ('settings.manage', 'settings', 'manage', 'Update restaurant profile, tax, and hours'),
  ('dashboard.read', 'dashboard', 'read', 'Access management overview and metrics')
ON CONFLICT (code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 8. Pasang relasi role_permissions baseline (Owner, Admin, Kasir, Dapur, Pelayan)
-- -----------------------------------------------------------------------------
WITH grants(role_code, permission_code) AS (
  VALUES
    ('owner', 'users.roles_manage'),
    ('owner', 'users.read'),
    ('owner', 'users.create'),
    ('owner', 'users.update'),
    ('owner', 'users.disable'),
    ('owner', 'roles.read'),
    ('owner', 'roles.manage'),
    ('owner', 'dashboard.read'),
    ('owner', 'catalog.read'),
    ('owner', 'catalog.create'),
    ('owner', 'catalog.update'),
    ('owner', 'catalog.archive'),
    ('owner', 'categories.manage'),
    ('owner', 'modifiers.manage'),
    ('owner', 'tables.read'),
    ('owner', 'tables.create'),
    ('owner', 'tables.update'),
    ('owner', 'tables.archive'),
    ('owner', 'tables.qr_manage'),
    ('owner', 'orders.read'),
    ('owner', 'orders.confirm'),
    ('owner', 'orders.transition'),
    ('owner', 'orders.create_manual'),
    ('owner', 'payments.read'),
    ('owner', 'payments.create'),
    ('owner', 'settings.read'),
    ('owner', 'settings.manage'),

    ('admin', 'users.roles_manage'),
    ('admin', 'users.read'),
    ('admin', 'users.create'),
    ('admin', 'users.update'),
    ('admin', 'users.disable'),
    ('admin', 'roles.read'),
    ('admin', 'roles.manage'),
    ('admin', 'dashboard.read'),
    ('admin', 'catalog.read'),
    ('admin', 'catalog.create'),
    ('admin', 'catalog.update'),
    ('admin', 'tables.read'),
    ('admin', 'tables.create'),
    ('admin', 'tables.update'),
    ('admin', 'orders.read'),
    ('admin', 'orders.confirm'),
    ('admin', 'orders.transition'),
    ('admin', 'orders.create_manual'),
    ('admin', 'payments.read'),
    ('admin', 'payments.create'),
    ('admin', 'settings.read'),

    ('cashier', 'orders.read'),
    ('cashier', 'orders.confirm'),
    ('cashier', 'orders.create_manual'),
    ('cashier', 'orders.transition'),
    ('cashier', 'payments.read'),
    ('cashier', 'payments.create'),
    ('cashier', 'tables.read'),

    ('waiter', 'orders.read'),
    ('waiter', 'orders.create_manual'),
    ('waiter', 'orders.serve'),
    ('waiter', 'tables.read'),
    ('waiter', 'table_sessions.read'),

    ('kitchen', 'kitchen.read'),
    ('kitchen', 'kitchen.start'),
    ('kitchen', 'kitchen.ready'),
    ('kitchen', 'orders.read'),

    ('supervisor', 'orders.read'),
    ('supervisor', 'orders.confirm'),
    ('supervisor', 'orders.cancel'),
    ('supervisor', 'orders.transition'),
    ('supervisor', 'payments.read'),
    ('supervisor', 'tables.read'),
    ('supervisor', 'kitchen.read')
)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM grants g
JOIN public.roles r ON r.code = g.role_code
JOIN public.permissions p ON p.code = g.permission_code
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 9. Pasang fungsi RPC: admin_update_user_roles (SECURITY DEFINER)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_update_user_roles(
  p_user_id uuid,
  p_role_codes text[]
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller_is_authorized boolean;
  v_role_id uuid;
  v_code text;
BEGIN
  SELECT (public.is_owner() OR public.is_admin()) INTO v_caller_is_authorized;
  IF NOT coalesce(v_caller_is_authorized, false) THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya Pemilik (Owner) atau Admin yang dapat mengatur tugas staf.';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = p_user_id;

  IF p_role_codes IS NOT NULL AND array_length(p_role_codes, 1) > 0 THEN
    FOREACH v_code IN ARRAY p_role_codes
    LOOP
      SELECT id INTO v_role_id FROM public.roles WHERE code = v_code;
      IF v_role_id IS NOT NULL THEN
        INSERT INTO public.user_roles (user_id, role_id)
        VALUES (p_user_id, v_role_id)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_user_roles(uuid, text[]) TO authenticated;

-- -----------------------------------------------------------------------------
-- 10. Pasang fungsi RPC: admin_delete_staff (SECURITY DEFINER)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_delete_staff(
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller_is_authorized boolean;
  v_is_target_owner boolean;
BEGIN
  SELECT (public.is_owner() OR public.is_admin()) INTO v_caller_is_authorized;
  IF NOT coalesce(v_caller_is_authorized, false) THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya Pemilik (Owner) atau Admin yang dapat menghapus akun staf.';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Pencegahan Self-Lockout: Anda tidak dapat menghapus akun Anda sendiri.';
  END IF;

  SELECT exists(
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = p_user_id AND r.code = 'owner'
  ) INTO v_is_target_owner;

  IF v_is_target_owner AND NOT public.is_owner() THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya akun Owner yang dapat menghapus akun sesama Owner.';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = p_user_id;
  DELETE FROM public.profiles WHERE id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_staff(uuid) TO authenticated;

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
