-- =============================================================================
-- Migration: Add Take Away, Online Delivery (GoFood, GrabFood, ShopeeFood)
-- and non-table order support.
-- =============================================================================

-- 1. Make table_id and table_session_id nullable on orders table
ALTER TABLE public.orders ALTER COLUMN table_id DROP NOT NULL;
ALTER TABLE public.orders ALTER COLUMN table_session_id DROP NOT NULL;

-- 2. Add order_type, customer_name, and external_reference
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_type text NOT NULL DEFAULT 'DINE_IN';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_name text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS external_reference text;

-- 3. Constraint for order_type vocabulary
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_type_vocabulary;
ALTER TABLE public.orders ADD CONSTRAINT orders_order_type_vocabulary
  CHECK (order_type IN ('DINE_IN', 'TAKE_AWAY', 'GOFOOD', 'GRABFOOD', 'SHOPEEFOOD'));

CREATE INDEX IF NOT EXISTS orders_order_type_idx ON public.orders (order_type);

-- 4. Drop old create_draft_order signatures to avoid function overloading conflicts
DROP FUNCTION IF EXISTS public.create_draft_order(text, uuid, uuid, jsonb, text, text, text);
DROP FUNCTION IF EXISTS public.create_draft_order(text, uuid, uuid, jsonb, text, text, text, text, text, text);

