-- =============================================================================
-- Tepi Sawah — Grant the admin role to a Dashboard-created user
--
-- Create the login in the Supabase Dashboard (Authentication → Users → Add
-- user, Auto Confirm ON). That handles auth.users + auth.identities correctly,
-- and the on_auth_user_created trigger provisions public.profiles.
--
-- This script does the app-level half only: it ensures the profile is active
-- and grants the admin staff role, which is what fetchCurrentUserRoles() reads
-- through RLS. It touches only the public schema — no auth.* writes.
--
-- Plain SQL only (no PL/pgSQL): safe in the Supabase SQL editor. Idempotent.
--
-- >>> Change the email to match what you created in the Dashboard <<<
-- =============================================================================
with target as (
  select id, email from auth.users where email = 'admin@tepisawah.id'
),
profile as (
  insert into public.profiles (id, display_name, is_active)
  select id, split_part(email, '@', 1), true
  from target
  on conflict (id) do update set is_active = true
  returning id
)
insert into public.user_roles (user_id, role_id)
select profile.id, roles.id
from profile, public.roles
where roles.code = 'admin'
on conflict (user_id, role_id) do nothing;

-- =============================================================================
-- Verification.
-- =============================================================================
select u.email,
       u.email_confirmed_at is not null          as email_confirmed,
       p.is_active,
       r.code                                   as role,
       (select count(*) from public.role_permissions rp where rp.role_id = r.id)
                                                 as permission_count,
       (select count(*) from auth.identities i where i.user_id = u.id)
                                                 as identities
from auth.users u
join public.profiles  p on p.id = u.id
join public.user_roles ur on ur.user_id = u.id
join public.roles     r on r.id = ur.role_id
where u.email = 'admin@tepisawah.id';
