-- =============================================================================
-- Tepi Sawah — Migration 006 (part 1): Dining tables.
--
-- Source: docs/database/DATABASE_SCHEMA.md §17 (tables),
-- docs/database/DATABASE_MIGRATION_PLAN.md §19, docs/api/API_CONTRACT.md §8.1
-- (Get Active Tables), docs/security/AUTH_RBAC_RLS.md §26 (RLS Pattern:
-- Tables), §8 (Tables permissions), docs/design/MASTER_DESIGN_SYSTEM.md §14.
--
-- A table is a physical dining location. Its `table_code` is the identifier the
-- printed QR carries and the staff-facing label (`A12`); `name` is the display
-- label (`Meja A12`) (API_CONTRACT.md §8.1). `status` is the operational state
-- of the furniture, deliberately a separate vocabulary from order status
-- (DATABASE_SCHEMA.md §17, MASTER_DESIGN_SYSTEM.md §14 — TABLE STATUS is never
-- derived from ORDER STATUS). The baseline vocabulary below is the design
-- system's; transitions into OCCUPIED / WAITING_* are driven by table sessions
-- and orders in later phases, so Phase 6 only stores and validates the value.
--
-- Archival is soft: `is_active = false` deactivates a table so its QR stops
-- resolving, while every historical row that references it stays valid. No hard
-- DELETE is ever granted — the same rule the catalog tables follow
-- (API_CONTRACT.md §1004-§1008).
-- =============================================================================
create table if not exists public.tables (
  id          uuid        primary key default gen_random_uuid(),
  table_code  text        not null,
  name        text        not null,
  capacity    integer     null,
  status      text        not null default 'AVAILABLE',
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint tables_table_code_not_blank check (btrim(table_code) <> ''),
  constraint tables_name_not_blank check (btrim(name) <> ''),
  constraint tables_capacity_non_negative check (capacity is null or capacity >= 0),
  constraint tables_status_vocabulary check (
    status in ('AVAILABLE', 'OCCUPIED', 'WAITING_SERVICE', 'WAITING_PAYMENT', 'CLEANING')
  )
);

-- `table_code` is unique (DATABASE_SCHEMA.md §17). Compared case-insensitively
-- and trimmed so "a12 " cannot shadow "A12" — the code is typed from a QR and
-- printed on the floor plan, and two tables sharing one code would send
-- customers to the wrong table.
create unique index if not exists tables_table_code_key
  on public.tables (lower(btrim(table_code)));

create index if not exists tables_active_code_idx
  on public.tables (is_active, lower(btrim(table_code)));

-- `updated_at` is maintained by the shared trigger from migration 002.
drop trigger if exists tables_set_updated_at on public.tables;
create trigger tables_set_updated_at
  before update on public.tables
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS — the security boundary (AUTH_RBAC_RLS.md §26).
--
-- SELECT: an active authenticated staff session with `tables.read` sees every
--          table including inactive ones (the admin list needs archived rows).
--          Anonymous callers never touch this table directly: they resolve a
--          QR through the public projection in part 3 (§17, §46).
-- INSERT:  `tables.create`.
-- UPDATE:  `tables.update` (covers the status/configuration patch and the
--          `is_active` archival toggle).
-- DELETE:  never granted — archive, do not delete.
-- -----------------------------------------------------------------------------
alter table public.tables enable row level security;

drop policy if exists "tables_select_authorized" on public.tables;
create policy "tables_select_authorized"
  on public.tables
  for select
  to authenticated
  using (
    public.auth_user_id() is not null
    and public.current_user_is_active()
    and public.has_permission('tables.read')
  );

drop policy if exists "tables_insert_authorized" on public.tables;
create policy "tables_insert_authorized"
  on public.tables
  for insert
  to authenticated
  with check (
    public.auth_user_id() is not null
    and public.current_user_is_active()
    and public.has_permission('tables.create')
  );

drop policy if exists "tables_update_authorized" on public.tables;
create policy "tables_update_authorized"
  on public.tables
  for update
  to authenticated
  using (
    public.auth_user_id() is not null
    and public.current_user_is_active()
    and public.has_permission('tables.update')
  )
  with check (
    public.auth_user_id() is not null
    and public.current_user_is_active()
    and public.has_permission('tables.update')
  );

revoke insert, update, delete on public.tables from anon;
revoke delete on public.tables from authenticated;

-- Admin writes every column except the surrogate key and timestamps.
grant insert (table_code, name, capacity, status, is_active) on public.tables to authenticated;
grant update (table_code, name, capacity, status, is_active) on public.tables to authenticated;
