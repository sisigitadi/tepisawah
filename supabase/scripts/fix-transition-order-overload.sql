-- =============================================================================
-- FIX DEFINITIF: HAPUS AMBIGUITAS OVERLOAD open_cash_shift & transition_order
-- =============================================================================
-- Jalankan skrip ini di Supabase Dashboard > SQL Editor.
-- Skrip ini menyelesaikan 2 error sekaligus:
-- 1. "Could not choose the best candidate function between: open_cash_shift(...)"
-- 2. "Could not choose the best candidate function between: transition_order(...)"
-- serta memastikan kolom display_name yang valid dari tabel public.profiles digunakan.
-- =============================================================================

-- =============================================================================
-- 1. FIX OPEN_CASH_SHIFT (DROP SEMUA VARIASI OVERLOAD & RECREATE SATU FUNGSI)
-- =============================================================================

-- Drop seluruh variasi parameter open_cash_shift lama
DROP FUNCTION IF EXISTS public.open_cash_shift(text, numeric);
DROP FUNCTION IF EXISTS public.open_cash_shift(numeric, text);
DROP FUNCTION IF EXISTS public.open_cash_shift(numeric);
DROP FUNCTION IF EXISTS public.open_cash_shift(text);
DROP FUNCTION IF EXISTS public.open_cash_shift();

