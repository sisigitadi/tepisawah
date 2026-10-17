-- =============================================================================
-- Tepi Sawah — Migration: Cash Drawer, Shifts, Settings Sync, Auto-Session & Void
-- =============================================================================

-- 1. Pastikan tabel tax_settings memiliki kolom lengkap untuk QRIS, Bank, Sesi Meja, dan Printer
CREATE TABLE IF NOT EXISTS public.tax_settings (
  id uuid PRIMARY KEY DEFAULT '22222222-2222-4222-8222-222222222222',
  tax_enabled boolean NOT NULL DEFAULT true,
  tax_rate numeric(5,2) NOT NULL DEFAULT 10.00,
  tax_name text NOT NULL DEFAULT 'PB1 (Pajak Restoran 10%)',
  tax_calculation text NOT NULL DEFAULT 'exclusive',
  npwpd text DEFAULT 'P.2.0192834.01.24',
  show_npwpd_on_receipt boolean NOT NULL DEFAULT true,
  service_charge_enabled boolean NOT NULL DEFAULT false,
  service_charge_rate numeric(5,2) NOT NULL DEFAULT 5.00,
  service_charge_name text NOT NULL DEFAULT 'Biaya Layanan (5%)',
  rounding text NOT NULL DEFAULT 'none',
  receipt_header_note text DEFAULT 'Kawasan Wisata Sawah, Ciperna, Kec. Talun, Cirebon',
  receipt_footer_note text DEFAULT 'Matur Kesuwun, Hatur Nuhun.\nInstagram: @tepisawah.id',
  receipt_phone text DEFAULT '0812-3456-7890',
  table_session_mode text NOT NULL DEFAULT 'auto',
  qris_image_url text DEFAULT '',
  qris_payload text DEFAULT '',
  bank_name text DEFAULT 'BCA',
  bank_account_number text DEFAULT '',
  bank_account_holder text DEFAULT '',
  printer_paper_width text NOT NULL DEFAULT '80mm',
  printer_auto_print boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tax_settings_singleton CHECK (id = '22222222-2222-4222-8222-222222222222')
);

-- Tambahkan kolom jika tabel tax_settings sudah ada sebelumnya
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tax_settings' AND column_name = 'table_session_mode') THEN
    ALTER TABLE public.tax_settings ADD COLUMN table_session_mode text NOT NULL DEFAULT 'auto';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tax_settings' AND column_name = 'qris_image_url') THEN
    ALTER TABLE public.tax_settings ADD COLUMN qris_image_url text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tax_settings' AND column_name = 'qris_payload') THEN
    ALTER TABLE public.tax_settings ADD COLUMN qris_payload text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tax_settings' AND column_name = 'bank_name') THEN
    ALTER TABLE public.tax_settings ADD COLUMN bank_name text DEFAULT 'BCA';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tax_settings' AND column_name = 'bank_account_number') THEN
    ALTER TABLE public.tax_settings ADD COLUMN bank_account_number text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tax_settings' AND column_name = 'bank_account_holder') THEN
    ALTER TABLE public.tax_settings ADD COLUMN bank_account_holder text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tax_settings' AND column_name = 'printer_paper_width') THEN
    ALTER TABLE public.tax_settings ADD COLUMN printer_paper_width text NOT NULL DEFAULT '80mm';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tax_settings' AND column_name = 'printer_auto_print') THEN
    ALTER TABLE public.tax_settings ADD COLUMN printer_auto_print boolean NOT NULL DEFAULT true;
  END IF;
END $$;

-- Baris default tax_settings
INSERT INTO public.tax_settings (
  id, tax_enabled, tax_rate, tax_name, tax_calculation, npwpd, show_npwpd_on_receipt,
  table_session_mode, bank_name, printer_paper_width, printer_auto_print
) VALUES (
  '22222222-2222-4222-8222-222222222222', true, 10.00, 'PB1 (Pajak Restoran 10%)', 'exclusive', 'P.2.0192834.01.24', true,
  'auto', 'BCA', '80mm', true
) ON CONFLICT (id) DO UPDATE SET updated_at = now();

ALTER TABLE public.tax_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tax_settings_select_all" ON public.tax_settings;
CREATE POLICY "tax_settings_select_all" ON public.tax_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "tax_settings_all_auth" ON public.tax_settings;
CREATE POLICY "tax_settings_all_auth" ON public.tax_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT ON public.tax_settings TO anon, authenticated;
GRANT ALL ON public.tax_settings TO authenticated;

