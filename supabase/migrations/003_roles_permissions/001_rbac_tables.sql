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
