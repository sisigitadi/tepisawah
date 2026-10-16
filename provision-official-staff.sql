-- =============================================================================
-- TEPI SAWAH RESTO & CAFE — PENETAPAN PERAN STAF RESMI PRODUKSI
-- =============================================================================
-- Petunjuk:
-- 1. Buat user terlebih dahulu di Dashboard Supabase:
--    Menu "Authentication" -> "Users" -> "Add user" -> "Create user"
--    - Email: owner@tepisawah.id  (Auto Confirm: ON)
--    - Email: kasir@tepisawah.id  (Auto Confirm: ON)
--    - Email: dapur@tepisawah.id  (Auto Confirm: ON)
-- 2. Buka menu "SQL Editor" di Dashboard Supabase, lalu jalankan script ini.
-- =============================================================================

-- 1. Tetapkan Role OWNER untuk owner@tepisawah.id
with target as (
  select id, email from auth.users where lower(email) = 'owner@tepisawah.id'
),
profile as (
  insert into public.profiles (id, display_name, is_active)
  select id, 'Pemilik (Owner)', true
  from target
  on conflict (id) do update set display_name = 'Pemilik (Owner)', is_active = true
  returning id
)
insert into public.user_roles (user_id, role_id)
select profile.id, roles.id
from profile, public.roles
where roles.code = 'owner'
on conflict (user_id, role_id) do nothing;

-- 2. Tetapkan Role CASHIER untuk kasir@tepisawah.id
with target as (
  select id, email from auth.users where lower(email) = 'kasir@tepisawah.id'
),
profile as (
  insert into public.profiles (id, display_name, is_active)
  select id, 'Kasir Utama', true
  from target
  on conflict (id) do update set display_name = 'Kasir Utama', is_active = true
  returning id
)
insert into public.user_roles (user_id, role_id)
select profile.id, roles.id
from profile, public.roles
where roles.code = 'cashier'
on conflict (user_id, role_id) do nothing;

-- 3. Tetapkan Role KITCHEN untuk dapur@tepisawah.id
with target as (
  select id, email from auth.users where lower(email) = 'dapur@tepisawah.id'
),
profile as (
  insert into public.profiles (id, display_name, is_active)
  select id, 'Kepala Dapur', true
  from target
  on conflict (id) do update set display_name = 'Kepala Dapur', is_active = true
  returning id
)
insert into public.user_roles (user_id, role_id)
select profile.id, roles.id
from profile, public.roles
where roles.code = 'kitchen'
on conflict (user_id, role_id) do nothing;

-- =============================================================================
-- Verifikasi Hasil Penetapan Peran
-- =============================================================================
select 
  u.email,
  p.display_name,
  r.code as role_code,
  r.name as role_name,
  p.is_active
from auth.users u
join public.profiles p on p.id = u.id
join public.user_roles ur on ur.user_id = u.id
join public.roles r on r.id = ur.role_id
where u.email in (
  'admin@tepisawah.id',
  'owner@tepisawah.id',
  'kasir@tepisawah.id',
  'dapur@tepisawah.id'
)
order by r.code;
