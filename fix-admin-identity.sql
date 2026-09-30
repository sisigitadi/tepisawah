-- =============================================================================
-- Tepi Sawah — Complete the manually-created Admin identity
--
-- create-admin-user.sql inserted the auth.users row directly, which bypasses
-- GoTrue. Supabase's sign-in path then loads the user's identities relation,
-- and the missing companion row surfaces as:
--
--     500 unexpected_failure "Database error querying schema"
--
-- This adds the missing auth.identities row using the project's actual schema
-- (provider_id, not the older identity_id). It does NOT touch the password.
--
-- Plain SQL only (no PL/pgSQL): safe in the Supabase SQL editor. Idempotent.
--
-- >>> If you changed the email in create-admin-user.sql, change it here too <<<
-- =============================================================================
with target as (
  select id, email
  from auth.users
  where email = 'admin@tepisawah.id'
),
inserted as (
  insert into auth.identities
    (id, user_id, provider_id, provider, identity_data,
     created_at, updated_at, last_sign_in_at)
  -- NOTE: email is a GENERATED column on identities in this Supabase version,
  -- derived from identity_data, so it must not be written directly.
  select
    gen_random_uuid(),
    target.id,
    target.id::text,
    'email',
    jsonb_build_object('sub', target.id::text, 'email', target.email),
    now(), now(), now()
  from target
  where not exists (select 1 from auth.identities i where i.user_id = target.id)
  returning user_id
)
select
  case when exists (select 1 from inserted)
       then 'identity created for ' || (select email from target)
       else 'identity already present for ' || (select email from target)
  end as result;

-- =============================================================================
-- Verification: the account is now complete on both sides.
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
where r.code = 'admin';
