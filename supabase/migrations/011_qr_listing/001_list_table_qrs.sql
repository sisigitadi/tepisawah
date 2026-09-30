-- =============================================================================
-- Tepi Sawah — Migration 011: Staff QR listing.
--
-- The admin Tables page needs the printed QR for each table when it loads.
-- Part 2 of migration 006 deliberately grants no client role any access to
-- `table_qr` (AUTH_RBAC_RLS.md §18: the token is the revocable credential on
-- every printed sticker, so it is never broadly readable). Minting, rolling
-- and retiring already ride the part-3 SECURITY DEFINER functions; listing was
-- the one missing piece, and the direct SELECT the UI attempted fails with
-- `permission denied for table table_qr` by design.
--
-- This function completes the set: staff holding `tables.qr_manage` get the
-- full projection (including the token, which they must have to print a
-- sticker), everyone else gets nothing. Authorization is re-checked inside the
-- function and reported as 42501, matching the part-3 pattern so client error
-- handling stays uniform.
--
-- `create or replace` cannot change an existing function's return type, so the
-- drop guard keeps the migration set re-runnable (same pattern as
-- 007 part 4 and the resolve_table_qr fix).
-- =============================================================================
drop function if exists public.list_table_qrs();

create or replace function public.list_table_qrs()
returns table (
  id          uuid,
  table_id    uuid,
  token       text,
  is_active   boolean,
  created_at  timestamptz,
  expires_at  timestamptz
)
language plpgsql
stable
security definer set search_path = public
as $$
begin
  if public.auth_user_id() is null
     or not public.current_user_is_active()
     or not public.has_permission('tables.qr_manage') then
    raise insufficient_privilege
      using detail = 'QR listing requires the tables.qr_manage permission.';
  end if;

  return query
  select q.id, q.table_id, q.token, q.is_active, q.created_at, q.expires_at
  from public.table_qr q
  order by q.created_at desc;
end;
$$;

comment on function public.list_table_qrs() is
  'List every printed QR for staff holding tables.qr_manage; the token is the printable credential, so no broader role may read this table.';

grant execute on function public.list_table_qrs() to authenticated;
revoke execute on function public.list_table_qrs() from anon;
