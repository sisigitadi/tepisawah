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
