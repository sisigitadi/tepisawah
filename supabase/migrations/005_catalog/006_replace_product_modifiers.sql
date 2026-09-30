-- =============================================================================
-- Tepi Sawah — Migration 005 (part 6): atomic product-modifier replace.
--
-- Source: docs/api/API_CONTRACT.md §27 (Price Integrity), docs/security/
-- AUTH_RBAC_RLS.md §8 (backend is the authority), §21 (RLS answers the six
-- questions), §34 (SECURITY DEFINER rules), §47 (validate before mutating),
-- docs/database/DATABASE_SCHEMA.md §16 (selection bounds), docs/implementation/
-- CLINE_IMPLEMENTATION_PLAN.md §11 (Phase 5 catalog management).
--
-- Defect fixed: `saveProductModifiers` used to run the unlink (delete) and the
-- relink (upsert) as two separate REST round trips. If the second request
-- failed — network drop, denial, a CHECK violation — the first was already
-- committed, leaving a product half-linked, and the audit for the removal was
-- never produced (the audit is computed from rows the second request never
-- returned). Replacing a product's modifier set is one critical mutation, so it
-- is now one server-side call: this function validates the whole payload, then
-- deletes the existing links and inserts the new set inside one implicit
-- transaction. Either the full replace lands or nothing does.
--
-- The function is SECURITY DEFINER with search_path pinned to public and no
-- dynamic SQL (§34). Parts 1-4 grant DELETE on product_modifiers to no client
-- role (categories/products/modifiers revoke it outright; this table was only
-- ever granted INSERT/UPDATE), so this RPC is the sole mutation path — direct
-- REST writes stay blocked by the missing table grants. Authorization is
-- re-imposed inside the function with the same three predicates the part 4 RLS
-- policy uses, so the caller still needs `catalog.update` and the check is
-- server-side, not client-side (§8). A caller who lacks it gets 42501, which
-- the query layer maps exactly the way it maps a denial.
--
-- SECURITY DEFINER also sidesteps the plpgsql OUT-parameter hazard: `delete`
-- and `return query` qualify every column (`pm.`) because the function's own
-- OUT parameter is named `product_id` and would otherwise shadow the column.
-- =============================================================================
create or replace function public.replace_product_modifiers(
  p_product_id uuid,
  p_links jsonb
)
returns table (
  product_id uuid,
  modifier_id uuid,
  is_required boolean,
  min_select integer,
  max_select integer,
  sort_order integer,
  created_at timestamptz
)
language plpgsql
security definer set search_path = public
as $$
declare
  v_link jsonb;
  v_min integer;
  v_max integer;
begin
  -- Authorization — mirrors `product_modifiers_delete_authorized` in part 4.
  if public.auth_user_id() is null
     or not public.current_user_is_active()
     or not public.has_permission('catalog.update') then
    raise exception 'permission denied for function replace_product_modifiers'
      using errcode = '42501';
  end if;

  if p_product_id is null then
    raise exception 'Product id is required.' using errcode = 'P0001';
  end if;

  -- An absent payload is an empty set: every link is unlinked. Anything that is
  -- not an array is a protocol error, not a silent empty replace.
  if p_links is not null and jsonb_typeof(p_links) <> 'array' then
    raise exception 'Links payload must be an array.' using errcode = 'P0001';
  end if;

  -- Validate the whole payload before touching any row (§47): a rejected link
  -- can never reach the delete, so a bad payload leaves the product as-is.
  -- These mirror the CHECK constraints from part 4 so the client gets a typed
  -- 49000-class error instead of a constraint traceback.
  for v_link in select * from jsonb_array_elements(coalesce(p_links, '[]'::jsonb)) loop
    if coalesce(v_link->>'modifierId', '') = '' then
      raise exception 'A link is missing a modifier id.' using errcode = 'P0001';
    end if;

    v_min := coalesce((v_link->>'minSelect')::integer, 0);
    v_max := coalesce((v_link->>'maxSelect')::integer, 1);

    if v_min < 0 then
      raise exception 'min_select must be >= 0.' using errcode = 'P0004';
    end if;
    if v_max < 1 then
      raise exception 'max_select must be >= 1.' using errcode = 'P0004';
    end if;
    if v_max < v_min then
      raise exception 'max_select must be >= min_select.' using errcode = 'P0004';
    end if;
    if coalesce((v_link->>'isRequired')::boolean, false) and v_min < 1 then
      raise exception 'A required modifier group needs min_select >= 1.'
        using errcode = 'P0004';
    end if;
  end loop;

  -- The composite primary key would trip on a repeated modifier id; reject it
  -- with the same class of error as a bounds violation.
  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_links, '[]'::jsonb)) as l
    group by l->>'modifierId'
    having count(*) > 1
  ) then
    raise exception 'A modifier may only be linked to a product once.'
      using errcode = 'P0004';
  end if;

  -- Replace the whole set in one transaction. The payload is the whole truth
  -- for this product, so the delete is unconditional on the product, not a
  -- per-id diff — that is what makes the outcome independent of failure order.
  delete from public.product_modifiers as pm where pm.product_id = p_product_id;

  insert into public.product_modifiers (
    product_id, modifier_id, is_required, min_select, max_select, sort_order
  )
  select
    p_product_id,
    (l->>'modifierId')::uuid,
    coalesce((l->>'isRequired')::boolean, false),
    coalesce((l->>'minSelect')::integer, 0),
    coalesce((l->>'maxSelect')::integer, 1),
    coalesce((l->>'sortOrder')::integer, 0)
  from jsonb_array_elements(coalesce(p_links, '[]'::jsonb)) as l;

  return query
  select pm.product_id, pm.modifier_id, pm.is_required, pm.min_select,
         pm.max_select, pm.sort_order, pm.created_at
  from public.product_modifiers as pm
  where pm.product_id = p_product_id
  order by pm.sort_order, pm.modifier_id;
end;
$$;

revoke execute on function public.replace_product_modifiers(uuid, jsonb) from anon;
grant execute on function public.replace_product_modifiers(uuid, jsonb) to authenticated;
