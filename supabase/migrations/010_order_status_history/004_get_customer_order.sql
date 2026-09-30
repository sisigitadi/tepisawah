-- =============================================================================
-- Tepi Sawah — Migration 010 (part 4): Customer order status read.
--
-- Source: docs/api/API_CONTRACT.md §10.3 (Get Customer Order:
-- `GET /public/orders/:id` — "Customer hanya boleh melihat order yang
-- terkait dengan valid table/session/customer context"; the response must not
-- carry internal permission, audit, supplier/internal, payment-credential or
-- sensitive staff data), §30 (Public Customer Security: "order lookup must not
-- expose arbitrary orders", "customer must not be able to change another
-- table's order", "A public order identifier should not be treated as a
-- sufficient authorization credential"),
-- docs/security/AUTH_RBAC_RLS.md §18 (Public QR Security: server validates
-- table status, server validates session, public API returns minimal
-- information), §19 (Public Order Authorization: "Do not expose arbitrary
-- order data by predictable order ID"), §27 (customers read only through
-- controlled public ordering paths), §28 (items inherit from the order),
-- §29 (history is staff-only — the customer projection never includes it),
-- §34 (SECURITY DEFINER rules: pinned search_path, no dynamic SQL).
--
-- =============================================================================
-- WHAT THIS READ IS
-- =============================================================================
--
-- The controlled public path for a customer to look at the order they just
-- placed. There is deliberately no `anon` RLS policy on `orders`
-- (migration 008 part 1): an anonymous browser holds no grant and cannot
-- select, enumerate or guess orders by id. Every read for a customer comes
-- through this one function, which re-validates the table context the QR
-- established before a single column is projected
-- (AUTH_RBAC_RLS.md §47: validate before you act, even for a read).
--
-- THE ORDER ID IS NOT THE CREDENTIAL (API_CONTRACT.md §30). A customer who
-- somehow learns another table's order number still cannot read it, because
-- the caller must additionally prove the context only that order's own table
-- and session can satisfy:
--
--   * the supplied `p_table_id` / `p_table_session_id` must both be present
--     and must equal the order's own `table_id` / `table_session_id`
--   * the table must still exist and still be active
--   * the session must still exist, belong to that same table, and be OPEN
--
-- Every other state resolves to NULL (the read fails closed): unknown order,
-- mismatched table, mismatched or closed session, archived table, or a
-- staff-created order for a session the caller is not at. The customer sees
-- "Pesanan tidak ditemukan" and nothing about anyone else's order — the same
-- fail-closed shape `resolve_table_qr()` uses for a rejected sticker
-- (migration 006 part 3), and the boundary the submit command enforces on the
-- write side (part 3).
--
-- THE PROJECTION IS DELIBERATELY MINIMAL (API_CONTRACT.md §10.3, §30;
-- AUTH_RBAC_RLS.md §18: "public API returns minimal information"). Nothing
-- internal to the operation of the restaurant is returned:
--
--   * no `idempotency_key` / `submit_idempotency_key` — internal dedup handles
--   * no `created_by` — a staff profile id is sensitive staff information
--   * no `table_id` / `table_session_id` — the caller already holds its own
--     context; echoing them back would only widen the surface
--   * no status history, no actor ids, no reason codes — audit details
--     (AUTH_RBAC_RLS.md §29, §46: "audit visibility is limited")
--   * no permissions, no supplier data, no payment records (§30: the customer
--     path never touches payment data)
--
-- What the customer gets is exactly what their receipt needs: the order
-- number, its current status, their note, the money the server computed, and
-- the snapshotted lines the kitchen is working from (DATABASE_SCHEMA.md
-- §21-§22: the snapshot is the authoritative record of what was charged).
--
-- Reading the lines inside this SECURITY DEFINER frame is the point: the read
-- policies on `order_items` / `order_item_modifiers` grant `authenticated`
-- only (migration 009), so an anonymous customer's own second round trip
-- through RLS would come back silently empty. Returning the lines here gives
-- every caller — anonymous customer included — the complete order, while the
-- re-validated context above stays the only thing that decides whether they
-- see anything at all.
-- =============================================================================
create or replace function public.get_customer_order(
  p_order_id         uuid,
  p_table_id         uuid,
  p_table_session_id uuid
)
returns jsonb
language sql
stable
security definer set search_path = public
as $$
  -- Keys are the column names, the same convention `create_draft_order()`
  -- uses with `to_jsonb` (migration 010 part 2): the query layer's row types
  -- are snake_case, so the mappers read them verbatim.
  select jsonb_build_object(
    'order', jsonb_build_object(
      'id',          o.id,
      'order_number', o.order_number,
      'status',      o.status,
      'notes',       o.notes,
      'subtotal',    o.subtotal,
      'discount',    o.discount,
      'tax',         o.tax,
      'total',       o.total,
      'created_at',  o.created_at,
      'updated_at',  o.updated_at
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',                  i.id,
        'product_name_snapshot', i.product_name_snapshot,
        'unit_price_snapshot',  i.unit_price_snapshot,
        'quantity',            i.quantity,
        'notes',               i.notes,
        'line_total',          i.line_total
      ) order by i.created_at, i.id)
      from public.order_items i
      where i.order_id = o.id
    ), '[]'::jsonb),
    'modifiers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',                  m.id,
        'order_item_id',       m.order_item_id,
        'modifier_name_snapshot', m.modifier_name_snapshot,
        'price_delta_snapshot', m.price_delta_snapshot,
        'quantity',            m.quantity
      ) order by m.created_at, m.id)
      from public.order_item_modifiers m
      where m.order_item_id in (
        select i.id from public.order_items i where i.order_id = o.id
      )
    ), '[]'::jsonb)
  )
  from public.orders o
  where o.id = p_order_id
    -- The context is the credential (API_CONTRACT.md §30). Both ids are
    -- required and must be the order's own — a public order identifier alone
    -- never authorizes this read.
    and p_table_id is not null
    and p_table_id = o.table_id
    and p_table_session_id is not null
    and p_table_session_id = o.table_session_id
    -- The table must still be an active, orderable table.
    and exists (
      select 1 from public.tables t
      where t.id = o.table_id
        and t.is_active
    )
    -- The session must still exist, still belong to this same table, and still
    -- be OPEN — the same live context the submit command demands on the write
    -- side, so the read window and the write window close together when staff
    -- close the visit.
    and exists (
      select 1 from public.table_sessions s
      where s.id = o.table_session_id
        and s.table_id = o.table_id
        and s.status = 'OPEN'
    )
  limit 1
$$;

comment on function public.get_customer_order(uuid, uuid, uuid) is
  'Public customer order status read: re-validates the table + OPEN session context against the order''s own and returns a minimal, customer-safe projection with its snapshotted lines. NULL for an unknown order, a mismatched or closed context, or an archived table.';

-- -----------------------------------------------------------------------------
-- Grants. This is the customer read path, so anonymous customers may call it;
-- the context re-validation inside is the real gate, not the grant. Staff hold
-- `orders.read` and have their own RLS projection, so this function grants them
-- nothing they did not already have.
-- -----------------------------------------------------------------------------
grant execute on function public.get_customer_order(uuid, uuid, uuid)
  to anon, authenticated;
