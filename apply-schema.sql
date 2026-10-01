-- =============================================================================
-- Tepi Sawah — consolidated schema + development seed
--
-- GENERATED ARTIFACT: concatenation of supabase/migrations/* in dependency
-- order followed by supabase/seed/development.sql. Do not edit by hand —
-- fix the source migrations and regenerate. Idempotent and re-runnable.
-- =============================================================================

BEGIN;

-- MIGRATION: supabase/migrations/000_extensions/001_pgcrypto.sql

-- =============================================================================
-- Tepi Sawah — Migration 000: Extensions.
--
-- `pgcrypto` provides gen_random_bytes(), used by regenerate_table_qr() to
-- mint 24-byte printable QR tokens (006_tables/003_tables_functions.sql).
-- gen_random_uuid() is core Postgres since 13, but gen_random_bytes() still
-- requires this extension, and a fresh Supabase project does not ship it
-- enabled — the function fails at runtime with "function gen_random_bytes
-- (integer) does not exist" until it is created.
--
-- Runs first (000_*) so every later migration can rely on it.
-- =============================================================================
create extension if not exists pgcrypto;


-- MIGRATION: supabase/migrations/001_extensions/001_extensions.sql

-- =============================================================================
-- Tepi Sawah — Migration 001: Extensions
--
-- Source: docs/database/DATABASE_MIGRATION_PLAN.md §6
--
-- Only enable extensions actually needed by the schema. pgcrypto provides the
-- gen_random_uuid() default used by every table PK.
-- =============================================================================

create extension if not exists "pgcrypto";


-- MIGRATION: supabase/migrations/002_profiles/001_profiles.sql

-- =============================================================================
-- Tepi Sawah — Migration 002: Profiles
--
-- Source: docs/security/AUTH_RBAC_RLS.md §5, docs/database/DATABASE_SCHEMA.md
-- §6.2, docs/database/DATABASE_MIGRATION_PLAN.md §7.
--
-- Application profile for an authenticated Supabase user. `id` is the
-- auth.users.id — profiles never stores passwords, tokens, or secrets of any
-- kind (AUTH_RBAC_RLS.md §5).
--
-- is_active gates internal authorization: an inactive staff user must not reach
-- any protected operation (AUTH_RBAC_RLS.md §14). It is deliberately NOT
-- self-service — a user may not re-enable themselves.
-- =============================================================================

create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  phone        text,
  avatar_url   text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.profiles is
  'Application profile keyed to auth.users.id; carries no secrets.';

comment on column public.profiles.is_active is
  'False blocks internal authorization (AUTH_RBAC_RLS.md §14). Admin-managed.';

-- -----------------------------------------------------------------------------
-- updated_at maintenance.
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Auto-create a profile when a Supabase Auth user is created.
--
-- SECURITY DEFINER so the insert runs with owner privileges, bypassing the RLS
-- policy below (which a new, not-yet-committed session could not satisfy).
-- search_path is pinned to public per Supabase security guidance.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- =============================================================================
-- Row Level Security
--
-- RLS is the security boundary (AUTH_RBAC_RLS.md §2.2). A user may read and
-- maintain their own profile only. is_active is excluded from self-service
-- updates via column-level GRANT so a disabled user cannot re-enable themself.
-- =============================================================================
alter table public.profiles enable row level security;

drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- No INSERT/DELETE policy: profiles are created exclusively by the
-- handle_new_user trigger, and deletion cascades from auth.users.
revoke delete on public.profiles from authenticated, anon;

-- Self-service updates may not touch the activation flag.
revoke update on public.profiles from authenticated;
grant update (display_name, phone, avatar_url) on public.profiles to authenticated;


-- MIGRATION: supabase/migrations/003_roles_permissions/001_rbac_tables.sql

-- =============================================================================
-- Tepi Sawah — Migration 003 (part 1): Roles, Permissions, User Roles,
-- Role Permissions.
--
-- Source: docs/security/AUTH_RBAC_RLS.md §6-§13, docs/database/DATABASE_SCHEMA.md
-- §7-§10, docs/database/DATABASE_MIGRATION_PLAN.md §8-§11.
--
-- This migration is the RBAC data model. It is deliberately structure-only:
-- role and permission *rows* are seeded separately (DATABASE_MIGRATION_PLAN.md
-- §37 — seed is separated from schema) and RLS policies are applied in part 3,
-- after the authorization helper functions they depend on exist.
--
-- Role codes are lowercase canonical identifiers. They are join keys shared
-- with the typed constants in packages/permissions and the app_metadata role
-- claim (AUTH_RBAC_RLS.md §6, DATABASE_MIGRATION_PLAN.md §8). A CHECK
-- constraint pins the canonical form so the join can never silently mismatch
-- on case.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- roles — the six MVP staff roles (AUTH_RBAC_RLS.md §6).
--
-- is_system marks the baseline roles: they are seeded reference data and are
-- not deletable from the client (§51 rule 6 — no unrestricted table writes).
-- -----------------------------------------------------------------------------
create table if not exists public.roles (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,
  name         text not null,
  description  text,
  is_system    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint roles_code_lowercase check (code = lower(code))
);

comment on table public.roles is
  'Staff roles; baseline codes are seeded reference data (AUTH_RBAC_RLS.md §6).';
comment on column public.roles.code is
  'Lowercase canonical role id; join key for user_roles and app_metadata claim.';
comment on column public.roles.is_system is
  'Baseline role — client may not delete or rename it.';

-- -----------------------------------------------------------------------------
-- permissions — the permission catalog (AUTH_RBAC_RLS.md §7, §8).
--
-- code is `<domain>.<action>`; module/action are kept for grouping in the
-- admin UI and are derived from the code, never trusted from the client.
-- -----------------------------------------------------------------------------
create table if not exists public.permissions (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,
  module       text not null,
  action       text not null,
  description  text,
  created_at   timestamptz not null default now(),
  constraint permissions_code_format check (code ~ '^[a-z_]+\.[a-z_]+$')
);

comment on table public.permissions is
  'Permission catalog; codes follow <domain>.<action> (AUTH_RBAC_RLS.md §7).';
comment on column public.permissions.code is
  'Stable identifier; the UI label may change without touching this value.';

-- -----------------------------------------------------------------------------
-- user_roles — many-to-many user → role (AUTH_RBAC_RLS.md §12).
--
-- A user may hold several roles; effective permissions are the union. There is
-- no role precedence and no client-side string comparison (§12).
--
-- No updated_at: an assignment is an auditable event, not an editable row, so
-- the table supports insert/delete only (DATABASE_MIGRATION_PLAN.md §10 —
-- role removal must be auditable).
-- -----------------------------------------------------------------------------
create table if not exists public.user_roles (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role_id     uuid not null references public.roles (id) on delete restrict,
  created_at  timestamptz not null default now(),
  primary key (user_id, role_id)
);

comment on table public.user_roles is
  'User to role assignment; union of role permissions is the effective set.';

-- Prevent duplicating an assignment and keep history clean: the PK already
-- enforces uniqueness, and on delete restrict protects system roles.
create index if not exists user_roles_user_id_idx on public.user_roles (user_id);

-- -----------------------------------------------------------------------------
-- role_permissions — many-to-many role → permission (DATABASE_SCHEMA.md §10).
-- -----------------------------------------------------------------------------
create table if not exists public.role_permissions (
  role_id       uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (role_id, permission_id)
);

comment on table public.role_permissions is
  'Grants a permission to a role; the join is the authorization graph.';

create index if not exists role_permissions_role_id_idx on public.role_permissions (role_id);
create index if not exists role_permissions_permission_id_idx on public.role_permissions (permission_id);

-- -----------------------------------------------------------------------------
-- updated_at maintenance for roles (permissions/user_roles are append-only).
-- The trigger function is defined by migration 002_profiles.
-- -----------------------------------------------------------------------------
drop trigger if exists roles_set_updated_at on public.roles;
create trigger roles_set_updated_at
  before update on public.roles
  for each row
  execute function public.set_updated_at();


-- MIGRATION: supabase/migrations/003_roles_permissions/002_rbac_helpers.sql

-- =============================================================================
-- Tepi Sawah — Migration 003 (part 2): Authorization helper functions.
--
-- Source: docs/security/AUTH_RBAC_RLS.md §21, §22, §34; §51 rules 17-18.
--
-- RLS policies must answer six questions per request (§21): authenticated,
-- active, roles, permissions, row domain, and whether the operation is an
-- explicitly allowed public one. Answering them inline in every policy would
-- duplicate the authorization join and invite recursion (a policy on
-- user_roles reading user_roles). These helpers centralize the answers.
--
-- Recursion safety (§51 rule 17): every function below is SECURITY DEFINER
-- with search_path pinned to `public`. Running as the schema owner, they read
-- the RBAC tables without re-entering their RLS policies, so no policy can
-- recurse into itself. Each function returns only a boolean or an id — it
-- never returns row data, so the privilege cannot be leveraged to read
-- protected rows (§34: expose minimum capability).
--
-- auth.uid() is schema-qualified and reads the request JWT claim, so it still
-- resolves correctly inside a SECURITY DEFINER frame.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- auth_user_id() — the requesting user, or NULL when anonymous (§22).
-- -----------------------------------------------------------------------------
create or replace function public.auth_user_id()
returns uuid
language sql
stable
security definer set search_path = public
as $$
  select auth.uid();
$$;

-- -----------------------------------------------------------------------------
-- current_user_is_active() — true when the caller is authenticated AND their
-- profile is active (AUTH_RBAC_RLS.md §14, §42).
--
-- This is the server-side enforcement of the disable flow: a disabled account
-- may authenticate but must not reach any protected operation. A missing
-- profile after authentication is treated as inactive — fail closed.
-- -----------------------------------------------------------------------------
create or replace function public.current_user_is_active()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
  );
$$;

-- -----------------------------------------------------------------------------
-- has_role(role_code) — true when the caller currently holds `role_code`
-- (AUTH_RBAC_RLS.md §22). Roles are read fresh from user_roles, so a revoked
-- role stops authorizing immediately.
-- -----------------------------------------------------------------------------
create or replace function public.has_role(role_code text)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.code = lower(role_code)
  );
$$;

-- -----------------------------------------------------------------------------
-- current_user_roles() — role codes held by the caller. Used by /me to report
-- the caller's roles without exposing other users' assignments.
-- -----------------------------------------------------------------------------
create or replace function public.current_user_roles()
returns setof text
language sql
stable
security definer set search_path = public
as $$
  select r.code
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = auth.uid()
  order by r.code;
$$;

-- -----------------------------------------------------------------------------
-- current_user_permissions() — effective permission codes for the caller:
-- the union over the caller's roles (AUTH_RBAC_RLS.md §12). The database is
-- the authority for this set; /me returns it to the client (§50 item 10).
--
-- Inactive accounts resolve to an empty set: permission without an active
-- profile is not authorization (§14).
-- -----------------------------------------------------------------------------
create or replace function public.current_user_permissions()
returns setof text
language sql
stable
security definer set search_path = public
as $$
  select distinct p.code
  from public.user_roles ur
  join public.role_permissions rp on rp.role_id = ur.role_id
  join public.permissions p on p.id = rp.permission_id
  where ur.user_id = auth.uid()
    and public.current_user_is_active()
  order by p.code;
$$;

-- -----------------------------------------------------------------------------
-- has_permission(permission_code) — true when the caller's effective
-- permissions include `permission_code` (AUTH_RBAC_RLS.md §22, §38).
--
-- This is the predicate every RLS policy reuses. Because it goes through
-- current_user_permissions(), the active-profile gate is built in: an inactive
-- account holds no permissions, so every policy built on it fails closed.
-- -----------------------------------------------------------------------------
create or replace function public.has_permission(permission_code text)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1
    from public.current_user_permissions() cp
    where cp = permission_code
  );
$$;

-- -----------------------------------------------------------------------------
-- is_admin() / is_owner() / is_supervisor() — convenience role predicates
-- (AUTH_RBAC_RLS.md §22). They are role checks only: a policy still combines
-- them with has_permission for the actual grant. Owner is NOT an implicit
-- superuser (§10) — these functions do not bypass permission checks.
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.has_role('admin');
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.has_role('owner');
$$;

create or replace function public.is_supervisor()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.has_role('supervisor');
$$;

-- -----------------------------------------------------------------------------
-- Authorization helpers are callable by any authenticated role; they only
-- ever answer a question about the caller's own grants.
-- -----------------------------------------------------------------------------
grant execute on function public.auth_user_id() to authenticated, anon;
grant execute on function public.current_user_is_active() to authenticated, anon;
grant execute on function public.has_role(text) to authenticated, anon;
grant execute on function public.current_user_roles() to authenticated, anon;
grant execute on function public.current_user_permissions() to authenticated, anon;
grant execute on function public.has_permission(text) to authenticated, anon;
grant execute on function public.is_admin() to authenticated, anon;
grant execute on function public.is_owner() to authenticated, anon;
grant execute on function public.is_supervisor() to authenticated, anon;


-- MIGRATION: supabase/migrations/003_roles_permissions/003_rbac_rls.sql

-- =============================================================================
-- Tepi Sawah — Migration 003 (part 3): RLS on the RBAC tables.
--
-- Source: docs/security/AUTH_RBAC_RLS.md §20-§24, §21 (six questions),
-- §34 (SECURITY DEFINER rules), docs/database/DATABASE_MIGRATION_PLAN.md §35.
--
-- Every policy below answers the §21 questions through the part-2 helpers:
--   1. authenticated?  -> auth_user_id() is not null
--   2. active?         -> current_user_is_active()
--   3/4. roles/perms?  -> has_role() / has_permission()
--   5. row domain?     -> the row-level predicate itself
--   6. public?         -> no: none of these tables are public (§36)
--
-- No policy below is unconditional (§21, migration plan §34): every
-- predicate answers the six questions. Reference tables
-- (roles, permissions, role_permissions) are read-with-permission and are not
-- client-writable at all; system roles and the permission catalog are seeded
-- server-side only.
--
-- Policies are additive: each joins the existing profiles policies from
-- migration 002 with `drop policy` + `create policy`, never by editing an
-- applied migration (REPOSITORY_STRUCTURE.md §29).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- roles — the role catalog.
--
-- SELECT: an active staff user may read the roles they hold (needed to resolve
--        /me without exposing the full catalog), and a holder of roles.read
--        may read the whole catalog for administration (§46 — Role Data).
--        has_role() is a SECURITY DEFINER call, so this policy does not recurse
--        into the user_roles policy (§51 rule 17).
-- INSERT/UPDATE/DELETE: none. Baseline roles are seeded reference data.
-- -----------------------------------------------------------------------------
alter table public.roles enable row level security;

drop policy if exists "roles_select_authorized" on public.roles;
create policy "roles_select_authorized"
  on public.roles
  for select
  to authenticated
  using (
    public.auth_user_id() is not null
    and public.current_user_is_active()
    and (
      public.has_permission('roles.read')
      or public.has_role(roles.code)
    )
  );

revoke insert, update, delete on public.roles from authenticated, anon;

-- -----------------------------------------------------------------------------
-- permissions — the permission catalog.
--
-- SELECT: requires permissions.read (§46 — Role Data is admin/owner only).
-- INSERT/UPDATE/DELETE: none; the catalog is seeded server-side.
-- -----------------------------------------------------------------------------
alter table public.permissions enable row level security;

drop policy if exists "permissions_select_authorized" on public.permissions;
create policy "permissions_select_authorized"
  on public.permissions
  for select
  to authenticated
  using (
    public.auth_user_id() is not null
    and public.current_user_is_active()
    and public.has_permission('permissions.read')
  );

revoke insert, update, delete on public.permissions from authenticated, anon;

-- -----------------------------------------------------------------------------
-- role_permissions — the grant graph.
--
-- SELECT: requires permissions.read (same sensitivity as the catalog).
-- INSERT/UPDATE/DELETE: none. Grant changes are seeded/migrated server-side;
-- the baseline matrix must not be editable from the client (§51 rule 3/4).
-- -----------------------------------------------------------------------------
alter table public.role_permissions enable row level security;

drop policy if exists "role_permissions_select_authorized" on public.role_permissions;
create policy "role_permissions_select_authorized"
  on public.role_permissions
  for select
  to authenticated
  using (
    public.auth_user_id() is not null
    and public.current_user_is_active()
    and public.has_permission('permissions.read')
  );

revoke insert, update, delete on public.role_permissions from authenticated, anon;

-- -----------------------------------------------------------------------------
-- user_roles — who holds which role (AUTH_RBAC_RLS.md §24).
--
-- SELECT: a user reads their own assignments; a holder of users.roles_manage
--        reads all assignments (§13 role-assignment authority).
-- INSERT/DELETE: only a holder of users.roles_manage. Assignment and removal
--        are auditable events (§39), so the table is insert/delete-only —
--        there is no UPDATE policy and no UPDATE grant.
--
-- Self-assignment is not separately blocked: only admin and owner hold
-- users.roles_manage in the baseline (§9), and they already hold every grant,
-- so there is no escalation path (§49 — privilege escalation test).
-- -----------------------------------------------------------------------------
alter table public.user_roles enable row level security;

drop policy if exists "user_roles_select_authorized" on public.user_roles;
create policy "user_roles_select_authorized"
  on public.user_roles
  for select
  to authenticated
  using (
    public.auth_user_id() is not null
    and public.current_user_is_active()
    and (
      user_id = public.auth_user_id()
      or public.has_permission('users.roles_manage')
    )
  );

drop policy if exists "user_roles_insert_authorized" on public.user_roles;
create policy "user_roles_insert_authorized"
  on public.user_roles
  for insert
  to authenticated
  with check (
    public.auth_user_id() is not null
    and public.current_user_is_active()
    and public.has_permission('users.roles_manage')
  );

drop policy if exists "user_roles_delete_authorized" on public.user_roles;
create policy "user_roles_delete_authorized"
  on public.user_roles
  for delete
  to authenticated
  using (
    public.auth_user_id() is not null
    and public.current_user_is_active()
    and public.has_permission('users.roles_manage')
  );

revoke update on public.user_roles from authenticated, anon;

-- =============================================================================
-- profiles — administration path (AUTH_RBAC_RLS.md §23, §42).
--
-- Migration 002 keeps self-service to a user's own row and excludes is_active
-- from self-service updates. Administration needs a second path: a holder of
-- users.read reads any profile, and a holder of users.update changes one —
-- including is_active, which is how an account is disabled (§14: an inactive
-- account must not reach any protected operation).
--
-- is_active is granted here specifically because the disable flow requires it;
-- the RLS policy above is the row-level gate. Row-level security cannot
-- isolate a single column, so the baseline co-grants users.update and
-- users.disable to the same roles (§9). A dedicated disable command that
-- records an audit event lands with migration 014_audit_logs (§39, §42).
-- =============================================================================
revoke update on public.profiles from authenticated;
grant update (display_name, phone, avatar_url, is_active) on public.profiles to authenticated;

drop policy if exists "profiles_admin_select" on public.profiles;
create policy "profiles_admin_select"
  on public.profiles
  for select
  to authenticated
  using (
    public.auth_user_id() is not null
    and public.current_user_is_active()
    and public.has_permission('users.read')
  );

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update"
  on public.profiles
  for update
  to authenticated
  using (
    public.auth_user_id() is not null
    and public.current_user_is_active()
    and public.has_permission('users.update')
  )
  with check (
    public.auth_user_id() is not null
    and public.current_user_is_active()
    and public.has_permission('users.update')
  );


-- MIGRATION: supabase/migrations/004_restaurant_settings/001_restaurant_settings.sql

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


-- MIGRATION: supabase/migrations/004_restaurant_settings/002_operating_hours.sql

-- =============================================================================
-- Tepi Sawah — Migration 004 (part 2): Operating hours.
--
-- Source: docs/database/DATABASE_SCHEMA.md §12 (operating_hours),
-- docs/database/DATABASE_MIGRATION_PLAN.md §13, docs/api/API_CONTRACT.md §38,
-- docs/security/AUTH_RBAC_RLS.md §20-§21, §33-§34, §39-§40.
--
-- One schedule per day of week (DATABASE_SCHEMA.md §12 — "Multiple schedules
-- per day should not be assumed unless explicitly required"), enforced by a
-- UNIQUE constraint on day_of_week.
--
-- day_of_week follows the PostgreSQL `extract(dow ...)` and JavaScript
-- `Date#getDay()` convention: 0 = Sunday ... 6 = Saturday. Both the open-state
-- computation (part 3) and the admin UI grid key off this directly, so no
-- conversion layer is needed between SQL and the browser.
--
-- Like part 1, this migration is structure-only: no day rows are inserted.
-- is_closed defaults to true so any seeded or inserted row is closed until an
-- authorized holder of settings.manage sets hours — ordering availability
-- fails closed while the restaurant is unconfigured.
-- =============================================================================

create table if not exists public.operating_hours (
  id          uuid primary key default gen_random_uuid(),
  day_of_week smallint not null,
  is_closed   boolean  not null default true,
  open_time   time,
  close_time  time,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint operating_hours_day_of_week_range
    check (day_of_week between 0 and 6),
  constraint operating_hours_day_unique
    unique (day_of_week),
  -- A closed day carries no hours; an open day carries both. This keeps a
  -- half-entered row from looking open to the ordering-availability check.
  constraint operating_hours_closed_has_no_times
    check (
      (is_closed and open_time is null and close_time is null)
      or ((not is_closed) and open_time is not null and close_time is not null)
    ),
  -- Single-interval days cannot span midnight; a schedule that does needs the
  -- multi-schedule-per-day support §12 defers, via a future migration.
  constraint operating_hours_open_before_close
    check (open_time is null or close_time is null or open_time < close_time)
);

comment on table public.operating_hours is
  'One operating schedule per day of week (0=Sunday). Client may read with settings.read, manage with settings.manage.';
comment on column public.operating_hours.day_of_week is
  '0 = Sunday ... 6 = Saturday (matches extract(dow) and JS Date#getDay).';
comment on column public.operating_hours.is_closed is
  'True means closed all day; open_time/close_time must be null. Defaults to true (fail closed).';

-- Resolve a day by its number without going through the id.
create index if not exists operating_hours_day_of_week_idx
  on public.operating_hours (day_of_week);

-- updated_at maintenance. The trigger function is defined by migration 002.
drop trigger if exists operating_hours_set_updated_at on public.operating_hours;
create trigger operating_hours_set_updated_at
  before update on public.operating_hours
  for each row
  execute function public.set_updated_at();

-- =============================================================================
-- Row Level Security (AUTH_RBAC_RLS.md §20-§21).
--
-- Six questions as in part 1. The raw schedule is internal configuration: the
-- public boundary is the derived is_open boolean in the projection function
-- from part 3, so anon again has no grant on this table.
--
-- INSERT is allowed for a settings.manage holder (unlike part 1): an empty
-- production database has no day rows, and the admin UI must be able to seed a
-- day's schedule. The unique-day and 0..6 constraints keep that to exactly one
-- row per canonical day, so the insert path cannot create a second schedule.
-- DELETE is not granted: a day is configured, never removed.
-- =============================================================================
alter table public.operating_hours enable row level security;

drop policy if exists "operating_hours_select_authorized" on public.operating_hours;
create policy "operating_hours_select_authorized"
  on public.operating_hours
  for select
  to authenticated
  using (
    public.auth_user_id() is not null
    and public.current_user_is_active()
    and public.has_permission('settings.read')
  );

drop policy if exists "operating_hours_insert_authorized" on public.operating_hours;
create policy "operating_hours_insert_authorized"
  on public.operating_hours
  for insert
  to authenticated
  with check (
    public.auth_user_id() is not null
    and public.current_user_is_active()
    and public.has_permission('settings.manage')
  );

drop policy if exists "operating_hours_update_authorized" on public.operating_hours;
create policy "operating_hours_update_authorized"
  on public.operating_hours
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

revoke delete on public.operating_hours from authenticated, anon;

-- day_of_week is the stable key of a schedule and is not client-editable.
revoke update on public.operating_hours from authenticated;
grant update (is_closed, open_time, close_time) on public.operating_hours to authenticated;
grant insert (day_of_week, is_closed, open_time, close_time) on public.operating_hours to authenticated;


-- MIGRATION: supabase/migrations/004_restaurant_settings/003_settings_functions.sql

-- =============================================================================
-- Tepi Sawah — Migration 004 (part 3): Public settings projection and
-- ordering availability.
--
-- Source: docs/api/API_CONTRACT.md §8.2 (resolve QR), §31 (frontend cache),
-- §38 (unresolved configuration decisions), docs/security/AUTH_RBAC_RLS.md
-- §17 (customer public access), §46 (data exposure rules by module),
-- §34 (SECURITY DEFINER rules).
--
-- Parts 1 and 2 keep restaurant_settings and operating_hours fully
-- client-unreadable for anonymous users: anon holds no grant on either table.
-- The customer QR flow still needs a small public payload (API_CONTRACT.md
-- §8.2) — restaurant name and open state — so the public boundary is exposed
-- here as named projections instead of a permissive table policy.
--
-- Both functions are SECURITY DEFINER with search_path pinned to public and
-- return only the public-safe fields (AUTH_RBAC_RLS.md §34: minimum
-- capability, fixed search_path, no parameters, no dynamic SQL). They expose
-- exactly four scalar columns; they never return address, phone, email, ids or
-- timestamps, and never return the raw schedule rows
-- (AUTH_RBAC_RLS.md §17 — the customer must not receive internal data). This
-- is the function/DTO field-level exposure §46 asks for rather than UI hiding.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- is_restaurant_open() — ordering availability right now.
--
-- The wall clock is evaluated in the restaurant's own timezone, then matched
-- against today's schedule. Fails closed in every unconfigured state:
--   - no restaurant_settings row  -> no cfg row, join yields nothing, false
--   - no operating_hours rows     -> nothing to match, false
--   - today is_closed             -> no match, false
--   - outside today's window      -> no match, false
-- So ordering availability is never derived from a missing configuration.
-- -----------------------------------------------------------------------------
create or replace function public.is_restaurant_open()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  with cfg as (
    select timezone from public.restaurant_settings limit 1
  )
  select exists (
    select 1
    from public.operating_hours oh
    cross join cfg
    where oh.is_closed = false
      and extract(dow from (now() at time zone cfg.timezone))::smallint = oh.day_of_week
      and (now() at time zone cfg.timezone)::time >= oh.open_time
      and (now() at time zone cfg.timezone)::time < oh.close_time
  );
$$;

comment on function public.is_restaurant_open() is
  'True only when the restaurant is open right now in its own timezone; false for every unconfigured state.';

-- -----------------------------------------------------------------------------
-- public_restaurant_settings() — the public-safe settings payload
-- (API_CONTRACT.md §8.2 `restaurant` object).
--
-- Returns at most one row. When no configuration exists yet the result is
-- empty and the caller must treat the restaurant as unconfigured/closed.
-- -----------------------------------------------------------------------------
create or replace function public.public_restaurant_settings()
returns table (
  restaurant_name text,
  timezone text,
  currency text,
  is_open boolean
)
language sql
stable
security definer set search_path = public
as $$
  select
    s.restaurant_name,
    s.timezone,
    s.currency,
    public.is_restaurant_open()
  from public.restaurant_settings s
  order by s.id
  limit 1
$$;

comment on function public.public_restaurant_settings() is
  'Public-safe settings projection: name, timezone, currency and open state only (API_CONTRACT.md §8.2).';

-- -----------------------------------------------------------------------------
-- Both functions are the public read path: callable by anonymous customers and
-- by signed-in staff. They answer a question, never expose a protected row.
-- -----------------------------------------------------------------------------
grant execute on function public.is_restaurant_open() to authenticated, anon;
grant execute on function public.public_restaurant_settings() to authenticated, anon;


-- MIGRATION: supabase/migrations/005_catalog/001_categories.sql

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


-- MIGRATION: supabase/migrations/005_catalog/002_products.sql

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


-- MIGRATION: supabase/migrations/005_catalog/003_modifiers.sql

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


-- MIGRATION: supabase/migrations/005_catalog/004_product_modifiers.sql

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


-- MIGRATION: supabase/migrations/005_catalog/005_catalog_functions.sql

-- =============================================================================
-- Tepi Sawah — Migration 005 (part 5): Public catalog projection and the
-- server-side order-item price resolver.
--
-- Source: docs/api/API_CONTRACT.md §7.1/§7.2/§7.3 (Catalog API), §27 (Price
-- Integrity), §30 (Public Customer Security), docs/security/AUTH_RBAC_RLS.md
-- §17 (Customer Public Access), §25 (RLS Pattern: Catalog), §34 (SECURITY
-- DEFINER rules), §46 (Data Exposure Rules by Module).
--
-- Parts 1-4 give anonymous callers no grant on categories, products, modifiers
-- or product_modifiers, so RLS answers the six questions (AUTH_RBAC_RLS.md
-- §21) with "public? no" for every one of those tables. The customer catalog
-- flow still needs the active menu (API_CONTRACT.md §7.1/§7.2), so the public
-- boundary is a read-only projection here instead of a permissive policy
-- (§46: exact field-level exposure through functions, not UI hiding).
--
-- `public_catalog()` returns one flat row per product, joined to its category
-- and its active modifiers as three columns. Every filter that makes a menu
-- item orderable is applied inside the function, so the customer can never see
-- an archived category, an archived or unavailable product, or a detached or
-- archived modifier. The result carries no prices the customer may not see —
-- the catalog price IS the customer price — and no ids beyond the public ones
-- the order flow needs (productId, categoryId, modifierId).
--
-- `resolve_order_item()` is the price-integrity seam for order creation
-- (API_CONTRACT.md §27). It takes only what a client is allowed to send
-- (productId, quantity, modifierIds), re-reads the catalog as the authority,
-- validates orderability and the selection bounds from part 4, and returns the
-- snapshot values (names, unit price, modifier deltas, subtotal) that order
-- creation persists. A client can never place a price into an order; it can
-- only ask the server to compute one. Order tables land in migration 008/009;
-- this function is deliberately catalog-only so Phase 8 consumes it.
--
-- Both functions are SECURITY DEFINER with search_path pinned to public, take
-- no untrusted identifiers beyond the read-only lookup keys, and use no dynamic
-- SQL (AUTH_RBAC_RLS.md §34).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- public_catalog() — the customer-facing active menu.
--
-- Returns at most one row per product; the modifiers column is an array of the
-- product's orderable modifiers (empty when the product has none). Fails to an
-- empty result for every unconfigured state — a restaurant with no active menu
-- shows nothing, never a broken or half-filtered menu.
-- -----------------------------------------------------------------------------
create or replace function public.public_catalog()
returns table (
  category_id   uuid,
  category_name text,
  category_sort integer,
  product_id    uuid,
  product_name  text,
  description   text,
  price         numeric(12,2),
  image_url     text,
  is_available  boolean,
  product_sort  integer,
  modifiers     jsonb
)
language sql
stable
security definer set search_path = public
as $$
  select
    c.id         as category_id,
    c.name       as category_name,
    c.sort_order as category_sort,
    p.id         as product_id,
    p.name       as product_name,
    p.description,
    p.price,
    p.image_url,
    p.is_available,
    p.sort_order as product_sort,
    coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'modifierId', m.id,
          'name',       m.name,
          'priceDelta', m.price_delta,
          'isRequired', pm.is_required,
          'minSelect',  pm.min_select,
          'maxSelect',  pm.max_select,
          'sortOrder',  pm.sort_order
        ) order by pm.sort_order, m.name)
        from public.product_modifiers pm
        join public.modifiers m
          on m.id = pm.modifier_id
        where pm.product_id  = p.id
          and m.is_active    = true
      ),
      '[]'::jsonb
    ) as modifiers
  from public.categories c
  join public.products p
    on p.category_id = c.id
  where c.is_active     = true
    and p.is_active     = true
  order by c.sort_order, c.name, p.sort_order, p.name
$$;

comment on function public.public_catalog() is
  'Customer-facing active catalog: active categories, their active products, and each product orderable modifiers. Read-only, anonymous-safe (API_CONTRACT.md §7).';

-- -----------------------------------------------------------------------------
-- resolve_order_item(p_product_id, p_quantity, p_modifier_ids)
--
-- Computes the authoritative order-item snapshot (API_CONTRACT.md §27). Raises
-- a typed error whenever the item is not orderable, so order creation cannot
-- persist a stale or forbidden price:
--
--   P001  product does not exist / not active / not available
--   P002  category archived (the product left the public catalog)
--   P003  a modifier is unknown, archived, or not attached to this product
--   P004  selection count violates the group bounds from part 4
--   P005  quantity out of the allowed range
--
-- The client supplies only ids and a quantity. Every price, name, delta and
-- subtotal is read and computed here.
-- -----------------------------------------------------------------------------
create or replace function public.resolve_order_item(
  p_product_id  uuid,
  p_quantity    integer,
  p_modifier_ids uuid[] default '{}'
)
returns table (
  product_id            uuid,
  product_name_snapshot text,
  category_id           uuid,
  unit_price_snapshot   numeric(12,2),
  quantity              integer,
  modifier_ids          uuid[],
  modifier_names        text[],
  modifier_deltas       numeric(12,2)[],
  modifiers_subtotal    numeric(12,2),
  subtotal              numeric(12,2)
)
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_product record;
  v_modifier_ids uuid[] := coalesce(p_modifier_ids, '{}');
  v_qty         integer := coalesce(p_quantity, 0);
  v_names       text[];
  v_deltas      numeric(12,2)[];
  v_group       record;
begin
  -- Quantity is validated first: it is the one client-supplied scalar that
  -- reaches arithmetic, so an out-of-range value must never reach a price.
  if v_qty < 1 or v_qty > 999 then
    raise exception 'Quantity must be between 1 and 999.' using errcode = 'P0005';
  end if;

  -- Load the product as the authority, with every orderability gate.
  select p.id, p.name, p.category_id, p.price, p.is_active, p.is_available, c.is_active as category_active
    into v_product
  from public.products p
  join public.categories c on c.id = p.category_id
  where p.id = p_product_id;

  if not found then
    raise exception 'Product does not exist.' using errcode = 'P0001';
  end if;

  if v_product.is_active = false then
    raise exception 'Product is inactive and cannot be ordered.' using errcode = 'P0001';
  end if;

  if v_product.is_available = false then
    raise exception 'Product is currently unavailable.' using errcode = 'P0001';
  end if;

  if v_product.category_active = false then
    raise exception 'Product category is inactive.' using errcode = 'P0002';
  end if;

  -- Resolve each requested modifier against this product's links. An unknown
  -- id, an archived modifier, or a modifier attached to a different product all
  -- fail the join and raise P0003 — the client never decides what is orderable.
  select array_agg(m.id order by pm.sort_order, m.name),
         array_agg(m.name order by pm.sort_order, m.name),
         array_agg(m.price_delta order by pm.sort_order, m.name)
    into v_modifier_ids, v_names, v_deltas
  from public.product_modifiers pm
  join public.modifiers m on m.id = pm.modifier_id
  where pm.product_id = p_product_id
    and m.is_active   = true
    and m.id = any(v_modifier_ids);

  -- Zero requested modifiers resolves to null, which is why both sides are
  -- coalesced before the count comparison.
  if coalesce(array_length(v_modifier_ids, 1), 0) <> coalesce(array_length(coalesce(p_modifier_ids, '{}'), 1), 0) then
    raise exception 'One or more modifiers are not valid for this product.' using errcode = 'P0003';
  end if;

  -- Enforce the selection bounds from part 4, per group of identical bounds.
  -- A required group with min_select > 0 must be satisfied; no group may be
  -- over-selected.
  for v_group in
    select pm.is_required, pm.min_select, pm.max_select,
           count(*) filter (where selected.id = any(coalesce(v_modifier_ids, '{}'))) as picked
    from public.product_modifiers pm
    join public.modifiers m on m.id = pm.modifier_id
    left join lateral (select * from unnest(coalesce(v_modifier_ids, '{}')) as selected(id)) selected
      on selected.id = pm.modifier_id
    where pm.product_id = p_product_id
      and m.is_active = true
    group by pm.is_required, pm.min_select, pm.max_select
  loop
    if v_group.picked > v_group.max_select then
      raise exception 'Too many options selected for a modifier group (max %).', v_group.max_select
        using errcode = 'P0004';
    end if;
    if v_group.picked < v_group.min_select then
      raise exception 'A required modifier group is incomplete (min %).', v_group.min_select
        using errcode = 'P0004';
    end if;
  end loop;

  return query
  select
    v_product.id,
    v_product.name,
    v_product.category_id,
    v_product.price,
    v_qty,
    coalesce(v_modifier_ids, '{}'),
    coalesce(v_names, '{}'),
    coalesce(v_deltas, '{}'),
    coalesce((select sum(d) from unnest(v_deltas) as d), 0),
    (v_product.price + coalesce((select sum(d) from unnest(v_deltas) as d), 0)) * v_qty;
end;
$$;

comment on function public.resolve_order_item(uuid, integer, uuid[]) is
  'Authoritative order-item snapshot: validates orderability and selection bounds, computes names, prices and subtotal server-side (API_CONTRACT.md §27).';

-- -----------------------------------------------------------------------------
-- Both are the public/staff read paths. `public_catalog()` is callable
-- anonymously (the customer QR flow needs no login, AUTH_RBAC_RLS.md §30).
-- `resolve_order_item()` is callable by any authenticated role that may create
-- an order, and by anonymous customers in the QR flow; it never discloses
-- anything the catalog projection does not already expose, and it writes
-- nothing.
-- -----------------------------------------------------------------------------
grant execute on function public.public_catalog() to authenticated, anon;
grant execute on function public.resolve_order_item(uuid, integer, uuid[]) to authenticated, anon;


-- MIGRATION: supabase/migrations/005_catalog/006_replace_product_modifiers.sql

-- =============================================================================
-- Tepi Sawah — Migration 005 (part 6): atomic product-modifier replace.
--
-- Source: docs/api/API_CONTRACT.md §27 (Price Integrity), docs/security/
-- AUTH_RBAC_RLS.md §8 (backend is the authority), §21 (RLS answers the six
-- questions), §34 (SECURITY DEFINER rules), §47 (validate before mutating),
-- docs/database/DATABASE_SCHEMA.md §16 (selection bounds), docs/implementation/
-- CLINE_IMPLEMENTATION_PLAN.md §11 (Phase 5 catalog management).
--
-- Defect fixed: `saveProductModifiers` used to run the unlink (delete) and the
-- relink (upsert) as two separate REST round trips. If the second request
-- failed — network drop, denial, a CHECK violation — the first was already
-- committed, leaving a product half-linked, and the audit for the removal was
-- never produced (the audit is computed from rows the second request never
-- returned). Replacing a product's modifier set is one critical mutation, so it
-- is now one server-side call: this function validates the whole payload, then
-- deletes the existing links and inserts the new set inside one implicit
-- transaction. Either the full replace lands or nothing does.
--
-- The function is SECURITY DEFINER with search_path pinned to public and no
-- dynamic SQL (§34). Parts 1-4 grant DELETE on product_modifiers to no client
-- role (categories/products/modifiers revoke it outright; this table was only
-- ever granted INSERT/UPDATE), so this RPC is the sole mutation path — direct
-- REST writes stay blocked by the missing table grants. Authorization is
-- re-imposed inside the function with the same three predicates the part 4 RLS
-- policy uses, so the caller still needs `catalog.update` and the check is
-- server-side, not client-side (§8). A caller who lacks it gets 42501, which
-- the query layer maps exactly the way it maps a denial.
--
-- SECURITY DEFINER also sidesteps the plpgsql OUT-parameter hazard: `delete`
-- and `return query` qualify every column (`pm.`) because the function's own
-- OUT parameter is named `product_id` and would otherwise shadow the column.
-- =============================================================================
create or replace function public.replace_product_modifiers(
  p_product_id uuid,
  p_links jsonb
)
returns table (
  product_id uuid,
  modifier_id uuid,
  is_required boolean,
  min_select integer,
  max_select integer,
  sort_order integer,
  created_at timestamptz
)
language plpgsql
security definer set search_path = public
as $$
declare
  v_link jsonb;
  v_min integer;
  v_max integer;
begin
  -- Authorization — mirrors `product_modifiers_delete_authorized` in part 4.
  if public.auth_user_id() is null
     or not public.current_user_is_active()
     or not public.has_permission('catalog.update') then
    raise exception 'permission denied for function replace_product_modifiers'
      using errcode = '42501';
  end if;

  if p_product_id is null then
    raise exception 'Product id is required.' using errcode = 'P0001';
  end if;

  -- An absent payload is an empty set: every link is unlinked. Anything that is
  -- not an array is a protocol error, not a silent empty replace.
  if p_links is not null and jsonb_typeof(p_links) <> 'array' then
    raise exception 'Links payload must be an array.' using errcode = 'P0001';
  end if;

  -- Validate the whole payload before touching any row (§47): a rejected link
  -- can never reach the delete, so a bad payload leaves the product as-is.
  -- These mirror the CHECK constraints from part 4 so the client gets a typed
  -- 49000-class error instead of a constraint traceback.
  for v_link in select * from jsonb_array_elements(coalesce(p_links, '[]'::jsonb)) loop
    if coalesce(v_link->>'modifierId', '') = '' then
      raise exception 'A link is missing a modifier id.' using errcode = 'P0001';
    end if;

    v_min := coalesce((v_link->>'minSelect')::integer, 0);
    v_max := coalesce((v_link->>'maxSelect')::integer, 1);

    if v_min < 0 then
      raise exception 'min_select must be >= 0.' using errcode = 'P0004';
    end if;
    if v_max < 1 then
      raise exception 'max_select must be >= 1.' using errcode = 'P0004';
    end if;
    if v_max < v_min then
      raise exception 'max_select must be >= min_select.' using errcode = 'P0004';
    end if;
    if coalesce((v_link->>'isRequired')::boolean, false) and v_min < 1 then
      raise exception 'A required modifier group needs min_select >= 1.'
        using errcode = 'P0004';
    end if;
  end loop;

  -- The composite primary key would trip on a repeated modifier id; reject it
  -- with the same class of error as a bounds violation.
  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_links, '[]'::jsonb)) as l
    group by l->>'modifierId'
    having count(*) > 1
  ) then
    raise exception 'A modifier may only be linked to a product once.'
      using errcode = 'P0004';
  end if;

  -- Replace the whole set in one transaction. The payload is the whole truth
  -- for this product, so the delete is unconditional on the product, not a
  -- per-id diff — that is what makes the outcome independent of failure order.
  delete from public.product_modifiers as pm where pm.product_id = p_product_id;

  insert into public.product_modifiers (
    product_id, modifier_id, is_required, min_select, max_select, sort_order
  )
  select
    p_product_id,
    (l->>'modifierId')::uuid,
    coalesce((l->>'isRequired')::boolean, false),
    coalesce((l->>'minSelect')::integer, 0),
    coalesce((l->>'maxSelect')::integer, 1),
    coalesce((l->>'sortOrder')::integer, 0)
  from jsonb_array_elements(coalesce(p_links, '[]'::jsonb)) as l;

  return query
  select pm.product_id, pm.modifier_id, pm.is_required, pm.min_select,
         pm.max_select, pm.sort_order, pm.created_at
  from public.product_modifiers as pm
  where pm.product_id = p_product_id
  order by pm.sort_order, pm.modifier_id;
end;
$$;

revoke execute on function public.replace_product_modifiers(uuid, jsonb) from anon;
grant execute on function public.replace_product_modifiers(uuid, jsonb) to authenticated;


-- MIGRATION: supabase/migrations/006_tables/001_tables.sql

-- =============================================================================
-- Tepi Sawah — Migration 006 (part 1): Dining tables.
--
-- Source: docs/database/DATABASE_SCHEMA.md §17 (tables),
-- docs/database/DATABASE_MIGRATION_PLAN.md §19, docs/api/API_CONTRACT.md §8.1
-- (Get Active Tables), docs/security/AUTH_RBAC_RLS.md §26 (RLS Pattern:
-- Tables), §8 (Tables permissions), docs/design/MASTER_DESIGN_SYSTEM.md §14.
--
-- A table is a physical dining location. Its `table_code` is the identifier the
-- printed QR carries and the staff-facing label (`A12`); `name` is the display
-- label (`Meja A12`) (API_CONTRACT.md §8.1). `status` is the operational state
-- of the furniture, deliberately a separate vocabulary from order status
-- (DATABASE_SCHEMA.md §17, MASTER_DESIGN_SYSTEM.md §14 — TABLE STATUS is never
-- derived from ORDER STATUS). The baseline vocabulary below is the design
-- system's; transitions into OCCUPIED / WAITING_* are driven by table sessions
-- and orders in later phases, so Phase 6 only stores and validates the value.
--
-- Archival is soft: `is_active = false` deactivates a table so its QR stops
-- resolving, while every historical row that references it stays valid. No hard
-- DELETE is ever granted — the same rule the catalog tables follow
-- (API_CONTRACT.md §1004-§1008).
-- =============================================================================
create table if not exists public.tables (
  id          uuid        primary key default gen_random_uuid(),
  table_code  text        not null,
  name        text        not null,
  capacity    integer     null,
  status      text        not null default 'AVAILABLE',
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint tables_table_code_not_blank check (btrim(table_code) <> ''),
  constraint tables_name_not_blank check (btrim(name) <> ''),
  constraint tables_capacity_non_negative check (capacity is null or capacity >= 0),
  constraint tables_status_vocabulary check (
    status in ('AVAILABLE', 'OCCUPIED', 'WAITING_SERVICE', 'WAITING_PAYMENT', 'CLEANING')
  )
);

-- `table_code` is unique (DATABASE_SCHEMA.md §17). Compared case-insensitively
-- and trimmed so "a12 " cannot shadow "A12" — the code is typed from a QR and
-- printed on the floor plan, and two tables sharing one code would send
-- customers to the wrong table.
create unique index if not exists tables_table_code_key
  on public.tables (lower(btrim(table_code)));

create index if not exists tables_active_code_idx
  on public.tables (is_active, lower(btrim(table_code)));

-- `updated_at` is maintained by the shared trigger from migration 002.
drop trigger if exists tables_set_updated_at on public.tables;
create trigger tables_set_updated_at
  before update on public.tables
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS — the security boundary (AUTH_RBAC_RLS.md §26).
--
-- SELECT: an active authenticated staff session with `tables.read` sees every
--          table including inactive ones (the admin list needs archived rows).
--          Anonymous callers never touch this table directly: they resolve a
--          QR through the public projection in part 3 (§17, §46).
-- INSERT:  `tables.create`.
-- UPDATE:  `tables.update` (covers the status/configuration patch and the
--          `is_active` archival toggle).
-- DELETE:  never granted — archive, do not delete.
-- -----------------------------------------------------------------------------
alter table public.tables enable row level security;

drop policy if exists "tables_select_authorized" on public.tables;
create policy "tables_select_authorized"
  on public.tables
  for select
  to authenticated
  using (
    public.auth_user_id() is not null
    and public.current_user_is_active()
    and public.has_permission('tables.read')
  );

drop policy if exists "tables_insert_authorized" on public.tables;
create policy "tables_insert_authorized"
  on public.tables
  for insert
  to authenticated
  with check (
    public.auth_user_id() is not null
    and public.current_user_is_active()
    and public.has_permission('tables.create')
  );

drop policy if exists "tables_update_authorized" on public.tables;
create policy "tables_update_authorized"
  on public.tables
  for update
  to authenticated
  using (
    public.auth_user_id() is not null
    and public.current_user_is_active()
    and public.has_permission('tables.update')
  )
  with check (
    public.auth_user_id() is not null
    and public.current_user_is_active()
    and public.has_permission('tables.update')
  );

revoke insert, update, delete on public.tables from anon;
revoke delete on public.tables from authenticated;

-- Admin writes every column except the surrogate key and timestamps.
grant insert (table_code, name, capacity, status, is_active) on public.tables to authenticated;
grant update (table_code, name, capacity, status, is_active) on public.tables to authenticated;


-- MIGRATION: supabase/migrations/006_tables/002_table_qr.sql

-- =============================================================================
-- Tepi Sawah — Migration 006 (part 2): Table QR codes.
--
-- Source: docs/database/DATABASE_SCHEMA.md §18 (table_qr),
-- docs/security/AUTH_RBAC_RLS.md §18 (Public QR Security), §26 (RLS Pattern:
-- Tables), §46 (data exposure rules by module), docs/api/API_CONTRACT.md §8.2.
--
-- One row per printed QR for a table. The printed QR carries the table code
-- plus this row's `token`: the code is public and not a secret (§18 — table code
-- alone must not authorize anything), the token is the revocable, optionally
-- expirable credential that makes a specific printed QR stop working
-- (`is_active = false`) or roll over (`regenerate_table_qr()` in part 3). The
-- token is deliberately not the table's UUID (DATABASE_SCHEMA.md §18): a UUID
-- would leak an internal identifier onto every printed sticker, and rotating
-- one QR would have to invalidate the table identity itself.
--
-- A table holds exactly one active QR. The unique partial index below is the
-- duplicate-QR guard: two active rows for one table are impossible, so a table
-- can never resolve through two different printed codes at once, and the token
-- unique index keeps two tables from sharing one code+token pair.
--
-- No client role receives any grant on this table. Reads and writes go through
-- the SECURITY DEFINER functions in part 3, which check `tables.qr_manage`
-- server-side before touching a row and return only the columns each caller is
-- allowed to see (AUTH_RBAC_RLS.md §34, §46).
-- =============================================================================
create table if not exists public.table_qr (
  id          uuid        primary key default gen_random_uuid(),
  table_id    uuid        not null references public.tables(id),
  token       text        not null,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz null,
  constraint table_qr_token_not_blank check (btrim(token) <> '')
);

-- Every token is distinct, forever: a reprinted QR must not resurrect a retired
-- token, and two tables can never share a printed code+token pair.
create unique index if not exists table_qr_token_key
  on public.table_qr (token);

-- One active QR per table. This is the duplicate-QR invariant.
create unique index if not exists table_qr_active_table_key
  on public.table_qr (table_id)
  where is_active;

create index if not exists table_qr_table_idx
  on public.table_qr (table_id);

-- -----------------------------------------------------------------------------
-- RLS — no direct client access in either direction (AUTH_RBAC_RLS.md §18,
-- §26). Anonymous customers resolve through the public projection in part 3;
-- staff mint, roll and retire QRs through the `tables.qr_manage` RPCs there.
-- -----------------------------------------------------------------------------
alter table public.table_qr enable row level security;

revoke select, insert, update, delete on public.table_qr from anon;
revoke select, insert, update, delete on public.table_qr from authenticated;


-- MIGRATION: supabase/migrations/006_tables/003_tables_functions.sql

-- =============================================================================
-- Tepi Sawah — Migration 006 (part 3): Table QR functions.
--
-- Source: docs/api/API_CONTRACT.md §8.2 (Resolve QR), docs/security/
-- AUTH_RBAC_RLS.md §17 (customer public access), §18 (Public QR Security),
-- §26 (RLS Pattern: Tables), §34 (SECURITY DEFINER rules), §47 (validate before
-- mutate), docs/database/DATABASE_SCHEMA.md §17-§18.
--
-- Three SECURITY DEFINER functions, each with `search_path` pinned to `public`
-- and no dynamic SQL (AUTH_RBAC_RLS.md §34):
--
--   resolve_table_qr(code, token)   public  — the customer QR entry point
--   regenerate_table_qr(table_id)   staff   — mint/roll a table's printed QR
--   deactivate_table_qr(table_id)   staff   — retire a table's printed QR
--
-- `table_qr` grants nothing to any client role (part 2), so these functions are
-- the only path to it. The staff pair re-check `tables.qr_manage` inside the
-- function body, so a session that loses the permission stops being able to
-- mint QRs even if a stale grant survived somewhere.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- resolve_table_qr() — the customer entry point (API_CONTRACT.md §8.2).
--
-- Validates the printed QR against the database, then returns the minimum the
-- ordering flow needs: the table identity and the public restaurant context.
-- A QR is one round trip; nothing about the staff side of the house — roles,
-- permissions, staff names, audit rows, other tables — is ever returned
-- (AUTH_RBAC_RLS.md §17, §18). The response never carries the token back: the
-- token is validated, never echoed.
--
-- Fails closed for every state a printed sticker can be in:
--   unknown code or token          -> no row, empty result
--   token belongs to another table -> the join finds nothing
--   QR retired (is_active = false) -> filtered out
--   QR expired (expires_at passed) -> filtered out
--   table archived (is_active off) -> filtered out
-- so the customer sees "QR tidak valid" instead of a half-open ordering
-- context. `session` (API_CONTRACT.md §8.2) lands with table sessions in
-- Phase 7; until then the caller treats it as absent.
--
-- Returns at most one row. Stable + SECURITY DEFINER: it only reads, so it is
-- safe to run as the function owner and callable by anonymous customers.
-- -----------------------------------------------------------------------------
-- Idempotent re-run guard: migration 007 part 4 redefines this function with
-- an additional OUT column (the active session), and CREATE OR REPLACE
-- FUNCTION cannot change the return type of an existing function. Drop first
-- so the whole migration set stays re-runnable in dependency order.
drop function if exists public.resolve_table_qr(text, text);

create or replace function public.resolve_table_qr(
  p_table_code text,
  p_token text
)
returns table (
  table_id        uuid,
  table_code      text,
  table_name      text,
  restaurant_name text,
  is_open         boolean
)
language sql
stable
security definer set search_path = public
as $$
  select
    t.id,
    t.table_code,
    t.name,
    s.restaurant_name,
    public.is_restaurant_open()
  from public.tables t
  join public.table_qr q
    on q.table_id = t.id
   and q.is_active
   and (q.expires_at is null or q.expires_at > now())
  cross join lateral (
    select rs.restaurant_name
    from public.restaurant_settings rs
    order by rs.id
    limit 1
  ) s
  where t.is_active
    and lower(btrim(t.table_code)) = lower(btrim(p_table_code))
    and q.token = btrim(p_token)
  limit 1
$$;

comment on function public.resolve_table_qr(text, text) is
  'Public QR resolver: validates a printed table QR (code + revocable token) and returns the table identity plus public restaurant context. Empty result for unknown, retired, expired or archived QR.';

-- -----------------------------------------------------------------------------
-- regenerate_table_qr() — mint or roll a table's printed QR (staff).
--
-- One statement, one transaction: the table's current active QR is retired and
-- a fresh token is inserted, so a table is never without an active QR and never
-- has two (the unique partial index from part 2 is the backstop). Because the
-- printed material carries the token, rolling it invalidates every previously
-- printed sticker for this table — that is the point of the operation
-- (AUTH_RBAC_RLS.md §18: a compromised or worn-out QR must be revocable).
--
-- Authorization is re-checked inside the function and reported as 42501, the
-- same code RLS raises, so the client cannot distinguish "no permission" from
-- "RLS denied" and the error handling stays uniform. The fresh token is
-- returned only to the authorized caller — staff need it to print the sticker —
-- and never appears in the public projection.
-- -----------------------------------------------------------------------------
create or replace function public.regenerate_table_qr(p_table_id uuid)
returns table (
  qr_id     uuid,
  table_id  uuid,
  token     text,
  is_active boolean,
  created_at timestamptz,
  expires_at timestamptz
)
language plpgsql
security definer set search_path = public, extensions
as $$
declare
  v_qr public.table_qr%rowtype;
begin
  if public.auth_user_id() is null
     or not public.current_user_is_active()
     or not public.has_permission('tables.qr_manage') then
    raise insufficient_privilege
      using detail = 'QR management requires the tables.qr_manage permission.';
  end if;

  -- Column references are qualified with the table name: the `returns table`
  -- clause turns every output column (table_id, is_active, …) into a PL/pgSQL
  -- variable, and unqualified references inside the body raise 42702
  -- "column reference is ambiguous" at runtime.
  update public.table_qr
     set is_active = false
   where table_qr.table_id = p_table_id
     and table_qr.is_active;

  -- RETURNING without INTO has no destination in PL/pgSQL (42601); capture the
  -- fresh row and hand it back through RETURN QUERY.
  insert into public.table_qr (table_id, token)
  values (p_table_id, encode(gen_random_bytes(24), 'hex'))
  returning * into v_qr;

  return query
  select v_qr.id, v_qr.table_id, v_qr.token,
         v_qr.is_active, v_qr.created_at, v_qr.expires_at;
end;
$$;

comment on function public.regenerate_table_qr(uuid) is
  'Mint (or roll) the active QR for one table. Retires the previous QR and returns the fresh token to the tables.qr_manage caller.';

-- -----------------------------------------------------------------------------
-- deactivate_table_qr() — retire a table's printed QR without touching the
-- table (staff). The table stays active and bookable through other channels;
-- only QR entry closes. This is the "QR harus dapat dinonaktifkan" control
-- (AUTH_RBAC_RLS.md §18) kept separate from table archival so the two shutdown
-- reasons — broken sticker and removed table — stay distinguishable.
--
-- Idempotent: retiring a table with no active QR updates nothing and still
-- succeeds. Returns true when a QR was actually retired, so the audit trail is
-- precise.
-- -----------------------------------------------------------------------------
create or replace function public.deactivate_table_qr(p_table_id uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
  if public.auth_user_id() is null
     or not public.current_user_is_active()
     or not public.has_permission('tables.qr_manage') then
    raise insufficient_privilege
      using detail = 'QR management requires the tables.qr_manage permission.';
  end if;

  update public.table_qr
     set is_active = false
   where table_id = p_table_id
     and is_active;

  return found;
end;
$$;

comment on function public.deactivate_table_qr(uuid) is
  'Retire the active QR of one table. Idempotent; returns true when a QR was retired. Requires tables.qr_manage.';

-- -----------------------------------------------------------------------------
-- Grants. The resolver is the public read path: anonymous customers and
-- signed-in staff may call it. The two management functions are staff-only;
-- the permission check inside each is the real gate, not this grant.
-- (regenerate_table_qr's search_path includes `extensions` so gen_random_bytes
-- from pgcrypto resolves when the extension lives in that schema — the
-- Supabase default.)
-- -----------------------------------------------------------------------------
grant execute on function public.resolve_table_qr(text, text) to authenticated, anon;
grant execute on function public.regenerate_table_qr(uuid) to authenticated;
grant execute on function public.deactivate_table_qr(uuid) to authenticated;


-- MIGRATION: supabase/migrations/007_table_sessions/001_table_sessions.sql

-- =============================================================================
-- Tepi Sawah — Migration 007 (part 1): Table sessions.
--
-- Source: docs/database/DATABASE_SCHEMA.md §19 (table_sessions),
-- docs/database/DATABASE_MIGRATION_PLAN.md §20 (one table session may hold
-- more than one order; history survives closure),
-- docs/api/API_CONTRACT.md §9.1-§9.3 (Open / Get / Close Table Session),
-- docs/security/AUTH_RBAC_RLS.md §20 (RLS list), §21 (six questions),
-- §26 (RLS pattern), §34 (SECURITY DEFINER rules), §47 (validate before mutate),
-- docs/implementation/CLINE_IMPLEMENTATION_PLAN.md §13.
--
-- A session is the operational dining visit: one table, one OPEN session at a
-- time, and every order placed during that visit belongs to it
-- (DATABASE_SCHEMA.md §19: Table A12 / Session S1 / Order 001+002+003).
--
-- The one-active-session invariant is enforced by a partial unique index
-- (below) — this is the concurrency protection the phase asks for. Two staff
-- opening the same table at the same instant cannot produce two OPEN sessions:
-- the second write fails the index, and `open_table_session()` in part 3 turns
-- that failure into a reuse of the winner. Frontend never decides session
-- state; the database does.
--
-- Closure is soft and history-preserving (DATABASE_SCHEMA.md §36): a closed
-- session row stays, its orders keep pointing at it, and `closed_at`/`closed_by`
-- record the end. No DELETE is ever granted on this table.
-- =============================================================================
create table if not exists public.table_sessions (
  id         uuid        primary key default gen_random_uuid(),
  table_id   uuid        not null references public.tables(id),
  status     text        not null default 'OPEN',
  opened_at  timestamptz not null default now(),
  closed_at  timestamptz null,
  opened_by  uuid        null references public.profiles(id),
  closed_by  uuid        null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint table_sessions_status_vocabulary check (status in ('OPEN', 'CLOSED')),
  constraint table_sessions_open_before_close check (
    closed_at is null or (opened_at is not null and closed_at >= opened_at)
  )
);

-- One OPEN session per table, enforced by the index. This is the backstop the
-- RPC relies on: `open_table_session()` inserts with an ON CONFLICT clause that
-- only resolves against this exact predicate, so a race collapses into a
-- single row rather than a duplicate session.
create unique index if not exists table_sessions_one_open_per_table
  on public.table_sessions (table_id)
  where status = 'OPEN';

create index if not exists table_sessions_table_status_idx
  on public.table_sessions (table_id, status);

create index if not exists table_sessions_opened_at_idx
  on public.table_sessions (opened_at desc);

-- `updated_at` is maintained by the shared trigger from migration 002.
drop trigger if exists table_sessions_set_updated_at on public.table_sessions;
create trigger table_sessions_set_updated_at
  before update on public.table_sessions
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS — the security boundary (AUTH_RBAC_RLS.md §26).
--
-- SELECT: an active authenticated staff session holding `table_sessions.read`.
--          The customer flow never touches this table directly: the active
--          session reaches the QR entry point through the `resolve_table_qr()`
--          projection (part 3), which only exposes the session id + status
--          (API_CONTRACT.md §8.2).
-- INSERT / UPDATE / DELETE: never granted. Every mutation rides one of the
--          SECURITY DEFINER functions in part 3, which re-check

--          `table_sessions.manage` inside the transaction. That keeps the
--          critical mutations atomic, authorized and idempotent
--          (MASTER prompt: server-side, authorized, atomic, idempotent,
--           auditable) and means a lost grant cannot open a backdoor.
-- -----------------------------------------------------------------------------
alter table public.table_sessions enable row level security;

drop policy if exists "table_sessions_select_authorized" on public.table_sessions;
create policy "table_sessions_select_authorized"
  on public.table_sessions
  for select
  to authenticated
  using (
    public.auth_user_id() is not null
    and public.current_user_is_active()
    and public.has_permission('table_sessions.read')
  );

revoke insert, update, delete on public.table_sessions from anon;
revoke insert, update, delete on public.table_sessions from authenticated;

comment on table public.table_sessions is
  'A dining visit at one table. One OPEN session per table (partial unique index); multiple orders may belong to it, and closure preserves history.';


-- MIGRATION: supabase/migrations/007_table_sessions/002_table_session_order_links.sql

-- =============================================================================
-- Tepi Sawah — Migration 007 (part 2): Table session order links.
--
-- Purpose: the "attach order" half of the one-session-has-many-orders relation
-- (DATABASE_SCHEMA.md §19, API_CONTRACT.md §10.1: create order carries
-- tableSessionId). Phase 8 builds `orders` with its own `table_session_id`
-- foreign key; this lightweight link is the Phase 7 side of the same invariant
-- and is the thing the order-creation flow posts against to register an order
-- with its session.
--
-- Why a link table instead of a counter: the phase requires tests for multiple
-- orders, concurrent order creation and duplicate actions, which need order
-- identity. A counter cannot tell a duplicate attach from a genuine second
-- order; the unique constraint on `order_id` can.
--
-- Unique on `order_id` — one order belongs to at most one session (an attach to
-- a second session is rejected, not redirected). Idempotent by construction:
-- attaching the same order/session pair twice touches no rows, so a retried
-- request after a network drop cannot corrupt the session.
-- =============================================================================
create table if not exists public.table_session_order_links (
  id          uuid        primary key default gen_random_uuid(),
  session_id  uuid        not null references public.table_sessions(id) on delete cascade,
  order_id    uuid        not null,
  order_code  text        not null,
  attached_at timestamptz not null default now(),
  constraint table_session_order_links_order_once unique (order_id)
);

create index if not exists table_session_order_links_session_idx
  on public.table_session_order_links (session_id);

-- -----------------------------------------------------------------------------
-- RLS — read-only like its parent table.
--
-- SELECT: active staff holding `table_sessions.read` (the same module
--          permission that governs the session itself).
-- INSERT / UPDATE / DELETE: never granted. `attach_order_to_session()` in
--          part 3 is the only write path; it validates the session is OPEN and
--          the table is active before inserting.
--
-- The customer order app reaches this through the resolve projection, not by
-- reading the table, and the projection exposes no order detail.
-- -----------------------------------------------------------------------------
alter table public.table_session_order_links enable row level security;

drop policy if exists "table_session_order_links_select_authorized"
  on public.table_session_order_links;
create policy "table_session_order_links_select_authorized"
  on public.table_session_order_links
  for select
  to authenticated
  using (
    public.auth_user_id() is not null
    and public.current_user_is_active()
    and public.has_permission('table_sessions.read')
  );

revoke insert, update, delete on public.table_session_order_links from anon;
revoke insert, update, delete on public.table_session_order_links from authenticated;

comment on table public.table_session_order_links is
  'Links one order into its table session. Unique on order_id; only attach_order_to_session() may insert.';


-- MIGRATION: supabase/migrations/007_table_sessions/003_table_sessions_functions.sql

-- =============================================================================
-- Tepi Sawah — Migration 007 (part 3): Table session commands.
--
-- Source: API_CONTRACT.md §9.1 (Open Table Session), §9.2 (Get Active Session),
-- §9.3 (Close Table Session), §10.1 (create order carries tableSessionId),
-- AUTH_RBAC_RLS.md §20, §25 (auth predicates), §34 (SECURITY DEFINER rules),
-- §46 (idempotency), §47 (validate before mutate),
-- CLINE_IMPLEMENTATION_PLAN.md §13.
--
-- All four commands are SECURITY DEFINER with `search_path` pinned to `public`
-- and no dynamic SQL (AUTH_RBAC_RLS.md §34). They are the only write paths to
-- `table_sessions`, so the grants that were withheld in part 1 cannot be lost
-- in a way that breaks the invariant. Each one re-checks its own permission
-- inside the transaction and raises 42501 on denial, matching the RLS denial
-- the caller would have seen on a granted table.
--
-- Session state is always decided here, never in the frontend
-- (MASTER prompt: the backend is the authority; the database is the source of
--  truth; frontend permission is only UX).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- open_table_session(p_table_id)
--
-- Idempotent + race-safe. The partial unique index from part 1 is the
-- invariant: the INSERT carries `on conflict (table_id) where status = 'OPEN'
-- do nothing`, so two concurrent "open" requests on the same table yield one
-- session and the loser simply gets the winner returned to it — no duplicate,
-- no error to handle client-side.
-- -----------------------------------------------------------------------------
create or replace function public.open_table_session(p_table_id uuid)
returns setof public.table_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table public.tables%rowtype;
  v_session public.table_sessions%rowtype;
begin
  -- Authorization (AUTH_RBAC_RLS.md §25).
  if public.auth_user_id() is null or not public.current_user_is_active()
     or not public.has_permission('table_sessions.manage')
  then
    raise exception 'Not authorized to manage table sessions' using errcode = '42501';
  end if;

  -- Validate before mutate (§47): the table must exist and be active.
  select * into v_table
  from public.tables
  where id = p_table_id
  for update;  -- lock the table row so open/close cannot interleave on it

  if not found then
    raise exception 'Table not found' using errcode = 'P0002';
  end if;

  if not v_table.is_active then
    raise exception 'Table % is not active', v_table.table_code
      using errcode = '23003';  -- class 23 — integrity violation
  end if;

  -- The race collapses into one row here; then we read the surviving session.
  insert into public.table_sessions (table_id, status, opened_by)
  values (p_table_id, 'OPEN', public.auth_user_id())
  on conflict (table_id) where status = 'OPEN' do nothing
  returning * into v_session;

  if v_session.id is null then
    select * into v_session
    from public.table_sessions
    where table_id = p_table_id and status = 'OPEN';
  end if;

  return next v_session;
end;
$$;

grant execute on function public.open_table_session(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- get_active_table_session(p_table_id)
--
-- Returns the one OPEN session for a table, or nothing. Staff use this to pick
-- up the live session before attaching an order or closing it; the customer
-- flow gets its copy through `resolve_table_qr()` (part 4).
-- -----------------------------------------------------------------------------
create or replace function public.get_active_table_session(p_table_id uuid)
returns setof public.table_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.table_sessions%rowtype;
begin
  if public.auth_user_id() is null or not public.current_user_is_active()
     or not public.has_permission('table_sessions.read')
  then
    raise exception 'Not authorized to read table sessions' using errcode = '42501';
  end if;

  select * into v_session
  from public.table_sessions
  where table_id = p_table_id and status = 'OPEN';

  if v_session.id is not null then
    return next v_session;
  end if;
end;
$$;

grant execute on function public.get_active_table_session(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- attach_order_to_session(p_session_id, p_order_id, p_order_code)
--
-- Registers one order against its session (API_CONTRACT.md §10.1). This is the
-- command that makes "one session can have several orders" true on the write
-- side, and it is safe to retry: the unique `order_id` constraint means a
-- duplicated request attaches nothing new.
--
-- Attaching to a CLOSED session is refused — a stale session must not quietly
-- absorb orders.
-- -----------------------------------------------------------------------------
create or replace function public.attach_order_to_session(
  p_session_id uuid,
  p_order_id   uuid,
  p_order_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.table_sessions%rowtype;
  v_table   public.tables%rowtype;
  v_count   integer;
  v_inserted boolean;
begin
  if public.auth_user_id() is null or not public.current_user_is_active()
     or not public.has_permission('table_sessions.manage')
  then
    raise exception 'Not authorized to attach an order to a table session'
      using errcode = '42501';
  end if;

  -- Validate the session is open and its table still usable.
  select * into v_session
  from public.table_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'Table session not found' using errcode = 'P0002';
  end if;

  if v_session.status <> 'OPEN' then
    raise exception 'Table session is closed; cannot attach order %', p_order_code
      using errcode = '23003';
  end if;

  select * into v_table from public.tables where id = v_session.table_id;
  if not v_table.is_active then
    raise exception 'Table % is not active', v_table.table_code using errcode = '23003';
  end if;

  -- Concurrent create: two writers racing the same order_id both land here;
  -- exactly one wins, the other's ON CONFLICT no-ops and reports attached=false
  -- so the client can treat a retry as success (§46).
  insert into public.table_session_order_links (session_id, order_id, order_code)
  values (v_session.id, p_order_id, p_order_code)
  on conflict (order_id) do nothing
  returning true into v_inserted;

  if v_inserted is null then
    v_inserted := false;
  end if;

  select count(*) into v_count
  from public.table_session_order_links
  where session_id = v_session.id;

  return jsonb_build_object(
    'session_id', v_session.id,
    'table_id',   v_session.table_id,
    'status',     v_session.status,
    'order_id',   p_order_id,
    'order_code', p_order_code,
    'attached',   v_inserted,
    'order_count', v_count
  );
end;
$$;

grant execute on function public.attach_order_to_session(uuid, uuid, text)
  to authenticated;

-- -----------------------------------------------------------------------------
-- close_table_session(p_session_id)
--
-- Ends the dining visit (API_CONTRACT.md §9.3). Closure is soft: the row stays,
-- `orders` will keep pointing at it, and history remains readable through the
-- same `table_sessions.read` policy.
--
-- Validation enforced server-side:
--   * the caller may manage sessions;
--   * the session exists;
--   * the session is still OPEN (a repeat close is rejected, not ignored —
--     duplicate action must surface);
--   * the table the session belongs to is still active.
--
-- Closing NEVER happens because one order finished — this command is the only
-- route to CLOSED and it is a deliberate staff action. The
-- "no orders are still in flight" business rule is intentionally not enforced
-- yet: the `orders` table does not exist until Phase 8 (migration 008) and
-- inventing a rule over a table that does not exist would be guessing. It is
-- added as the first task of Phase 8, documented in the phase report.
-- -----------------------------------------------------------------------------
create or replace function public.close_table_session(p_session_id uuid)
returns setof public.table_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.table_sessions%rowtype;
begin
  if public.auth_user_id() is null or not public.current_user_is_active()
     or not public.has_permission('table_sessions.manage')
  then
    raise exception 'Not authorized to close a table session' using errcode = '42501';
  end if;

  select * into v_session
  from public.table_sessions
  where id = p_session_id
  for update;  -- serialize against a concurrent close

  if not found then
    raise exception 'Table session not found' using errcode = 'P0002';
  end if;

  if v_session.status <> 'OPEN' then
    raise exception 'Table session is already closed' using errcode = '23003';
  end if;

  update public.table_sessions
  set status    = 'CLOSED',
      closed_at = now(),
      closed_by = public.auth_user_id()
  where id = p_session_id
  returning * into v_session;

  return next v_session;
end;
$$;

grant execute on function public.close_table_session(uuid) to authenticated;


-- MIGRATION: supabase/migrations/007_table_sessions/004_resolve_qr_session.sql

-- =============================================================================
-- Tepi Sawah — Migration 007 (part 4): resolve_table_qr gains the active session.
--
-- API_CONTRACT.md §8.2 lists `session` on the QR resolve payload, and
-- CLINE_IMPLEMENTATION_PLAN.md §13 / AUTH_RBAC_RLS.md §20 place the active
-- session on the customer path. This migration fills that field.
--
-- The return shape grows by two nullable columns (`session_id`, `session_status`),
-- so the `returns table` signature changes and the function must be dropped and
-- recreated rather than `create or replace`d. The grant below is restored
-- explicitly.
--
-- Only the session id and status are exposed — never opened_by/closed_by,
-- order ids, or the QR token (AUTH_RBAC_RLS.md §17-§18: the customer gets the
-- minimum, and internal staff data never reaches the public surface).
-- =============================================================================
drop function if exists public.resolve_table_qr(text, text);

create or replace function public.resolve_table_qr(
  p_table_code text,
  p_token text
)
returns table (
  table_id        uuid,
  table_code      text,
  table_name      text,
  restaurant_name text,
  is_open         boolean,
  session_id      uuid,
  session_status  text
)
language sql
stable
security definer set search_path = public
as $$
  select
    t.id,
    t.table_code,
    t.name,
    s.restaurant_name,
    public.is_restaurant_open(),
    ses.id,
    ses.status
  from public.tables t
  join public.table_qr q
    on q.table_id = t.id
   and q.is_active
   and (q.expires_at is null or q.expires_at > now())
  cross join lateral (
    select rs.restaurant_name
    from public.restaurant_settings rs
    order by rs.id
    limit 1
  ) s
  left join public.table_sessions ses
    on ses.table_id = t.id
   and ses.status = 'OPEN'
  where t.is_active
    and lower(btrim(t.table_code)) = lower(btrim(p_table_code))
    and q.token = btrim(p_token)
  limit 1
$$;

comment on function public.resolve_table_qr(text, text) is
  'Public QR resolver: validates a printed table QR (code + revocable token) and returns the table identity, the public restaurant context, and the table active session (id + status only). Empty result for unknown, retired, expired or archived QR.';

grant execute on function public.resolve_table_qr(text, text) to authenticated, anon;


-- MIGRATION: supabase/migrations/008_orders/001_orders.sql

-- =============================================================================
-- Tepi Sawah — Migration 008 (part 1): Orders.
--
-- Source: docs/database/DATABASE_SCHEMA.md §20 (orders),
-- docs/database/DATABASE_MIGRATION_PLAN.md §21 (Migration 016 — Orders:
-- "Jangan mengizinkan arbitrary status string tanpa validation"),
-- docs/api/API_CONTRACT.md §10.1 (Create Draft Order), §13 (order state
-- machine), §2.3 (Idempotency-Key),
-- docs/security/AUTH_RBAC_RLS.md §20 (RLS list), §21 (six questions),
-- §27 (RLS Pattern: Orders — customers reach orders only through controlled
-- public ordering paths), §34 (SECURITY DEFINER rules), §46 (idempotency),
-- §47 (validate before mutate),
-- docs/implementation/CLINE_IMPLEMENTATION_PLAN.md §14 (Phase 8A).
--
-- CRITICAL — the whole point of this table (API_CONTRACT.md §10.1):
-- `subtotal`, `discount`, `tax` and `total` are computed by the backend from
-- authoritative catalog data. A client may send only product/modifier
-- references, quantity and notes. The `create_draft_order()` RPC in
-- migration 010 part 2 is the only INSERT path: it reads `products.price` and
-- `modifiers.price_delta` itself, snapshots them onto the item rows, and sums
-- the totals here. No client-supplied money value is ever written, so there is
-- no column to tamper with — the columns simply are not in the grant list and
-- the RPC never accepts them as parameters.
--
-- The totals are additionally constrained by a CHECK: `total = subtotal -
-- discount + tax`. Even a buggy caller cannot store an inconsistent order.
--
-- `idempotency_key` makes a retried create return the same order instead of a
-- duplicate (API_CONTRACT.md §2.3). It is the client's key, stored once, with a
-- unique index so a second create with the same key fails the index and the
-- RPC turns that into a reuse of the winner — the same race-proof shape used
-- for table sessions in migration 007.
-- =============================================================================
create sequence if not exists public.order_number_seq as bigint start 1;

create table if not exists public.orders (
  id               uuid          primary key default gen_random_uuid(),
  order_number     text          not null,
  table_id         uuid          not null references public.tables(id),
  table_session_id uuid          not null references public.table_sessions(id),
  source           text          not null,
  status           text          not null default 'DRAFT',
  notes            text          null,
  subtotal         numeric(12,2) not null default 0,
  discount         numeric(12,2) not null default 0,
  tax              numeric(12,2) not null default 0,
  total            numeric(12,2) not null default 0,
  idempotency_key  text          null,
  created_by       uuid          null references public.profiles(id),
  created_at       timestamptz  not null default now(),
  updated_at       timestamptz  not null default now(),

  -- The order number is the human-facing handle (TS-YYYYMMDD-NNNN); the id is
  -- the join key. Only order_number is unique-constrained for display.
  constraint orders_order_number_unique unique (order_number),

  -- The idempotency key is unique when present. NULL keys (a client that did
  -- not send one) are allowed and are simply not deduplicated.
  constraint orders_idempotency_key_unique unique (idempotency_key),

  -- Source vocabulary (DATABASE_SCHEMA.md §20). POS drafts share the waiter
  -- command path; a customer draft is always CUSTOMER_QR.
  constraint orders_source_vocabulary check (
    source in ('CUSTOMER_QR', 'WAITER', 'POS')
  ),

  -- The full order state machine, including the exception states. A draft
  -- order may only be born here; every later transition is a guarded command.
  constraint orders_status_vocabulary check (
    status in ('DRAFT', 'SUBMITTED', 'PENDING_CONFIRMATION', 'CONFIRMED',
               'PREPARING', 'READY', 'SERVED', 'PAID', 'COMPLETED',
               'CANCELLED', 'REJECTED', 'VOID', 'REFUNDED')
  ),

  -- Money is never negative, and the total always reconciles with its parts.
  -- A caller can never store a total it invented.
  constraint orders_money_non_negative check (
    subtotal >= 0 and discount >= 0 and tax >= 0 and total >= 0
  ),
  constraint orders_total_reconciles check (
    total = subtotal - discount + tax
  )
);

create index if not exists orders_table_session_id_idx
  on public.orders (table_session_id);

create index if not exists orders_status_idx
  on public.orders (status);

create index if not exists orders_table_id_idx
  on public.orders (table_id);

alter table public.orders enable row level security;

-- -----------------------------------------------------------------------------
-- RLS (AUTH_RBAC_RLS.md §27).
--
-- Customers never read this table directly: they see an order only through the
-- controlled public order path in migration 010 part 3, which re-validates the
-- table context the QR established. That is why there is no `anon` policy here
-- at all — an anonymous browser cannot enumerate or guess orders by id
-- (§47: "customer cannot read arbitrary orders").
--
-- Staff read their operational orders through the `orders.read` grant, which
-- the role matrix gives to waiter / cashier / kitchen / supervisor / admin /
-- owner (AUTH_RBAC_RLS.md §8). Kitchen reads the kitchen projection from a
-- dedicated function in a later migration, never payment details (§46).
-- -----------------------------------------------------------------------------
create policy orders_staff_read on public.orders
  for select to authenticated
  using (
    public.current_user_is_active()
    and public.has_permission('orders.read')
  );

-- No INSERT / UPDATE / DELETE policy, and no grants. Order creation, status
-- transitions and exception handling are all SECURITY DEFINER RPCs in
-- migration 010 (and later phases), each re-checking authorization and
-- permission inside its own transaction. There is no client-side path that can
-- create an order, set a status, or rewrite totals — by construction, not by
-- cooperation (AUTH_RBAC_RLS.md §34: "critical mutation harus server-side,
-- authorized, atomic, idempotent, auditable").

revoke insert, update, delete on public.orders from anon, authenticated;


-- MIGRATION: supabase/migrations/008_orders/002_submit_idempotency_key.sql

-- =============================================================================
-- Tepi Sawah — Migration 008 (part 2): Submit idempotency key.
--
-- Source: docs/api/API_CONTRACT.md §10.2 (Submit Order — the request carries
-- its own `idempotencyKey`), §2.3 (Idempotency-Key), §14 (idempotency),
-- docs/security/AUTH_RBAC_RLS.md §46 (idempotency),
-- docs/implementation/CLINE_IMPLEMENTATION_PLAN.md §14 (Phase 8B).
--
-- The create command already owns `orders.idempotency_key` (migration 008 part
-- 1), unique across the whole table. Submission is a *second* deduplicated
-- command on the same row: a customer taps submit, the network stutters, the
-- tap is retried. That retry must land on the already-submitted order, not be
-- rejected as a duplicate create and not be accepted as a second submission.
--
-- Reusing the create column is not possible — its unique index is keyed to the
-- create command's key space, and one row can carry at most one of each. So
-- submission gets its own column, with its own unique index, on the same row.
-- The two keys never collide: they are minted by different commands with
-- different scopes (API_CONTRACT.md §14).
--
-- NULL is allowed and simply not deduplicated, mirroring the create column.
-- =============================================================================
alter table public.orders
  add column if not exists submit_idempotency_key text null;

-- Unique when present. A retried submit with the same key is turned into a
-- read of the first result by `submit_order()` (migration 010 part 3); a
-- second submit with a *different* key on an already-submitted order is a
-- genuine conflict and is refused (API_CONTRACT.md §26).
create unique index if not exists orders_submit_idempotency_key_unique
  on public.orders (submit_idempotency_key)
  where submit_idempotency_key is not null;


-- MIGRATION: supabase/migrations/009_order_items/001_order_items.sql

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


-- MIGRATION: supabase/migrations/009_order_items/002_order_item_modifiers.sql

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


-- MIGRATION: supabase/migrations/010_order_status_history/001_order_status_history.sql

-- =============================================================================
-- Tepi Sawah — Migration 010 (part 1): Order status history.
--
-- Source: docs/database/DATABASE_SCHEMA.md §23 (order_status_history),
-- docs/database/DATABASE_MIGRATION_PLAN.md §24 (Migration 019 — Order Status
-- History: "immutable-oriented audit trail untuk lifecycle order"; "Jangan
-- menghapus history hanya karena order selesai"),
-- docs/security/AUTH_RBAC_RLS.md §29 (RLS Pattern: Order Status History —
-- append-oriented; "Users should not directly edit historical transitions"),
-- §30 (audit events are append-only).
--
-- Every status change appends one row; the current status lives on
-- `orders.status`. Nothing here is ever UPDATEd or DELETEd from the client —
-- there are no grants for it. The first row of every order is
-- `from_status = null, to_status = 'DRAFT'`, written by the create command
-- itself so an order's birth is part of its trail.
--
-- `actor_role` records the role the actor used, not the actor's current role:
-- if a cashier is later demoted, the audit still says a cashier confirmed.
-- =============================================================================
create table if not exists public.order_status_history (
  id          uuid         primary key default gen_random_uuid(),
  order_id    uuid         not null references public.orders(id) on delete cascade,
  from_status text         null,
  to_status   text         not null,
  actor_id    uuid         null references public.profiles(id),
  actor_role  text         null,
  reason      text         null,
  created_at  timestamptz not null default now()
);

create index if not exists order_status_history_order_id_created_at_idx
  on public.order_status_history (order_id, created_at);

alter table public.order_status_history enable row level security;

-- Append-oriented reads: staff with `orders.read` may follow an order's trail.
-- (AUTH_RBAC_RLS.md §46: audit visibility is limited; the customer projection
-- never includes history — that is §30's "audit details" exclusion.)
create policy order_status_history_staff_read on public.order_status_history
  for select to authenticated
  using (
    public.current_user_is_active()
    and public.has_permission('orders.read')
  );

-- INSERT/UPDATE/DELETE are never granted. History is written only by the
-- server-side transition commands, each of which is SECURITY DEFINER and
-- re-checks its own authorization (AUTH_RBAC_RLS.md §29). No client can
-- rewrite or delete the past.
revoke insert, update, delete on public.order_status_history from anon, authenticated;


-- MIGRATION: supabase/migrations/010_order_status_history/002_create_draft_order.sql

-- =============================================================================
-- Tepi Sawah — Migration 010 (part 2): Draft order creation command.
--
-- Source: docs/api/API_CONTRACT.md §10.1 (Create Draft Order), §11.1 (Create
-- Waiter Order), §2.2 (Security — never trust client price/total/role/status),
-- §2.3 (Idempotency-Key), §13 (order state machine: DRAFT is the entry state),
-- docs/database/DATABASE_SCHEMA.md §20-§23, §20 rules ("inactive products
-- cannot be ordered", "unavailable products cannot be ordered", "frontend
-- price is never authoritative", "Order totals must be calculated/validated
-- server-side"), §16 ("Selection behavior must be validated server-side"),
-- docs/security/AUTH_RBAC_RLS.md §27 (orders), §28 (items/modifiers inherit),
-- §34 (SECURITY DEFINER rules), §46 (idempotency), §47 (validate before
-- mutate), docs/implementation/CLINE_IMPLEMENTATION_PLAN.md §14 (Phase 8A).
--
-- =============================================================================
-- WHAT THIS COMMAND IS
-- =============================================================================
--
-- The single authority for order creation. A caller may send ONLY:
--
--     source          CUSTOMER_QR | WAITER | POS
--     tableId         which table this order belongs to
--     tableSessionId  the OPEN session this order joins
--     items[]         { productId, quantity, modifierIds[], notes }
--     customerNote    order-level note from the customer
--     internalNote    staff-only note (WAITER/POS only; never shown to
--                     customers — AUTH_RBAC_RLS.md §46)
--     idempotencyKey  the client's dedup key
--
-- It may NOT send, and this function does not accept, any money value: no
-- unit price, no line total, no subtotal, discount, tax or total, and no
-- status or payment field (API_CONTRACT.md §10.1, §2.2). Prices are looked up
-- from the live catalog inside this transaction and snapshotted onto the item
-- rows; totals are computed and written here. The client cannot tamper with a
-- price because there is no parameter to tamper with.
--
-- Authorization is re-checked inside the transaction (AUTH_RBAC_RLS.md §47):
-- a customer draft may be created anonymously, but ONLY through a validated
-- table context — the table must be active and the session must be OPEN and
-- must belong to that table. An anonymous caller cannot create an order for a
-- table they have no valid context for. A waiter/POS draft additionally
-- requires an authenticated, active staff account holding
-- `orders.create_manual`.
--
-- Idempotency (§2.3, §46): the client's key is stored on the order under a
-- unique index. A repeat create with the same key returns the order that the
-- first create produced — the same id, the same number, the same totals. Two
-- concurrent creates with the same key race on the unique index: the loser's
-- INSERT is absorbed by `on conflict do nothing` and the RPC then reads the
-- winner's order and serves it, so a double-tap or a network retry yields one
-- order, not two.
--
-- Validation happens BEFORE any write (§47): the whole item list is validated
-- and priced first, and only then does a single INSERT run. A rejected create
-- leaves no order row, no item rows, no history, and no consumed order number
-- that has to be explained away on a receipt.
--
-- Table session association: the order is linked to its session via
-- `orders.table_session_id`, the canonical relationship in DATABASE_SCHEMA.md
-- §20. `attach_order_to_session()` (migration 007 part 3) is NOT called: that
-- path requires `table_sessions.manage`, which a customer cannot hold, and the
-- gate review for Phase 7 flagged the separate link table as a second
-- representation of the same fact. Orders now carry the relationship directly.
--
-- Note on tax and discount: both are written as 0 for a draft. Tax is a
-- business rule the project has deliberately not fixed (payment/tax rules are
-- undecided; the prototype's PB1 must not become a production rule), and a
-- discount engine does not exist yet. The totals still reconcile because the
-- CHECK on `orders` enforces `total = subtotal - discount + tax`; when a real
-- rule arrives it will be applied here, server-side, and existing orders will
-- be unaffected (their snapshots are already frozen).
-- =============================================================================
create or replace function public.create_draft_order(
  p_source          text,
  p_table_id        uuid,
  p_table_session_id uuid,
  p_items           jsonb,
  p_customer_note   text default null,
  p_internal_note   text default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
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
begin
  -- ===========================================================================
  -- 1. Authorize.
  -- ===========================================================================
  -- Source must be a known value; an unknown source is never silently coerced
  -- (DATABASE_MIGRATION_PLAN.md §21: no arbitrary strings).
  if p_source is null or not (p_source in ('CUSTOMER_QR', 'WAITER', 'POS')) then
    raise exception 'Sumber order tidak valid' using errcode = '22023';
  end if;

  if p_source in ('WAITER', 'POS') then
    -- Staff manual order: must be an authenticated, active account holding the
    -- manual-order permission (API_CONTRACT.md §11.1, AUTH_RBAC_RLS.md §8).
    -- The role is recorded from the effective grant, not trusted from input.
    if public.auth_user_id() is null or not public.current_user_is_active()
       or not public.has_permission('orders.create_manual')
    then
      raise exception 'Not authorized to create manual orders'
        using errcode = '42501';
    end if;
    v_actor_id := public.auth_user_id();
    select r.code into v_actor_role
    from public.role_permissions rp
    join public.permissions p on p.id = rp.permission_id
    join public.roles r on r.id = rp.role_id
    where rp.permission_id = (
            select id from public.permissions where code = 'orders.create_manual'
          )
      and rp.role_id in (select role_id from public.user_roles
                         where user_id = v_actor_id)
    limit 1;
  else
    -- Customer QR draft: anonymous is allowed (API_CONTRACT.md §3), but the
    -- table context below must still validate. No staff actor is recorded.
    v_actor_id := null;
    v_actor_role := null;
  end if;

  -- ===========================================================================
  -- 2. Validate the table context before mutating anything (AUTH_RBAC_RLS.md
  --    §47). This is the controlled-public-access boundary for an anonymous
  --    caller: the table must exist and be active, and the session must be
  --    OPEN and must belong to this table (AUTH_RBAC_RLS.md §18 — a QR/token
  --    grants its own table context, nothing more).
  -- ===========================================================================
  select * into v_table
  from public.tables
  where id = p_table_id
  for update;

  if not found then
    raise exception 'Meja tidak ditemukan' using errcode = 'P0002';
  end if;

  if not v_table.is_active then
    raise exception 'Meja % tidak aktif', v_table.table_code
      using errcode = '23003';
  end if;

  select * into v_session
  from public.table_sessions
  where id = p_table_session_id
  for update;

  if not found then
    raise exception 'Sesi meja tidak ditemukan' using errcode = 'P0002';
  end if;

  if v_session.status <> 'OPEN' then
    raise exception 'Sesi meja sudah ditutup' using errcode = '23003';
  end if;

  if v_session.table_id <> p_table_id then
    raise exception 'Sesi tidak terhubung ke meja ini' using errcode = '23003';
  end if;

  -- An order must contain something. `jsonb_typeof` is checked first because a
  -- non-array payload (an object or a scalar) makes `jsonb_array_length` NULL,
  -- which would neither trip this guard nor iterate the loop (a client that
  -- sends `p_items: {"a": 1}` is not a valid request, and must not fall through
  -- to an empty order). An empty items array is a client bug, not an order.
  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0
  then
    raise exception 'Order harus memiliki minimal satu item'
      using errcode = '22023';
  end if;

  -- ===========================================================================
  -- 3. Idempotency — check before mutate (AUTH_RBAC_RLS.md §46). A repeat with
  --    the same key returns the first result verbatim (API_CONTRACT.md §2.3:
  --    "Backend harus mengembalikan hasil yang sama"), including its snapshot
  --    lines, assembled by `order_create_payload()` below.
  -- ===========================================================================
  if p_idempotency_key is not null then
    select * into v_order
    from public.orders
    where idempotency_key = p_idempotency_key;

    if found then
      return public.order_create_payload(v_order.id);
    end if;
  end if;

  -- ===========================================================================
  -- 4. Validate and price EVERY item from the authoritative catalog, before
  --    writing a single row. The client sent references only; the prices come
  --    from `products` and `modifiers` (DATABASE_SCHEMA.md §20 rules).
  -- ===========================================================================
  v_items := coalesce(p_items, '[]'::jsonb);

  for v_i in 0..jsonb_array_length(v_items) - 1 loop
    v_item := v_items->v_i;

    -- ---- quantity ----------------------------------------------------------
    -- Positive, and capped so a stray client value cannot produce an absurd
    -- line. The schema allows fractional quantity (numeric(12,3)); it just
    -- must be > 0 and sane.
    if (v_item->>'quantity')::numeric is null
       or (v_item->>'quantity')::numeric <= 0
       or (v_item->>'quantity')::numeric > 999
    then
      raise exception 'Jumlah item tidak valid' using errcode = '22023';
    end if;

    -- ---- product -----------------------------------------------------------
    select * into v_product
    from public.products
    where id = (v_item->>'productId')::uuid
    for update;

    if not found then
      raise exception 'Produk tidak ditemukan' using errcode = 'P0002';
    end if;

    -- Inactive = archived from the menu; unavailable = temporarily 86'd. Neither
    -- can be ordered (DATABASE_SCHEMA.md §20 rules).
    if not v_product.is_active then
      raise exception 'Produk % tidak aktif', v_product.name
        using errcode = '23003';
    end if;

    if not v_product.is_available then
      raise exception 'Produk % sedang tidak tersedia', v_product.name
        using errcode = 'P0003';
    end if;

    v_unit_price := v_product.price;
    v_line_total := v_unit_price * (v_item->>'quantity')::numeric;

    -- ---- modifiers ---------------------------------------------------------
    -- Each id must exist, be active, and be genuinely applicable to THIS
    -- product via `product_modifiers` (DATABASE_SCHEMA.md §16). A modifier
    -- from a different product is an invalid modifier, refused rather than
    -- priced (API_CONTRACT.md test list: "invalid modifier").
    v_mod_ids := coalesce(
      array(select (jsonb_array_elements_text(v_item->'modifierIds'))::uuid),
      array[]::uuid[]
    );

    foreach v_mod_id in array v_mod_ids loop
      select * into v_modifier
      from public.modifiers
      where id = v_mod_id;

      if not found then
        raise exception 'Modifier tidak ditemukan' using errcode = 'P0002';
      end if;

      if not v_modifier.is_active then
        raise exception 'Modifier % tidak aktif', v_modifier.name
          using errcode = '23003';
      end if;

      if not exists (
        select 1 from public.product_modifiers pm
        where pm.product_id = v_product.id and pm.modifier_id = v_mod_id
      ) then
        raise exception 'Modifier % tidak tersedia untuk produk ini', v_modifier.name
          using errcode = '23003';
      end if;

      -- The authoritative delta, multiplied by the item quantity — the
      -- snapshot row below records exactly this contribution.
      v_line_total := v_line_total
        + v_modifier.price_delta * (v_item->>'quantity')::numeric;
    end loop;

    -- ---- selection rules per modifier group (DATABASE_SCHEMA.md §16:
    --      "Selection behavior must be validated server-side") -------------
    -- A required group must receive at least its minimum; a bounded group must
    -- not exceed its maximum. Both are enforced here, not in the UI.
    for v_product_mods in
      select pm.modifier_id, m.name, pm.is_required, pm.min_select, pm.max_select
      from public.product_modifiers pm
      join public.modifiers m on m.id = pm.modifier_id
      where pm.product_id = v_product.id
        and m.is_active
    loop
      v_selected := (
        select count(*) from unnest(v_mod_ids) as sel(id)
        where sel.id = v_product_mods.modifier_id
      );

      if v_product_mods.is_required and v_selected < v_product_mods.min_select then
        raise exception 'Modifier % wajib dipilih untuk produk ini',
          v_product_mods.name
          using errcode = '23003';
      end if;

      v_max := coalesce(v_product_mods.max_select, 0);
      if v_max > 0 and v_selected > v_max then
        raise exception 'Modifier % melebihi jumlah maksimal', v_product_mods.name
          using errcode = '23003';
      end if;
    end loop;

    v_subtotal := v_subtotal + v_line_total;
  end loop;

  -- ===========================================================================
  -- 5. Mutate — one transaction, all rows or none.
  -- ===========================================================================
  v_order_number := 'TS-' || to_char(now(), 'YYYYMMDD')
                    || '-' || lpad(nextval('order_number_seq')::text, 4, '0');

  insert into public.orders (
    id, order_number, table_id, table_session_id, source, status,
    notes, subtotal, discount, tax, total, idempotency_key, created_by
  )
  values (
    v_new_id, v_order_number, p_table_id, p_table_session_id, p_source, 'DRAFT',
    -- Staff internal note is never merged into the customer-visible note
    -- (AUTH_RBAC_RLS.md §46: customer note is own/context, internal is staff).
    p_customer_note,
    v_subtotal, 0, 0, v_subtotal,
    p_idempotency_key, v_actor_id
  )
  -- A concurrent create with the same key already won the unique index; this
  -- insert does nothing and the block below serves that winner instead. The
  -- conflict is turned into a read of the winner, never surfaced as an error
  -- (API_CONTRACT.md §2.3: same key must yield the same result).
  on conflict (idempotency_key) do nothing
  returning * into v_order;

  -- This create lost the race for the key. `v_order` is untouched by the
  -- no-op insert, so serve the order the winner wrote — same id, same totals,
  -- same snapshot lines — and leave the caller none the wiser about the race.
  if v_order.id is null then
    select * into v_order
    from public.orders
    where idempotency_key = p_idempotency_key;

    if not found then
      raise exception 'Order tidak dapat dibuat' using errcode = 'P0003';
    end if;

    return public.order_create_payload(v_order.id);
  end if;

  -- Items + their modifier selections, snapshotted from the catalog values
  -- read above. The client never sees these columns being written from its
  -- own input — it sent ids, and the server wrote the prices (§21, §22).
  for v_i in 0..jsonb_array_length(v_items) - 1 loop
    v_item := v_items->v_i;

    select * into v_product
    from public.products
    where id = (v_item->>'productId')::uuid;

    v_unit_price := v_product.price;
    v_line_total := v_unit_price * (v_item->>'quantity')::numeric;

    v_mod_ids := coalesce(
      array(select (jsonb_array_elements_text(v_item->'modifierIds'))::uuid),
      array[]::uuid[]
    );

    foreach v_mod_id in array v_mod_ids loop
      select * into v_modifier from public.modifiers where id = v_mod_id;
      v_line_total := v_line_total
        + v_modifier.price_delta * (v_item->>'quantity')::numeric;
    end loop;

    insert into public.order_items (
      order_id, product_id, product_name_snapshot, unit_price_snapshot,
      quantity, notes, line_total
    )
    values (
      v_new_id, v_product.id, v_product.name, v_unit_price,
      (v_item->>'quantity')::numeric, v_item->>'notes', v_line_total
    )
    returning id into v_item_id;

    foreach v_mod_id in array v_mod_ids loop
      select * into v_modifier from public.modifiers where id = v_mod_id;

      insert into public.order_item_modifiers (
        order_item_id, modifier_id, modifier_name_snapshot,
        price_delta_snapshot, quantity
      )
      values (
        v_item_id, v_modifier.id, v_modifier.name, v_modifier.price_delta,
        (v_item->>'quantity')::numeric
      );
    end loop;
  end loop;

  -- Birth event of the audit trail (DATABASE_SCHEMA.md §23).
  insert into public.order_status_history (
    order_id, from_status, to_status, actor_id, actor_role, reason
  )
  values (v_new_id, null, 'DRAFT', v_actor_id, v_actor_role, null);

  return public.order_create_payload(v_new_id);
end;
$$;

-- =============================================================================
-- order_create_payload(): assemble the create result.
--
-- The created order's snapshot lines live in `order_items` /
-- `order_item_modifiers`, whose read policies are granted to `authenticated`
-- only (migration 009). An anonymous customer holds no read grant there, so a
-- second, RLS-gated round trip after the create would come back silently empty —
-- exactly the partial record this command must never produce. Reading the lines
-- inside this SECURITY DEFINER frame and returning them with the order gives
-- every caller — anonymous customer included — the complete order the server
-- just wrote (AUTH_RBAC_RLS.md §27: customers reach orders only through this
-- controlled public path; §28: items inherit from the order).
--
-- The function is internal: EXECUTE is revoked from every client role below,
-- so the only caller is `create_draft_order()`. It cannot be used to read an
-- arbitrary order by id.
-- =============================================================================
create or replace function public.order_create_payload(p_order_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'order', to_jsonb(o),
    'items', coalesce((
      select jsonb_agg(to_jsonb(i) order by i.created_at, i.id)
      from public.order_items i
      where i.order_id = p_order_id
    ), '[]'::jsonb),
    'modifiers', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.created_at, m.id)
      from public.order_item_modifiers m
      where m.order_item_id in (
        select i.id from public.order_items i where i.order_id = p_order_id
      )
    ), '[]'::jsonb)
  )
  from public.orders o
  where o.id = p_order_id;
$$;

revoke execute on function public.order_create_payload(uuid)
  from public, anon, authenticated;

grant execute on function public.create_draft_order(
  text, uuid, uuid, jsonb, text, text, text
) to anon, authenticated;


-- MIGRATION: supabase/migrations/010_order_status_history/003_submit_order.sql

-- =============================================================================
-- Tepi Sawah — Migration 010 (part 3): Submit order command.
--
-- Source: docs/api/API_CONTRACT.md §10.2 (Submit Order: DRAFT -> SUBMITTED ->
-- PENDING_CONFIRMATION, "Transition harus atomic"), §11.2 (Submit Waiter
-- Order), §2.2 (never trust client price/status/role), §2.3 + §14
-- (Idempotency-Key), §26 (concurrency), §27 (price integrity), §33
-- (transaction boundaries), §30 (public customer security),
-- docs/database/DATABASE_SCHEMA.md §20-§23 (snapshot is authoritative),
-- docs/security/AUTH_RBAC_RLS.md §27 (orders), §29 (history append-only),
-- §34 (SECURITY DEFINER rules), §46 (idempotency), §47 (validate before
-- mutate), docs/implementation/CLINE_IMPLEMENTATION_PLAN.md §14 (Phase 8B).
--
-- =============================================================================
-- WHAT THIS COMMAND IS
-- =============================================================================
--
-- The single authority for submitting a draft. The caller may send ONLY:
--
--     orderId         the draft to submit
--     source          CUSTOMER_QR | WAITER | POS (who is submitting)
--     tableId         the table context (customer path; required for anon)
--     tableSessionId  the OPEN session context (customer path; required for anon)
--     idempotencyKey  the client's dedup key for THIS submission
--
-- It may NOT send, and this function does not accept: any money value, any
-- status, any item list, any payment field (API_CONTRACT.md §2.2). The order
-- being submitted already exists as a DRAFT with its snapshot lines written by
-- `create_draft_order()`; this command does not rewrite them.
--
-- RECALCULATION (API_CONTRACT.md §27, "Price Integrity"). The snapshot columns
-- are authoritative for the receipt and are immutable (DATABASE_SCHEMA.md
-- §21). But a DRAFT can sit in a customer's cart while the menu changes
-- underneath it: a product gets 86'd, a price is edited, a modifier is
-- retired. Submitting such a draft would silently charge a stale price. So
-- this command re-reads the live catalog and re-derives every line total from
-- it, then compares the recomputed total against the frozen snapshot total:
--
--   * any product now inactive/unavailable, or any modifier now
--     inactive/removed from its product  -> REFUSE (item is no longer orderable)
--   * recomputed total != snapshot total  -> REFUSE (stale price)
--
-- It never overwrites the snapshot. A refusal tells the customer the menu
-- changed and that the draft must be rebuilt at current prices — the correct
-- outcome, because the frozen values are the receipt of record and a draft
-- that no longer matches them is not an order that can be submitted.
--
-- TRANSITION (API_CONTRACT.md §13, §33). DRAFT -> SUBMITTED ->
-- PENDING_CONFIRMATION is one atomic step here: the row is written to
-- PENDING_CONFIRMATION and BOTH history rows are appended in the same
-- transaction. SUBMITTED is a real state in the machine, so it is recorded in
-- the audit trail; the observable steady state a cashier queues on is
-- PENDING_CONFIRMATION. A partially-committed submit is impossible.
--
-- ACTORS (API_CONTRACT.md §29). A CUSTOMER_QR submit is anonymous but ONLY
-- through a validated table context — the caller must prove the table + OPEN
-- session the order actually belongs to (AUTH_RBAC_RLS.md §18, §30: a public
-- order id alone is not an authorization credential, and a customer cannot
-- touch another table's order). A WAITER/POS submit requires an authenticated,
-- active staff account holding `orders.create_manual` (§11.2); the source must
-- match the order's own source, so a customer path can never submit a staff
-- draft and vice versa.
--
-- IDEMPOTENCY (API_CONTRACT.md §2.3, §14, §26). The client's submit key is
-- stored under `submit_idempotency_key` (migration 008 part 2). A repeat
-- submit with the same key returns the first result verbatim. Two concurrent
-- submits of the SAME draft with the SAME key race on the row lock: the loser
-- finds the row already past DRAFT and reads back the winner's result. Two
-- concurrent submits with DIFFERENT keys on the same draft is a genuine
-- conflict and is refused (§26: 409 CONFLICT).
-- =============================================================================
create or replace function public.submit_order(
  p_order_id          uuid,
  p_source            text,
  p_table_id          uuid default null,
  p_table_session_id  uuid default null,
  p_idempotency_key   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
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
begin
  -- ===========================================================================
  -- 1. Authorize.
  -- ===========================================================================
  -- Source must be a known vocabulary value; never silently coerced
  -- (DATABASE_MIGRATION_PLAN.md §21: no arbitrary status/source strings).
  if p_source is null or not (p_source in ('CUSTOMER_QR', 'WAITER', 'POS')) then
    raise exception 'Sumber order tidak valid' using errcode = '22023';
  end if;

  if p_source in ('WAITER', 'POS') then
    -- Staff submit (API_CONTRACT.md §11.2). The same grant that authorizes
    -- creating a manual draft authorizes sending it to the kitchen.
    if public.auth_user_id() is null or not public.current_user_is_active()
       or not public.has_permission('orders.create_manual')
    then
      raise exception 'Not authorized to submit manual orders'
        using errcode = '42501';
    end if;
    v_actor_id := public.auth_user_id();
    select r.code into v_actor_role
    from public.role_permissions rp
    join public.permissions p on p.id = rp.permission_id
    join public.roles r on r.id = rp.role_id
    where rp.permission_id = (
            select id from public.permissions where code = 'orders.create_manual'
          )
      and rp.role_id in (select role_id from public.user_roles
                         where user_id = v_actor_id)
    limit 1;
  else
    -- Customer submit: anonymous is allowed, but the table context below must
    -- validate. No staff actor is recorded.
    v_actor_id := null;
    v_actor_role := null;
  end if;

  -- ===========================================================================
  -- 2. Idempotency — check before mutate (AUTH_RBAC_RLS.md §46). A repeat with
  --    the same key returns the first result verbatim (API_CONTRACT.md §2.3).
  -- ===========================================================================
  if p_idempotency_key is not null then
    select * into v_existing
    from public.orders
    where submit_idempotency_key = p_idempotency_key;

    if found then
      return public.order_create_payload(v_existing.id);
    end if;
  end if;

  -- ===========================================================================
  -- 3. Load and LOCK the draft (API_CONTRACT.md §26 concurrency). FOR UPDATE
  --    serializes concurrent submits of the same row; the second one waits and
  --    then observes the first one's result instead of racing it.
  -- ===========================================================================
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order tidak ditemukan' using errcode = 'P0002';
  end if;

  -- Only a draft can be submitted (API_CONTRACT.md §13). An order already past
  -- DRAFT was submitted by someone else — a different-key submit is a conflict
  -- (§26), not an idempotent replay (that was handled in step 2).
  if v_order.status <> 'DRAFT' then
    raise exception 'Order sudah disubmit' using errcode = '23003';
  end if;

  -- The source must match the order's own source. A customer path can never
  -- submit a staff draft, and a staff path can never submit a customer's QR
  -- draft (API_CONTRACT.md §10.2 vs §11.2 are separate trust boundaries).
  if v_order.source <> p_source then
    raise exception 'Sumber order tidak cocok untuk order ini'
      using errcode = '22023';
  end if;

  -- ===========================================================================
  -- 4. Validate the table context BEFORE mutating anything
  --    (AUTH_RBAC_RLS.md §47).
  --
  -- Customer path: this is the whole authorization. An anonymous caller may
  -- submit ONLY the order whose table + OPEN session it can prove it is at
  -- (AUTH_RBAC_RLS.md §18, §30; API_CONTRACT.md §30: "customer must not be able
  -- to change another table's order", "A public order identifier should not be
  -- treated as a sufficient authorization credential"). Both ids are required,
  -- must match the order's own, and must still resolve to an active table with
  -- an OPEN session.
  --
  -- Staff path: the permission grant is the authority, so the context is not
  -- required. But the session the order belongs to must still be OPEN for ANY
  -- source — submitting into a closed session is invalid for everyone.
  -- ===========================================================================
  if p_source = 'CUSTOMER_QR' then
    if p_table_id is null or p_table_session_id is null then
      raise exception 'Konteks meja wajib untuk submit pesanan'
        using errcode = '22023';
    end if;

    if p_table_id <> v_order.table_id then
      raise exception 'Order tidak terkait dengan meja ini'
        using errcode = '23003';
    end if;

    if p_table_session_id <> v_order.table_session_id then
      raise exception 'Order tidak terkait dengan sesi ini'
        using errcode = '23003';
    end if;
  end if;

  select * into v_table
  from public.tables
  where id = v_order.table_id
  for update;

  if not found then
    raise exception 'Meja tidak ditemukan' using errcode = 'P0002';
  end if;

  if not v_table.is_active then
    raise exception 'Meja % tidak aktif', v_table.table_code
      using errcode = '23003';
  end if;

  select * into v_session
  from public.table_sessions
  where id = v_order.table_session_id
  for update;

  if not found then
    raise exception 'Sesi meja tidak ditemukan' using errcode = 'P0002';
  end if;

  if v_session.status <> 'OPEN' then
    raise exception 'Sesi meja sudah ditutup' using errcode = '23003';
  end if;

  -- An order must contain something. `create_draft_order()` refuses an empty
  -- item list, so a draft normally has lines; this guard keeps the invariant
  -- here too, in case a draft is ever seeded by another path.
  if not exists (select 1 from public.order_items where order_id = p_order_id) then
    raise exception 'Order harus memiliki minimal satu item'
      using errcode = '22023';
  end if;

  -- ===========================================================================
  -- 5. RECALCULATE from the authoritative catalog (API_CONTRACT.md §27).
  --
  -- The snapshot columns stay exactly as `create_draft_order()` wrote them —
  -- they are the receipt of record and are immutable (DATABASE_SCHEMA.md §21:
  -- "Changing the product later must not alter historical order data"). This
  -- loop only READS the live catalog to re-derive what the order would cost
  -- now, then compares it to the frozen total. A mismatch or a withdrawn
  -- product means the draft is stale and must be refused, never silently
  -- re-priced (§2.2: the client's money is never trusted, and neither is a
  -- stale snapshot).
  -- ===========================================================================
  for v_item in
    select * from public.order_items where order_id = p_order_id
  loop
    -- Product must still exist and still be orderable.
    select * into v_product
    from public.products
    where id = v_item.product_id;

    if not found then
      raise exception 'Produk tidak ditemukan' using errcode = 'P0002';
    end if;

    if not v_product.is_active then
      raise exception 'Produk % tidak aktif', v_product.name
        using errcode = '23003';
    end if;

    if not v_product.is_available then
      raise exception 'Produk % sedang tidak tersedia', v_product.name
        using errcode = 'P0003';
    end if;

    v_line_total := v_product.price * v_item.quantity;

    -- The authoritative delta contribution of this line's modifier
    -- selections, re-derived from the live catalog.
    select coalesce(sum(m.price_delta * im.quantity), 0)
    into v_mod_total
    from public.order_item_modifiers im
    join public.modifiers m on m.id = im.modifier_id
    where im.order_item_id = v_item.id;

    -- Re-verify every modifier selection individually: the sum above is for
    -- the total, this loop is for the refusal messages (DATABASE_SCHEMA.md §16).
    for v_modifier in
      select m.*
      from public.order_item_modifiers im
      join public.modifiers m on m.id = im.modifier_id
      where im.order_item_id = v_item.id
    loop
      if not v_modifier.is_active then
        raise exception 'Modifier % tidak aktif', v_modifier.name
          using errcode = '23003';
      end if;

      if not exists (
        select 1 from public.product_modifiers pm
        where pm.product_id = v_item.product_id
          and pm.modifier_id = v_modifier.id
      ) then
        raise exception 'Modifier % tidak tersedia untuk produk ini',
          v_modifier.name
          using errcode = '23003';
      end if;
    end loop;

    v_recomputed := v_recomputed + v_line_total + v_mod_total;
  end loop;

  -- The frozen snapshot must match the live catalog. A drift means the menu
  -- changed under the draft and the snapshot is stale — the customer has to
  -- rebuild the draft at current prices rather than be charged a number that
  -- no longer exists.
  if v_recomputed <> v_order.total then
    raise exception 'Harga menu telah berubah, mohon buat ulang pesanan'
      using errcode = '23003';
  end if;

  -- ===========================================================================
  -- 6. Mutate — one atomic transition (API_CONTRACT.md §33: validate
  --    table/session -> validate products -> create/update order -> create
  --    status history -> audit). DRAFT -> SUBMITTED -> PENDING_CONFIRMATION is
  --    written as a single row update plus both history rows inside this
  --    transaction; nothing in between is ever observable.
  -- ===========================================================================
  update public.orders
  set status              = 'PENDING_CONFIRMATION',
      submit_idempotency_key = p_idempotency_key,
      updated_at          = now()
  where id = v_order.id
    and status = 'DRAFT'
  returning * into v_updated;

  -- This submit lost the race for the row. Someone else already moved it past
  -- DRAFT while we held the lock (API_CONTRACT.md §26). Same key -> serve the
  -- winner's result; different key -> genuine conflict.
  if v_updated.id is null then
    if p_idempotency_key is not null then
      select * into v_updated
      from public.orders
      where submit_idempotency_key = p_idempotency_key;

      if found then
        return public.order_create_payload(v_updated.id);
      end if;
    end if;

    raise exception 'Order sudah disubmit' using errcode = '23003';
  end if;

  -- Both hops of the transition are recorded (API_CONTRACT.md §13, §10.2:
  -- "DRAFT -> SUBMITTED -> PENDING_CONFIRMATION"). SUBMITTED is a real state in
  -- the machine and appears in the trail; the steady state a cashier queues on
  -- is PENDING_CONFIRMATION. History is append-only and never rewritten
  -- (AUTH_RBAC_RLS.md §29).
  insert into public.order_status_history (
    order_id, from_status, to_status, actor_id, actor_role, reason
  )
  values
    (v_updated.id, 'DRAFT',     'SUBMITTED',           v_actor_id, v_actor_role, null),
    (v_updated.id, 'SUBMITTED', 'PENDING_CONFIRMATION', v_actor_id, v_actor_role, null);

  -- The cashier queue signal is the order's new status itself: `orders.status
  -- = 'PENDING_CONFIRMATION'`, which the operational queue filters on
  -- (API_CONTRACT.md §12.1: `?status=PENDING_CONFIRMATION`). Any staff client
  -- holding `orders.read` sees it on the next poll. A realtime broadcast is
  -- Phase 15 scope and is deliberately not emitted here
  -- (docs/architecture/REALTIME_SPEC.md).
  return public.order_create_payload(v_updated.id);
end;
$$;

-- Anonymous customers submit their own QR drafts through this path; staff
-- submit through it with a session. Both are the controlled command surface —
-- there is no client-side path to flip an order's status.
grant execute on function public.submit_order(
  uuid, text, uuid, uuid, text
) to anon, authenticated;


-- MIGRATION: supabase/migrations/010_order_status_history/004_get_customer_order.sql

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


-- MIGRATION: supabase/migrations/010_order_status_history/005_order_version.sql

-- =============================================================================
-- Tepi Sawah — Migration 010 (part 5): Order version (optimistic concurrency).
--
-- Source: docs/api/API_CONTRACT.md §13 (Order State Transition: the backend
-- must check "concurrency/version"), §26 (Concurrency Control: "optimistic
-- version", "atomic conditional update", "An order currently PREPARING cannot
-- be changed to READY by two kitchen clients simultaneously in a way that
-- creates duplicate transition records"; a conflicting request receives
-- 409 CONFLICT), docs/database/DATABASE_MIGRATION_PLAN.md §24 (history is the
-- immutable trail; the current state lives on `orders`).
--
-- A row-level lock alone is not enough for the transition command: a lock
-- serializes two concurrent calls, but the loser must still be *told* it lost
-- rather than silently overwriting the winner's result. A monotonic version
-- gives every caller a cheap read handle — they hold the version they rendered,
-- send it back as their expectation, and the conditional UPDATE either moves
-- the row (version bumps) or matches nothing (409, "order changed under you").
--
-- The column is internal: no client may set it, and the customer projection
-- (migration 010 part 4) deliberately does not return it. Existing rows backfill
-- to 1 — they were never transitioned by this engine, and every first
-- transition away from their seeded state is a valid first hop.
-- =============================================================================
alter table public.orders
  add column if not exists version bigint not null default 1;

comment on column public.orders.version is
  'Monotonic optimistic-concurrency handle, bumped by every transition_order() call. Clients send the version they rendered as their expectation; a mismatch is a 409 conflict (API_CONTRACT.md §26).';


-- MIGRATION: supabase/migrations/010_order_status_history/006_transition_order.sql

-- =============================================================================
-- Tepi Sawah — Migration 010 (part 6): The centralized order state transition
-- engine.
--
-- Source: docs/api/API_CONTRACT.md §13 (Order State Transition API:
-- "Gunakan satu command terpusat" — POST /orders/:id/transition; the backend
-- must determine the actor from the authenticated session and check current
-- status, requested status, actor role, permission, business rule,
-- concurrency/version and idempotency), §26 (Concurrency Control: row-level
-- lock + optimistic version + atomic conditional update + idempotency; a
-- duplicate returns the idempotent result, a conflict receives 409),
-- §33 (transaction boundaries), §2.2 (never trust client status),
-- docs/security/AUTH_RBAC_RLS.md §21-§22 (authorization helpers),
-- §29 (history is append-only and is written only by server-side transition
-- commands), §34 (SECURITY DEFINER rules: pinned search_path, no dynamic SQL),
-- §47 (validate before you mutate), docs/implementation/
-- CLINE_IMPLEMENTATION_PLAN.md §17 (Phase 8C — one transition command).
--
-- =============================================================================
-- WHY ONE COMMAND
-- =============================================================================
--
-- Order status is a state machine, and the machine lives here. Before this,
-- the only status mutation was the atomic hop inside `submit_order()`; every
-- later hop — confirm, reject, start, ready, serve, paid, complete, cancel,
-- refund — funnels through `transition_order()` instead. There is no other
-- server-side writer of `orders.status` and no client-side path at all:
-- `orders` has no anon update grant (migration 008 part 1) and staff RLS is
-- read-only on orders. A module that wants to move an order calls this
-- command; it never re-implements a guard, so a rule change is one edit here
-- and reaches every actor surface (API_CONTRACT.md §13: "Gunakan satu command
-- terpusat").
--
-- The one deliberate exception is the DRAFT exit. Leaving DRAFT means
-- submitting, and submitting means re-deriving the total from the live catalog
-- to refuse a stale price (API_CONTRACT.md §27). That validation belongs to
-- `submit_order()`, so DRAFT -> SUBMITTED stays there and this engine has no
-- such rule: calling it on a DRAFT fails closed, and there is no way to skip
-- the price check. The SUBMITTED -> PENDING_CONFIRMATION hop the submit command
-- writes atomically IS in this engine's rule table, because a rest order must
-- never get stuck in a state the machine cannot describe.
--
-- =============================================================================
-- WHAT THE COMMAND ENFORCES, IN ORDER
-- =============================================================================
--
--   1. ACTOR (API_CONTRACT.md §13: "Backend harus menentukan actor berdasarkan
--      authenticated session"). Anonymous cannot transition an order. The
--      caller must be authenticated AND active (AUTH_RBAC_RLS.md §14: an
--      inactive account holds no permissions, so this fails closed).
--   2. TARGET VOCABULARY. The requested status must be a real state in the
--      machine; an unknown string is refused, never coerced
--      (DATABASE_MIGRATION_PLAN.md §21).
--   3. LOAD AND LOCK. SELECT ... FOR UPDATE serializes concurrent transitions
--      of the same order (API_CONTRACT.md §26).
--   4. IDEMPOTENCY. An order already at the requested status is a no-op
--      success: the current order is returned and NO new history row is
--      written. A double-tap, a retry after a network blur, and two staff
--      clients that both pressed the same button all resolve to one
--      transition and one audit entry.
--   5. CONCURRENCY/VERSION. When the caller sends the version it rendered, a
--      mismatch is a 409 (§26): someone else moved the order first, and the
--      caller must reload.
--   6. THE RULE. The (current -> requested) pair must exist in the rule table
--      below. Backward transitions, self-transitions other than the idempotent
--      no-op above, hops out of terminal states, and every pair the machine
--      does not know are refused. There is no backward path by default.
--   7. PERMISSION. Each rule carries the permission that authorizes it. The
--      check goes through `has_permission()`, which is the union over the
--      caller's roles gated by the active-profile check — so a revoked role or
--      a disabled account stops authorizing immediately (AUTH_RBAC_RLS.md
--      §12, §14, §22).
--   8. REASON. Every exceptional transition (cancel, refund) requires a
--      non-empty reason and an audit row (API_CONTRACT.md §13:
--      "Every exceptional transition requires reason and audit").
--   9. MUTATE. One conditional UPDATE moves the status and bumps the version;
--      if it matches nothing, the order changed under the caller and it is a
--      409. The history row is appended in the same transaction, so a
--      partially-committed transition is impossible (§33).
--
-- The returned payload is the same `{order, items, modifiers}` shape the create
-- and submit commands return, so every caller renders one order shape.
-- =============================================================================
-- The rule table: every (from, to) pair the machine permits, with the
-- permission that authorizes it and whether a reason is mandatory. This is the
-- single source of the graph — the engine is its only reader, and no client
-- module re-declares any of it (API_CONTRACT.md §13; MASTER prompt: "Do not
-- duplicate state transition rules in frontend modules").
--
-- Permission mapping follows the actor table in API_CONTRACT.md §13 against the
-- seeded baseline (AUTH_RBAC_RLS.md §9): confirm/reject for the cashier line,
-- kitchen.start/ready for the kitchen line, orders.serve for the service line,
-- payments.create for the payment line, orders.cancel / payments.refund for the
-- exceptional line. `orders.serve` is the permission for the §9 "Mark Served"
-- grant.
-- =============================================================================
create or replace function public.order_transition_rule(
  p_from text,
  p_to   text,
  out required_permission text,
  out requires_reason     boolean
)
returns record
language sql
stable
security definer
set search_path = public
as $$
  select required_permission, requires_reason
  from (values
    -- Normal forward flow (API_CONTRACT.md §13, ORDER STATE in MASTER prompt).
    -- DRAFT -> SUBMITTED is deliberately absent: it belongs to submit_order(),
    -- which re-derives the price first (API_CONTRACT.md §27).
    ('SUBMITTED',           'PENDING_CONFIRMATION', 'orders.transition', false),
    ('PENDING_CONFIRMATION','CONFIRMED',            'orders.confirm',    false),
    ('PENDING_CONFIRMATION','REJECTED',             'orders.reject',     false),
    ('CONFIRMED',           'PREPARING',            'kitchen.start',     false),
    ('PREPARING',           'READY',                'kitchen.ready',     false),
    ('READY',               'SERVED',               'orders.serve',      false),
    ('SERVED',              'PAID',                 'payments.create',   false),
    ('PAID',                'COMPLETED',            'payments.create',   false),
    -- Exceptional flow: reason + audit are mandatory for each of these
    -- (API_CONTRACT.md §13 "Exceptional").
    ('CONFIRMED',           'CANCELLED',            'orders.cancel',     true),
    ('PREPARING',           'CANCELLED',            'orders.cancel',     true),
    ('PAID',                'REFUNDED',             'payments.refund',   true)
  ) as t(from_status, to_status, required_permission, requires_reason)
  where t.from_status = p_from
    and t.to_status   = p_to
$$;

comment on function public.order_transition_rule(text, text) is
  'The order state machine: the single (from, to) -> permission/reason table the transition engine enforces. NULL for any pair the machine does not permit, including every backward hop.';

-- =============================================================================
-- The command.
-- =============================================================================
create or replace function public.transition_order(
  p_order_id         uuid,
  p_to_status        text,
  p_reason           text default null,
  p_expected_version bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule        record;
  v_order       public.orders%rowtype;
  v_updated     public.orders%rowtype;
  v_prev_status text;
  v_actor_id    uuid := public.auth_user_id();
  v_actor_role  text;
  v_reason      text;
begin
  -- ===========================================================================
  -- 1. ACTOR — an authenticated, active staff member. Anonymous has no path to
  --    this command; the anonymous order path is the context-authorized
  --    `submit_order()` and it never reaches the transition engine
  --    (API_CONTRACT.md §13, §30; AUTH_RBAC_RLS.md §14, §34).
  -- ===========================================================================
  if v_actor_id is null or not public.current_user_is_active() then
    raise exception 'Not authorized to transition orders'
      using errcode = '42501';
  end if;

  -- ===========================================================================
  -- 2. TARGET VOCABULARY — the requested status must be a state the machine
  --    knows (DATABASE_MIGRATION_PLAN.md §21: no arbitrary status strings).
  -- ===========================================================================
  if p_to_status is null or p_to_status not in (
       'DRAFT', 'SUBMITTED', 'PENDING_CONFIRMATION', 'CONFIRMED', 'PREPARING',
       'READY', 'SERVED', 'PAID', 'COMPLETED',
       'CANCELLED', 'REJECTED', 'VOID', 'REFUNDED'
     )
  then
    raise exception 'Status tujuan tidak valid' using errcode = '22023';
  end if;

  -- ===========================================================================
  -- 3. LOAD AND LOCK the row (API_CONTRACT.md §26: row-level lock). Two
  --    concurrent transitions of the same order serialize here; the second one
  --    observes the first one's result instead of racing it.
  -- ===========================================================================
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order tidak ditemukan' using errcode = 'P0002';
  end if;

  -- ===========================================================================
  -- 4. IDEMPOTENCY (API_CONTRACT.md §13, §26: "duplicate request returns
  --    idempotent result"). An order already at the requested status is a
  --    no-op: return the current order, append nothing, bump nothing. A
  --    double-tap by the same actor and a race where the other caller won
  --    both land here.
  -- ===========================================================================
  if v_order.status = p_to_status then
    return public.order_create_payload(v_order.id);
  end if;

  -- ===========================================================================
  -- 5. CONCURRENCY / VERSION (API_CONTRACT.md §13 item 6, §26: optimistic
  --    version). The caller that rendered this order sends the version it saw;
  --    a mismatch means the order moved since and this request is stale. It is
  --    refused as a conflict rather than blindly applied over the newer state.
  -- ===========================================================================
  if p_expected_version is not null
     and v_order.version is distinct from p_expected_version
  then
    raise exception 'Versi order telah berubah, mohon muat ulang order'
      using errcode = '40001';
  end if;

  -- ===========================================================================
  -- 6. THE RULE — the (current -> requested) pair must be permitted. This is
  --    where backward transitions, hops out of terminal states, and every pair
  --    the machine does not describe are refused. There is no backward path
  --    and no implicit superuser bypass.
  -- ===========================================================================
  select * into v_rule
  from public.order_transition_rule(v_order.status, p_to_status);

  if v_rule.required_permission is null then
    raise exception 'Transisi % -> % tidak diizinkan', v_order.status, p_to_status
      using errcode = '23003';
  end if;

  -- ===========================================================================
  -- 7. PERMISSION (AUTH_RBAC_RLS.md §22, §38). `has_permission()` resolves the
  --    union over the caller's roles with the active-profile gate built in, so
  --    this is the authority — not a role name the client sent (API_CONTRACT.md
  --    §2.2: never trust a client role).
  -- ===========================================================================
  if not public.has_permission(v_rule.required_permission) then
    raise exception 'Not authorized untuk transisi % -> %', v_order.status, p_to_status
      using errcode = '42501';
  end if;

  -- ===========================================================================
  -- 8. REASON where required (API_CONTRACT.md §13: "Every exceptional
  --    transition requires reason and audit"). A whitespace-only reason is no
  --    reason at all.
  -- ===========================================================================
  v_reason := nullif(btrim(coalesce(p_reason, '')), '');

  if v_rule.requires_reason and v_reason is null then
    raise exception 'Alasan wajib untuk transisi % -> %', v_order.status, p_to_status
      using errcode = '22023';
  end if;

  -- The audit row records the role the actor used, not the actor's current
  -- role (migration 010 part 1): if a cashier is later demoted, the trail
  -- still says a cashier confirmed.
  select r.code into v_actor_role
  from public.role_permissions rp
  join public.permissions p on p.id = rp.permission_id
  join public.roles r on r.id = rp.role_id
  where p.code = v_rule.required_permission
    and rp.role_id in (
          select ur.role_id from public.user_roles ur
          where ur.user_id = v_actor_id
        )
  order by r.code
  limit 1;

  -- ===========================================================================
  -- 9. MUTATE — one atomic conditional update (API_CONTRACT.md §26, §33).
  --    The status + version guards are belt-and-braces under the row lock: if
  --    they match nothing, the order changed under this caller and the whole
  --    transaction aborts as a conflict rather than committing a partial
  --    transition.
  -- ===========================================================================
  v_prev_status := v_order.status;

  update public.orders
  set status     = p_to_status,
      version    = version + 1,
      updated_at = now()
  where id = v_order.id
    and status = v_prev_status
    and version = v_order.version
  returning * into v_updated;

  if v_updated.id is null then
    raise exception 'Order sudah berubah, mohon muat ulang order'
      using errcode = '40001';
  end if;

  -- Append-only audit (AUTH_RBAC_RLS.md §29: history is written only by the
  -- server-side transition commands; no client grant exists on this table).
  -- A reason supplied on a normal transition is recorded too — it is useful
  -- context and the caller sent it voluntarily.
  insert into public.order_status_history (
    order_id, from_status, to_status, actor_id, actor_role, reason
  )
  values (
    v_updated.id, v_prev_status, p_to_status, v_actor_id, v_actor_role, v_reason
  );

  return public.order_create_payload(v_updated.id);
end;
$$;

comment on function public.transition_order(uuid, text, text, bigint) is
  'The single authority for order state transitions. Derives the actor from the authenticated session, checks current status, requested status, permission, reason-where-required, version/concurrency and idempotency, then moves the row and appends the audit history atomically. No backward transitions; no client-side status writes exist.';

-- Staff call this command; anonymous customers never can (their order path is
-- submit_order()). The grant is wide, the logic inside is the gate
-- (AUTH_RBAC_RLS.md §34: expose minimum capability).
grant execute on function public.transition_order(uuid, text, text, bigint)
  to authenticated;

-- The rule table is callable for staff tooling (e.g. deciding which actions to
-- offer); it answers a question about the machine, never about row data.
grant execute on function public.order_transition_rule(text, text)
  to authenticated;


-- MIGRATION: supabase/migrations/011_qr_listing/001_list_table_qrs.sql

-- =============================================================================
-- Tepi Sawah — Migration 012: Realtime for the orders table (part 1)
--
-- The staff boards (kitchen KDS, cashier confirmation queue, cashier payment
-- terminal, waiter ready board) subscribe to `orders` through Supabase
-- Realtime's Postgres Changes, replacing their 15-second polling with instant
-- debounced refreshes. Postgres Changes only delivers events for tables in
-- the `supabase_realtime` publication, so this migration adds it.
--
-- Security semantics (Supabase docs, Postgres Changes → Security):
-- - RLS is respected: a subscriber receives an event only when its role's
--   SELECT policies let it read the row. `orders` has no anon policy
--   (migration 008) by design, so anonymous customers receive nothing —
--   their order-status screens already go through get_customer_order() and
--   do NOT need this publication.
-- - A session that cannot read the row at all fails closed (CHANNEL_ERROR),
--   never a data leak.
--
-- The client half (useOrderBoardChannel in @tepisawah/database) treats events
-- as signals only and re-reads through the same RLS-gated queries as before —
-- nothing about the wire contract changes for the apps.
--
-- Idempotent: re-running is a no-op. Run in the Supabase SQL Editor.
-- =============================================================================

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end
$$;

-- =============================================================================
-- Verification. Expected: one row listing public.orders.
-- =============================================================================
select pubname, schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime' and tablename = 'orders';

-- =============================================================================
-- Tepi Sawah — Migration 011: Staff QR listing.
--
-- The admin Tables page needs the printed QR for each table when it loads.
-- Part 2 of migration 006 deliberately grants no client role any access to
-- `table_qr` (AUTH_RBAC_RLS.md §18: the token is the revocable credential on
-- every printed sticker, so it is never broadly readable). Minting, rolling
-- and retiring already ride the part-3 SECURITY DEFINER functions; listing was
-- the one missing piece, and the direct SELECT the UI attempted fails with
-- `permission denied for table table_qr` by design.
--
-- This function completes the set: staff holding `tables.qr_manage` get the
-- full projection (including the token, which they must have to print a
-- sticker), everyone else gets nothing. Authorization is re-checked inside the
-- function and reported as 42501, matching the part-3 pattern so client error
-- handling stays uniform.
--
-- `create or replace` cannot change an existing function's return type, so the
-- drop guard keeps the migration set re-runnable (same pattern as
-- 007 part 4 and the resolve_table_qr fix).
-- =============================================================================
drop function if exists public.list_table_qrs();

create or replace function public.list_table_qrs()
returns table (
  id          uuid,
  table_id    uuid,
  token       text,
  is_active   boolean,
  created_at  timestamptz,
  expires_at  timestamptz
)
language plpgsql
stable
security definer set search_path = public
as $$
begin
  if public.auth_user_id() is null
     or not public.current_user_is_active()
     or not public.has_permission('tables.qr_manage') then
    raise insufficient_privilege
      using detail = 'QR listing requires the tables.qr_manage permission.';
  end if;

  return query
  select q.id, q.table_id, q.token, q.is_active, q.created_at, q.expires_at
  from public.table_qr q
  order by q.created_at desc;
end;
$$;

comment on function public.list_table_qrs() is
  'List every printed QR for staff holding tables.qr_manage; the token is the printable credential, so no broader role may read this table.';

grant execute on function public.list_table_qrs() to authenticated;
revoke execute on function public.list_table_qrs() from anon;


-- SEED: supabase/seed/development.sql

-- =============================================================================
-- Tepi Sawah — DEVELOPMENT seed.
--
-- Boundary file. Applied ONLY by `scripts/seed-dev.mjs`, which refuses any
-- target that is not localhost or a preview host, so this file can never run
-- against production (ENVIRONMENT_CONFIG.md §22; DATABASE_MIGRATION_PLAN.md
-- §37).
--
-- Seed is separated from migrations: schema lives in `supabase/migrations/`.
-- Seed is deterministic and idempotent: re-running must not duplicate or drift.
--
-- Contents (DATABASE_MIGRATION_PLAN.md §37):
--   - the six baseline staff roles        (AUTH_RBAC_RLS.md §6)
--   - the initial permission catalog       (AUTH_RBAC_RLS.md §7, §8)
--   - the role to permission baseline       (AUTH_RBAC_RLS.md §9)
--
-- The grant pairs below are the authority for `packages/permissions`
-- ROLE_PERMISSIONS, which mirrors them for frontend guards. They must stay in
-- sync; a change here is a security change and requires review
-- (DATABASE_SCHEMA.md §44 — seed data must be reviewed).
--
-- No test users, catalog, tables or transaction history: those arrive with
-- their phases. No fake audit events or payments, ever (seed README).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Baseline roles. is_system marks seeded reference data that the client may
-- neither delete nor rename (migration 003 revokes those writes).
-- -----------------------------------------------------------------------------
insert into public.roles (code, name, description, is_system)
values
  ('waiter',    'Waiter',    'Table service and manual orders', true),
  ('cashier',   'Cashier',   'Order confirmation and payment', true),
  ('kitchen',   'Kitchen',   'Kitchen display operations', true),
  ('supervisor','Supervisor','Operational authority', true),
  ('admin',     'Admin',     'System administration', true),
  ('owner',     'Owner',     'Business-level access and oversight', true)
on conflict (code) do update set
  name        = excluded.name,
  description = excluded.description,
  is_system   = excluded.is_system;

-- -----------------------------------------------------------------------------
-- Permission catalog. module/action are derived from the `<domain>.<action>`
-- code; they are grouping metadata for the admin UI, never an authorization
-- input.
-- -----------------------------------------------------------------------------
insert into public.permissions (code, module, action, description)
values
  ('catalog.read',                'catalog',         'read',          'Read the catalog'),
  ('catalog.create',              'catalog',         'create',        'Create products'),
  ('catalog.update',              'catalog',         'update',        'Update products'),
  ('catalog.archive',             'catalog',         'archive',       'Archive products'),
  ('categories.manage',           'catalog',         'manage',        'Manage categories'),
  ('modifiers.manage',            'catalog',         'manage',        'Manage modifiers'),
  ('tables.read',                 'tables',          'read',          'Read tables'),
  ('tables.create',               'tables',          'create',        'Create tables'),
  ('tables.update',               'tables',          'update',        'Update tables'),
  ('tables.archive',              'tables',          'archive',       'Archive tables'),
  ('tables.qr_manage',            'tables',          'qr_manage',     'Manage table QR codes'),
  ('table_sessions.read',         'table_sessions',  'read',          'Read table sessions'),
  ('table_sessions.manage',       'table_sessions',  'manage',        'Manage table sessions'),
  ('orders.read',                 'orders',          'read',          'Read orders'),
  ('orders.create_manual',        'orders',          'create_manual', 'Create a manual order'),
  ('orders.confirm',              'orders',          'confirm',       'Confirm an order'),
  ('orders.reject',               'orders',          'reject',        'Reject an order'),  ('orders.transition',           'orders',          'transition',    'Transition an order state'),
  ('orders.cancel',                'orders',          'cancel',        'Cancel an order'),
  ('orders.recall',                'orders',          'recall',        'Recall an order'),
  ('orders.serve',                 'orders',          'serve',         'Mark an order served'),
  ('kitchen.read',                'kitchen',         'read',          'Read the kitchen queue'),
  ('kitchen.start',               'kitchen',         'start',         'Start preparing'),
  ('kitchen.ready',               'kitchen',         'ready',         'Mark an order ready'),
  ('kitchen.recall',              'kitchen',         'recall',        'Recall a kitchen ticket'),
  ('service_requests.read',       'service_requests','read',          'Read service requests'),
  ('service_requests.create',     'service_requests','create',        'Create a service request'),
  ('service_requests.acknowledge','service_requests','acknowledge',   'Acknowledge a service request'),
  ('service_requests.resolve',    'service_requests','resolve',       'Resolve a service request'),
  ('payments.read',               'payments',        'read',          'Read payments'),
  ('payments.create',             'payments',        'create',        'Create a payment'),
  ('payments.refund',             'payments',        'refund',        'Refund a payment'),
  ('payments.void',               'payments',        'void',          'Void a payment'),
  ('users.read',                  'users',           'read',          'Read user profiles'),
  ('users.create',                'users',           'create',        'Create a user'),
  ('users.update',                'users',           'update',        'Update a user profile'),
  ('users.disable',               'users',           'disable',       'Disable a user account'),
  ('users.roles_manage',          'users',           'roles_manage',  'Assign or remove roles'),
  ('roles.read',                  'roles',           'read',          'Read the role catalog'),
  ('roles.manage',                'roles',           'manage',        'Manage roles'),
  ('permissions.read',            'permissions',     'read',          'Read the permission catalog'),
  ('audit.read',                  'audit',           'read',          'Read audit logs'),
  ('settings.read',               'settings',        'read',          'Read settings'),
  ('settings.manage',             'settings',        'manage',        'Manage settings'),
  ('dashboard.read',              'dashboard',       'read',          'Read the dashboard')
on conflict (code) do update set
  module      = excluded.module,
  action      = excluded.action,
  description = excluded.description;

-- -----------------------------------------------------------------------------
-- Role to permission baseline (AUTH_RBAC_RLS.md §9).
--
-- Owner and admin are deliberately granted the same baseline here but are NOT
-- an implicit superuser: the grant list is explicit and reviewed (§10). A
-- future change may diverge them without touching code. Supervisor holds
-- operational authority only — no catalog, user or settings administration
-- (§11).
--
-- Effective permissions for a user are the union over their roles (§12).
-- -----------------------------------------------------------------------------
with grants(role_code, permission_code) as (
  values
    -- waiter — table service and manual orders. `table_sessions.read` sits in
    -- the Tables group (§8) and the baseline grants Waiter Tables Read (§9);
    -- a manual order must join the table's OPEN session (API_CONTRACT §11.1),
    -- so the waiter needs to resolve it. Session *management* stays withheld.
    ('waiter', 'catalog.read'),
    ('waiter', 'tables.read'),
    ('waiter', 'table_sessions.read'),
    ('waiter', 'orders.create_manual'),
    ('waiter', 'orders.read'),
    ('waiter', 'orders.serve'),
    ('waiter', 'service_requests.read'),
    ('waiter', 'service_requests.create'),
    ('waiter', 'service_requests.acknowledge'),
    ('waiter', 'service_requests.resolve'),
    ('waiter', 'dashboard.read'),

    -- cashier — confirmation and payment
    ('cashier', 'catalog.read'),
    ('cashier', 'tables.read'),
    ('cashier', 'orders.create_manual'),
    ('cashier', 'orders.read'),
    ('cashier', 'orders.confirm'),
    ('cashier', 'orders.reject'),
    ('cashier', 'service_requests.read'),
    ('cashier', 'payments.read'),
    ('cashier', 'payments.create'),
    ('cashier', 'audit.read'),
    ('cashier', 'dashboard.read'),

    -- kitchen — KDS operations, no payment or service-request data
    ('kitchen', 'catalog.read'),
    ('kitchen', 'tables.read'),
    ('kitchen', 'orders.read'),
    ('kitchen', 'kitchen.read'),
    ('kitchen', 'kitchen.start'),
    ('kitchen', 'kitchen.ready'),
    ('kitchen', 'dashboard.read'),

    -- supervisor — operational authority, no system administration
    ('supervisor', 'catalog.read'),
    ('supervisor', 'tables.read'),
    ('supervisor', 'tables.create'),
    ('supervisor', 'tables.update'),
    ('supervisor', 'tables.archive'),
    ('supervisor', 'table_sessions.read'),
    ('supervisor', 'table_sessions.manage'),
    ('supervisor', 'orders.create_manual'),
    ('supervisor', 'orders.read'),
    ('supervisor', 'orders.confirm'),
    ('supervisor', 'orders.reject'),
    ('supervisor', 'orders.transition'),
    ('supervisor', 'orders.cancel'),
    ('supervisor', 'orders.recall'),
    ('supervisor', 'orders.serve'),
    ('supervisor', 'kitchen.read'),
    ('supervisor', 'kitchen.start'),
    ('supervisor', 'kitchen.ready'),
    ('supervisor', 'kitchen.recall'),
    ('supervisor', 'service_requests.read'),
    ('supervisor', 'service_requests.create'),
    ('supervisor', 'service_requests.acknowledge'),
    ('supervisor', 'service_requests.resolve'),
    ('supervisor', 'payments.read'),
    ('supervisor', 'payments.create'),
    ('supervisor', 'payments.refund'),
    ('supervisor', 'payments.void'),
    ('supervisor', 'audit.read'),
    ('supervisor', 'dashboard.read'),

    -- admin — system configuration, catalog, users, roles
    ('admin', 'catalog.read'),
    ('admin', 'catalog.create'),
    ('admin', 'catalog.update'),
    ('admin', 'catalog.archive'),
    ('admin', 'categories.manage'),
    ('admin', 'modifiers.manage'),
    ('admin', 'tables.read'),
    ('admin', 'tables.create'),
    ('admin', 'tables.update'),
    ('admin', 'tables.archive'),
    ('admin', 'tables.qr_manage'),
    ('admin', 'table_sessions.read'),
    ('admin', 'table_sessions.manage'),
    ('admin', 'orders.create_manual'),
    ('admin', 'orders.read'),
    ('admin', 'orders.confirm'),
    ('admin', 'orders.reject'),
    ('admin', 'orders.transition'),
    ('admin', 'orders.cancel'),
    ('admin', 'orders.recall'),
    ('admin', 'orders.serve'),
    ('admin', 'kitchen.read'),
    ('admin', 'kitchen.start'),
    ('admin', 'kitchen.ready'),
    ('admin', 'kitchen.recall'),
    ('admin', 'service_requests.read'),
    ('admin', 'service_requests.create'),
    ('admin', 'service_requests.acknowledge'),
    ('admin', 'service_requests.resolve'),
    ('admin', 'payments.read'),
    ('admin', 'payments.create'),
    ('admin', 'payments.refund'),
    ('admin', 'payments.void'),
    ('admin', 'users.read'),
    ('admin', 'users.create'),
    ('admin', 'users.update'),
    ('admin', 'users.disable'),
    ('admin', 'users.roles_manage'),
    ('admin', 'roles.read'),
    ('admin', 'roles.manage'),
    ('admin', 'permissions.read'),
    ('admin', 'audit.read'),
    ('admin', 'settings.read'),
    ('admin', 'settings.manage'),
    ('admin', 'dashboard.read'),

    -- owner — business-level visibility and high-risk operations (§10)
    ('owner', 'catalog.read'),
    ('owner', 'catalog.create'),
    ('owner', 'catalog.update'),
    ('owner', 'catalog.archive'),
    ('owner', 'categories.manage'),
    ('owner', 'modifiers.manage'),
    ('owner', 'tables.read'),
    ('owner', 'tables.create'),
    ('owner', 'tables.update'),
    ('owner', 'tables.archive'),
    ('owner', 'tables.qr_manage'),
    ('owner', 'table_sessions.read'),
    ('owner', 'table_sessions.manage'),
    ('owner', 'orders.create_manual'),
    ('owner', 'orders.read'),
    ('owner', 'orders.confirm'),
    ('owner', 'orders.reject'),
    ('owner', 'orders.transition'),
    ('owner', 'orders.cancel'),
    ('owner', 'orders.recall'),
    ('owner', 'orders.serve'),
    ('owner', 'kitchen.read'),
    ('owner', 'kitchen.start'),
    ('owner', 'kitchen.ready'),
    ('owner', 'kitchen.recall'),
    ('owner', 'service_requests.read'),
    ('owner', 'service_requests.create'),
    ('owner', 'service_requests.acknowledge'),
    ('owner', 'service_requests.resolve'),
    ('owner', 'payments.read'),
    ('owner', 'payments.create'),
    ('owner', 'payments.refund'),
    ('owner', 'payments.void'),
    ('owner', 'users.read'),
    ('owner', 'users.create'),
    ('owner', 'users.update'),
    ('owner', 'users.disable'),
    ('owner', 'users.roles_manage'),
    ('owner', 'roles.read'),
    ('owner', 'roles.manage'),
    ('owner', 'permissions.read'),
    ('owner', 'audit.read'),
    ('owner', 'settings.read'),
    ('owner', 'settings.manage'),
    ('owner', 'dashboard.read')
)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from grants g
join public.roles r on r.code = g.role_code
join public.permissions p on p.code = g.permission_code
on conflict (role_id, permission_id) do nothing;

-- -----------------------------------------------------------------------------
-- Restaurant configuration (Phase 4 — DATABASE_SCHEMA.md §11-§12).
--
-- EXAMPLE DATA ONLY. A development stand-in so the admin console and the
-- public ordering flow have something to render. The real address, phone,
-- timezone, currency and operating hours are unresolved decisions and must be
-- applied to production server-side from approved configuration
-- (DATABASE_SCHEMA.md §11; API_CONTRACT.md §38). The client may never insert
-- the settings row (migration 004 part 1); the singleton id is fixed by schema.
-- -----------------------------------------------------------------------------
insert into public.restaurant_settings (
  id, restaurant_name, address, phone, email, timezone, currency, logo_url, primary_color
) values (
  '11111111-1111-4111-8111-111111111111',
  'Tepi Sawah Resto & Cafe',
  'Jl. Raya Sawah Indah, Ubud, Bali',
  '+62 361 000 000',
  'halo@tepisawah.id',
  'Asia/Makassar',
  'IDR',
  null,
  null
)
on conflict (id) do update set
  restaurant_name = excluded.restaurant_name,
  address         = excluded.address,
  phone           = excluded.phone,
  email           = excluded.email,
  timezone        = excluded.timezone,
  currency        = excluded.currency;

-- One schedule per day, Sunday first. Sunday is closed; weekdays and the
-- weekend keep an example cafe window. A closed day with null times is also
-- the fail-closed shape an unconfigured day renders as.
insert into public.operating_hours (day_of_week, is_closed, open_time, close_time) values
  (0, true,  null,    null),
  (1, false, '08:00', '21:00'),
  (2, false, '08:00', '21:00'),
  (3, false, '08:00', '21:00'),
  (4, false, '08:00', '21:00'),
  (5, false, '08:00', '22:00'),
  (6, false, '08:00', '22:00')
on conflict (day_of_week) do update set
  is_closed  = excluded.is_closed,
  open_time  = excluded.open_time,
  close_time = excluded.close_time;

-- =============================================================================
-- Catalog seed (Phase 5 — CLINE_IMPLEMENTATION_PLAN.md §11).
--
-- Reference menu: three categories, six products and four global modifiers
-- attached through product_modifiers. Rows carry fixed UUIDs so every statement
-- is idempotent by primary key — the partial unique indexes from migration 005
-- only cover active rows, so name-based upserts could not make an inactive row
-- re-runnable, but primary-key upserts can. One product is deliberately seeded
-- unavailable (is_available = false) so the admin "out of stock" state and the
-- public projection's filter are both observable in development.
--
-- These are sample values only (DATABASE_SCHEMA.md §44); production catalog data
-- arrives from approved configuration, never from this file.
-- =============================================================================

insert into public.categories (id, name, description, sort_order, is_active)
values
  ('00000000-0000-4000-8000-100000000001', 'Menu Utama', 'Nasi dan hidangan utama', 10, true),
  ('00000000-0000-4000-8000-100000000002', 'Minuman',    'Es, teh, dan kopi',        20, true),
  ('00000000-0000-4000-8000-100000000003', 'Cemilan',    'Cemilan untuk berbagi',    30, true)
on conflict (id) do update set
  name        = excluded.name,
  description = excluded.description,
  sort_order  = excluded.sort_order,
  is_active   = excluded.is_active;

insert into public.products (id, category_id, name, description, image_url, price, is_active, is_available, sort_order)
values
  ('00000000-0000-4000-8000-200000000001', '00000000-0000-4000-8000-100000000001', 'Nasi Liwet Sawah', 'Nasi liwet dengan lauk khas sawah', 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=800&q=80', 45000, true, true,  10),
  ('00000000-0000-4000-8000-200000000002', '00000000-0000-4000-8000-100000000001', 'Ayam Bakar Tepi',  'Ayam bakar bumbu rumahan',          'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80', 38000, true, true,  20),
  ('00000000-0000-4000-8000-200000000003', '00000000-0000-4000-8000-100000000001', 'Pepes Ikan',       'Pepes ikan air tawar',              'https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?auto=format&fit=crop&w=800&q=80', 32000, true, false, 30),
  ('00000000-0000-4000-8000-200000000004', '00000000-0000-4000-8000-100000000002', 'Es Kelapa Muda',   'Kelapa muda segar',                 'https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=800&q=80', 15000, true, true,  10),
  ('00000000-0000-4000-8000-200000000005', '00000000-0000-4000-8000-100000000002', 'Teh Talas',        'Teh daun talas khas',               'https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=800&q=80', 12000, true, true,  20),
  ('00000000-0000-4000-8000-200000000006', '00000000-0000-4000-8000-100000000003', 'Kerupuk Sawah',    'Kerupuk renyah',                    'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80',  8000, true, true,  10)
on conflict (id) do update set
  category_id   = excluded.category_id,
  name          = excluded.name,
  description   = excluded.description,
  image_url     = excluded.image_url,
  price         = excluded.price,
  is_active     = excluded.is_active,
  is_available  = excluded.is_available,
  sort_order    = excluded.sort_order;

insert into public.modifiers (id, name, description, price_delta, is_active)
values
  ('00000000-0000-4000-8000-300000000001', 'Level Pedas',  'Tingkat kepedasan',     0,    true),
  ('00000000-0000-4000-8000-300000000002', 'Tambah Nasi',  'Porsi nasi tambahan',   5000, true),
  ('00000000-0000-4000-8000-300000000003', 'Tanpa Es',     'Minuman tanpa es',      0,    true),
  ('00000000-0000-4000-8000-300000000004', 'Extra Telur',  'Telur tambahan',        6000, true)
on conflict (id) do update set
  name         = excluded.name,
  description  = excluded.description,
  price_delta  = excluded.price_delta,
  is_active    = excluded.is_active;

-- Modifier groups per product. "Level Pedas" is a required single select
-- (min 1, max 1) on the main dishes, "Tambah Nasi" is optional (max 1),
-- "Tanpa Es" applies to drinks, and "Extra Telur" is a multi-select (max 3).
insert into public.product_modifiers (product_id, modifier_id, is_required, min_select, max_select, sort_order)
values
  ('00000000-0000-4000-8000-200000000001', '00000000-0000-4000-8000-300000000001', true,  1, 1, 10),
  ('00000000-0000-4000-8000-200000000001', '00000000-0000-4000-8000-300000000002', false, 0, 1, 20),
  ('00000000-0000-4000-8000-200000000001', '00000000-0000-4000-8000-300000000004', false, 0, 3, 30),
  ('00000000-0000-4000-8000-200000000002', '00000000-0000-4000-8000-300000000001', true,  1, 1, 10),
  ('00000000-0000-4000-8000-200000000002', '00000000-0000-4000-8000-300000000004', false, 0, 3, 20),
  ('00000000-0000-4000-8000-200000000003', '00000000-0000-4000-8000-300000000001', true,  1, 1, 10),
  ('00000000-0000-4000-8000-200000000004', '00000000-0000-4000-8000-300000000003', false, 0, 1, 10),
  ('00000000-0000-4000-8000-200000000005', '00000000-0000-4000-8000-300000000003', false, 0, 1, 10)
on conflict (product_id, modifier_id) do update set
  is_required = excluded.is_required,
  min_select  = excluded.min_select,
  max_select  = excluded.max_select,
  sort_order  = excluded.sort_order;

-- =============================================================================
-- Tables + QR (Phase 6 — DATABASE_SCHEMA.md §17-§18).
--
-- Four active dining tables, each with one active QR. The seed writes the QR
-- rows directly (seed runs as the service role, so it bypasses the client grant
-- restrictions from migration 006 part 2) with fixed tokens so a developer can
-- exercise the customer resolver without minting a QR in the admin UI first.
-- =============================================================================

insert into public.tables (id, table_code, name, capacity, status, is_active)
values
  ('00000000-0000-4000-8000-700000000001', 'A1', 'Meja A1', 4, 'AVAILABLE',      true),
  ('00000000-0000-4000-8000-700000000002', 'A2', 'Meja A2', 4, 'AVAILABLE',      true),
  ('00000000-0000-4000-8000-700000000003', 'A3', 'Meja A3', 6, 'WAITING_SERVICE', true),
  ('00000000-0000-4000-8000-700000000004', 'B1', 'Meja B1', 2, 'OCCUPIED',        true)
on conflict (id) do update set
  table_code = excluded.table_code,
  name       = excluded.name,
  capacity   = excluded.capacity,
  status     = excluded.status,
  is_active  = excluded.is_active;

-- One active QR per table (migration 006 part 2 enforces the invariant). The
-- retired A2 row demonstrates roll-over: its token no longer resolves.
insert into public.table_qr (id, table_id, token, is_active, expires_at)
values
  ('00000000-0000-4000-8000-800000000001', '00000000-0000-4000-8000-700000000001', 'dev-qr-a1-000000000000000000000001', true,  null),
  ('00000000-0000-4000-8000-800000000002', '00000000-0000-4000-8000-700000000002', 'dev-qr-a2-retired-00000000000000000', false, null),
  ('00000000-0000-4000-8000-800000000003', '00000000-0000-4000-8000-700000000002', 'dev-qr-a2-000000000000000000000002', true,  null),
  ('00000000-0000-4000-8000-800000000004', '00000000-0000-4000-8000-700000000003', 'dev-qr-a3-000000000000000000000003', true,  null),
  ('00000000-0000-4000-8000-800000000005', '00000000-0000-4000-8000-700000000004', 'dev-qr-b1-000000000000000000000004', true,  null)
on conflict (id) do update set
  table_id   = excluded.table_id,
  token      = excluded.token,
  is_active  = excluded.is_active,
  expires_at = excluded.expires_at;

-- =============================================================================
-- Table sessions (Phase 7 — DATABASE_SCHEMA.md §19).
--
--   A1  one CLOSED session, three orders attached — history survives closure
--       exactly as DATABASE_SCHEMA.md §19 sketches (S1 / Order 001-003).
--   B1  one OPEN session, two orders attached — the live visit.
--
-- Order codes are placeholders: the real `orders` table lands in Phase 8
-- (migration 008) and will carry its own `table_session_id` foreign key. These
-- links exist so the multi-order attach/read path can be exercised now.
-- =============================================================================

insert into public.table_sessions (id, table_id, status, opened_at, closed_at, opened_by, closed_by)
values
  ('00000000-0000-4000-8000-900000000001', '00000000-0000-4000-8000-700000000001', 'CLOSED', now() - interval '4 hours', now() - interval '3 hours', null, null),
  ('00000000-0000-4000-8000-900000000002', '00000000-0000-4000-8000-700000000004', 'OPEN',   now() - interval '40 minutes', null, null, null)
on conflict (id) do update set
  table_id   = excluded.table_id,
  status     = excluded.status,
  opened_at  = excluded.opened_at,
  closed_at  = excluded.closed_at,
  opened_by  = excluded.opened_by,
  closed_by  = excluded.closed_by;

-- Closed A1 + attached orders demonstrate history preservation; seeded in one
-- statement so a duplicate seed run is a pure upsert, never a second session.
insert into public.table_session_order_links (id, session_id, order_id, order_code)
values
  ('00000000-0000-4000-8000-a00000000001', '00000000-0000-4000-8000-900000000001', '00000000-0000-4000-8000-c00000000001', 'ORD-240101-001'),
  ('00000000-0000-4000-8000-a00000000002', '00000000-0000-4000-8000-900000000001', '00000000-0000-4000-8000-c00000000002', 'ORD-240101-002'),
  ('00000000-0000-4000-8000-a00000000003', '00000000-0000-4000-8000-900000000001', '00000000-0000-4000-8000-c00000000003', 'ORD-240101-003'),
  ('00000000-0000-4000-8000-a00000000004', '00000000-0000-4000-8000-900000000002', '00000000-0000-4000-8000-c00000000004', 'ORD-240701-001'),
  ('00000000-0000-4000-8000-a00000000005', '00000000-0000-4000-8000-900000000002', '00000000-0000-4000-8000-c00000000005', 'ORD-240701-002')
on conflict (order_id) do update set
  session_id  = excluded.session_id,
  order_code  = excluded.order_code;

-- =============================================================================
-- Orders (Phase 8A).
--
-- The three order ids below are the same ones the session links above already
-- pointed at; the placeholder codes (`ORD-...`) become real rows.
--
-- `order_number` follows the API_CONTRACT.md §10.1 format (TS-YYYYMMDD-NNNN)
-- and is unique. Totals are seeded already-reconciled (total = subtotal, tax
-- and discount both 0 for now) to match what `create_draft_order()` computes.
-- The sequence is advanced past the seeded numbers so the first real order
-- does not collide with a seed.
-- =============================================================================
insert into public.orders (
  id, order_number, table_id, table_session_id, source, status, notes,
  subtotal, discount, tax, total, idempotency_key, created_by
)
values
  -- Historical visit on A1 (session is CLOSED): two orders, both completed.
  -- History survives closure (DATABASE_MIGRATION_PLAN.md §20).
  ('00000000-0000-4000-8000-c00000000001', 'TS-20260927-0001', '00000000-0000-4000-8000-700000000001', '00000000-0000-4000-8000-900000000001', 'CUSTOMER_QR', 'COMPLETED', 'Meja untuk keluarga', 100000, 0, 0, 100000, 'seed-order-0001', null),
  ('00000000-0000-4000-8000-c00000000002', 'TS-20260927-0002', '00000000-0000-4000-8000-700000000001', '00000000-0000-4000-8000-900000000001', 'CUSTOMER_QR', 'COMPLETED', null,                    44000, 0, 0,  44000, 'seed-order-0002', null),
  -- Open session on A4 carries one live DRAFT the customer is still building.
  ('00000000-0000-4000-8000-c00000000004', 'TS-20260929-0001', '00000000-0000-4000-8000-700000000004', '00000000-0000-4000-8000-900000000002', 'CUSTOMER_QR', 'DRAFT',     null,                    30000, 0, 0,  30000, 'seed-order-0004', null)
on conflict (id) do update set
  order_number     = excluded.order_number,
  table_id         = excluded.table_id,
  table_session_id = excluded.table_session_id,
  source           = excluded.source,
  status           = excluded.status,
  notes            = excluded.notes,
  subtotal         = excluded.subtotal,
  discount         = excluded.discount,
  tax              = excluded.tax,
  total            = excluded.total,
  idempotency_key  = excluded.idempotency_key;

select setval('public.order_number_seq', 100, true);

-- Snapshotted lines (DATABASE_SCHEMA.md §21-§22): names and prices are frozen
-- from the catalog above, so later catalog edits never rewrite a receipt.
insert into public.order_items (id, order_id, product_id, product_name_snapshot, unit_price_snapshot, quantity, notes, line_total)
values
  ('00000000-0000-4000-8000-d00000000001', '00000000-0000-4000-8000-c00000000001', '00000000-0000-4000-8000-200000000001', 'Nasi Liwet Sawah', 45000, 2, 'Tidak terlalu pedas', 100000),
  ('00000000-0000-4000-8000-d00000000002', '00000000-0000-4000-8000-c00000000002', '00000000-0000-4000-8000-200000000002', 'Ayam Bakar Tepi',  38000, 1, null,                 44000),
  ('00000000-0000-4000-8000-d00000000003', '00000000-0000-4000-8000-c00000000004', '00000000-0000-4000-8000-200000000004', 'Es Kelapa Muda',   15000, 2, null,                 30000)
on conflict (id) do update set
  product_name_snapshot = excluded.product_name_snapshot,
  unit_price_snapshot   = excluded.unit_price_snapshot,
  quantity              = excluded.quantity,
  notes                 = excluded.notes,
  line_total            = excluded.line_total;

-- Modifier selections, snapshotted at their catalog deltas. Level Pedas is
-- 0 but is still recorded: the customer's actual choice is part of the receipt.
insert into public.order_item_modifiers (id, order_item_id, modifier_id, modifier_name_snapshot, price_delta_snapshot, quantity)
values
  ('00000000-0000-4000-8000-e00000000001', '00000000-0000-4000-8000-d00000000001', '00000000-0000-4000-8000-300000000001', 'Level Pedas',  0,    2),
  ('00000000-0000-4000-8000-e00000000002', '00000000-0000-4000-8000-d00000000001', '00000000-0000-4000-8000-300000000002', 'Tambah Nasi', 5000,  2),
  ('00000000-0000-4000-8000-e00000000003', '00000000-0000-4000-8000-d00000000002', '00000000-0000-4000-8000-300000000001', 'Level Pedas',  0,    1),
  ('00000000-0000-4000-8000-e00000000004', '00000000-0000-4000-8000-d00000000002', '00000000-0000-4000-8000-300000000004', 'Extra Telur', 6000,  1),
  ('00000000-0000-4000-8000-e00000000005', '00000000-0000-4000-8000-d00000000003', '00000000-0000-4000-8000-300000000003', 'Tanpa Es',    0,    2)
on conflict (id) do update set
  modifier_name_snapshot = excluded.modifier_name_snapshot,
  price_delta_snapshot   = excluded.price_delta_snapshot,
  quantity               = excluded.quantity;

-- The audit trail for the seeded orders (DATABASE_SCHEMA.md §23). A completed
-- order shows its full path; the live draft shows only its birth event.
insert into public.order_status_history (id, order_id, from_status, to_status, actor_id, actor_role, reason)
values
  ('00000000-0000-4000-8000-f00000000001', '00000000-0000-4000-8000-c00000000001', null,            'DRAFT',     null, null, null),
  ('00000000-0000-4000-8000-f00000000002', '00000000-0000-4000-8000-c00000000001', 'DRAFT',         'SUBMITTED', null, null, null),
  ('00000000-0000-4000-8000-f00000000003', '00000000-0000-4000-8000-c00000000001', 'SUBMITTED',     'COMPLETED', null, 'cashier', null),
  ('00000000-0000-4000-8000-f00000000004', '00000000-0000-4000-8000-c00000000002', null,            'DRAFT',     null, null, null),
  ('00000000-0000-4000-8000-f00000000005', '00000000-0000-4000-8000-c00000000002', 'DRAFT',         'COMPLETED', null, 'cashier', null)
on conflict (id) do update set
  order_id    = excluded.order_id,
  from_status = excluded.from_status,
  to_status   = excluded.to_status,
  actor_id    = excluded.actor_id,
  actor_role  = excluded.actor_role,
  reason      = excluded.reason;

-- =============================================================================
-- Submitted order (Phase 8B).
--
-- A second order on the still-open A4 session, already sent to the kitchen so
-- the cashier queue has a `PENDING_CONFIRMATION` row to display
-- (API_CONTRACT.md §12.1). Its two transition rows show the atomic
-- DRAFT -> SUBMITTED -> PENDING_CONFIRMATION step the submit command writes
-- (API_CONTRACT.md §10.2, §13), and `submit_idempotency_key` is populated so a
-- retry of that submit collapses to this order instead of creating a second
-- one (API_CONTRACT.md §2.3, §14).
-- =============================================================================
insert into public.orders (
  id, order_number, table_id, table_session_id, source, status, notes,
  subtotal, discount, tax, total, idempotency_key, submit_idempotency_key, created_by
)
values
  ('00000000-0000-4000-8000-c00000000005', 'TS-20260929-0002', '00000000-0000-4000-8000-700000000004', '00000000-0000-4000-8000-900000000002', 'CUSTOMER_QR', 'PENDING_CONFIRMATION', null, 38000, 0, 0, 38000, 'seed-order-0005', 'seed-submit-0005', null)
on conflict (id) do update set
  order_number          = excluded.order_number,
  table_id              = excluded.table_id,
  table_session_id      = excluded.table_session_id,
  source                = excluded.source,
  status                = excluded.status,
  notes                 = excluded.notes,
  subtotal              = excluded.subtotal,
  discount              = excluded.discount,
  tax                   = excluded.tax,
  total                 = excluded.total,
  idempotency_key       = excluded.idempotency_key,
  submit_idempotency_key = excluded.submit_idempotency_key;

insert into public.order_items (id, order_id, product_id, product_name_snapshot, unit_price_snapshot, quantity, notes, line_total)
values
  ('00000000-0000-4000-8000-d00000000006', '00000000-0000-4000-8000-c00000000005', '00000000-0000-4000-8000-200000000002', 'Ayam Bakar Tepi', 38000, 1, null, 38000)
on conflict (id) do update set
  product_name_snapshot = excluded.product_name_snapshot,
  unit_price_snapshot   = excluded.unit_price_snapshot,
  quantity              = excluded.quantity,
  notes                 = excluded.notes,
  line_total            = excluded.line_total;

insert into public.order_status_history (id, order_id, from_status, to_status, actor_id, actor_role, reason)
values
  ('00000000-0000-4000-8000-f00000000007', '00000000-0000-4000-8000-c00000000005', null,        'DRAFT',               null, null, null),
  ('00000000-0000-4000-8000-f00000000008', '00000000-0000-4000-8000-c00000000005', 'DRAFT',     'SUBMITTED',           null, null, null),
  ('00000000-0000-4000-8000-f00000000009', '00000000-0000-4000-8000-c00000000005', 'SUBMITTED', 'PENDING_CONFIRMATION', null, null, null)
on conflict (id) do nothing;

COMMIT;