-- =============================================================================
-- 2. TABEL CASH DRAWER & SHIFT KASIR
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.cash_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES auth.users(id),
  staff_name text NOT NULL DEFAULT 'Kasir',
  shift_name text NOT NULL DEFAULT 'Shift Pagi',
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  starting_cash numeric(12,2) NOT NULL DEFAULT 0,
  cash_sales numeric(12,2) NOT NULL DEFAULT 0,
  cash_in numeric(12,2) NOT NULL DEFAULT 0,
  cash_out numeric(12,2) NOT NULL DEFAULT 0,
  expected_cash numeric(12,2) GENERATED ALWAYS AS (starting_cash + cash_sales + cash_in - cash_out) STORED,
  actual_cash numeric(12,2),
  cash_difference numeric(12,2),
  notes text,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_shifts_status ON public.cash_shifts (status);
CREATE INDEX IF NOT EXISTS idx_cash_shifts_opened ON public.cash_shifts (opened_at DESC);

ALTER TABLE public.cash_shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cash_shifts_read_authenticated" ON public.cash_shifts;
CREATE POLICY "cash_shifts_read_authenticated" ON public.cash_shifts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "cash_shifts_write_authenticated" ON public.cash_shifts;
CREATE POLICY "cash_shifts_write_authenticated" ON public.cash_shifts FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT ALL ON public.cash_shifts TO authenticated;

-- Tabel Transaksi Kas Operasional (Kas Masuk / Kas Keluar)
CREATE TABLE IF NOT EXISTS public.cash_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES public.cash_shifts(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('CASH_IN', 'CASH_OUT')),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  reason text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_transactions_shift ON public.cash_transactions (shift_id);

ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cash_transactions_read_authenticated" ON public.cash_transactions;
CREATE POLICY "cash_transactions_read_authenticated" ON public.cash_transactions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "cash_transactions_write_authenticated" ON public.cash_transactions;
CREATE POLICY "cash_transactions_write_authenticated" ON public.cash_transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT ALL ON public.cash_transactions TO authenticated;

-- =============================================================================
-- =============================================================================
-- 3. RPC PENDUKUNG CASH DRAWER
-- =============================================================================

-- Drop overload signatures agar tidak ambigu
DROP FUNCTION IF EXISTS public.open_cash_shift(text, numeric);
DROP FUNCTION IF EXISTS public.open_cash_shift(numeric, text);
DROP FUNCTION IF EXISTS public.open_cash_shift(numeric);
DROP FUNCTION IF EXISTS public.open_cash_shift(text);
DROP FUNCTION IF EXISTS public.open_cash_shift();

-- Buka Shift Kasir Baru
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

  -- Ambil nama kasir
  SELECT COALESCE(NULLIF(trim(display_name), ''), 'Kasir') INTO v_staff_name FROM public.profiles WHERE id = v_staff_id;
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



-- Ambil Shift Kasir Aktif Saat Ini
CREATE OR REPLACE FUNCTION public.get_current_cash_shift()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift RECORD;
  v_txs jsonb;
BEGIN
  SELECT * INTO v_shift FROM public.cash_shifts WHERE status = 'OPEN' ORDER BY opened_at DESC LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('active', false, 'shift', null, 'transactions', '[]'::jsonb);
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.created_at ASC), '[]'::jsonb)
  INTO v_txs
  FROM public.cash_transactions t
  WHERE t.shift_id = v_shift.id;

  RETURN jsonb_build_object(
    'active', true,
    'shift', row_to_json(v_shift),
    'transactions', v_txs
  );
END;
$$;

-- Catat Kas Masuk / Kas Keluar Operasional
CREATE OR REPLACE FUNCTION public.record_cash_transaction(
  p_shift_id uuid,
  p_type text,
  p_amount numeric,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id uuid;
  v_shift RECORD;
  v_tx RECORD;
BEGIN
  v_staff_id := auth.uid();
  IF v_staff_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: sesi kasir tidak terautentikasi.';
  END IF;

  SELECT * INTO v_shift FROM public.cash_shifts WHERE id = p_shift_id AND status = 'OPEN';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shift kasir tidak ditemukan atau sudah ditutup.';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Nominal transaksi kas harus lebih dari 0.';
  END IF;

  IF trim(p_reason) IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'Alasan transaksi kas operasional wajib diisi.';
  END IF;

  INSERT INTO public.cash_transactions (shift_id, type, amount, reason, created_by)
  VALUES (p_shift_id, p_type, p_amount, trim(p_reason), v_staff_id)
  RETURNING * INTO v_tx;

  -- Perbarui agregasi kas di cash_shifts
  IF p_type = 'CASH_IN' THEN
    UPDATE public.cash_shifts SET cash_in = cash_in + p_amount, updated_at = now() WHERE id = p_shift_id;
  ELSE
    UPDATE public.cash_shifts SET cash_out = cash_out + p_amount, updated_at = now() WHERE id = p_shift_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'transaction', row_to_json(v_tx));