CREATE OR REPLACE FUNCTION public.open_cash_shift(
  p_starting_cash numeric DEFAULT 0,
  p_shift_name    text    DEFAULT 'Shift Kasir'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id uuid;
  v_staff_name text;
  v_active_shift RECORD;
  v_new_shift RECORD;
BEGIN
  v_staff_id := auth.uid();
  IF v_staff_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: sesi kasir tidak terautentikasi.';
  END IF;

  -- Ambil nama kasir dari public.profiles menggunakan display_name
  SELECT COALESCE(NULLIF(trim(display_name), ''), 'Kasir') INTO v_staff_name 
  FROM public.profiles 
  WHERE id = v_staff_id;

  IF v_staff_name IS NULL THEN
    v_staff_name := 'Kasir';
  END IF;

  -- Cek apakah sudah ada shift yang OPEN saat ini
  SELECT * INTO v_active_shift FROM public.cash_shifts WHERE status = 'OPEN' ORDER BY opened_at DESC LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Shift kasir aktif sudah terbuka sebelumnya.',
      'shift', row_to_json(v_active_shift)
    );
  END IF;

  -- Buka shift baru
  INSERT INTO public.cash_shifts (staff_id, staff_name, shift_name, starting_cash, status)
  VALUES (v_staff_id, v_staff_name, COALESCE(NULLIF(trim(p_shift_name), ''), 'Shift Kasir'), COALESCE(p_starting_cash, 0), 'OPEN')
  RETURNING * INTO v_new_shift;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Shift kasir berhasil dibuka.',
    'shift', row_to_json(v_new_shift)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.open_cash_shift(numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_cash_shift() TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_cash_transaction(uuid, text, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_cash_shift(uuid, numeric, text) TO authenticated;


-- =============================================================================
-- 2. FIX TRANSITION_ORDER (DROP SEMUA VARIASI OVERLOAD & RECREATE SATU FUNGSI)
-- =============================================================================

-- Drop seluruh variasi parameter transition_order lama
DROP FUNCTION IF EXISTS public.transition_order(uuid, text, integer, text);
DROP FUNCTION IF EXISTS public.transition_order(uuid, text, int, text);
DROP FUNCTION IF EXISTS public.transition_order(uuid, text, text, bigint);
DROP FUNCTION IF EXISTS public.transition_order(uuid, text, text, integer);

-- Aturan State Machine Transisi
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
    -- Alur normal maju
    ('SUBMITTED',           'PENDING_CONFIRMATION', 'orders.transition', false),
    ('PENDING_CONFIRMATION','CONFIRMED',            'orders.confirm',    false),
    ('PENDING_CONFIRMATION','REJECTED',             'orders.reject',     false),
    ('CONFIRMED',           'PREPARING',            'kitchen.start',     false),
    ('PREPARING',           'READY',                'kitchen.ready',     false),
    ('READY',               'SERVED',               'orders.serve',      false),
    ('SERVED',              'PAID',                 'payments.create',   false),
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

GRANT EXECUTE ON FUNCTION public.order_transition_rule(text, text) TO authenticated;

-- Fungsi transition_order Definitif
CREATE OR REPLACE FUNCTION public.transition_order(
  p_order_id         uuid,
  p_to_status        text,
  p_reason           text DEFAULT NULL,
  p_expected_version bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule        RECORD;
  v_order       public.orders%ROWTYPE;
  v_updated     public.orders%ROWTYPE;
  v_prev_status text;
  v_actor_id    uuid := public.auth_user_id();
  v_actor_role  text;
  v_reason      text;
BEGIN
  -- 1. Verifikasi Aktor (Staf aktif terotentikasi)
  IF v_actor_id IS NULL OR NOT public.current_user_is_active() THEN
    RAISE EXCEPTION 'Not authorized to transition orders' USING errcode = '42501';
  END IF;

  -- 2. Validasi Kosakata Status Tujuan
  IF p_to_status IS NULL OR p_to_status NOT IN (
       'DRAFT', 'SUBMITTED', 'PENDING_CONFIRMATION', 'CONFIRMED', 'PREPARING',
       'READY', 'SERVED', 'PAID', 'COMPLETED',
       'CANCELLED', 'REJECTED', 'VOID', 'REFUNDED'
     )
  THEN
    RAISE EXCEPTION 'Status tujuan tidak valid' USING errcode = '22023';
  END IF;

  -- 3. Load & Kunci Baris Pesanan (Row-Level Lock)
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order tidak ditemukan' USING errcode = 'P0002';
  END IF;

  -- 4. Idempotensi: jika status sudah sesuai, kembalikan data tanpa modifikasi
  IF v_order.status = p_to_status THEN
    RETURN public.order_create_payload(v_order.id);
  END IF;

  -- 5. Optimistic Concurrency Control (Cek Versi)
  IF p_expected_version IS NOT NULL AND v_order.version IS DISTINCT FROM p_expected_version THEN
    RAISE EXCEPTION 'Versi order telah berubah, mohon muat ulang order' USING errcode = '40001';
  END IF;

  -- 6. Validasi Aturan Transisi Status
  SELECT * INTO v_rule FROM public.order_transition_rule(v_order.status, p_to_status);
  IF v_rule.required_permission IS NULL THEN
    RAISE EXCEPTION 'Transisi % -> % tidak diizinkan', v_order.status, p_to_status USING errcode = '23003';
  END IF;

  -- 7. Pengecekan Hak Akses / Permission
  IF NOT (
    public.has_permission(v_rule.required_permission)
    OR (p_to_status = 'VOID' AND (
      public.has_permission('orders.cancel')
      OR public.has_permission('payments.void')
      OR public.is_admin()
      OR public.is_owner()
      OR public.is_supervisor()
    ))
  ) THEN
    RAISE EXCEPTION 'Not authorized untuk transisi % -> %', v_order.status, p_to_status USING errcode = '42501';
  END IF;

  -- 8. Validasi Alasan (Mandatory Reason)
  v_reason := NULLIF(btrim(COALESCE(p_reason, '')), '');
  IF (v_rule.requires_reason OR p_to_status = 'VOID') AND v_reason IS NULL THEN
    RAISE EXCEPTION 'Alasan wajib diisi untuk transisi % -> %', v_order.status, p_to_status USING errcode = '22023';
  END IF;

  -- Khusus VOID: order yang sudah dibayar tidak boleh di-void (harus melalui refund)
  IF p_to_status = 'VOID' AND v_order.status = 'PAID' THEN
    RAISE EXCEPTION 'Pesanan yang sudah dibayar tidak dapat di-void melalui kasir biasa.' USING errcode = '22023';
  END IF;

  -- Dapatkan role aktor saat ini untuk catatan audit trail
  SELECT r.code INTO v_actor_role
  FROM public.role_permissions rp
  JOIN public.permissions p ON p.id = rp.permission_id
  JOIN public.roles r ON r.id = rp.role_id
  WHERE p.code = v_rule.required_permission
    AND rp.role_id IN (
          SELECT ur.role_id FROM public.user_roles ur WHERE ur.user_id = v_actor_id
        )
  ORDER BY r.code LIMIT 1;

  -- 9. Mutasi Status Pesanan Secara Atomik
  v_prev_status := v_order.status;

  UPDATE public.orders
  SET status     = p_to_status,
      version    = version + 1,
      updated_at = now()
  WHERE id = v_order.id
    AND status = v_prev_status
    AND version = v_order.version
  RETURNING * INTO v_updated;

  IF v_updated.id IS NULL THEN
    RAISE EXCEPTION 'Order sudah berubah, mohon muat ulang order' USING errcode = '40001';
  END IF;

  -- 10. Jika berstatus PAID dan modul shift kasir aktif, akumulasi omzet tunai shift
  IF p_to_status = 'PAID' AND to_regclass('public.cash_shifts') IS NOT NULL THEN
    EXECUTE 'UPDATE public.cash_shifts SET cash_sales = cash_sales + $1, updated_at = now() WHERE id = (SELECT id FROM public.cash_shifts WHERE status = ''OPEN'' ORDER BY opened_at DESC LIMIT 1)'
      USING v_updated.total;
  END IF;

  -- 11. Catat Audit Riwayat Transisi Status
  INSERT INTO public.order_status_history (
    order_id, from_status, to_status, actor_id, actor_role, reason
  )
  VALUES (
    v_updated.id, v_prev_status, p_to_status, v_actor_id, v_actor_role, v_reason
  );

  -- 12. Kembalikan payload order lengkap
  RETURN public.order_create_payload(v_updated.id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.transition_order(uuid, text, text, bigint) TO authenticated;
