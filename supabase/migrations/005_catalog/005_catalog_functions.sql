-- =============================================================================
-- Tepi Sawah — Migration 005 (part 5): Public catalog projection and the
-- server-side order-item price resolver.
--
-- Source: docs/api/API_CONTRACT.md §7.1/§7.2/§7.3 (Catalog API), §27 (Price
-- Integrity), §30 (Public Customer Security), docs/security/AUTH_RBAC_RLS.md
-- §17 (Customer Public Access), §25 (RLS Pattern: Catalog), §34 (SECURITY
-- DEFINER rules), §46 (Data Exposure Rules by Module).
--
-- Parts 1-4 give anonymous callers no grant on categories, products, modifiers
-- or product_modifiers, so RLS answers the six questions (AUTH_RBAC_RLS.md
-- §21) with "public? no" for every one of those tables. The customer catalog
-- flow still needs the active menu (API_CONTRACT.md §7.1/§7.2), so the public
-- boundary is a read-only projection here instead of a permissive policy
-- (§46: exact field-level exposure through functions, not UI hiding).
--
-- `public_catalog()` returns one flat row per product, joined to its category
-- and its active modifiers as three columns. Every filter that makes a menu
-- item orderable is applied inside the function, so the customer can never see
-- an archived category, an archived or unavailable product, or a detached or
-- archived modifier. The result carries no prices the customer may not see —
-- the catalog price IS the customer price — and no ids beyond the public ones
-- the order flow needs (productId, categoryId, modifierId).
--
-- `resolve_order_item()` is the price-integrity seam for order creation
-- (API_CONTRACT.md §27). It takes only what a client is allowed to send
-- (productId, quantity, modifierIds), re-reads the catalog as the authority,
-- validates orderability and the selection bounds from part 4, and returns the
-- snapshot values (names, unit price, modifier deltas, subtotal) that order
-- creation persists. A client can never place a price into an order; it can
-- only ask the server to compute one. Order tables land in migration 008/009;
-- this function is deliberately catalog-only so Phase 8 consumes it.
--
-- Both functions are SECURITY DEFINER with search_path pinned to public, take
-- no untrusted identifiers beyond the read-only lookup keys, and use no dynamic
-- SQL (AUTH_RBAC_RLS.md §34).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- public_catalog() — the customer-facing active menu.
--
-- Returns at most one row per product; the modifiers column is an array of the
-- product's orderable modifiers (empty when the product has none). Fails to an
-- empty result for every unconfigured state — a restaurant with no active menu
-- shows nothing, never a broken or half-filtered menu.
-- -----------------------------------------------------------------------------
create or replace function public.public_catalog()
returns table (
  category_id   uuid,
  category_name text,
  category_sort integer,
  product_id    uuid,
  product_name  text,
  description   text,
  price         numeric(12,2),
  image_url     text,
  is_available  boolean,
  product_sort  integer,
  modifiers     jsonb
)
language sql
stable
security definer set search_path = public
as $$
  select
    c.id         as category_id,
    c.name       as category_name,
    c.sort_order as category_sort,
    p.id         as product_id,
    p.name       as product_name,
    p.description,
    p.price,
    p.image_url,
    p.is_available,
    p.sort_order as product_sort,
    coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'modifierId', m.id,
          'name',       m.name,
          'priceDelta', m.price_delta,
          'isRequired', pm.is_required,
          'minSelect',  pm.min_select,
          'maxSelect',  pm.max_select,
          'sortOrder',  pm.sort_order
        ) order by pm.sort_order, m.name)
        from public.product_modifiers pm
        join public.modifiers m
          on m.id = pm.modifier_id
        where pm.product_id  = p.id
          and m.is_active    = true
      ),
      '[]'::jsonb
    ) as modifiers
  from public.categories c
  join public.products p
    on p.category_id = c.id
  where c.is_active     = true
    and p.is_active     = true
  order by c.sort_order, c.name, p.sort_order, p.name
$$;

comment on function public.public_catalog() is
  'Customer-facing active catalog: active categories, their active products, and each product orderable modifiers. Read-only, anonymous-safe (API_CONTRACT.md §7).';

-- -----------------------------------------------------------------------------
-- resolve_order_item(p_product_id, p_quantity, p_modifier_ids)
--
-- Computes the authoritative order-item snapshot (API_CONTRACT.md §27). Raises
-- a typed error whenever the item is not orderable, so order creation cannot
-- persist a stale or forbidden price:
--
--   P001  product does not exist / not active / not available
--   P002  category archived (the product left the public catalog)
--   P003  a modifier is unknown, archived, or not attached to this product
--   P004  selection count violates the group bounds from part 4
--   P005  quantity out of the allowed range
--
-- The client supplies only ids and a quantity. Every price, name, delta and
-- subtotal is read and computed here.
-- -----------------------------------------------------------------------------
create or replace function public.resolve_order_item(
  p_product_id  uuid,
  p_quantity    integer,
  p_modifier_ids uuid[] default '{}'
)
returns table (
  product_id            uuid,
  product_name_snapshot text,
  category_id           uuid,
  unit_price_snapshot   numeric(12,2),
  quantity              integer,
  modifier_ids          uuid[],
  modifier_names        text[],
  modifier_deltas       numeric(12,2)[],
  modifiers_subtotal    numeric(12,2),
  subtotal              numeric(12,2)
)
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_product record;
  v_modifier_ids uuid[] := coalesce(p_modifier_ids, '{}');
  v_qty         integer := coalesce(p_quantity, 0);
  v_names       text[];
  v_deltas      numeric(12,2)[];
  v_group       record;