END;
$$;

-- Tutup Shift Kasir (Rekonsiliasi Kas Aktual vs Sistem)
CREATE OR REPLACE FUNCTION public.close_cash_shift(
  p_shift_id uuid,
  p_actual_cash numeric,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift RECORD;
  v_expected numeric;
  v_diff numeric;
  v_updated RECORD;
BEGIN
  SELECT * INTO v_shift FROM public.cash_shifts WHERE id = p_shift_id AND status = 'OPEN';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shift kasir tidak ditemukan atau sudah ditutup sebelumnya.';
  END IF;

  v_expected := v_shift.starting_cash + v_shift.cash_sales + v_shift.cash_in - v_shift.cash_out;
  v_diff := p_actual_cash - v_expected;

  UPDATE public.cash_shifts
  SET status = 'CLOSED',
      closed_at = now(),
      actual_cash = p_actual_cash,
      cash_difference = v_diff,
      notes = p_notes,
      updated_at = now()
  WHERE id = p_shift_id
  RETURNING * INTO v_updated;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Shift kasir berhasil ditutup.',
    'shift', row_to_json(v_updated)
  );
END;
$$;

-- =============================================================================
-- 4. PEMBARUAN RPC CREATE_DRAFT_ORDER DENGAN AUTO-SESSION UNTUK DINE_IN
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_draft_order(
  p_source text,
  p_table_id uuid DEFAULT NULL,
  p_table_session_id uuid DEFAULT NULL,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_customer_note text DEFAULT NULL,
  p_internal_note text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_order_type text DEFAULT 'DINE_IN',
  p_customer_name text DEFAULT NULL,
  p_external_reference text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid;
  v_order_type text;
  v_resolved_table_id uuid;
  v_resolved_session_id uuid;
  v_session_mode text;
  v_order_id uuid;
  v_order_number text;
  v_subtotal numeric(12,2) := 0;
  v_tax numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
  v_tax_rate numeric(5,2) := 10.00;
  v_tax_enabled boolean := true;
  v_item jsonb;
  v_product RECORD;
  v_mod_id text;
  v_modifier RECORD;
  v_item_id uuid;
  v_line_total numeric(12,2);
  v_existing_order RECORD;
BEGIN
  v_actor_id := auth.uid();
  v_order_type := upper(COALESCE(p_order_type, 'DINE_IN'));
  IF v_order_type NOT IN ('DINE_IN', 'TAKE_AWAY', 'GOFOOD', 'GRABFOOD', 'SHOPEEFOOD') THEN
    v_order_type := 'DINE_IN';
  END IF;

  -- Cek Idempotency
  IF p_idempotency_key IS NOT NULL AND trim(p_idempotency_key) <> '' THEN
    SELECT * INTO v_existing_order FROM public.orders WHERE idempotency_key = trim(p_idempotency_key) LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'order', row_to_json(v_existing_order),
        'items', (SELECT COALESCE(jsonb_agg(row_to_json(i)), '[]'::jsonb) FROM public.order_items i WHERE i.order_id = v_existing_order.id),
        'modifiers', (SELECT COALESCE(jsonb_agg(row_to_json(m)), '[]'::jsonb) FROM public.order_item_modifiers m WHERE m.order_item_id IN (SELECT id FROM public.order_items WHERE order_id = v_existing_order.id))
      );
    END IF;
  END IF;

  -- Baca mode sesi meja dari tax_settings
  SELECT COALESCE(table_session_mode, 'auto') INTO v_session_mode FROM public.tax_settings LIMIT 1;
  IF v_session_mode IS NULL THEN
    v_session_mode := 'auto';
  END IF;

  v_resolved_table_id := p_table_id;
  v_resolved_session_id := p_table_session_id;

  -- Validasi & Resolusi Meja
  IF v_order_type = 'DINE_IN' THEN
    IF v_resolved_table_id IS NULL THEN
      RAISE EXCEPTION 'Meja wajib dipilih untuk pesanan Makan di Tempat (Dine In).';
    END IF;

    -- Jika session_id belum diberikan, cari sesi OPEN untuk meja ini
    IF v_resolved_session_id IS NULL THEN
      SELECT id INTO v_resolved_session_id
      FROM public.table_sessions
      WHERE table_id = v_resolved_table_id AND status = 'OPEN'
      ORDER BY created_at DESC LIMIT 1;
    END IF;

    -- Jika masih belum ada sesi dan mode adalah AUTO, buka sesi otomatis!
    IF v_resolved_session_id IS NULL THEN
      IF v_session_mode = 'auto' THEN
        INSERT INTO public.table_sessions (table_id, status, opened_by)
        VALUES (v_resolved_table_id, 'OPEN', v_actor_id)
        RETURNING id INTO v_resolved_session_id;
      ELSE
        RAISE EXCEPTION 'Sesi meja belum dibuka. Minta kasir/supervisor membuka sesi sebelum membuat pesanan.';
      END IF;
    END IF;
  ELSE
    -- Take Away / Online Delivery tidak mengunci meja fisik
    v_resolved_table_id := NULL;
    v_resolved_session_id := NULL;
  END IF;

  -- Baca parameter pajak
  SELECT tax_enabled, tax_rate INTO v_tax_enabled, v_tax_rate FROM public.tax_settings LIMIT 1;

  -- Buat Nomor Order Unik
  v_order_number := 'TS-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(floor(random() * 9000 + 1000)::text, 4, '0');

  INSERT INTO public.orders (
    order_number, source, order_type, customer_name, external_reference,
    table_id, table_session_id, status, notes, subtotal, discount, tax, total,
    idempotency_key, created_by, version
  ) VALUES (
    v_order_number, p_source, v_order_type, trim(p_customer_name), trim(p_external_reference),
    v_resolved_table_id, v_resolved_session_id, 'DRAFT', trim(p_customer_note), 0, 0, 0, 0,
    nullif(trim(p_idempotency_key), ''), v_actor_id, 1
  ) RETURNING id INTO v_order_id;

  -- Proses Item Pesanan
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT id, name, price INTO v_product FROM public.products WHERE id = (v_item->>'productId')::uuid;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produk tidak valid: %', v_item->>'productId';
    END IF;

    v_line_total := v_product.price * (v_item->>'quantity')::int;

    INSERT INTO public.order_items (
      order_id, product_id, product_name_snapshot, unit_price_snapshot, quantity, notes, line_total
    ) VALUES (
      v_order_id, v_product.id, v_product.name, v_product.price, (v_item->>'quantity')::int,
      v_item->>'notes', v_line_total
    ) RETURNING id INTO v_item_id;

    -- Modifier Item jika ada
    IF v_item ? 'modifierIds' THEN
      FOR v_mod_id IN SELECT jsonb_array_elements_text(v_item->'modifierIds') LOOP
        SELECT id, name, price_delta INTO v_modifier FROM public.modifiers WHERE id = v_mod_id::uuid;
        IF FOUND THEN
          INSERT INTO public.order_item_modifiers (
            order_item_id, modifier_id, modifier_name_snapshot, price_delta_snapshot, quantity
          ) VALUES (
            v_item_id, v_modifier.id, v_modifier.name, v_modifier.price_delta, 1
          );
          v_line_total := v_line_total + (v_modifier.price_delta * (v_item->>'quantity')::int);
        END IF;
      END LOOP;
    END IF;

    UPDATE public.order_items SET line_total = v_line_total WHERE id = v_item_id;
    v_subtotal := v_subtotal + v_line_total;
  END LOOP;

  -- Hitung Pajak & Total
  IF v_tax_enabled THEN
    v_tax := round(v_subtotal * (v_tax_rate / 100.0), 2);
  ELSE
    v_tax := 0;
  END IF;
  v_total := v_subtotal + v_tax;

  UPDATE public.orders
  SET subtotal = v_subtotal, tax = v_tax, total = v_total
  WHERE id = v_order_id;

  -- Kembalikan payload order lengkap
  SELECT * INTO v_existing_order FROM public.orders WHERE id = v_order_id;
  RETURN jsonb_build_object(
    'order', row_to_json(v_existing_order),
    'items', (SELECT COALESCE(jsonb_agg(row_to_json(i)), '[]'::jsonb) FROM public.order_items i WHERE i.order_id = v_order_id),
    'modifiers', (SELECT COALESCE(jsonb_agg(row_to_json(m)), '[]'::jsonb) FROM public.order_item_modifiers m WHERE m.order_item_id IN (SELECT id FROM public.order_items WHERE order_id = v_order_id))
  );