-- 5. Create new create_draft_order supporting order_type, customer_name, external_reference
CREATE OR REPLACE FUNCTION public.create_draft_order(
  p_source             text,
  p_table_id           uuid default null,
  p_table_session_id   uuid default null,
  p_items              jsonb default '[]'::jsonb,
  p_customer_note      text default null,
  p_internal_note      text default null,
  p_idempotency_key    text default null,
  p_order_type         text default 'DINE_IN',
  p_customer_name      text default null,
  p_external_reference text default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order        public.orders%rowtype;
  v_table        public.tables%rowtype;
  v_session      public.table_sessions%rowtype;
  v_product      public.products%rowtype;
  v_modifier     public.modifiers%rowtype;
  v_items        jsonb;
  v_item         jsonb;
  v_mod_ids      uuid[];
  v_mod_id       uuid;
  v_product_mods record;
  v_selected     int;
  v_unit_price   numeric(12,2);
  v_line_total   numeric(12,2);
  v_subtotal     numeric(12,2) := 0;
  v_new_id       uuid := gen_random_uuid();
  v_item_id      uuid;
  v_order_number text;
  v_actor_id     uuid;
  v_actor_role   text;
  v_max          int;
  v_i            int;
BEGIN
  -- 1. Authorize source
  IF p_source IS NULL OR NOT (p_source IN ('CUSTOMER_QR', 'WAITER', 'POS')) THEN
    RAISE EXCEPTION 'Sumber order tidak valid' USING errcode = '22023';
  END IF;

  -- Validate order_type
  IF p_order_type IS NULL OR NOT (p_order_type IN ('DINE_IN', 'TAKE_AWAY', 'GOFOOD', 'GRABFOOD', 'SHOPEEFOOD')) THEN
    RAISE EXCEPTION 'Tipe pesanan tidak valid' USING errcode = '22023';
  END IF;

  IF p_source IN ('WAITER', 'POS') THEN
    IF public.auth_user_id() IS NULL OR NOT public.current_user_is_active()
       OR NOT public.has_permission('orders.create_manual')
    THEN
      RAISE EXCEPTION 'Not authorized to create manual orders' USING errcode = '42501';
    END IF;
    v_actor_id := public.auth_user_id();
    SELECT r.code INTO v_actor_role
    FROM public.role_permissions rp
    JOIN public.permissions p ON p.id = rp.permission_id
    JOIN public.roles r ON r.id = rp.role_id
    WHERE rp.permission_id = (
            SELECT id FROM public.permissions WHERE code = 'orders.create_manual'
          )
      AND rp.role_id IN (SELECT role_id FROM public.user_roles WHERE user_id = v_actor_id)
    LIMIT 1;
  ELSE
    -- Customer QR draft: only allowed for DINE_IN with table
    IF p_order_type <> 'DINE_IN' THEN
      RAISE EXCEPTION 'Pesanan non-meja hanya dapat dibuat oleh staf' USING errcode = '42501';
    END IF;
    v_actor_id := NULL;
    v_actor_role := NULL;
  END IF;

  -- 2. Validate table context if DINE_IN
  IF p_order_type = 'DINE_IN' THEN
    IF p_table_id IS NULL OR p_table_session_id IS NULL THEN
      RAISE EXCEPTION 'Konteks meja dan sesi wajib untuk pesanan Dine In' USING errcode = '22023';
    END IF;

    SELECT * INTO v_table
    FROM public.tables
    WHERE id = p_table_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Meja tidak ditemukan' USING errcode = 'P0002';
    END IF;

    IF NOT v_table.is_active THEN
      RAISE EXCEPTION 'Meja % tidak aktif', v_table.table_code USING errcode = '23003';
    END IF;

    SELECT * INTO v_session
    FROM public.table_sessions
    WHERE id = p_table_session_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Sesi meja tidak ditemukan' USING errcode = 'P0002';
    END IF;

    IF v_session.status <> 'OPEN' THEN
      RAISE EXCEPTION 'Sesi meja sudah ditutup' USING errcode = '23003';
    END IF;

    IF v_session.table_id <> p_table_id THEN
      RAISE EXCEPTION 'Sesi tidak terhubung ke meja ini' USING errcode = '23003';
    END IF;
  END IF;

  -- 3. Items validation
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Order harus memiliki minimal satu item' USING errcode = '22023';
  END IF;

  -- 4. Idempotency check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_order
    FROM public.orders
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
      RETURN public.order_create_payload(v_order.id);
    END IF;
  END IF;

  -- 5. Validate & price items from authoritative catalog
  v_items := COALESCE(p_items, '[]'::jsonb);

  FOR v_i IN 0..jsonb_array_length(v_items) - 1 LOOP
    v_item := v_items->v_i;

    IF (v_item->>'quantity')::numeric IS NULL
       OR (v_item->>'quantity')::numeric <= 0
       OR (v_item->>'quantity')::numeric > 999
    THEN
      RAISE EXCEPTION 'Jumlah item tidak valid' USING errcode = '22023';
    END IF;

    SELECT * INTO v_product
    FROM public.products
    WHERE id = (v_item->>'productId')::uuid
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produk tidak ditemukan' USING errcode = 'P0002';
    END IF;

    IF NOT v_product.is_active THEN
      RAISE EXCEPTION 'Produk % tidak aktif', v_product.name USING errcode = '23003';
    END IF;

    IF NOT v_product.is_available THEN
      RAISE EXCEPTION 'Produk % sedang tidak tersedia', v_product.name USING errcode = 'P0003';
    END IF;

    v_unit_price := v_product.price;
    v_line_total := v_unit_price * (v_item->>'quantity')::numeric;

    v_mod_ids := COALESCE(
      ARRAY(SELECT (jsonb_array_elements_text(v_item->'modifierIds'))::uuid),
      ARRAY[]::uuid[]
    );

    FOREACH v_mod_id IN ARRAY v_mod_ids LOOP
      SELECT * INTO v_modifier
      FROM public.modifiers
      WHERE id = v_mod_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Modifier tidak ditemukan' USING errcode = 'P0002';
      END IF;

      IF NOT v_modifier.is_active THEN
        RAISE EXCEPTION 'Modifier % tidak aktif', v_modifier.name USING errcode = '23003';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM public.product_modifiers pm
        WHERE pm.product_id = v_product.id AND pm.modifier_id = v_mod_id
      ) THEN
        RAISE EXCEPTION 'Modifier % tidak tersedia untuk produk ini', v_modifier.name USING errcode = '23003';
      END IF;

      v_line_total := v_line_total + v_modifier.price_delta * (v_item->>'quantity')::numeric;
    END LOOP;

    -- Group rules
    FOR v_product_mods IN
      SELECT DISTINCT
        mg.id AS group_id,
        mg.name AS group_name,
        pm.is_required,
        pm.min_selection,
        pm.max_selection
      FROM public.product_modifiers pm
      JOIN public.modifiers m ON m.id = pm.modifier_id
      JOIN public.modifier_groups mg ON mg.id = m.group_id
      WHERE pm.product_id = v_product.id
    LOOP
      SELECT COUNT(*) INTO v_selected
      FROM unnest(v_mod_ids) mid
      JOIN public.modifiers m ON m.id = mid
      WHERE m.group_id = v_product_mods.group_id;

      IF v_product_mods.is_required AND v_selected < COALESCE(v_product_mods.min_selection, 1) THEN
        RAISE EXCEPTION 'Modifier % wajib dipilih untuk produk ini', v_product_mods.group_name
          USING errcode = '23003';
      END IF;

      v_max := COALESCE(v_product_mods.max_selection, 1);
      IF v_max > 0 AND v_selected > v_max THEN
        RAISE EXCEPTION 'Maksimal % pilihan untuk modifier %', v_max, v_product_mods.group_name
          USING errcode = '23003';
      END IF;
    END LOOP;

    v_subtotal := v_subtotal + v_line_total;
  END LOOP;

  -- 6. Generate order number
  v_order_number := 'TS-' || to_char(now() at time zone 'Asia/Jakarta', 'YYYYMMDD') || '-'
                    || lpad(nextval('public.order_number_seq')::text, 4, '0');

  -- 7. Insert orders row
  INSERT INTO public.orders (
    id, order_number, table_id, table_session_id, source, status,
    order_type, customer_name, external_reference,
    notes, subtotal, discount, tax, total,
    idempotency_key, created_by
  )
  VALUES (
    v_new_id, v_order_number, p_table_id, p_table_session_id, p_source, 'DRAFT',
    p_order_type, p_customer_name, p_external_reference,
    p_customer_note,
    v_subtotal, 0, 0, v_subtotal,
    p_idempotency_key, v_actor_id
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING * INTO v_order;

  IF v_order.id IS NULL THEN
    SELECT * INTO v_order
    FROM public.orders
    WHERE idempotency_key = p_idempotency_key;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Order tidak dapat dibuat' USING errcode = 'P0003';
    END IF;

    RETURN public.order_create_payload(v_order.id);
  END IF;

  -- 8. Insert order items & modifiers snapshot
  FOR v_i IN 0..jsonb_array_length(v_items) - 1 LOOP
    v_item := v_items->v_i;

    SELECT * INTO v_product
    FROM public.products
    WHERE id = (v_item->>'productId')::uuid;

    v_unit_price := v_product.price;
    v_line_total := v_unit_price * (v_item->>'quantity')::numeric;

    v_mod_ids := COALESCE(
      ARRAY(SELECT (jsonb_array_elements_text(v_item->'modifierIds'))::uuid),
      ARRAY[]::uuid[]
    );

    FOREACH v_mod_id IN ARRAY v_mod_ids LOOP
      SELECT * INTO v_modifier FROM public.modifiers WHERE id = v_mod_id;
      v_line_total := v_line_total + v_modifier.price_delta * (v_item->>'quantity')::numeric;
    END LOOP;

    INSERT INTO public.order_items (
      order_id, product_id, product_name_snapshot, unit_price_snapshot,
      quantity, notes, line_total
    )
    VALUES (
      v_new_id, v_product.id, v_product.name, v_unit_price,
      (v_item->>'quantity')::numeric, v_item->>'notes', v_line_total
    )
    RETURNING id INTO v_item_id;

    FOREACH v_mod_id IN ARRAY v_mod_ids LOOP
      SELECT * INTO v_modifier FROM public.modifiers WHERE id = v_mod_id;

      INSERT INTO public.order_item_modifiers (
        order_item_id, modifier_id, modifier_name_snapshot,
        price_delta_snapshot, quantity
      )
      VALUES (
        v_item_id, v_modifier.id, v_modifier.name, v_modifier.price_delta,
        (v_item->>'quantity')::numeric
      );
    END LOOP;
  END LOOP;

  -- 9. Status history
  INSERT INTO public.order_status_history (
    order_id, from_status, to_status, actor_id, actor_role, reason
  )
  VALUES (v_new_id, NULL, 'DRAFT', v_actor_id, v_actor_role, NULL);

  RETURN public.order_create_payload(v_new_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_draft_order(
  text, uuid, uuid, jsonb, text, text, text, text, text, text
) TO anon, authenticated;

-- 6. Update submit_order to allow non-table orders
CREATE OR REPLACE FUNCTION public.submit_order(
  p_order_id          uuid,
  p_source            text,
  p_table_id          uuid default null,
  p_table_session_id  uuid default null,
  p_idempotency_key   text default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order        public.orders%rowtype;
  v_existing     public.orders%rowtype;
  v_updated      public.orders%rowtype;
  v_table        public.tables%rowtype;
  v_session      public.table_sessions%rowtype;
  v_item         public.order_items%rowtype;
  v_product      public.products%rowtype;
  v_modifier     public.modifiers%rowtype;
  v_line_total   numeric(12,2);
  v_mod_total    numeric(12,2);
  v_recomputed   numeric(12,2) := 0;
  v_actor_id     uuid;
  v_actor_role   text;
BEGIN
  -- 1. Authorize
  IF p_source IS NULL OR NOT (p_source IN ('CUSTOMER_QR', 'WAITER', 'POS')) THEN
    RAISE EXCEPTION 'Sumber order tidak valid' USING errcode = '22023';
  END IF;

  IF p_source IN ('WAITER', 'POS') THEN
    IF public.auth_user_id() IS NULL OR NOT public.current_user_is_active()
       OR NOT public.has_permission('orders.create_manual')
    THEN
      RAISE EXCEPTION 'Not authorized to submit manual orders' USING errcode = '42501';
    END IF;
    v_actor_id := public.auth_user_id();
    SELECT r.code INTO v_actor_role
    FROM public.role_permissions rp
    JOIN public.permissions p ON p.id = rp.permission_id
    JOIN public.roles r ON r.id = rp.role_id
    WHERE rp.permission_id = (
            SELECT id FROM public.permissions WHERE code = 'orders.create_manual'
          )
      AND rp.role_id IN (SELECT role_id FROM public.user_roles WHERE user_id = v_actor_id)
    LIMIT 1;
  ELSE
    v_actor_id := NULL;
    v_actor_role := NULL;
  END IF;

  -- 2. Idempotency check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.orders
    WHERE submit_idempotency_key = p_idempotency_key;

    IF FOUND THEN
      RETURN public.order_create_payload(v_existing.id);
    END IF;
  END IF;

  -- 3. Load and lock
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order tidak ditemukan' USING errcode = 'P0002';
  END IF;

  IF v_order.status <> 'DRAFT' THEN
    RAISE EXCEPTION 'Order sudah disubmit' USING errcode = '23003';
  END IF;

  IF v_order.source <> p_source THEN
    RAISE EXCEPTION 'Sumber order tidak cocok untuk order ini' USING errcode = '22023';
  END IF;

  -- 4. Validate table context only if DINE_IN or table_id is set
  IF v_order.order_type = 'DINE_IN' OR v_order.table_id IS NOT NULL THEN
    IF p_source = 'CUSTOMER_QR' THEN
      IF p_table_id IS NULL OR p_table_session_id IS NULL THEN
        RAISE EXCEPTION 'Konteks meja wajib untuk submit pesanan' USING errcode = '22023';
      END IF;

      IF p_table_id <> v_order.table_id THEN
        RAISE EXCEPTION 'Order tidak terkait dengan meja ini' USING errcode = '23003';
      END IF;

      IF p_table_session_id <> v_order.table_session_id THEN
        RAISE EXCEPTION 'Order tidak terkait dengan sesi ini' USING errcode = '23003';
      END IF;
    END IF;

    SELECT * INTO v_table
    FROM public.tables
    WHERE id = v_order.table_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Meja tidak ditemukan' USING errcode = 'P0002';
    END IF;

    IF NOT v_table.is_active THEN
      RAISE EXCEPTION 'Meja % tidak aktif', v_table.table_code USING errcode = '23003';
    END IF;

    SELECT * INTO v_session
    FROM public.table_sessions
    WHERE id = v_order.table_session_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Sesi meja tidak ditemukan' USING errcode = 'P0002';
    END IF;

    IF v_session.status <> 'OPEN' THEN
      RAISE EXCEPTION 'Sesi meja sudah ditutup' USING errcode = '23003';
    END IF;
  END IF;

  -- 5. Items verification and price re-derivation (anti-stale price)
  IF NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id = v_order.id) THEN
    RAISE EXCEPTION 'Order tidak memiliki item' USING errcode = '23003';
  END IF;

  FOR v_item IN
    SELECT * FROM public.order_items
    WHERE order_id = v_order.id
    ORDER BY created_at, id
    FOR UPDATE
  LOOP
    SELECT * INTO v_product
    FROM public.products
    WHERE id = v_item.product_id;

    IF NOT FOUND OR NOT v_product.is_active OR NOT v_product.is_available THEN
      RAISE EXCEPTION 'Menu telah berubah, silakan buat ulang pesanan' USING errcode = '23003';
    END IF;

    v_line_total := v_product.price * v_item.quantity;

    SELECT COALESCE(SUM(m.price_delta * oim.quantity), 0)
    INTO v_mod_total
    FROM public.order_item_modifiers oim
    JOIN public.modifiers m ON m.id = oim.modifier_id
    WHERE oim.order_item_id = v_item.id
      AND m.is_active = true;

    v_line_total := v_line_total + v_mod_total;
    v_recomputed := v_recomputed + v_line_total;
  END LOOP;

  IF v_recomputed <> v_order.subtotal THEN
    RAISE EXCEPTION 'Harga menu telah berubah, silakan buat ulang pesanan' USING errcode = '23003';
  END IF;

  -- 6. Transition DRAFT -> SUBMITTED -> PENDING_CONFIRMATION atomically
  UPDATE public.orders
  SET status = 'PENDING_CONFIRMATION',
      submit_idempotency_key = p_idempotency_key,
      updated_at = now()
  WHERE id = v_order.id
  RETURNING * INTO v_updated;

  INSERT INTO public.order_status_history (
    order_id, from_status, to_status, actor_id, actor_role, reason
  )
  VALUES
    (v_order.id, 'DRAFT', 'SUBMITTED', v_actor_id, v_actor_role, 'Customer / Waiter submitted'),
    (v_order.id, 'SUBMITTED', 'PENDING_CONFIRMATION', v_actor_id, v_actor_role, 'Awaiting cashier confirmation');

  RETURN public.order_create_payload(v_updated.id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_order(
  uuid, text, uuid, uuid, text
) TO anon, authenticated;
