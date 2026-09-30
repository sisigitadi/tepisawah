-- =============================================================================
-- Tepi Sawah — Migration 004 (part 3): Public settings projection and
-- ordering availability.
--
-- Source: docs/api/API_CONTRACT.md §8.2 (resolve QR), §31 (frontend cache),
-- §38 (unresolved configuration decisions), docs/security/AUTH_RBAC_RLS.md
-- §17 (customer public access), §46 (data exposure rules by module),
-- §34 (SECURITY DEFINER rules).
--
-- Parts 1 and 2 keep restaurant_settings and operating_hours fully
-- client-unreadable for anonymous users: anon holds no grant on either table.
-- The customer QR flow still needs a small public payload (API_CONTRACT.md
-- §8.2) — restaurant name and open state — so the public boundary is exposed
-- here as named projections instead of a permissive table policy.
--
-- Both functions are SECURITY DEFINER with search_path pinned to public and
-- return only the public-safe fields (AUTH_RBAC_RLS.md §34: minimum
-- capability, fixed search_path, no parameters, no dynamic SQL). They expose
-- exactly four scalar columns; they never return address, phone, email, ids or
-- timestamps, and never return the raw schedule rows
-- (AUTH_RBAC_RLS.md §17 — the customer must not receive internal data). This
-- is the function/DTO field-level exposure §46 asks for rather than UI hiding.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- is_restaurant_open() — ordering availability right now.
--
-- The wall clock is evaluated in the restaurant's own timezone, then matched
-- against today's schedule. Fails closed in every unconfigured state:
--   - no restaurant_settings row  -> no cfg row, join yields nothing, false
--   - no operating_hours rows     -> nothing to match, false
--   - today is_closed             -> no match, false
--   - outside today's window      -> no match, false
-- So ordering availability is never derived from a missing configuration.
-- -----------------------------------------------------------------------------
create or replace function public.is_restaurant_open()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  with cfg as (
    select timezone from public.restaurant_settings limit 1
  )
  select exists (
    select 1
    from public.operating_hours oh
    cross join cfg
    where oh.is_closed = false
      and extract(dow from (now() at time zone cfg.timezone))::smallint = oh.day_of_week
      and (now() at time zone cfg.timezone)::time >= oh.open_time
      and (now() at time zone cfg.timezone)::time < oh.close_time
  );
$$;

comment on function public.is_restaurant_open() is
  'True only when the restaurant is open right now in its own timezone; false for every unconfigured state.';

-- -----------------------------------------------------------------------------
-- public_restaurant_settings() — the public-safe settings payload
-- (API_CONTRACT.md §8.2 `restaurant` object).
--
-- Returns at most one row. When no configuration exists yet the result is
-- empty and the caller must treat the restaurant as unconfigured/closed.
-- -----------------------------------------------------------------------------
create or replace function public.public_restaurant_settings()
returns table (
  restaurant_name text,
  timezone text,
  currency text,
  is_open boolean
)
language sql
stable
security definer set search_path = public
as $$
  select
    s.restaurant_name,
    s.timezone,
    s.currency,
    public.is_restaurant_open()
  from public.restaurant_settings s
  order by s.id
  limit 1
$$;

comment on function public.public_restaurant_settings() is
  'Public-safe settings projection: name, timezone, currency and open state only (API_CONTRACT.md §8.2).';

-- -----------------------------------------------------------------------------
-- Both functions are the public read path: callable by anonymous customers and
-- by signed-in staff. They answer a question, never expose a protected row.
-- -----------------------------------------------------------------------------
grant execute on function public.is_restaurant_open() to authenticated, anon;
grant execute on function public.public_restaurant_settings() to authenticated, anon;
