-- =============================================================================
-- Tepi Sawah — Migration 007 (part 1): Table sessions.
--
-- Source: docs/database/DATABASE_SCHEMA.md §19 (table_sessions),
-- docs/database/DATABASE_MIGRATION_PLAN.md §20 (one table session may hold
-- more than one order; history survives closure),
-- docs/api/API_CONTRACT.md §9.1-§9.3 (Open / Get / Close Table Session),
-- docs/security/AUTH_RBAC_RLS.md §20 (RLS list), §21 (six questions),
-- §26 (RLS pattern), §34 (SECURITY DEFINER rules), §47 (validate before mutate),
-- docs/implementation/CLINE_IMPLEMENTATION_PLAN.md §13.
--
-- A session is the operational dining visit: one table, one OPEN session at a
-- time, and every order placed during that visit belongs to it
-- (DATABASE_SCHEMA.md §19: Table A12 / Session S1 / Order 001+002+003).
--
-- The one-active-session invariant is enforced by a partial unique index
-- (below) — this is the concurrency protection the phase asks for. Two staff
-- opening the same table at the same instant cannot produce two OPEN sessions:
-- the second write fails the index, and `open_table_session()` in part 3 turns
-- that failure into a reuse of the winner. Frontend never decides session
-- state; the database does.
--
-- Closure is soft and history-preserving (DATABASE_SCHEMA.md §36): a closed
-- session row stays, its orders keep pointing at it, and `closed_at`/`closed_by`
-- record the end. No DELETE is ever granted on this table.
-- =============================================================================
create table if not exists public.table_sessions (
  id         uuid        primary key default gen_random_uuid(),
  table_id   uuid        not null references public.tables(id),
  status     text        not null default 'OPEN',
  opened_at  timestamptz not null default now(),
  closed_at  timestamptz null,
  opened_by  uuid        null references public.profiles(id),
  closed_by  uuid        null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint table_sessions_status_vocabulary check (status in ('OPEN', 'CLOSED')),
  constraint table_sessions_open_before_close check (
    closed_at is null or (opened_at is not null and closed_at >= opened_at)
  )
);

-- One OPEN session per table, enforced by the index. This is the backstop the
-- RPC relies on: `open_table_session()` inserts with an ON CONFLICT clause that
-- only resolves against this exact predicate, so a race collapses into a
-- single row rather than a duplicate session.
create unique index if not exists table_sessions_one_open_per_table
  on public.table_sessions (table_id)
  where status = 'OPEN';

create index if not exists table_sessions_table_status_idx
  on public.table_sessions (table_id, status);

create index if not exists table_sessions_opened_at_idx
  on public.table_sessions (opened_at desc);

-- `updated_at` is maintained by the shared trigger from migration 002.
drop trigger if exists table_sessions_set_updated_at on public.table_sessions;
create trigger table_sessions_set_updated_at
  before update on public.table_sessions
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS — the security boundary (AUTH_RBAC_RLS.md §26).
--
-- SELECT: an active authenticated staff session holding `table_sessions.read`.
--          The customer flow never touches this table directly: the active
--          session reaches the QR entry point through the `resolve_table_qr()`
--          projection (part 3), which only exposes the session id + status
--          (API_CONTRACT.md §8.2).
-- INSERT / UPDATE / DELETE: never granted. Every mutation rides one of the
--          SECURITY DEFINER functions in part 3, which re-check

--          `table_sessions.manage` inside the transaction. That keeps the
--          critical mutations atomic, authorized and idempotent
--          (MASTER prompt: server-side, authorized, atomic, idempotent,
--           auditable) and means a lost grant cannot open a backdoor.
-- -----------------------------------------------------------------------------
alter table public.table_sessions enable row level security;

drop policy if exists "table_sessions_select_authorized" on public.table_sessions;
create policy "table_sessions_select_authorized"
  on public.table_sessions
  for select
  to authenticated
  using (
    public.auth_user_id() is not null
    and public.current_user_is_active()
    and public.has_permission('table_sessions.read')
  );

revoke insert, update, delete on public.table_sessions from anon;
revoke insert, update, delete on public.table_sessions from authenticated;

comment on table public.table_sessions is
  'A dining visit at one table. One OPEN session per table (partial unique index); multiple orders may belong to it, and closure preserves history.';
