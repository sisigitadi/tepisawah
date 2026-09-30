-- =============================================================================
-- Tepi Sawah — Migration 006 (part 3): Table QR functions.
--
-- Source: docs/api/API_CONTRACT.md §8.2 (Resolve QR), docs/security/
-- AUTH_RBAC_RLS.md §17 (customer public access), §18 (Public QR Security),
-- §26 (RLS Pattern: Tables), §34 (SECURITY DEFINER rules), §47 (validate before
-- mutate), docs/database/DATABASE_SCHEMA.md §17-§18.
--
-- Three SECURITY DEFINER functions, each with `search_path` pinned to `public`
-- and no dynamic SQL (AUTH_RBAC_RLS.md §34):
--
--   resolve_table_qr(code, token)   public  — the customer QR entry point
--   regenerate_table_qr(table_id)   staff   — mint/roll a table's printed QR
--   deactivate_table_qr(table_id)   staff   — retire a table's printed QR
--
-- `table_qr` grants nothing to any client role (part 2), so these functions are
-- the only path to it. The staff pair re-check `tables.qr_manage` inside the
-- function body, so a session that loses the permission stops being able to
-- mint QRs even if a stale grant survived somewhere.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- resolve_table_qr() — the customer entry point (API_CONTRACT.md §8.2).
--
-- Validates the printed QR against the database, then returns the minimum the
-- ordering flow needs: the table identity and the public restaurant context.
-- A QR is one round trip; nothing about the staff side of the house — roles,
-- permissions, staff names, audit rows, other tables — is ever returned
-- (AUTH_RBAC_RLS.md §17, §18). The response never carries the token back: the
-- token is validated, never echoed.
--
-- Fails closed for every state a printed sticker can be in:
--   unknown code or token          -> no row, empty result
--   token belongs to another table -> the join finds nothing
--   QR retired (is_active = false) -> filtered out
--   QR expired (expires_at passed) -> filtered out
--   table archived (is_active off) -> filtered out
-- so the customer sees "QR tidak valid" instead of a half-open ordering
-- context. `session` (API_CONTRACT.md §8.2) lands with table sessions in
-- Phase 7; until then the caller treats it as absent.
--
-- Returns at most one row. Stable + SECURITY DEFINER: it only reads, so it is
-- safe to run as the function owner and callable by anonymous customers.
-- -----------------------------------------------------------------------------
create or replace function public.resolve_table_qr(
  p_table_code text,
  p_token text
)
returns table (
  table_id        uuid,
  table_code      text,
  table_name      text,
  restaurant_name text,
  is_open         boolean
)
language sql
stable
security definer set search_path = public
as $$
  select
    t.id,
    t.table_code,
    t.name,
    s.restaurant_name,
    public.is_restaurant_open()
  from public.tables t
  join public.table_qr q
    on q.table_id = t.id
   and q.is_active
   and (q.expires_at is null or q.expires_at > now())
  cross join lateral (
    select rs.restaurant_name
    from public.restaurant_settings rs
    order by rs.id
    limit 1
  ) s
  where t.is_active
    and lower(btrim(t.table_code)) = lower(btrim(p_table_code))
    and q.token = btrim(p_token)
  limit 1
$$;

comment on function public.resolve_table_qr(text, text) is
  'Public QR resolver: validates a printed table QR (code + revocable token) and returns the table identity plus public restaurant context. Empty result for unknown, retired, expired or archived QR.';

-- -----------------------------------------------------------------------------
-- regenerate_table_qr() — mint or roll a table's printed QR (staff).
--
-- One statement, one transaction: the table's current active QR is retired and
-- a fresh token is inserted, so a table is never without an active QR and never
-- has two (the unique partial index from part 2 is the backstop). Because the
-- printed material carries the token, rolling it invalidates every previously
-- printed sticker for this table — that is the point of the operation
-- (AUTH_RBAC_RLS.md §18: a compromised or worn-out QR must be revocable).
--
-- Authorization is re-checked inside the function and reported as 42501, the
-- same code RLS raises, so the client cannot distinguish "no permission" from
-- "RLS denied" and the error handling stays uniform. The fresh token is
-- returned only to the authorized caller — staff need it to print the sticker —
-- and never appears in the public projection.
-- -----------------------------------------------------------------------------
create or replace function public.regenerate_table_qr(p_table_id uuid)
returns table (
  qr_id     uuid,
  table_id  uuid,
  token     text,
  is_active boolean,
  created_at timestamptz,
  expires_at timestamptz
)
language plpgsql
security definer set search_path = public
as $$
begin
  if public.auth_user_id() is null
     or not public.current_user_is_active()
     or not public.has_permission('tables.qr_manage') then
    raise insufficient_privilege
      using detail = 'QR management requires the tables.qr_manage permission.';
  end if;

  update public.table_qr
     set is_active = false
   where table_id = p_table_id
     and is_active;

  insert into public.table_qr (table_id, token)
  values (p_table_id, encode(gen_random_bytes(24), 'hex'))
  returning
    id, table_id, token, is_active, created_at, expires_at;
end;
$$;

comment on function public.regenerate_table_qr(uuid) is
  'Mint (or roll) the active QR for one table. Retires the previous QR and returns the fresh token to the tables.qr_manage caller.';

-- -----------------------------------------------------------------------------
-- deactivate_table_qr() — retire a table's printed QR without touching the
-- table (staff). The table stays active and bookable through other channels;
-- only QR entry closes. This is the "QR harus dapat dinonaktifkan" control
-- (AUTH_RBAC_RLS.md §18) kept separate from table archival so the two shutdown
-- reasons — broken sticker and removed table — stay distinguishable.
--
-- Idempotent: retiring a table with no active QR updates nothing and still
-- succeeds. Returns true when a QR was actually retired, so the audit trail is
-- precise.
-- -----------------------------------------------------------------------------
create or replace function public.deactivate_table_qr(p_table_id uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
  if public.auth_user_id() is null
     or not public.current_user_is_active()
     or not public.has_permission('tables.qr_manage') then
    raise insufficient_privilege
      using detail = 'QR management requires the tables.qr_manage permission.';
  end if;

  update public.table_qr
     set is_active = false
   where table_id = p_table_id
     and is_active;

  return found;
end;
$$;

comment on function public.deactivate_table_qr(uuid) is
  'Retire the active QR of one table. Idempotent; returns true when a QR was retired. Requires tables.qr_manage.';

-- -----------------------------------------------------------------------------
-- Grants. The resolver is the public read path: anonymous customers and
-- signed-in staff may call it. The two management functions are staff-only;
-- the permission check inside each is the real gate, not this grant.
-- -----------------------------------------------------------------------------
grant execute on function public.resolve_table_qr(text, text) to authenticated, anon;
grant execute on function public.regenerate_table_qr(uuid) to authenticated;
grant execute on function public.deactivate_table_qr(uuid) to authenticated;
