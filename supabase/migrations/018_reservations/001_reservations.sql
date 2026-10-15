-- =============================================================================
-- Tepi Sawah — Migration 018: Table reservations.
--
-- Enables visitors of the public website (apps/web) to book saung / tables
-- directly into the database while opening WhatsApp to restaurant customer service.
-- Staf and admin can inspect, confirm, or complete reservations in the portal.
-- =============================================================================

create table if not exists public.reservations (
  id               uuid primary key default gen_random_uuid(),
  customer_name    text not null,
  phone            text not null,
  reservation_date date not null,
  reservation_time text not null,
  guests_count     integer not null default 4,
  seating_area     text not null default 'Saung Lesehan Sawah',
  notes            text null,
  status           text not null default 'PENDING'
                   check (status in ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.reservations is
  'Table and event bookings submitted by guests from the public website.';

-- Indexes
create index if not exists reservations_date_idx
  on public.reservations (reservation_date desc, reservation_time asc);

create index if not exists reservations_status_idx
  on public.reservations (status);

-- Enable RLS
alter table public.reservations enable row level security;

-- Policies
-- 1. Anyone (including anonymous web visitors) can submit a reservation
create policy reservations_anon_insert
  on public.reservations
  for insert
  to anon, authenticated
  with check (true);

-- 2. Only authenticated staff can view all reservations
create policy reservations_staff_select
  on public.reservations
  for select
  to authenticated
  using (true);

-- 3. Only authenticated staff can update reservation status
create policy reservations_staff_update
  on public.reservations
  for update
  to authenticated
  using (true)
  with check (true);

-- Grants
grant select, insert on public.reservations to anon;
grant select, insert, update on public.reservations to authenticated;
