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
INSERT INTO public.permissions (code, module, action, description)
VALUES
  ('catalog.read',                'catalog',         'read',          'Read the catalog'),
  ('catalog.create',              'catalog',         'create',        'Create products'),
  ('catalog.update',              'catalog',         'update',        'Update products'),
  ('catalog.archive',             'catalog',         'archive',       'Archive products'),
  ('categories.manage',           'catalog',         'manage',        'Manage categories'),
  ('modifiers.manage',            'catalog',         'manage',        'Manage modifiers'),
  ('tables.read',                 'tables',          'read',          'Read tables'),
  ('tables.create',               'tables',          'create',        'Create tables'),
  ('tables.update',               'tables',          'update',        'Update tables'),
  ('tables.archive',              'tables',          'archive',       'Archive tables'),
  ('tables.qr_manage',            'tables',          'qr_manage',     'Manage table QR codes'),
  ('table_sessions.read',         'table_sessions',  'read',          'Read table sessions'),
  ('table_sessions.manage',       'table_sessions',  'manage',        'Manage table sessions'),
  ('orders.read',                 'orders',          'read',          'Read orders'),
  ('orders.create_manual',        'orders',          'create_manual', 'Create a manual order'),
  ('orders.confirm',              'orders',          'confirm',       'Confirm an order'),
  ('orders.reject',               'orders',          'reject',        'Reject an order'),
  ('orders.transition',           'orders',          'transition',    'Transition an order state'),
  ('orders.cancel',               'orders',          'cancel',        'Cancel an order'),
  ('orders.recall',               'orders',          'recall',        'Recall an order'),
  ('orders.serve',                'orders',          'serve',         'Mark an order served'),
  ('kitchen.read',                'kitchen',         'read',          'Read the kitchen queue'),
  ('kitchen.start',               'kitchen',         'start',         'Start preparing'),
  ('kitchen.ready',               'kitchen',         'ready',         'Mark an order ready'),
  ('kitchen.recall',              'kitchen',         'recall',        'Recall a kitchen ticket'),
  ('service_requests.read',       'service_requests','read',          'Read service requests'),
  ('service_requests.create',     'service_requests','create',        'Create a service request'),
  ('service_requests.acknowledge','service_requests','acknowledge',   'Acknowledge a service request'),
  ('service_requests.resolve',    'service_requests','resolve',       'Resolve a service request'),
  ('payments.read',               'payments',        'read',          'Read payments'),
  ('payments.create',             'payments',        'create',        'Create a payment'),
  ('payments.refund',             'payments',        'refund',        'Refund a payment'),
  ('payments.void',               'payments',        'void',          'Void a payment'),
  ('users.read',                  'users',           'read',          'Read user profiles'),
  ('users.create',                'users',           'create',        'Create a user'),
  ('users.update',                'users',           'update',        'Update a user profile'),
  ('users.disable',               'users',           'disable',       'Disable a user account'),
  ('users.roles_manage',          'users',           'roles_manage',  'Assign or remove roles'),
  ('roles.read',                  'roles',           'read',          'Read the role catalog'),
  ('roles.manage',                'roles',           'manage',        'Manage roles'),
  ('permissions.read',            'permissions',     'read',          'Read the permission catalog'),
  ('audit.read',                  'audit',           'read',          'Read audit logs'),
  ('settings.read',               'settings',        'read',          'Read settings'),
  ('settings.manage',             'settings',        'manage',        'Manage settings'),
  ('dashboard.read',              'dashboard',       'read',          'Read the dashboard')
ON CONFLICT (code) DO UPDATE SET
  module      = excluded.module,
  action      = excluded.action,
  description = excluded.description;

