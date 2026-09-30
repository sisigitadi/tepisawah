/**
 * Catalog admin queries (Phase 5).
 *
 * Read/write paths for `categories`, `products`, `modifiers` and
 * `product_modifiers`, plus the two server-side projections from migration
 * 005 part 5 (see catalog-public.ts). Every write rides the RLS-enforced
 * browser client, so RLS answers the six questions from AUTH_RBAC_RLS.md §21
 * server-side. Validation runs before any write (§47): a rejected patch
 * returns field errors and never reaches the network. Results never throw —
 * an error degrades to an explicit failure so callers fail closed.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../generated/index.js";
import {
  describeCategoryChange,
  describeModifierChange,
  describeProductChange,
  describeProductModifierChange,
  toCategory,
  toModifier,
  toProduct,
  toProductModifier,
  validateCategory,
  validateModifier,
  validateProduct,
  validateProductModifier,
  type Category,
  type CategoryErrors,
  type CategoryInput,
  type CategoryRow,
  type CatalogAuditEvent,
  type Modifier,
  type ModifierErrors,
  type ModifierInput,
  type ModifierRow,
  type Product,
  type ProductErrors,
  type ProductInput,
  type ProductModifier,
  type ProductModifierErrors,
  type ProductModifierInput,
  type ProductModifierRow,
  type ProductRow,
} from "../models/index.js";

export interface CatalogQueryError {
  message: string;
  fieldErrors?: Record<string, string>;
}

export interface CatalogQueryResult<T> {
  data: T | null;
  error: CatalogQueryError | null;
}

/** Generated table types are absent until the Supabase CLI lands (see
 * scripts/generate-types.mjs), so `from(...)` resolves to a `never`-typed
 * builder. Until then the write chains are typed against this local
 * row-shaped builder; reads cast their rows the way
 * queries/authorization.ts does. Nothing weakens the runtime contract — the
 * browser client still sends exactly one parameterized query. */
interface SupabaseFailure {
  message: string;
  code?: string;
}

interface SelectChain {
  maybeSingle: <T>() => Promise<{ data: T | null; error: SupabaseFailure | null }>;
  single: <T>() => Promise<{ data: T | null; error: SupabaseFailure | null }>;
  order: (
    column: string,
    options?: { ascending?: boolean },
  ) => Promise<{ data: unknown[] | null; error: SupabaseFailure | null }>;
  eq: (column: string, value: string) => SelectChain;
}

interface MutateChain {
  eq: (column: string, value: string) => { select: (columns?: string) => SelectChain };
  in: (column: string, values: readonly string[]) => { select: (columns?: string) => SelectChain };
  select: (columns?: string) => SelectChain;
}

interface DeleteChain {
  eq: (column: string, value: string) => { in: (column: string, values: readonly string[]) => Promise<{ error: SupabaseFailure | null }> };
  in: (column: string, values: readonly string[]) => Promise<{ error: SupabaseFailure | null }>;
}

interface UntypedTable {
  select: (columns?: string) => SelectChain;
  insert: (rows: Record<string, unknown>[]) => MutateChain;
  update: (row: Record<string, unknown>) => MutateChain;
  upsert: (
    rows: Record<string, unknown>[],
    options?: { onConflict?: string },
  ) => MutateChain;
  delete: () => DeleteChain;
}

function untypedTable(client: SupabaseClient<Database>, name: string): UntypedTable {
  return (client as unknown as { from: (table: string) => UntypedTable }).from(name);
}

/** The generated RPC types land with the Supabase CLI (see
 * scripts/generate-types.mjs), so `rpc()` is typed against this local shape —
 * the same approach queries/catalog-public.ts takes for `public_catalog()` and
 * `resolve_order_item()`. Exactly one parameterized call leaves the client. */
interface UntypedRpc {
  data: unknown | null;
  error: SupabaseFailure | null;
}

function untypedRpc(
  client: SupabaseClient<Database>,
  fn: string,
  args: Record<string, unknown>,
): Promise<UntypedRpc> {
  return (
    client as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<UntypedRpc>;
    }
  ).rpc(fn, args);
}

