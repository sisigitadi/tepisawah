/**
 * Catalog models (Phase 5): database row mappers.
 *
 * Mirrors migration `005_catalog` and docs/database/DATABASE_SCHEMA.md
 * §13-§16. Database snake_case rows are mapped to camelCase application
 * records; nullability is preserved so an unreadable column never degrades
 * into a fake value (a NULL price reads as 0, never as "free").
 *
 * Public/private boundary (AUTH_RBAC_RLS.md §17, §46): the admin records are
 * internal; {@link PublicCatalogProduct} is the only customer-safe projection
 * and mirrors the `public_catalog()` SQL function. An archived category,
 * archived product, or archived/detached modifier never reaches it — the
 * function applies those filters, and the mapper preserves them.
 */
import type {
  Category,
  Modifier,
  OrderItemSnapshot,
  Product,
  ProductModifier,
  PublicCatalogModifier,
  PublicCatalogProduct,
} from "./catalog-types.js";

export type {
  Category,
  CategoryErrors,
  CategoryInput,
  CatalogAuditEvent,
  CatalogEntity,
  Modifier,
  ModifierErrors,
  ModifierInput,
  OrderItemErrorCode,
  OrderItemSnapshot,
  Product,
  ProductErrors,
  ProductInput,
  ProductModifier,
  ProductModifierErrors,
  ProductModifierInput,
  PublicCatalogModifier,
  PublicCatalogProduct,
} from "./catalog-types.js";

