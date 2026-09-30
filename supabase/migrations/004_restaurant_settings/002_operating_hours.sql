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