function failure(error: SupabaseFailure | null): CatalogQueryError {
  return { message: error?.message ?? "Kueri katalog gagal." };
}

function invalid<E extends Record<string, string>>(errors: E): CatalogQueryError {
  return { message: "Validasi gagal.", fieldErrors: errors };
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function fetchCategories(
  client: SupabaseClient<Database>,
): Promise<CatalogQueryResult<Category[]>> {
  const { data, error } = await untypedTable(client, "categories")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) return { data: null, error: failure(error) };
  return { data: ((data ?? []) as unknown as CategoryRow[]).map(toCategory), error: null };
}

export async function createCategory(
  client: SupabaseClient<Database>,
  input: CategoryInput,
): Promise<CatalogQueryResult<Category>> {
  const errors = validateCategory(input);
  if (Object.keys(errors).length > 0) return { data: null, error: invalid(errors) };

  const { data, error } = await untypedTable(client, "categories")
    .insert([toCategoryRow(input)])
    .select("*")
    .single<CategoryRow>();

  if (error) return { data: null, error: failure(error) };
  if (!data) return { data: null, error: { message: "Kategori tidak dibuat." } };
  return { data: toCategory(data), error: null };
}

export async function updateCategory(
  client: SupabaseClient<Database>,
  id: string,
  input: CategoryInput,
  current: Category,
): Promise<CatalogQueryResult<{ category: Category; audit: CatalogAuditEvent | null }>> {
  if (!id) return { data: null, error: { message: "Id kategori wajib diisi." } };

  const errors = validateCategory(input);
  if (Object.keys(errors).length > 0) return { data: null, error: invalid(errors) };

  const { data, error } = await untypedTable(client, "categories")
    .update(toCategoryRow(input))
    .eq("id", id)
    .select("*")
    .single<CategoryRow>();

  if (error) return { data: null, error: failure(error) };
  if (!data) return { data: null, error: { message: "Kategori tidak ditemukan." } };

  const category = toCategory(data);
  const event = describeCategoryChange(current, category);
  const audit = event.changedFields.length > 0 ? event : null;
  return { data: { category, audit }, error: null };
}

