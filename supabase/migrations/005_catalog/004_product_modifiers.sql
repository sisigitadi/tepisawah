-- =============================================================================
-- Tepi Sawah — Migration 005 (part 4): Product ↔ modifier links.
--
-- Source: docs/database/DATABASE_SCHEMA.md §16, docs/database/DATABASE_MIGRATION_PLAN.md
-- §17, docs/security/AUTH_RBAC_RLS.md §25, §46.
--
-- `product_modifiers` attaches a global modifier to a product and states how a
-- customer may select it. The PK is the composite (product_id, modifier_id), so
-- a modifier is attached to a product at most once.
--
-- Selection bounds (validated server-side, DATABASE_SCHEMA.md §16):
--   is_required  the customer must pick at least one option from this group
--   min_select   minimum options the customer must pick (>= 0)
--   max_select   maximum options the customer may pick (>= min_select, >= 1)
--
-- The link has no updated_at and no soft-delete column: unlinking is a delete.
-- That is safe because nothing historical references this table — order
-- snapshots copy modifier names and price deltas into order_item_modifiers
-- (migration 010/017 area, API_CONTRACT.md §27), so removing a link cannot
-- damage history. Deletion is still revoked from clients; only the archive of
-- the product or modifier (is_active) is client-reachable, and the projection
-- in part 5 filters both.
-- =============================================================================
create table if not exists public.product_modifiers (
  product_id  uuid     not null references public.products(id),
  modifier_id uuid     not null references public.modifiers(id),
  is_required boolean  not null default false,
  min_select  integer  not null default 0,
  max_select  integer  not null default 1,
  sort_order  integer  not null default 0,
  created_at  timestamptz not null default now(),
  constraint product_modifiers_pkey primary key (product_id, modifier_id),
  constraint product_modifiers_min_select_non_negative check (min_select >= 0),
  constraint product_modifiers_max_select_at_least_one check (max_select >= 1),
  constraint product_modifiers_max_ge_min check (max_select >= min_select),
  constraint product_modifiers_required_implies_min_one
    check (is_required = false or min_select >= 1),
  constraint product_modifiers_sort_order_non_negative check (sort_order >= 0)
);

create index if not exists product_modifiers_modifier_idx
  on public.product_modifiers (modifier_id);
create index if not exists product_modifiers_product_sort_idx
  on public.product_modifiers (product_id, sort_order, modifier_id);

-- -----------------------------------------------------------------------------
-- RLS (AUTH_RBAC_RLS.md §25). Read needs `catalog.read`; writing the links of a
-- product is part of managing that product, so the gate is `catalog.update`.
-- No updated_at trigger: the table has no updated_at column.
-- -----------------------------------------------------------------------------
alter table public.product_modifiers enable row level security;

drop policy if exists "product_modifiers_select_authorized" on public.product_modifiers;
create policy "product_modifiers_select_authorized"
  on public.product_modifiers
  for select
  to authenticated
  using (
    public.auth_user_id() is not null
    and public.current_user_is_active()
    and public.has_permission('catalog.read')
  );

drop policy if exists "product_modifiers_insert_authorized" on public.product_modifiers;
create policy "product_modifiers_insert_authorized"
  on public.product_modifiers
  for insert
  to authenticated
  with check (
    public.auth_user_id() is not null
    and public.current_user_is_active()
    and public.has_permission('catalog.update')
  );

drop policy if exists "product_modifiers_update_authorized" on public.product_modifiers;
create policy "product_modifiers_update_authorized"
  on public.product_modifiers
  for update
  to authenticated
  using (
    public.auth_user_id() is not null
    and public.current_user_is_active()
    and public.has_permission('catalog.update')
  )
  with check (
    public.auth_user_id() is not null
    and public.current_user_is_active()
    and public.has_permission('catalog.update')
  );

drop policy if exists "product_modifiers_delete_authorized" on public.product_modifiers;
create policy "product_modifiers_delete_authorized"
  on public.product_modifiers
  for delete
  to authenticated
  using (
    public.auth_user_id() is not null
    and public.current_user_is_active()
    and public.has_permission('catalog.update')
  );

revoke insert, update, delete on public.product_modifiers from anon;

grant insert (product_id, modifier_id, is_required, min_select, max_select, sort_order)
  on public.product_modifiers to authenticated;
grant update (is_required, min_select, max_select, sort_order)
  on public.product_modifiers to authenticated;