-- -----------------------------------------------------------------------------
-- 8. Pasang relasi role_permissions baseline (Owner, Admin, Kasir, Dapur, Pelayan, Supervisor)
-- -----------------------------------------------------------------------------
WITH grants(role_code, permission_code) AS (
  VALUES
    -- Waiter
    ('waiter', 'catalog.read'),
    ('waiter', 'tables.read'),
    ('waiter', 'table_sessions.read'),
    ('waiter', 'orders.create_manual'),
    ('waiter', 'orders.read'),
    ('waiter', 'orders.serve'),
    ('waiter', 'service_requests.read'),
    ('waiter', 'service_requests.create'),
    ('waiter', 'service_requests.acknowledge'),
    ('waiter', 'service_requests.resolve'),
    ('waiter', 'dashboard.read'),

    -- Cashier
    ('cashier', 'catalog.read'),
    ('cashier', 'tables.read'),
    ('cashier', 'orders.create_manual'),
    ('cashier', 'orders.read'),
    ('cashier', 'orders.confirm'),
    ('cashier', 'orders.reject'),
    ('cashier', 'service_requests.read'),
    ('cashier', 'payments.read'),
    ('cashier', 'payments.create'),
    ('cashier', 'audit.read'),
    ('cashier', 'dashboard.read'),

    -- Kitchen
    ('kitchen', 'catalog.read'),
    ('kitchen', 'tables.read'),
    ('kitchen', 'orders.read'),
    ('kitchen', 'kitchen.read'),
    ('kitchen', 'kitchen.start'),
    ('kitchen', 'kitchen.ready'),
    ('kitchen', 'dashboard.read'),

    -- Supervisor
    ('supervisor', 'catalog.read'),
    ('supervisor', 'tables.read'),
    ('supervisor', 'tables.create'),
    ('supervisor', 'tables.update'),
    ('supervisor', 'tables.archive'),
    ('supervisor', 'table_sessions.read'),
    ('supervisor', 'table_sessions.manage'),
    ('supervisor', 'orders.create_manual'),
    ('supervisor', 'orders.read'),
    ('supervisor', 'orders.confirm'),
    ('supervisor', 'orders.reject'),
    ('supervisor', 'orders.transition'),
    ('supervisor', 'orders.cancel'),
    ('supervisor', 'orders.recall'),
    ('supervisor', 'orders.serve'),
    ('supervisor', 'kitchen.read'),
    ('supervisor', 'kitchen.start'),
    ('supervisor', 'kitchen.ready'),
    ('supervisor', 'kitchen.recall'),
    ('supervisor', 'service_requests.read'),
    ('supervisor', 'service_requests.create'),
    ('supervisor', 'service_requests.acknowledge'),
    ('supervisor', 'service_requests.resolve'),
    ('supervisor', 'payments.read'),
    ('supervisor', 'payments.create'),
    ('supervisor', 'payments.refund'),
    ('supervisor', 'payments.void'),
    ('supervisor', 'audit.read'),
    ('supervisor', 'dashboard.read'),

    -- Admin
    ('admin', 'catalog.read'),
    ('admin', 'catalog.create'),
    ('admin', 'catalog.update'),
    ('admin', 'catalog.archive'),
    ('admin', 'categories.manage'),
    ('admin', 'modifiers.manage'),
    ('admin', 'tables.read'),
    ('admin', 'tables.create'),
    ('admin', 'tables.update'),
    ('admin', 'tables.archive'),
    ('admin', 'tables.qr_manage'),
    ('admin', 'table_sessions.read'),
    ('admin', 'table_sessions.manage'),
    ('admin', 'orders.create_manual'),
    ('admin', 'orders.read'),
    ('admin', 'orders.confirm'),
    ('admin', 'orders.reject'),
    ('admin', 'orders.transition'),
    ('admin', 'orders.cancel'),
    ('admin', 'orders.recall'),
    ('admin', 'orders.serve'),
    ('admin', 'kitchen.read'),
    ('admin', 'kitchen.start'),
    ('admin', 'kitchen.ready'),
    ('admin', 'kitchen.recall'),
    ('admin', 'service_requests.read'),
    ('admin', 'service_requests.create'),
    ('admin', 'service_requests.acknowledge'),
    ('admin', 'service_requests.resolve'),
    ('admin', 'payments.read'),
    ('admin', 'payments.create'),
    ('admin', 'payments.refund'),
    ('admin', 'payments.void'),
    ('admin', 'users.read'),
    ('admin', 'users.create'),
    ('admin', 'users.update'),
    ('admin', 'users.disable'),
    ('admin', 'users.roles_manage'),
    ('admin', 'roles.read'),
    ('admin', 'roles.manage'),
    ('admin', 'permissions.read'),
    ('admin', 'audit.read'),
    ('admin', 'settings.read'),
    ('admin', 'settings.manage'),
    ('admin', 'dashboard.read'),

    -- Owner
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
    ('owner', 'table_sessions.read'),
    ('owner', 'table_sessions.manage'),
    ('owner', 'orders.create_manual'),
    ('owner', 'orders.read'),
    ('owner', 'orders.confirm'),
    ('owner', 'orders.reject'),
    ('owner', 'orders.transition'),
    ('owner', 'orders.cancel'),
    ('owner', 'orders.recall'),
    ('owner', 'orders.serve'),
    ('owner', 'kitchen.read'),
    ('owner', 'kitchen.start'),
    ('owner', 'kitchen.ready'),
    ('owner', 'kitchen.recall'),
    ('owner', 'service_requests.read'),
    ('owner', 'service_requests.create'),
    ('owner', 'service_requests.acknowledge'),
    ('owner', 'service_requests.resolve'),
    ('owner', 'payments.read'),
    ('owner', 'payments.create'),
    ('owner', 'payments.refund'),
    ('owner', 'payments.void'),
    ('owner', 'users.read'),
    ('owner', 'users.create'),
    ('owner', 'users.update'),
    ('owner', 'users.disable'),
    ('owner', 'users.roles_manage'),
    ('owner', 'roles.read'),
    ('owner', 'roles.manage'),
    ('owner', 'permissions.read'),
    ('owner', 'audit.read'),
    ('owner', 'settings.read'),
    ('owner', 'settings.manage'),
    ('owner', 'dashboard.read')
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
