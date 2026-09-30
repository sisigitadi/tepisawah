-- =============================================================================
-- Tepi Sawah — Migration 004 (part 1): Restaurant settings.
--
-- Source: docs/database/DATABASE_SCHEMA.md §11 (restaurant_settings),
-- docs/database/DATABASE_MIGRATION_PLAN.md §12, docs/api/API_CONTRACT.md §8.2,
-- docs/security/AUTH_RBAC_RLS.md §20-§21, §33-§34, §39-§40.
--
-- The single restaurant configuration row: name, address, contact, timezone,
-- currency and branding. One row only (DATABASE_SCHEMA.md §11 — "For MVP,
-- assume one restaurant configuration"), enforced by a fixed singleton key.
--
-- The migration is deliberately structure-only: no row is inserted here.
-- Operational values (address, phone, timezone, currency) must come from
-- approved configuration (DATABASE_SCHEMA.md §11, API_CONTRACT.md §38 —
-- "restaurant timezone / operating hours / currency configuration" are
-- unresolved decisions before production). Seed rows for development and test
-- land in supabase/seed (DATABASE_MIGRATION_PLAN.md §37); production is
-- seeded server-side from the approved configuration. The client may never
-- INSERT or DELETE this row (see part 3).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- restaurant_settings (DATABASE_SCHEMA.md §11).
--
-- timezone: IANA zone name (e.g. 'Asia/Jakarta'); the format guard below keeps
--   junk out, the full IANA validity check happens in the application layer
--   (packages/database models) and is what the admin UI validates against.
-- currency: ISO 4217 code (e.g. 'IDR').
-- logo_url / primary_color: branding, nullable until a brand asset exists.
-- -----------------------------------------------------------------------------
create table if not exists public.restaurant_settings (
  id            uuid primary key default '11111111-1111-4111-8111-111111111111',
  restaurant_name text      not null,
  address        text      not null,
  phone          text,
  email          text,
  timezone       text      not null,
  currency       text      not null,
  logo_url       text,
  primary_color  text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint restaurant_settings_singleton
    check (id = '11111111-1111-4111-8111-111111111111'),
  constraint restaurant_settings_timezone_format
    check (timezone ~ '^[A-Za-z0-9_+/-]+$'),
  constraint restaurant_settings_currency_iso
    check (currency ~ '^[A-Z]{3}$'),
  constraint restaurant_settings_email_format
    check (email is null or email ~ '^[^@[:space:]]+@[^@[:space:]]+$')
);

comment on table public.restaurant_settings is
  'Single restaurant configuration row (DATABASE_SCHEMA.md §11). Client may read/update only; never insert or delete.';
comment on column public.restaurant_settings.timezone is
  'IANA timezone name; ordering availability is computed in this zone.';
comment on column public.restaurant_settings.currency is
  'ISO 4217 currency code.';

-- Only one row can ever exist: the singleton CHECK pins the PK and the default
-- fills it, so an idempotent seed is a plain upsert on that id.
create unique index if not exists restaurant_settings_singleton_idx
  on public.restaurant_settings (id);

-- updated_at maintenance. The trigger function is defined by migration 002.
drop trigger if exists restaurant_settings_set_updated_at on public.restaurant_settings;
create trigger restaurant_settings_set_updated_at
  before update on public.restaurant_settings
  for each row
  execute function public.set_updated_at();

-- =============================================================================
-- Row Level Security (AUTH_RBAC_RLS.md §20-§21).
--
-- Answers the six questions (§21) through the migration 003 helpers:
--   1. authenticated?  -> auth_user_id() is not null
--   2. active?         -> current_user_is_active()
--   3/4. roles/perms? -> has_permission('settings.read' | 'settings.manage')
--   5. row domain?    -> the singleton: every row is the restaurant's config
--   6. public?        -> not on this table. The public-safe projection is the
--      public_restaurant_settings() function in part 3 (§46: field-level
--      exposure through functions, not UI hiding). Anon has no grant on this
--      table at all.
--
-- No policy is unconditional (§34, migration plan §34): every predicate
-- answers authentication, activation and permission.
-- =============================================================================
alter table public.restaurant_settings enable row level security;

-- SELECT: any active staff holder of settings.read (admin and owner in the
-- baseline; supervisor is deliberately excluded — AUTH_RBAC_RLS.md §11).
drop policy if exists "restaurant_settings_select_authorized" on public.restaurant_settings;
create policy "restaurant_settings_select_authorized"
  on public.restaurant_settings
  for select
  to authenticated
  using (
    public.auth_user_id() is not null
    and public.current_user_is_active()
    and public.has_permission('settings.read')
  );

-- UPDATE: an active holder of settings.manage. This is a sensitive action
-- (AUTH_RBAC_RLS.md §39) and must produce a SETTINGS_UPDATED audit event; the
-- audit table lands with migration 014, so the application layer records the
-- change descriptor today (packages/database settings queries).
drop policy if exists "restaurant_settings_update_authorized" on public.restaurant_settings;
create policy "restaurant_settings_update_authorized"
  on public.restaurant_settings
  for update
  to authenticated
  using (
    public.auth_user_id() is not null
    and public.current_user_is_active()
    and public.has_permission('settings.manage')
  )
  with check (
    public.auth_user_id() is not null
    and public.current_user_is_active()
    and public.has_permission('settings.manage')
  );

-- The singleton row is created server-side (seed / approved configuration),
-- never from the browser. No INSERT or DELETE policy exists for any role.
revoke insert, delete on public.restaurant_settings from authenticated, anon;

-- Administrative updates may not touch the keys or the audit timestamps;
-- is_active-style flags do not exist on this table.
revoke update on public.restaurant_settings from authenticated;
grant update (
  restaurant_name, address, phone, email, timezone, currency, logo_url, primary_color
) on public.restaurant_settings to authenticated;