END;
$$;

-- =============================================================================
-- 5. PEMBARUAN RPC TRANSITION_ORDER (MENDUKUNG VOID, SINKRONISASI KAS SHIFT & CEK RBAC)
-- =============================================================================

-- Drop signature-signature lama agar tidak terjadi ambigu overload di PostgreSQL
DROP FUNCTION IF EXISTS public.transition_order(uuid, text, integer, text);
DROP FUNCTION IF EXISTS public.transition_order(uuid, text, int, text);
DROP FUNCTION IF EXISTS public.transition_order(uuid, text, text, bigint);
DROP FUNCTION IF EXISTS public.transition_order(uuid, text, text, integer);

-- Pastikan order_transition_rule mendukung VOID
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

GRANT EXECUTE ON FUNCTION public.order_transition_rule(text, text) TO authenticated;

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
  v_active_shift_id uuid;
BEGIN
  -- 1. Verifikasi Aktor (Staf aktif terotentikasi)
  IF v_actor_id IS NULL OR NOT public.current_user_is_active() THEN
    RAISE EXCEPTION 'Not authorized to transition orders'
      USING errcode = '42501';
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
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order tidak ditemukan' USING errcode = 'P0002';
  END IF;

  -- 4. Idempotensi: jika status sudah sesuai, kembalikan data tanpa modifikasi
  IF v_order.status = p_to_status THEN
    RETURN public.order_create_payload(v_order.id);
  END IF;

  -- 5. Optimistic Concurrency Control (Cek Versi)
  IF p_expected_version IS NOT NULL
     AND v_order.version IS DISTINCT FROM p_expected_version
  THEN
    RAISE EXCEPTION 'Versi order telah berubah, mohon muat ulang order'
      USING errcode = '40001';
  END IF;

  -- 6. Validasi Aturan Transisi Status
  SELECT * INTO v_rule
  FROM public.order_transition_rule(v_order.status, p_to_status);

  IF v_rule.required_permission IS NULL THEN
    RAISE EXCEPTION 'Transisi % -> % tidak diizinkan', v_order.status, p_to_status
      USING errcode = '23003';
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
    RAISE EXCEPTION 'Not authorized untuk transisi % -> %', v_order.status, p_to_status
      USING errcode = '42501';
  END IF;

  -- 8. Validasi Alasan (Mandatory Reason)
  v_reason := NULLIF(btrim(COALESCE(p_reason, '')), '');

  IF (v_rule.requires_reason OR p_to_status = 'VOID') AND v_reason IS NULL THEN
    RAISE EXCEPTION 'Alasan wajib diisi untuk transisi % -> %', v_order.status, p_to_status
      USING errcode = '22023';
  END IF;

  -- Khusus VOID: order yang sudah dibayar tidak boleh di-void (harus melalui refund)
  IF p_to_status = 'VOID' AND v_order.status = 'PAID' THEN
    RAISE EXCEPTION 'Pesanan yang sudah dibayar tidak dapat di-void melalui kasir biasa.'
      USING errcode = '22023';
  END IF;

  -- Dapatkan role aktor saat ini untuk catatan audit trail
  SELECT r.code INTO v_actor_role
  FROM public.role_permissions rp
  JOIN public.permissions p ON p.id = rp.permission_id
  JOIN public.roles r ON r.id = rp.role_id
  WHERE p.code = v_rule.required_permission
    AND rp.role_id IN (
          SELECT ur.role_id FROM public.user_roles ur
          WHERE ur.user_id = v_actor_id
        )
  ORDER BY r.code
  LIMIT 1;

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
    RAISE EXCEPTION 'Order sudah berubah, mohon muat ulang order'
      USING errcode = '40001';
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

COMMENT ON FUNCTION public.transition_order(uuid, text, text, bigint) IS
  'Otoritas tunggal transisi status pesanan. Memeriksa aktor, aturan transisi, izin, alasan, konkurensi versi (bigint), dan mencatat riwayat audit status.';

GRANT EXECUTE ON FUNCTION public.transition_order(uuid, text, text, bigint) TO authenticated;

