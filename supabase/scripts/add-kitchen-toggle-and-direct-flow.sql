-- =============================================================================
-- Tepi Sawah — Skrip Konfigurasi Pengaturan Dapur & Alur Langsung
--
-- Menambahkan kolom konfigurasi modul dapur ke tabel tax_settings:
-- 1. kitchen_enabled (boolean, default true)
-- 2. kitchen_bypass_mode (text, default 'direct_serve')
--
-- Memperbarui aturan transisi order (public.order_transition_rule) agar kasir &
-- waiter dapat langsung menyajikan pesanan tanpa KDS atau mengontrol masak mandiri:
-- - CONFIRMED -> SERVED (orders.serve)
-- - CONFIRMED -> READY  (orders.serve)
-- - PREPARING -> SERVED (orders.serve)
--
-- Serta memberikan hak akses (role_permissions) yang diperlukan ke kasir & waiter.
-- =============================================================================

-- 1. Tambahkan kolom ke tax_settings jika belum ada
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tax_settings' AND column_name = 'kitchen_enabled'
  ) THEN
    ALTER TABLE public.tax_settings ADD COLUMN kitchen_enabled boolean NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tax_settings' AND column_name = 'kitchen_bypass_mode'
  ) THEN
    ALTER TABLE public.tax_settings ADD COLUMN kitchen_bypass_mode text NOT NULL DEFAULT 'direct_serve';
  END IF;
END $$;

-- Pastikan baris singleton tax_settings memiliki nilai default
UPDATE public.tax_settings
SET
  kitchen_enabled = COALESCE(kitchen_enabled, true),
  kitchen_bypass_mode = COALESCE(kitchen_bypass_mode, 'direct_serve')
WHERE id = '22222222-2222-4222-8222-222222222222';

-- 2. Perbarui hak akses role_permissions
WITH grants (role_code, permission_code) AS (
  VALUES
    ('cashier', 'orders.serve'),
    ('cashier', 'kitchen.start'),
    ('cashier', 'kitchen.ready'),
    ('waiter', 'orders.confirm'),
    ('waiter', 'kitchen.start'),
    ('waiter', 'kitchen.ready'),
    ('kitchen', 'kitchen.start'),
    ('kitchen', 'kitchen.ready'),
    ('supervisor', 'kitchen.start'),
    ('supervisor', 'kitchen.ready')
)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM grants g
JOIN public.roles r ON r.code = g.role_code
JOIN public.permissions p ON p.code = g.permission_code
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 3. Perbarui fungsi aturan transisi status pesanan
CREATE OR REPLACE FUNCTION public.order_transition_rule(
  p_from text,
  p_to   text,
  OUT required_permission text,
  OUT requires_reason     boolean
)
RETURNS record
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT required_permission, requires_reason
  FROM (VALUES
    -- Alur normal maju (API_CONTRACT.md §13)
    ('SUBMITTED',           'PENDING_CONFIRMATION', 'orders.transition', false),
    ('PENDING_CONFIRMATION','CONFIRMED',            'orders.confirm',    false),
    ('PENDING_CONFIRMATION','REJECTED',             'orders.reject',     false),
    ('CONFIRMED',           'PREPARING',            'kitchen.start',     false),
    ('PREPARING',           'READY',                'kitchen.ready',     false),
    ('READY',               'SERVED',               'orders.serve',      false),
    ('SERVED',              'PAID',                 'payments.create',   false),

    -- Alur bypass dapur (saat dapur dinonaktifkan: langsung saji atau siap saji)
    ('CONFIRMED',           'READY',                'orders.serve',      false),
    ('CONFIRMED',           'SERVED',               'orders.serve',      false),
    ('PREPARING',           'SERVED',               'orders.serve',      false),

    -- Pembayaran kasir hybrid (pre-pay & post-pay)
    ('CONFIRMED',           'PAID',                 'payments.create',   false),
    ('PREPARING',           'PAID',                 'payments.create',   false),
    ('READY',               'PAID',                 'payments.create',   false),
    ('PAID',                'PREPARING',            'kitchen.start',     false),
    ('PAID',                'READY',                'kitchen.ready',     false),
    ('PAID',                'SERVED',               'orders.serve',      false),
    ('PAID',                'COMPLETED',            'payments.create',   false),

    -- Pembatalan & Pengembalian dana (Wajib Alasan)
    ('CONFIRMED',           'CANCELLED',            'orders.cancel',     true),
    ('PREPARING',           'CANCELLED',            'orders.cancel',     true),
    ('PAID',                'REFUNDED',             'payments.refund',   true),

    -- Alur VOID untuk kasir & supervisor (Wajib Alasan, untuk pesanan belum dibayar)
    ('SUBMITTED',           'VOID',                 'orders.reject',     true),
    ('PENDING_CONFIRMATION','VOID',                 'orders.reject',     true),
    ('CONFIRMED',           'VOID',                 'payments.create',   true),
    ('PREPARING',           'VOID',                 'payments.create',   true),
    ('READY',               'VOID',                 'payments.create',   true),
    ('SERVED',              'VOID',                 'payments.create',   true),
    ('DRAFT',               'VOID',                 'orders.create_manual', true)
  ) AS t(from_status, to_status, required_permission, requires_reason)
  WHERE t.from_status = p_from
    AND t.to_status   = p_to
$$;

COMMENT ON FUNCTION public.order_transition_rule(text, text) IS
  'Tabel aturan mesin status pesanan: memetakan (from, to) -> izin yang dibutuhkan & keharusan alasan.';
