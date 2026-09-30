-- =============================================================================
-- Tepi Sawah — Migration 006 (part 2): Table QR codes.
--
-- Source: docs/database/DATABASE_SCHEMA.md §18 (table_qr),
-- docs/security/AUTH_RBAC_RLS.md §18 (Public QR Security), §26 (RLS Pattern:
-- Tables), §46 (data exposure rules by module), docs/api/API_CONTRACT.md §8.2.
--
-- One row per printed QR for a table. The printed QR carries the table code
-- plus this row's `token`: the code is public and not a secret (§18 — table code
-- alone must not authorize anything), the token is the revocable, optionally
-- expirable credential that makes a specific printed QR stop working
-- (`is_active = false`) or roll over (`regenerate_table_qr()` in part 3). The
-- token is deliberately not the table's UUID (DATABASE_SCHEMA.md §18): a UUID
-- would leak an internal identifier onto every printed sticker, and rotating
-- one QR would have to invalidate the table identity itself.
--
-- A table holds exactly one active QR. The unique partial index below is the
-- duplicate-QR guard: two active rows for one table are impossible, so a table
-- can never resolve through two different printed codes at once, and the token
-- unique index keeps two tables from sharing one code+token pair.
--
-- No client role receives any grant on this table. Reads and writes go through
-- the SECURITY DEFINER functions in part 3, which check `tables.qr_manage`
-- server-side before touching a row and return only the columns each caller is
-- allowed to see (AUTH_RBAC_RLS.md §34, §46).
-- =============================================================================
create table if not exists public.table_qr (
  id          uuid        primary key default gen_random_uuid(),
  table_id    uuid        not null references public.tables(id),
  token       text        not null,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz null,
  constraint table_qr_token_not_blank check (btrim(token) <> '')
);

-- Every token is distinct, forever: a reprinted QR must not resurrect a retired
-- token, and two tables can never share a printed code+token pair.
create unique index if not exists table_qr_token_key
  on public.table_qr (token);

-- One active QR per table. This is the duplicate-QR invariant.
create unique index if not exists table_qr_active_table_key
  on public.table_qr (table_id)
  where is_active;

create index if not exists table_qr_table_idx
  on public.table_qr (table_id);

-- -----------------------------------------------------------------------------
-- RLS — no direct client access in either direction (AUTH_RBAC_RLS.md §18,
-- §26). Anonymous customers resolve through the public projection in part 3;
-- staff mint, roll and retire QRs through the `tables.qr_manage` RPCs there.
-- -----------------------------------------------------------------------------
alter table public.table_qr enable row level security;

revoke select, insert, update, delete on public.table_qr from anon;
revoke select, insert, update, delete on public.table_qr from authenticated;
