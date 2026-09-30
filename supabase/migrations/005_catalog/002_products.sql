-- =============================================================================
-- Tepi Sawah — Migration 005 (part 2): Products.
--
-- Source: docs/database/DATABASE_SCHEMA.md §14, docs/database/DATABASE_MIGRATION_PLAN.md
-- §15, docs/api/API_CONTRACT.md §7.2/§7.3, §27 (Price Integrity), §38
-- (unresolved decisions), docs/security/AUTH_RBAC_RLS.md §25, §46.
--
-- Products are the centralized menu source of truth. Two independent switches
-- govern orderability (DATABASE_SCHEMA.md §14 rules):
--
--   is_active     catalog visibility. false = archived; the product leaves
--                 every catalog read and can never be ordered again.
--   is_available  the temporary "86"/out-of-stock switch. An active product
--                 that is unavailable stays visible but cannot be ordered.
--
-- Both are checked server-side (never trusted from a client).
--
-- `price` is `numeric(12,2)` and MUST be non-negative. The stored price is the
-- current catalog price only (API_CONTRACT.md §27); historical orders read
-- their own snapshot columns, never this value. A client-supplied price is
-- never authoritative — it is rejected at the API boundary and again here.
--
-- `image_url` is a *reference* only (TECHNICAL_ARCHITECTURE.md §28): the
-- binary lives in Supabase Storage / CDN, never in Postgres. The column holds
-- a public-safe URL the customer may see; uploading bytes is a later phase.
-- =============================================================================
create table if not exists public.products (
  id           uuid          primary key default gen_random_uuid(),
  category_id  uuid          not null references public.categories(id),
  name         text          not null,
  description  text,
  image_url    text,
  price        numeric(12,2) not null,
  is_active    boolean       not null default true,
  is_available boolean       not null default true,
  sort_order   integer       not null default 0,
  created_at   timestamptz   not null default now(),
  updated_at   timestamptz   not null default now(),
  constraint products_name_not_blank check (btrim(name) <> ''),
  constraint products_price_non_negative check (price >= 0),
  constraint products_sort_order_non_negative check (sort_order >= 0)
);

-- One active product name per category. Same archival rule as categories:
-- archived rows vacate the unique range.
create unique index if not exists products_active_category_name_key
  on public.products (category_id, lower(btrim(name)))
  where is_active = true;

create index if not exists products_category_idx on public.products (category_id);
create index if not exists products_active_idx
  on public.products (is_active, is_available, sort_order, name);

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS — same shape as categories (AUTH_RBAC_RLS.md §25).
--
-- Public users must not change prices, create products, archive products, or
-- flip availability through direct table writes (§25). None of those grants
-- exist; the public path is the read-only projection in part 5.
-- -----------------------------------------------------------------------------
alter table public.products enable row level security;

drop policy if exists "products_select_authorized" on public.products;
create policy "products_select_authorized"
  on public.products
  for select
  to authenticated
  using (
    public.auth_user_id() is not null
    and public.current_user_is_active()
    and public.has_permission('catalog.read')
  );

drop policy if exists "products_insert_authorized" on public.products;
create policy "products_insert_authorized"
  on public.products
  for insert
  to authenticated
  with check (
    public.auth_user_id() is not null
    and public.current_user_is_active()
    and public.has_permission('catalog.create')
  );

drop policy if exists "products_update_authorized" on public.products;
create policy "products_update_authorized"
  on public.products
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

revoke insert, update, delete on public.products from anon;
revoke delete on public.products from authenticated;

-- Catalog management may write every business column. Price is included
-- deliberately: authorized staff set the price of record here, and order
-- creation reads it server-side (§27).
grant insert (category_id, name, description, image_url, price, is_active, is_available, sort_order)
  on public.products to authenticated;
grant update (category_id, name, description, image_url, price, is_active, is_available, sort_order)
  on public.products to authenticated;
