-- =============================================================================
-- Tepi Sawah — Migration 009 (part 1): Order items.
--
-- Source: docs/database/DATABASE_SCHEMA.md §21 (order_items), §20 (rules),
-- docs/database/DATABASE_MIGRATION_PLAN.md §22 (Migration 017 — Order Items:
-- "order_items = historical snapshot"; "Backend menghitung authoritative
-- amount"), docs/security/AUTH_RBAC_RLS.md §28 (RLS Pattern: Order Items —
-- inherit access from the parent order, do not duplicate authorization logic),
-- §34 (SECURITY DEFINER rules).
--
-- THE SNAPSHOT RULE (DATABASE_SCHEMA.md §21): `product_name_snapshot` and
-- `unit_price_snapshot` are authoritative for this line. They are written once
-- by `create_draft_order()` from the live catalog and never updated again. If
-- a product is later renamed, re-priced or archived, this row does not move —
-- a historical transaction stays exactly what it was. `product_id` is kept for
-- traceability and reporting only.
--
-- `line_total` is the server-computed line amount: (unit price + sum of chosen
-- modifier deltas) * quantity. The client never sends it; the CHECK below
-- reconciles it against the snapshots, so a tampered line cannot be stored
-- even by a buggy caller.
-- =============================================================================
create table if not exists public.order_items (
  id                    uuid          primary key default gen_random_uuid(),
  order_id              uuid          not null references public.orders(id) on delete cascade,
  product_id            uuid          null references public.products(id),
  product_name_snapshot text          not null,
  unit_price_snapshot   numeric(12,2) not null,
  quantity              numeric(12,3) not null,
  notes                 text          null,
  line_total            numeric(12,2) not null,
  created_at            timestamptz  not null default now(),
  updated_at            timestamptz  not null default now(),

  -- A line must order something, at a non-negative price. Quantity is
  -- numeric(12,3) because the schema allows fractional units (e.g. a half
  -- kilogram); zero or negative quantity is never a real order line.
  constraint order_items_quantity_positive check (quantity > 0),
  constraint order_items_price_non_negative check (unit_price_snapshot >= 0),
  constraint order_items_line_total_non_negative check (line_total >= 0)
);

create index if not exists order_items_order_id_idx
  on public.order_items (order_id);

create index if not exists order_items_product_id_idx
  on public.order_items (product_id);

alter table public.order_items enable row level security;

-- -----------------------------------------------------------------------------
-- RLS (AUTH_RBAC_RLS.md §28): order items inherit access from their parent
-- order. There is exactly one policy, and it delegates to the orders policy by
-- existence — an item is visible to a caller who may see its order, and to
-- nobody else. Authorization lives on `orders`, so this table carries no
-- independent permission check to drift out of sync.
-- -----------------------------------------------------------------------------
create policy order_items_inherit_order_read on public.order_items
  for select to authenticated
  using (
    exists (
      select 1
      from public.orders o
      where o.id = order_items.order_id
    )
  );

-- No write grants: items are created only inside `create_draft_order()`, which
-- is SECURITY DEFINER, so the client cannot insert, edit or delete a line.
-- Re-pricing a historical line is impossible from the client by construction.
revoke insert, update, delete on public.order_items from anon, authenticated;
