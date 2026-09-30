-- =============================================================================
-- Tepi Sawah — Delete the broken manually-created admin
--
-- The auth.users row inserted by create-admin-user.sql is malformed for this
-- GoTrue version and makes sign-in return
-- 500 "Database error querying schema". Deleting it clears the way for a
-- Dashboard-created user, which gets the correct shape.
--
-- Cascade handles the dependents automatically:
--   auth.identities        (on delete cascade)
--   public.profiles        (on delete cascade)   <- pulls user_roles with it
--
-- Plain SQL only. Safe to re-run.
--
-- >>> Change the email if you used a different one <<<
-- =============================================================================
delete from auth.users where email = 'admin@tepisawah.id';

-- =============================================================================
-- Verification: the account and its dependents are gone.
-- =============================================================================
select
  (select count(*) from auth.users     where email = 'admin@tepisawah.id') as auth_users,
  (select count(*) from auth.identities i
     join auth.users u on u.id = i.user_id
     where u.email = 'admin@tepisawah.id')                                as identities,
  (select count(*) from public.profiles p
     join auth.users u on u.id = p.id
     where u.email = 'admin@tepisawah.id')                                as app_profiles;
