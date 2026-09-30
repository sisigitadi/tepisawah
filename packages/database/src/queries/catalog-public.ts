/**
 * Catalog public queries (Phase 5).
 *
 * The customer-facing read paths. Both ride the RLS-enforced browser client and
 * hit the SECURITY DEFINER projections from migration 005 part 5, so anonymous
 * callers never receive a grant on `products`, `categories`, `modifiers` or
 * `product_modifiers` (AUTH_RBAC_RLS.md §17, §46). The projection applies every
 * filter that makes a menu item orderable; these helpers only map its rows.
 *
 * `resolveOrderItem` is the price-integrity seam (API_CONTRACT.md §27): the
 * caller sends only productId, quantity and modifierIds, and the database
 * returns the snapshot values order creation persists. A client can never put
 * a price into an order — it can only ask the server to compute one. It fails
 * closed: any error or unresolvable item is an ordering failure, never a
 * zero-priced line.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../generated/index.js";
import {
  toOrderItemSnapshot,
  toPublicCatalogProduct,
  type OrderItemSnapshot,
  type OrderItemSnapshotRow,
  type PublicCatalogProduct,
  type PublicCatalogRow,
} from "../models/index.js";

export interface CatalogPublicError {
  message: string;
  /** `resolve_order_item()` code, when the failure came from the database. */
  code?: string;
}

export interface CatalogPublicResult<T> {
  data: T | null;
  error: CatalogPublicError | null;
}

/** Generated `Database` is a placeholder until the Supabase CLI lands, so
 * `rpc(...)` is untyped for parameterized calls. Reads cast their rows the way
 * queries/settings.ts and queries/authorization.ts do. */
interface RpcFailure {
  message: string;
  code?: string;
}

interface RpcChain {
  maybeSingle: <T>() => Promise<{ data: T | null; error: RpcFailure | null }>;
  order: (column: string, options?: { ascending?: boolean }) => RpcListChain;
}

interface RpcListChain {
  data: unknown[] | null;
  error: RpcFailure | null;
}

function rpcClient(client: SupabaseClient<Database>): {
  rpc: (name: string, args?: Record<string, unknown>) => RpcChain;
} {
  return client as unknown as {
    rpc: (name: string, args?: Record<string, unknown>) => RpcChain;
  };
}

/**
 * The active customer menu, grouped by category. Fails to an empty array for
 * every unconfigured state — a restaurant with no active menu shows nothing,
 * never a broken or half-filtered menu. Anonymous-safe (API_CONTRACT.md §7).
 */
export async function fetchPublicCatalog(
  client: SupabaseClient<Database>,
): Promise<CatalogPublicResult<PublicCatalogProduct[]>> {
  const { data, error } = await rpcClient(client)
    .rpc("public_catalog")
    .order("category_sort", { ascending: true });

  if (error) return { data: null, error: { message: error.message } };

  const rows = (data ?? []) as unknown as PublicCatalogRow[];
  const products: PublicCatalogProduct[] = [];
  for (const row of rows) {
    const product = toPublicCatalogProduct(row);
    if (product) products.push(product);
  }
  return { data: products, error: null };
}

/**
 * Group the flat catalog projection into categories for menu rendering, in the
 * server-determined order. Categories whose products were all filtered out do
 * not appear — the customer never sees an empty section.
 */
export function groupCatalogByCategory(
  products: readonly PublicCatalogProduct[],
): PublicCatalogCategory[] {
  const byCategory = new Map<string, PublicCatalogCategory>();

  for (const product of products) {
    let category = byCategory.get(product.categoryId);
    if (!category) {
      category = {
        id: product.categoryId,
        name: product.categoryName,
        sortOrder: product.categorySortOrder,
        products: [],
      };
      byCategory.set(product.categoryId, category);
    }
    category.products.push(product);
  }

  return [...byCategory.values()].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.name.localeCompare(b.name, "id");
  });
}

export interface PublicCatalogCategory {
  id: string;
  name: string;
  sortOrder: number;
  products: PublicCatalogProduct[];
}

/**
 * Resolve one order item server-side: the authoritative names, prices, deltas
 * and subtotal for the snapshot (API_CONTRACT.md §27). Raises a typed error
 * (P0001-P0005) when the item is not orderable right now — archived product or
 * category, out of stock, unknown modifier, or violated selection bounds.
 */
export async function resolveOrderItem(
  client: SupabaseClient<Database>,
  productId: string,
  quantity: number,
  modifierIds: readonly string[] = [],
): Promise<CatalogPublicResult<OrderItemSnapshot>> {
  if (!productId) {
    return { data: null, error: { message: "Produk wajib dipilih.", code: "P0001" } };
  }

  const { data, error } = await rpcClient(client)
    .rpc("resolve_order_item", {
      p_product_id: productId,
      p_quantity: quantity,
      p_modifier_ids: [...modifierIds],
    })
    .maybeSingle<OrderItemSnapshotRow>();

  if (error) {
    return { data: null, error: { message: error.message, code: error.code } };
  }

  const snapshot = toOrderItemSnapshot(data);
  if (!snapshot) {
    return { data: null, error: { message: "Item tidak dapat diselesaikan.", code: "P0001" } };
  }
  return { data: snapshot, error: null };
}
