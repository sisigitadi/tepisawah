-- =============================================================================
-- Tepi Sawah — Migration 005 (part 1): Menu categories.
--
-- Source: docs/database/DATABASE_SCHEMA.md §13, docs/database/DATABASE_MIGRATION_PLAN.md
-- §14, docs/api/API_CONTRACT.md §7.1, docs/security/AUTH_RBAC_RLS.md §25
-- (RLS Pattern: Catalog), §8 (Catalog permissions), §34 (SECURITY DEFINER rules).
--
-- Categories are the top level of the centralized menu source of truth
-- (CLINE_IMPLEMENTATION_PLAN.md §11). Archival is soft: `is_active = false`
-- deactivates a category so it stops being orderable, while historical order
-- rows that reference it stay valid (DATABASE_MIGRATION_PLAN.md §14 — an
-- inactive category never deletes history). No hard DELETE is ever granted.
--
-- `sort_order` is the category ordering the customer and staff apps render by
-- (API_CONTRACT.md §7.1). Name uniqueness is enforced case-insensitively
-- among active categories (DATABASE_SCHEMA.md §13 leaves naming behavior to
-- the business rule; a duplicate active category name is a data-quality bug).
-- =============================================================================
create table if not exists public.categories (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  description text,
  sort_order  integer     not null default 0,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint categories_name_not_blank check (btrim(name) <> ''),
  constraint categories_sort_order_non_negative check (sort_order >= 0)
);

-- One active name at a time. Archived rows keep their name out of the unique
-- range so a category can be archived and a replacement created.
create unique index if not exists categories_active_name_key
  on public.categories (lower(btrim(name)))
  where is_active = true;

create index if not exists categories_active_sort_idx
  on public.categories (is_active, sort_order, name);

-- `updated_at` is maintained by the shared trigger from migration 002.
drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS — the security boundary (AUTH_RBAC_RLS.md §25).
--
-- SELECT: an active authenticated staff session with `catalog.read` sees every
--          category including inactive ones (the admin list needs archived
--          rows). Anonymous callers never touch this table directly: they read
--          the public projection in part 5 instead (§17, §46).
-- INSERT/UPDATE: `categories.manage` (§8 — Catalog).
-- DELETE: never granted — archive, do not delete (API_CONTRACT.md §1004-§1008).
-- -----------------------------------------------------------------------------
alter table public.categories enable row level security;

drop policy if exists "categories_select_authorized" on public.categories;
create policy "categories_select_authorized"
  on public.categories
  for select
  to authenticated
  using (
    public.auth_user_id() is not null
    and public.current_user_is_active()
    and public.has_permission('catalog.read')
  );

drop policy if exists "categories_insert_authorized" on public.categories;
create policy "categories_insert_authorized"
  on public.categories
  for insert
  to authenticated
  with check (
    public.auth_user_id() is not null
    and public.current_user_is_active()
    and public.has_permission('categories.manage')
  );

drop policy if exists "categories_update_authorized" on public.categories;
create policy "categories_update_authorized"
  on public.categories
  for update
  to authenticated
  using (
    public.auth_user_id() is not null
    and public.current_user_is_active()
    and public.has_permission('categories.manage')
  )
  with check (
    public.auth_user_id() is not null
    and public.current_user_is_active()
    and public.has_permission('categories.manage')
  );

revoke insert, update, delete on public.categories from anon;
revoke delete on public.categories from authenticated;

-- Admin writes every column except the surrogate key and timestamps.
grant insert (name, description, sort_order, is_active) on public.categories to authenticated;
grant update (name, description, sort_order, is_active) on public.categories to authenticated;