/** Raw `select * from categories` shape. */
export interface CategoryRow {
  id: string | null;
  name: string | null;
  description: string | null;
  sort_order: number | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

/** Raw `select * from products` shape. */
export interface ProductRow {
  id: string | null;
  category_id: string | null;
  name: string | null;
  description: string | null;
  image_url: string | null;
  price: number | string | null;
  is_active: boolean | null;
  is_available: boolean | null;
  sort_order: number | null;
  created_at: string | null;
  updated_at: string | null;
}

/** Raw `select * from modifiers` shape. */
export interface ModifierRow {
  id: string | null;
  name: string | null;
  description: string | null;
  price_delta: number | string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

/** Raw `select * from product_modifiers` shape. */
export interface ProductModifierRow {
  product_id: string | null;
  modifier_id: string | null;
  is_required: boolean | null;
  min_select: number | null;
  max_select: number | null;
  sort_order: number | null;
  created_at: string | null;
}

/**
 * `numeric` arrives over JSON as a number or a string depending on driver
 * configuration. Parse defensively: a NULL or unparseable price becomes 0 and
 * is flagged for the caller by the query layer's null check, never silently
 * treated as "free".
 */
function toAmount(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function toCategory(row: CategoryRow): Category {
  return {
    id: row.id ?? "",
    name: row.name ?? "",
    description: row.description,
    sortOrder: row.sort_order ?? 0,
    isActive: row.is_active === true,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
  };
}

export function toProduct(row: ProductRow): Product {
  return {
    id: row.id ?? "",
    categoryId: row.category_id ?? "",
    name: row.name ?? "",
    description: row.description,
    imageUrl: row.image_url,
    price: toAmount(row.price),
    isActive: row.is_active === true,
    isAvailable: row.is_available === true,
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
  };
}

export function toModifier(row: ModifierRow): Modifier {
  return {
    id: row.id ?? "",
    name: row.name ?? "",
    description: row.description,
    priceDelta: toAmount(row.price_delta),
    isActive: row.is_active === true,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
  };
}

export function toProductModifier(row: ProductModifierRow): ProductModifier {
  return {
    productId: row.product_id ?? "",
    modifierId: row.modifier_id ?? "",
    isRequired: row.is_required === true,
    minSelect: row.min_select ?? 0,
    maxSelect: row.max_select ?? 1,
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at ?? "",
  };
}

/**
 * One modifier object from the `public_catalog()` JSONB column. Unknown or
 * malformed entries are dropped, and bounds fall back to a safe closed group
 * (min 0, max 1) so a corrupt payload can never widen what a customer may pick.
 */
export function toPublicCatalogModifier(value: unknown): PublicCatalogModifier | null {
  if (typeof value !== "object" || value === null) return null;
  const entry = value as Record<string, unknown>;
  const modifierId = entry["modifierId"];
  const name = entry["name"];
  if (typeof modifierId !== "string" || typeof name !== "string") return null;

  const minSelect = toInt(entry["minSelect"]);
  const maxSelect = toInt(entry["maxSelect"]);
  // A corrupt pair never widens the group: the maximum is raised to at least
  // the stated minimum (keeping the restrictive floor) and never above it.
  const resolvedMax = maxSelect < 1
    ? Math.max(1, minSelect)
    : maxSelect < minSelect
      ? minSelect
      : maxSelect;
  return {
    modifierId,
    name,
    priceDelta: toAmount(entry["priceDelta"] as number | string | null),
    isRequired: entry["isRequired"] === true,
    minSelect,
    maxSelect: resolvedMax,
    sortOrder: toInt(entry["sortOrder"]),
  };
}

function toInt(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) ? parsed : 0;
}

/**
 * Map the public projection. An unreadable product row is dropped (null) rather
 * than half-rendered: the customer catalog shows a whole product or nothing.
 */
export function toPublicCatalogProduct(row: PublicCatalogRow): PublicCatalogProduct | null {
  if (row.product_id === null || row.product_name === null) return null;
  if (row.price === null) return null;

  const modifiers = Array.isArray(row.modifiers)
    ? row.modifiers
        .map(toPublicCatalogModifier)
        .filter((entry): entry is PublicCatalogModifier => entry !== null)
    : [];

  return {
    categoryId: row.category_id ?? "",
    categoryName: row.category_name ?? "",
    categorySortOrder: row.category_sort ?? 0,
    productId: row.product_id,
    name: row.product_name,
    description: row.description,
    price: toAmount(row.price),
    imageUrl: row.image_url,
    isAvailable: row.is_available === true,
    sortOrder: row.product_sort ?? 0,
    modifiers,
  };
}

/** Raw `public_catalog()` RPC row shape. */
export interface PublicCatalogRow {
  category_id: string | null;
  category_name: string | null;
  category_sort: number | null;
  product_id: string | null;
  product_name: string | null;
  description: string | null;
  price: number | string | null;
  image_url: string | null;
  is_available: boolean | null;
  product_sort: number | null;
  modifiers: unknown[] | null;
}

/** Raw `resolve_order_item()` RPC row shape. */
export interface OrderItemSnapshotRow {
  product_id: string | null;
  product_name_snapshot: string | null;
  category_id: string | null;
  unit_price_snapshot: number | string | null;
  quantity: number | null;
  modifier_ids: string[] | null;
  modifier_names: string[] | null;
  modifier_deltas: (number | string)[] | null;
  modifiers_subtotal: number | string | null;
  subtotal: number | string | null;
}

/**
 * Map the order-item snapshot. Returns null when the database did not resolve a
 * usable item — the caller must treat that as an ordering failure, never as a
 * zero-priced line (API_CONTRACT.md §27).
 */
export function toOrderItemSnapshot(row: OrderItemSnapshotRow | null): OrderItemSnapshot | null {
  if (!row) return null;
  if (row.product_id === null || row.product_name_snapshot === null) return null;
  if (row.unit_price_snapshot === null || row.subtotal === null) return null;

  const quantities = row.quantity ?? 1;
  return {
    productId: row.product_id,
    productNameSnapshot: row.product_name_snapshot,
    categoryId: row.category_id ?? "",
    unitPriceSnapshot: toAmount(row.unit_price_snapshot),
    quantity: quantities,
    modifierIds: Array.isArray(row.modifier_ids) ? row.modifier_ids.filter((id) => typeof id === "string") : [],
    modifierNames: Array.isArray(row.modifier_names) ? row.modifier_names.filter((name) => typeof name === "string") : [],
    modifierDeltas: Array.isArray(row.modifier_deltas) ? row.modifier_deltas.map((d) => toAmount(d)) : [],
    modifiersSubtotal: toAmount(row.modifiers_subtotal),
    subtotal: toAmount(row.subtotal),
  };
}
