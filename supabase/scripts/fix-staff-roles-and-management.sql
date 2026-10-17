-- =============================================================================
-- TEPI SAWAH RESTO & CAFE — FIX STAF ROLES, TASKS & DELETION ENGINE
-- =============================================================================
-- CARA PENGGUNAAN:
-- 1. Buka Supabase Dashboard -> Menu "SQL Editor" -> Buat Query Baru ("New Query").
-- 2. Salin (copy) dan tempel (paste) seluruh isi skrip ini.
-- 3. Klik tombol "Run" untuk mengeksekusi.
--
-- YANG DISELESAIKAN SKRIP INI:
-- 1. Memasang seluruh relasi role_permissions baseline (Owner, Admin, Kasir, Dapur, Pelayan, Supervisor)
--    sehingga izin seperti users.roles_manage, users.read, users.update aktif di sistem RLS.
-- 2. Memasang fungsi RPC public.admin_update_user_roles(p_user_id, p_role_codes)
--    yang aman (SECURITY DEFINER) untuk mengupdate centang tugas operasional staf seketika.
-- 3. Memasang fungsi RPC public.admin_delete_staff(p_user_id)
--    yang aman (SECURITY DEFINER) untuk menghapus akun staf (user_roles, profiles, dan auth.users)
--    dengan pencegahan self-lockout (tidak bisa hapus akun sendiri).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Pastikan tabel permissions terisi baseline
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
-- 2. Pasang relasi role_permissions baseline (Owner, Admin, Kasir, Dapur, Pelayan, Supervisor)
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
-- 3. Fungsi RPC: Update Tugas Operasional Staf (admin_update_user_roles)
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
  -- Pastikan pemanggil adalah Owner atau Admin aktif
  SELECT (public.is_owner() OR public.is_admin()) INTO v_caller_is_authorized;
  IF NOT coalesce(v_caller_is_authorized, false) THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya Pemilik (Owner) atau Admin yang dapat mengatur tugas staf.';
  END IF;

  -- 1. Hapus penugasan peran saat ini untuk pengguna target
  DELETE FROM public.user_roles WHERE user_id = p_user_id;

  -- 2. Pasang seluruh peran yang dipilih
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
-- 4. Fungsi RPC: Hapus Akun Staf (admin_delete_staff)
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
  -- Pastikan pemanggil adalah Owner atau Admin aktif
  SELECT (public.is_owner() OR public.is_admin()) INTO v_caller_is_authorized;
  IF NOT coalesce(v_caller_is_authorized, false) THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya Pemilik (Owner) atau Admin yang dapat menghapus akun staf.';
  END IF;

  -- Cegah self-lockout (tidak boleh menghapus akun diri sendiri yang sedang login)
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Pencegahan Self-Lockout: Anda tidak dapat menghapus akun Anda sendiri.';
  END IF;

  -- Jika target adalah sesama Owner, hanya Owner yang boleh menghapus
  SELECT exists(
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = p_user_id AND r.code = 'owner'
  ) INTO v_is_target_owner;

  IF v_is_target_owner AND NOT public.is_owner() THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya akun Owner yang dapat menghapus akun sesama Owner.';
  END IF;

  -- 1. Hapus seluruh relasi peran pengguna
  DELETE FROM public.user_roles WHERE user_id = p_user_id;

  -- 2. Hapus profil publik pengguna
  DELETE FROM public.profiles WHERE id = p_user_id;

  -- 3. Hapus akun otentikasi di skema auth
  DELETE FROM auth.users WHERE id = p_user_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_staff(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- 3b. Dukungan Kolom Username pada Profil Staf & RPC Pendaftaran Bebas Rate-Limit
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles (lower(username)) WHERE username IS NOT NULL;
GRANT UPDATE (display_name, phone, avatar_url, is_active, username) ON public.profiles TO authenticated;

-- Perbarui trigger otomatis pembuatan profil agar menyertakan username
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, username, phone)
  VALUES (
    new.id,
    COALESCE(
      new.raw_user_meta_data ->> 'display_name',
      split_part(new.email, '@', 1)
    ),
    COALESCE(
      new.raw_user_meta_data ->> 'username',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data ->> 'phone'
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = COALESCE(EXCLUDED.display_name, profiles.display_name),
    username = COALESCE(EXCLUDED.username, profiles.username),
    phone = COALESCE(EXCLUDED.phone, profiles.phone);
  RETURN new;
END;
$$;

-- CATATAN: Fungsi admin_create_staff yang menyisipkan data langsung ke auth.users dinonaktifkan
-- karena GoTrue Supabase membutuhkan companion identity record (auth.identities) dan salt internal
-- yang hanya di-generate secara valid melalui GoTrue API (auth.signUp).
-- Pendaftaran staf dilakukan melalui client.auth.signUp (ephemeral client) di StaffPage.tsx.
DROP FUNCTION IF EXISTS public.admin_create_staff(text, text, text, text, text[], text);

-- -----------------------------------------------------------------------------
-- 4. Pengaturan Pajak Restoran (PB1), Service Charge, & Struk Kasir
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tax_settings (
  id text PRIMARY KEY DEFAULT 'default',
  tax_enabled boolean NOT NULL DEFAULT true,
  tax_rate numeric(5,2) NOT NULL DEFAULT 10.00,
  tax_name text NOT NULL DEFAULT 'PB1 (Pajak Restoran 10%)',
  tax_calculation text NOT NULL DEFAULT 'exclusive',
  npwpd text NOT NULL DEFAULT 'P.2.0192834.01.24',
  show_npwpd_on_receipt boolean NOT NULL DEFAULT true,
  service_charge_enabled boolean NOT NULL DEFAULT false,
  service_charge_rate numeric(5,2) NOT NULL DEFAULT 5.00,
  service_charge_name text NOT NULL DEFAULT 'Biaya Layanan (5%)',
  rounding text NOT NULL DEFAULT 'none',
  receipt_header_note text NOT NULL DEFAULT 'Kawasan Wisata Sawah, Ciperna, Kec. Talun, Cirebon',
  receipt_footer_note text NOT NULL DEFAULT 'Matur Kesuwun, Hatur Nuhun.\nInstagram: @tepisawah.id',
  receipt_phone text NOT NULL DEFAULT '0812-3456-7890',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tax_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tax_settings_select_all" ON public.tax_settings;
CREATE POLICY "tax_settings_select_all"
  ON public.tax_settings FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "tax_settings_update_authorized" ON public.tax_settings;
CREATE POLICY "tax_settings_update_authorized"
  ON public.tax_settings FOR ALL
  TO authenticated
  USING (public.is_owner() OR public.is_admin())
  WITH CHECK (public.is_owner() OR public.is_admin());

GRANT SELECT ON public.tax_settings TO anon, authenticated;
GRANT ALL ON public.tax_settings TO authenticated;

-- Pastikan singleton default terisi
INSERT INTO public.tax_settings (id, tax_enabled, tax_rate, tax_name, tax_calculation, npwpd, show_npwpd_on_receipt)
VALUES ('default', true, 10.00, 'PB1 (Pajak Restoran 10%)', 'exclusive', 'P.2.0192834.01.24', true)
ON CONFLICT (id) DO NOTHING;

COMMIT;