function toCategoryRow(input: CategoryInput): Record<string, unknown> {
  return {
    name: input.name.trim(),
    description: input.description === null ? null : input.description.trim() || null,
    sort_order: input.sortOrder,
    is_active: input.isActive,
  };
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export async function fetchProducts(
  client: SupabaseClient<Database>,
  categoryId?: string,
): Promise<CatalogQueryResult<Product[]>> {
  let chain = untypedTable(client, "products").select("*");
  if (categoryId) chain = chain.eq("category_id", categoryId);

  const { data, error } = await chain.order("sort_order", { ascending: true });
  if (error) return { data: null, error: failure(error) };
  return { data: ((data ?? []) as unknown as ProductRow[]).map(toProduct), error: null };
}

export async function fetchProduct(
  client: SupabaseClient<Database>,
  id: string,
): Promise<CatalogQueryResult<Product | null>> {
  if (!id) return { data: null, error: { message: "Id produk wajib diisi." } };

  const { data, error } = await untypedTable(client, "products")
    .select("*")
    .eq("id", id)
    .maybeSingle<ProductRow>();

  if (error) return { data: null, error: failure(error) };
  return { data: data ? toProduct(data) : null, error: null };
}

export async function createProduct(
  client: SupabaseClient<Database>,
  input: ProductInput,
): Promise<CatalogQueryResult<Product>> {
  const errors = validateProduct(input);
  if (Object.keys(errors).length > 0) return { data: null, error: invalid(errors) };

  const { data, error } = await untypedTable(client, "products")
    .insert([toProductRow(input)])
    .select("*")
    .single<ProductRow>();

  if (error) return { data: null, error: failure(error) };
  if (!data) return { data: null, error: { message: "Produk tidak dibuat." } };
  return { data: toProduct(data), error: null };
}

export async function updateProduct(
  client: SupabaseClient<Database>,
  id: string,
  input: ProductInput,
  current: Product,
): Promise<CatalogQueryResult<{ product: Product; audit: CatalogAuditEvent | null }>> {
  if (!id) return { data: null, error: { message: "Id produk wajib diisi." } };

  const errors = validateProduct(input);
  if (Object.keys(errors).length > 0) return { data: null, error: invalid(errors) };

  const { data, error } = await untypedTable(client, "products")
    .update(toProductRow(input))
    .eq("id", id)
    .select("*")
    .single<ProductRow>();

  if (error) return { data: null, error: failure(error) };
  if (!data) return { data: null, error: { message: "Produk tidak ditemukan." } };

  const product = toProduct(data);
  const event = describeProductChange(current, product);
  const audit = event.changedFields.length > 0 ? event : null;
  return { data: { product, audit }, error: null };
}

function toProductRow(input: ProductInput): Record<string, unknown> {
  return {
    category_id: input.categoryId,
    name: input.name.trim(),
    description: input.description === null ? null : input.description.trim() || null,
    image_url: input.imageUrl === null ? null : input.imageUrl.trim() || null,
    price: input.price,
    is_active: input.isActive,
    is_available: input.isAvailable,
    sort_order: input.sortOrder,
  };
}

// ---------------------------------------------------------------------------
// Modifiers
// ---------------------------------------------------------------------------

export async function fetchModifiers(
  client: SupabaseClient<Database>,
): Promise<CatalogQueryResult<Modifier[]>> {
  const { data, error } = await untypedTable(client, "modifiers")
    .select("*")
    .order("name", { ascending: true });

  if (error) return { data: null, error: failure(error) };
  return { data: ((data ?? []) as unknown as ModifierRow[]).map(toModifier), error: null };
}

export async function createModifier(
  client: SupabaseClient<Database>,
  input: ModifierInput,
): Promise<CatalogQueryResult<Modifier>> {
  const errors = validateModifier(input);
  if (Object.keys(errors).length > 0) return { data: null, error: invalid(errors) };

  const { data, error } = await untypedTable(client, "modifiers")
    .insert([toModifierRow(input)])
    .select("*")
    .single<ModifierRow>();

  if (error) return { data: null, error: failure(error) };
  if (!data) return { data: null, error: { message: "Modifikasi tidak dibuat." } };
  return { data: toModifier(data), error: null };
}

export async function updateModifier(
  client: SupabaseClient<Database>,
  id: string,
  input: ModifierInput,
  current: Modifier,
): Promise<CatalogQueryResult<{ modifier: Modifier; audit: CatalogAuditEvent | null }>> {
  if (!id) return { data: null, error: { message: "Id modifikasi wajib diisi." } };

  const errors = validateModifier(input);
  if (Object.keys(errors).length > 0) return { data: null, error: invalid(errors) };

  const { data, error } = await untypedTable(client, "modifiers")
    .update(toModifierRow(input))
    .eq("id", id)
    .select("*")
    .single<ModifierRow>();

  if (error) return { data: null, error: failure(error) };
  if (!data) return { data: null, error: { message: "Modifikasi tidak ditemukan." } };

  const modifier = toModifier(data);
  const event = describeModifierChange(current, modifier);
  const audit = event.changedFields.length > 0 ? event : null;
  return { data: { modifier, audit }, error: null };
}

function toModifierRow(input: ModifierInput): Record<string, unknown> {
  return {
    name: input.name.trim(),
    description: input.description === null ? null : input.description.trim() || null,
    price_delta: input.priceDelta,
    is_active: input.isActive,
  };
}

// ---------------------------------------------------------------------------
// Product ↔ modifier links
// ---------------------------------------------------------------------------

export async function fetchProductModifiers(
  client: SupabaseClient<Database>,
  productId?: string,
): Promise<CatalogQueryResult<ProductModifier[]>> {
  let chain = untypedTable(client, "product_modifiers").select("*");
  if (productId) chain = chain.eq("product_id", productId);

  const { data, error } = await chain.order("sort_order", { ascending: true });
  if (error) return { data: null, error: failure(error) };
  return {
    data: ((data ?? []) as unknown as ProductModifierRow[]).map(toProductModifier),
    error: null,
  };
}

/**
 * Replace one product's links in one atomic round trip (`catalog.update`). The
 * pair (product_id, modifier_id) is the primary key, so the payload is the
 * whole truth for this product: links it omits are unlinked, the rest replace
 * what is stored. Every link is validated first; the first invalid link aborts
 * the whole write so a product is never left half-linked.
 *
 * The delete and the insert ride one `replace_product_modifiers()` call
 * (migration 005 part 6) rather than two separate REST round trips. A replace
 * is a single critical mutation, so it is one server-side transaction: if the
 * write fails at any point, the product keeps its prior links instead of the
 * unlinked-without-relinked half-state the old two-step path could leave
 * behind (AUTH_RBAC_RLS.md §8, API_CONTRACT.md §27). The function also holds
 * the only mutation path to this table — parts 1-4 grant DELETE to no client
 * role, and the RPC re-checks `catalog.update` server-side before writing.
 */
export async function saveProductModifiers(
  client: SupabaseClient<Database>,
  productId: string,
  inputs: readonly ProductModifierInput[],
  current: readonly ProductModifier[],
  modifierNames: ReadonlyMap<string, string>,
): Promise<CatalogQueryResult<{ links: ProductModifier[]; audit: CatalogAuditEvent[] }>> {
  if (!productId) return { data: null, error: { message: "Id produk wajib diisi." } };

  const errors = new Map<number, ProductModifierErrors>();
  for (const input of inputs) {
    const linkErrors = validateProductModifier(input);
    if (Object.keys(linkErrors).length > 0) errors.set(inputs.indexOf(input), linkErrors);
  }
  if (errors.size > 0) {
    return {
      data: null,
      error: invalid<ProductModifierErrors>(errors.values().next().value as ProductModifierErrors),
    };
  }

  const seen = new Set<string>();
  const rows = inputs
    .filter((input) => {
      if (seen.has(input.modifierId)) return false;
      seen.add(input.modifierId);
      return true;
    })
    .map((input) => ({
      product_id: productId,
      modifier_id: input.modifierId,
      is_required: input.isRequired,
      min_select: input.minSelect,
      max_select: input.maxSelect,
      sort_order: input.sortOrder,
    }));

  // Rows the payload no longer lists are unlinked. The unlink is part of the
  // atomic replace, not a separate request — nothing historical references
  // this table, so order snapshots copy modifier names and deltas
  // (API_CONTRACT.md §27), but the caller still must not observe a partial
  // replace while the write is in flight.
  const toRemove = current
    .filter((link) => !seen.has(link.modifierId))
    .map((link) => link.modifierId);

  // Parameter names must match the SQL signature exactly:
  // replace_product_modifiers(p_product_id uuid, p_links jsonb) — PostgREST
  // resolves named arguments literally, so a camelCase key here fails with
  // "Could not find the function … in the schema cache".
  const { data, error } = await untypedRpc(client, "replace_product_modifiers", {
    p_product_id: productId,
    p_links: rows,
  });

  if (error) return { data: null, error: failure(error) };

  const stored = (data ?? []) as unknown as ProductModifierRow[];
  const links = stored.map(toProductModifier);
  const audit: CatalogAuditEvent[] = [];

  for (const after of links) {
    const before = current.find((link) => link.modifierId === after.modifierId);
    const label = modifierNames.get(after.modifierId) ?? after.modifierId;
    if (!before) {
      audit.push({ entity: "product_modifier", action: "link", entityId: productId, label, changedFields: ["isRequired", "minSelect", "maxSelect", "sortOrder"] });
      continue;
    }
    const event = describeProductModifierChange(before, after, label);
    if (event.changedFields.length > 0) audit.push(event);
  }
  for (const gone of toRemove) {
    audit.push({ entity: "product_modifier", action: "unlink", entityId: productId, label: modifierNames.get(gone) ?? gone, changedFields: ["modifierId"] });
  }

  return { data: { links, audit }, error: null };
}

export type {
  CategoryErrors,
  CategoryInput,
  ModifierErrors,
  ModifierInput,
  ProductErrors,
  ProductInput,
  ProductModifierErrors,
  ProductModifierInput,
};
