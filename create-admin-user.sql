-- =============================================================================
-- Tepi Sawah — Create the first Admin account
--
-- The development seed provisions roles, permissions, settings, the menu and
-- tables, but deliberately creates NO auth.users accounts (staff identities
-- arrive with the test suite). This creates the first loginable admin so the
-- admin panel works with demo mode OFF.
--
-- Plain SQL only (no PL/pgSQL, no DO block): safe in the Supabase SQL editor.
-- Idempotent: safe to re-run.
--
-- >>> CHANGE THESE TWO VALUES (once, in the params block) BEFORE RUNNING <<<
--   email    — the address you will sign in with
--   password — choose your own; this default is only a placeholder
-- =============================================================================
with params as (
  select 'admin@tepisawah.id'::text    as v_email,
         'TepiSawah#Admin2026'::text    as v_password
),
created as (
  -- Create the auth user if it does not already exist.
  -- crypt() + gen_salt('bf', 10) produces the bcrypt hash Supabase Auth
  -- expects. email_confirmed_at is set so no confirmation email is needed.
  -- raw_app_meta_data carries the role claim; the app itself reads roles from
  -- user_roles under RLS, so the grant below is what actually unlocks access.
  -- gen_random_uuid() explicitly: auth.users.id has no default on Supabase.
  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password,
     email_confirmed_at, created_at, updated_at,
     raw_app_meta_data, raw_user_meta_data, is_super_admin)
  select
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    v_email,
    crypt(v_password, gen_salt('bf', 10)),
    now(), now(), now(),
    '{"role":"admin"}'::jsonb, '{}'::jsonb, false
  from params
  where not exists (select 1 from auth.users u where u.email = params.v_email)
  returning id, email
),
resolved as (
  -- The user id and email, whether just created or already present.
  select id, email from created
  union all
  select u.id, u.email
  from auth.users u, params
  where u.email = params.v_email
    and not exists (select 1 from created)
),
identity as (
  -- GoTrue's sign-in path reads the identities relation; a directly-inserted
  -- auth.users row needs this companion row or sign-in fails with
  -- 500 "Database error querying schema". provider_id is the current schema;
  -- older Supabase used identity_id.
  insert into auth.identities
    (id, user_id, provider_id, provider, identity_data,
     created_at, updated_at, last_sign_in_at)
  -- NOTE: email is a GENERATED column on identities in this Supabase version,
  -- derived from identity_data, so it must not be written directly.
  select
    gen_random_uuid(),
    resolved.id,
    resolved.id::text,
    'email',
    jsonb_build_object('sub', resolved.id::text, 'email', resolved.email),
    now(), now(), now()
  from resolved
  where not exists (select 1 from auth.identities i where i.user_id = resolved.id)
),
profile as (
  -- Ensure the profile exists and is active. The on_auth_user_created trigger
  -- normally creates it; this covers a pre-existing user, and is_active=false
  -- would otherwise gate the account out of the panel entirely.
  insert into public.profiles (id, display_name, is_active)
  select resolved.id, split_part(params.v_email, '@', 1), true
  from resolved, params
  on conflict (id) do update set is_active = true
  returning id
)
-- Grant the admin role. This row is what fetchCurrentUserRoles() reads through
-- RLS, so without it a signed-in user has no staff role and the panel shows
-- "unauthorized".
insert into public.user_roles (user_id, role_id)
select profile.id, roles.id
from profile, public.roles
where roles.code = 'admin'
on conflict (user_id, role_id) do nothing;

-- =============================================================================
-- Verification (visible in the SQL editor result pane).
-- =============================================================================
select u.email,
       p.display_name,
       p.is_active,
       r.code as role,
       (select count(*) from public.role_permissions rp where rp.role_id = r.id)
         as permission_count
from auth.users u
join public.profiles  p on p.id = u.id
join public.user_roles ur on ur.user_id = u.id
join public.roles     r on r.id = ur.role_id
where r.code = 'admin';
