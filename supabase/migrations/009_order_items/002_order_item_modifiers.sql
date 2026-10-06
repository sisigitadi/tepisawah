-- =============================================================================
-- Tepi Sawah — Migration 009 (part 2): Order item modifiers.
--
-- Source: docs/database/DATABASE_SCHEMA.md §22 (order_item_modifiers),
-- docs/database/DATABASE_MIGRATION_PLAN.md §23 (Migration 018 — Order Item
-- Modifiers: "menyimpan modifier yang benar-benar dipilih pada transaksi";
-- "Modifier historical data harus tetap tersedia meskipun catalog modifier
-- berubah"), docs/security/AUTH_RBAC_RLS.md §28 (inherit from parent order),
-- §34 (SECURITY DEFINER rules).
--
-- A row here is a selection that actually happened, frozen. If the restaurant
-- later renames "Level 5" to "Extra Pedas", or changes its price delta from
-- 5.000 to 6.000, past receipts still say what the customer ordered and what
-- they were charged. `modifier_id` stays for traceability; the snapshot
-- columns are the transactional record.
--
-- `quantity` lets one selection stand for "two extra portions of sauce" rather
-- than two duplicate rows; `create_draft_order()` multiplies the delta by it.
-- =============================================================================
create table if not exists public.order_item_modifiers (
  id                    uuid          primary key default gen_random_uuid(),
  order_item_id         uuid          not null references public.order_items(id) on delete cascade,
  modifier_id           uuid          null references public.modifiers(id),
  modifier_name_snapshot text         not null,
  price_delta_snapshot  numeric(12,2) not null default 0,
  quantity              numeric(12,3) not null default 1,
  created_at            timestamptz  not null default now(),

  constraint order_item_modifiers_quantity_positive check (quantity > 0)
);

create index if not exists order_item_modifiers_order_item_id_idx
  on public.order_item_modifiers (order_item_id);

create index if not exists order_item_modifiers_modifier_id_idx
  on public.order_item_modifiers (modifier_id);

alter table public.order_item_modifiers enable row level security;

-- Same inheritance as order_items (AUTH_RBAC_RLS.md §28): the modifier row is
-- visible exactly when its parent item is, which is exactly when that item's
-- order is. No independent authorization to maintain.
drop policy if exists order_item_modifiers_inherit_item_read on public.order_item_modifiers;
create policy order_item_modifiers_inherit_item_read on public.order_item_modifiers
  for select to authenticated
  using (
    exists (
      select 1
      from public.order_items oi
      where oi.id = order_item_modifiers.order_item_id
    )
  );

-- Selections are written only inside `create_draft_order()` (SECURITY
-- DEFINER). A client cannot retroactively add, re-price or remove a modifier
-- from an order line.
revoke insert, update, delete on public.order_item_modifiers from anon, authenticated;
