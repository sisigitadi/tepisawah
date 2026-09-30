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
