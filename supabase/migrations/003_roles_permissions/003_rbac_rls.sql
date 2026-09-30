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
