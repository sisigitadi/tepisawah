-- =============================================================================
-- Tepi Sawah — Migration 007 (part 4): resolve_table_qr gains the active session.
--
-- API_CONTRACT.md §8.2 lists `session` on the QR resolve payload, and
-- CLINE_IMPLEMENTATION_PLAN.md §13 / AUTH_RBAC_RLS.md §20 place the active
-- session on the customer path. This migration fills that field.
--
-- The return shape grows by two nullable columns (`session_id`, `session_status`),
-- so the `returns table` signature changes and the function must be dropped and
-- recreated rather than `create or replace`d. The grant below is restored
-- explicitly.
--
-- Only the session id and status are exposed — never opened_by/closed_by,
-- order ids, or the QR token (AUTH_RBAC_RLS.md §17-§18: the customer gets the
-- minimum, and internal staff data never reaches the public surface).
-- =============================================================================
drop function if exists public.resolve_table_qr(text, text);

create or replace function public.resolve_table_qr(
  p_table_code text,
  p_token text
)
returns table (
  table_id        uuid,
  table_code      text,
  table_name      text,
  restaurant_name text,
  is_open         boolean,
  session_id      uuid,
  session_status  text
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
    public.is_restaurant_open(),
    ses.id,
    ses.status
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
  left join public.table_sessions ses
    on ses.table_id = t.id
   and ses.status = 'OPEN'
  where t.is_active
    and lower(btrim(t.table_code)) = lower(btrim(p_table_code))
    and q.token = btrim(p_token)
  limit 1
$$;

comment on function public.resolve_table_qr(text, text) is
  'Public QR resolver: validates a printed table QR (code + revocable token) and returns the table identity, the public restaurant context, and the table active session (id + status only). Empty result for unknown, retired, expired or archived QR.';

grant execute on function public.resolve_table_qr(text, text) to authenticated, anon;