begin
  -- Quantity is validated first: it is the one client-supplied scalar that
  -- reaches arithmetic, so an out-of-range value must never reach a price.
  if v_qty < 1 or v_qty > 999 then
    raise exception 'Quantity must be between 1 and 999.' using errcode = 'P0005';
  end if;

  -- Load the product as the authority, with every orderability gate.
  select p.id, p.name, p.category_id, p.price, p.is_active, p.is_available, c.is_active as category_active
    into v_product
  from public.products p
  join public.categories c on c.id = p.category_id
  where p.id = p_product_id;

  if not found then
    raise exception 'Product does not exist.' using errcode = 'P0001';
  end if;

  if v_product.is_active = false then
    raise exception 'Product is inactive and cannot be ordered.' using errcode = 'P0001';
  end if;

  if v_product.is_available = false then
    raise exception 'Product is currently unavailable.' using errcode = 'P0001';
  end if;

  if v_product.category_active = false then
    raise exception 'Product category is inactive.' using errcode = 'P0002';
  end if;

  -- Resolve each requested modifier against this product's links. An unknown
  -- id, an archived modifier, or a modifier attached to a different product all
  -- fail the join and raise P0003 — the client never decides what is orderable.
  select array_agg(m.id order by pm.sort_order, m.name),
         array_agg(m.name order by pm.sort_order, m.name),
         array_agg(m.price_delta order by pm.sort_order, m.name)
    into v_modifier_ids, v_names, v_deltas
  from public.product_modifiers pm
  join public.modifiers m on m.id = pm.modifier_id
  where pm.product_id = p_product_id
    and m.is_active   = true
    and m.id = any(v_modifier_ids);

  -- Zero requested modifiers resolves to null, which is why both sides are
  -- coalesced before the count comparison.
  if coalesce(array_length(v_modifier_ids, 1), 0) <> coalesce(array_length(coalesce(p_modifier_ids, '{}'), 1), 0) then
    raise exception 'One or more modifiers are not valid for this product.' using errcode = 'P0003';
  end if;

  -- Enforce the selection bounds from part 4, per group of identical bounds.
  -- A required group with min_select > 0 must be satisfied; no group may be
  -- over-selected.
  for v_group in
    select pm.is_required, pm.min_select, pm.max_select,
           count(*) filter (where selected.id = any(coalesce(v_modifier_ids, '{}'))) as picked
    from public.product_modifiers pm
    join public.modifiers m on m.id = pm.modifier_id
    left join lateral (select * from unnest(coalesce(v_modifier_ids, '{}')) as selected(id)) selected
      on selected.id = pm.modifier_id
    where pm.product_id = p_product_id
      and m.is_active = true
    group by pm.is_required, pm.min_select, pm.max_select
  loop
    if v_group.picked > v_group.max_select then
      raise exception 'Too many options selected for a modifier group (max %).', v_group.max_select
        using errcode = 'P0004';
    end if;
    if v_group.picked < v_group.min_select then
      raise exception 'A required modifier group is incomplete (min %).', v_group.min_select
        using errcode = 'P0004';
    end if;
  end loop;

  return query
  select
    v_product.id,
    v_product.name,
    v_product.category_id,
    v_product.price,
    v_qty,
    coalesce(v_modifier_ids, '{}'),
    coalesce(v_names, '{}'),
    coalesce(v_deltas, '{}'),
    coalesce((select sum(d) from unnest(v_deltas) as d), 0),
    (v_product.price + coalesce((select sum(d) from unnest(v_deltas) as d), 0)) * v_qty;
end;
$$;

comment on function public.resolve_order_item(uuid, integer, uuid[]) is
  'Authoritative order-item snapshot: validates orderability and selection bounds, computes names, prices and subtotal server-side (API_CONTRACT.md §27).';

-- -----------------------------------------------------------------------------
-- Both are the public/staff read paths. `public_catalog()` is callable
-- anonymously (the customer QR flow needs no login, AUTH_RBAC_RLS.md §30).
-- `resolve_order_item()` is callable by any authenticated role that may create
-- an order, and by anonymous customers in the QR flow; it never discloses
-- anything the catalog projection does not already expose, and it writes
-- nothing.
-- -----------------------------------------------------------------------------
grant execute on function public.public_catalog() to authenticated, anon;
grant execute on function public.resolve_order_item(uuid, integer, uuid[]) to authenticated, anon;
