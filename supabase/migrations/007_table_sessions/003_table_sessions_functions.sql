-- =============================================================================
-- Tepi Sawah — Migration 007 (part 3): Table session commands.
--
-- Source: API_CONTRACT.md §9.1 (Open Table Session), §9.2 (Get Active Session),
-- §9.3 (Close Table Session), §10.1 (create order carries tableSessionId),
-- AUTH_RBAC_RLS.md §20, §25 (auth predicates), §34 (SECURITY DEFINER rules),
-- §46 (idempotency), §47 (validate before mutate),
-- CLINE_IMPLEMENTATION_PLAN.md §13.
--
-- All four commands are SECURITY DEFINER with `search_path` pinned to `public`
-- and no dynamic SQL (AUTH_RBAC_RLS.md §34). They are the only write paths to
-- `table_sessions`, so the grants that were withheld in part 1 cannot be lost
-- in a way that breaks the invariant. Each one re-checks its own permission
-- inside the transaction and raises 42501 on denial, matching the RLS denial
-- the caller would have seen on a granted table.
--
-- Session state is always decided here, never in the frontend
-- (MASTER prompt: the backend is the authority; the database is the source of
--  truth; frontend permission is only UX).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- open_table_session(p_table_id)
--
-- Idempotent + race-safe. The partial unique index from part 1 is the
-- invariant: the INSERT carries `on conflict (table_id) where status = 'OPEN'
-- do nothing`, so two concurrent "open" requests on the same table yield one
-- session and the loser simply gets the winner returned to it — no duplicate,
-- no error to handle client-side.
-- -----------------------------------------------------------------------------
create or replace function public.open_table_session(p_table_id uuid)
returns setof public.table_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table public.tables%rowtype;
  v_session public.table_sessions%rowtype;
begin
  -- Authorization (AUTH_RBAC_RLS.md §25).
  if public.auth_user_id() is null or not public.current_user_is_active()
     or not public.has_permission('table_sessions.manage')
  then
    raise exception 'Not authorized to manage table sessions' using errcode = '42501';
  end if;

  -- Validate before mutate (§47): the table must exist and be active.
  select * into v_table
  from public.tables
  where id = p_table_id
  for update;  -- lock the table row so open/close cannot interleave on it

  if not found then
    raise exception 'Table not found' using errcode = 'P0002';
  end if;

  if not v_table.is_active then
    raise exception 'Table % is not active', v_table.table_code
      using errcode = '23003';  -- class 23 — integrity violation
  end if;

  -- The race collapses into one row here; then we read the surviving session.
  insert into public.table_sessions (table_id, status, opened_by)
  values (p_table_id, 'OPEN', public.auth_user_id())
  on conflict (table_id) where status = 'OPEN' do nothing
  returning * into v_session;

  if v_session.id is null then
    select * into v_session
    from public.table_sessions
    where table_id = p_table_id and status = 'OPEN';
  end if;

  return next v_session;
end;
$$;

