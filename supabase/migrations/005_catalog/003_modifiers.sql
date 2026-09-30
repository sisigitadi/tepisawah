-- =============================================================================
-- Tepi Sawah — Migration 005 (part 3): Modifiers.
--
-- Source: docs/database/DATABASE_SCHEMA.md §15, docs/database/DATABASE_MIGRATION_PLAN.md
-- §16, docs/security/AUTH_RBAC_RLS.md §25, §46.
--
-- A modifier is a reusable customization (level, option, addon, customization —
-- DATABASE_MIGRATION_PLAN.md §16) with a signed `price_delta` applied on top of
-- the product price. The delta may be negative (a size downgrade) or zero.
--
-- Modifiers are global, then attached to products with selection bounds in
-- part 4 (`product_modifiers`). Availability of a modifier for a product is
-- therefore: this row's `is_active`, the link row, and the product's own
-- active/available state. All three are checked server-side at order time.
--
-- No inventory, recipe or supplier machinery here (CLINE_IMPLEMENTATION_PLAN.md
-- §11 explicitly excludes them).
-- =============================================================================
create table if not exists public.modifiers (
  id           uuid          primary key default gen_random_uuid(),
  name         text          not null,
  description  text,
  price_delta  numeric(12,2) not null default 0,
  is_active    boolean       not null default true,
  created_at   timestamptz   not null default now(),
  updated_at   timestamptz   not null default now(),
  constraint modifiers_name_not_blank check (btrim(name) <> '')
);

-- One active modifier name. Same archival semantics as categories/products.
create unique index if not exists modifiers_active_name_key
  on public.modifiers (lower(btrim(name)))
  where is_active = true;

create index if not exists modifiers_active_name_idx
  on public.modifiers (is_active, name);

drop trigger if exists modifiers_set_updated_at on public.modifiers;
create trigger modifiers_set_updated_at
  before update on public.modifiers
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS (AUTH_RBAC_RLS.md §25). Read needs `catalog.read` (staff catalog access);
-- write needs `modifiers.manage` (§8 — Catalog). Anonymous callers reach
-- modifiers only through the public projection in part 5, and only the ones
-- attached to an active product.
-- -----------------------------------------------------------------------------
alter table public.modifiers enable row level security;

drop policy if exists "modifiers_select_authorized" on public.modifiers;
create policy "modifiers_select_authorized"
  on public.modifiers
  for select
  to authenticated
  using (
    public.auth_user_id() is not null
    and public.current_user_is_active()
    and public.has_permission('catalog.read')
  );

drop policy if exists "modifiers_insert_authorized" on public.modifiers;
create policy "modifiers_insert_authorized"
  on public.modifiers
  for insert
  to authenticated
  with check (
    public.auth_user_id() is not null
    and public.current_user_is_active()
    and public.has_permission('modifiers.manage')
  );

drop policy if exists "modifiers_update_authorized" on public.modifiers;
create policy "modifiers_update_authorized"
  on public.modifiers
  for update
  to authenticated
  using (
    public.auth_user_id() is not null
    and public.current_user_is_active()
    and public.has_permission('modifiers.manage')
  )
  with check (
    public.auth_user_id() is not null
    and public.current_user_is_active()
    and public.has_permission('modifiers.manage')
  );

revoke insert, update, delete on public.modifiers from anon;
revoke delete on public.modifiers from authenticated;

grant insert (name, description, price_delta, is_active) on public.modifiers to authenticated;
grant update (name, description, price_delta, is_active) on public.modifiers to authenticated;