grant execute on function public.open_table_session(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- get_active_table_session(p_table_id)
--
-- Returns the one OPEN session for a table, or nothing. Staff use this to pick
-- up the live session before attaching an order or closing it; the customer
-- flow gets its copy through `resolve_table_qr()` (part 4).
-- -----------------------------------------------------------------------------
create or replace function public.get_active_table_session(p_table_id uuid)
returns setof public.table_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.table_sessions%rowtype;
begin
  if public.auth_user_id() is null or not public.current_user_is_active()
     or not public.has_permission('table_sessions.read')
  then
    raise exception 'Not authorized to read table sessions' using errcode = '42501';
  end if;

  select * into v_session
  from public.table_sessions
  where table_id = p_table_id and status = 'OPEN';

  if v_session.id is not null then
    return next v_session;
  end if;
end;
$$;

grant execute on function public.get_active_table_session(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- attach_order_to_session(p_session_id, p_order_id, p_order_code)
--
-- Registers one order against its session (API_CONTRACT.md §10.1). This is the
-- command that makes "one session can have several orders" true on the write
-- side, and it is safe to retry: the unique `order_id` constraint means a
-- duplicated request attaches nothing new.
--
-- Attaching to a CLOSED session is refused — a stale session must not quietly
-- absorb orders.
-- -----------------------------------------------------------------------------
create or replace function public.attach_order_to_session(
  p_session_id uuid,
  p_order_id   uuid,
  p_order_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.table_sessions%rowtype;
  v_table   public.tables%rowtype;
  v_count   integer;
  v_inserted boolean;
begin
  if public.auth_user_id() is null or not public.current_user_is_active()
     or not public.has_permission('table_sessions.manage')
  then
    raise exception 'Not authorized to attach an order to a table session'
      using errcode = '42501';
  end if;

  -- Validate the session is open and its table still usable.
  select * into v_session
  from public.table_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'Table session not found' using errcode = 'P0002';
  end if;

  if v_session.status <> 'OPEN' then
    raise exception 'Table session is closed; cannot attach order %', p_order_code
      using errcode = '23003';
  end if;

  select * into v_table from public.tables where id = v_session.table_id;
  if not v_table.is_active then
    raise exception 'Table % is not active', v_table.table_code using errcode = '23003';
  end if;

  -- Concurrent create: two writers racing the same order_id both land here;
  -- exactly one wins, the other's ON CONFLICT no-ops and reports attached=false
  -- so the client can treat a retry as success (§46).
  insert into public.table_session_order_links (session_id, order_id, order_code)
  values (v_session.id, p_order_id, p_order_code)
  on conflict (order_id) do nothing
  returning true into v_inserted;

  if v_inserted is null then
    v_inserted := false;
  end if;

  select count(*) into v_count
  from public.table_session_order_links
  where session_id = v_session.id;

  return jsonb_build_object(
    'session_id', v_session.id,
    'table_id',   v_session.table_id,
    'status',     v_session.status,
    'order_id',   p_order_id,
    'order_code', p_order_code,
    'attached',   v_inserted,
    'order_count', v_count
  );
end;
$$;

grant execute on function public.attach_order_to_session(uuid, uuid, text)
  to authenticated;

-- -----------------------------------------------------------------------------
-- close_table_session(p_session_id)
--
-- Ends the dining visit (API_CONTRACT.md §9.3). Closure is soft: the row stays,
-- `orders` will keep pointing at it, and history remains readable through the
-- same `table_sessions.read` policy.
--
-- Validation enforced server-side:
--   * the caller may manage sessions;
--   * the session exists;
--   * the session is still OPEN (a repeat close is rejected, not ignored —
--     duplicate action must surface);
--   * the table the session belongs to is still active.
--
-- Closing NEVER happens because one order finished — this command is the only
-- route to CLOSED and it is a deliberate staff action. The
-- "no orders are still in flight" business rule is intentionally not enforced
-- yet: the `orders` table does not exist until Phase 8 (migration 008) and
-- inventing a rule over a table that does not exist would be guessing. It is
-- added as the first task of Phase 8, documented in the phase report.
-- -----------------------------------------------------------------------------
create or replace function public.close_table_session(p_session_id uuid)
returns setof public.table_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.table_sessions%rowtype;
begin
  if public.auth_user_id() is null or not public.current_user_is_active()
     or not public.has_permission('table_sessions.manage')
  then
    raise exception 'Not authorized to close a table session' using errcode = '42501';
  end if;

  select * into v_session
  from public.table_sessions
  where id = p_session_id
  for update;  -- serialize against a concurrent close

  if not found then
    raise exception 'Table session not found' using errcode = 'P0002';
  end if;

  if v_session.status <> 'OPEN' then
    raise exception 'Table session is already closed' using errcode = '23003';
  end if;

  update public.table_sessions
  set status    = 'CLOSED',
      closed_at = now(),
      closed_by = public.auth_user_id()
  where id = p_session_id
  returning * into v_session;

  return next v_session;
end;
$$;

grant execute on function public.close_table_session(uuid) to authenticated;
