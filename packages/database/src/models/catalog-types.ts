/**
 * Catalog (menu) type contracts (Phase 5).
 *
 * Canonical field lists come from docs/database/DATABASE_SCHEMA.md §13-§16 and
 * docs/api/API_CONTRACT.md §7.1-§7.3. Prices are carried as rupiah major units
 * matching the `numeric(12,2)` columns and the API payload (`"price": 45000`),
 * never as client-supplied values (API_CONTRACT.md §27 — the client is never
 * the source of a price).
 *
 * Nothing outside the Phase 5 scope is modelled here: no inventory, no recipe,
 * no supplier, no accounting (CLINE_IMPLEMENTATION_PLAN.md §11).
 */

/** Admin record for `categories` (internal; the public flow never reads it). */
export interface Category {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Admin record for `products`. */
export interface Product {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  /** Rupiah major units, as stored in `products.price`. */
  price: number;
  /** Catalog visibility: false leaves every catalog read permanently. */
  isActive: boolean;
  /** Temporary out-of-stock switch: stays visible but not orderable. */
  isAvailable: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** Admin record for `modifiers`. */
export interface Modifier {
  id: string;
  name: string;
  description: string | null;
  /** Signed rupiah major units; may be negative or zero. */
  priceDelta: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Admin record for one `product_modifiers` link. The pair is the primary key,
 * so a modifier is attached to a product at most once.
 */
export interface ProductModifier {
  productId: string;
  modifierId: string;
  isRequired: boolean;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
  createdAt: string;
}

/**
 * Client-writable category patch. The id and timestamps are never accepted from
 * a client; the RLS column GRANT in migration 005 part 1 mirrors this exactly.
 */
export interface CategoryInput {
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
}

/** Client-writable product patch. `price` is accepted only from authorized
 * staff; it is never taken from a customer (API_CONTRACT.md §27). */
export interface ProductInput {
  categoryId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  isActive: boolean;
  isAvailable: boolean;
  sortOrder: number;
}

/** Client-writable modifier patch. */
export interface ModifierInput {
  name: string;
  description: string | null;
  priceDelta: number;
  isActive: boolean;
}

/** Client-writable product-modifier link patch. */
export interface ProductModifierInput {
  productId: string;
  modifierId: string;
  isRequired: boolean;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
}

/** Field-keyed validation errors; an empty object means valid. */
export type CategoryErrors = Partial<Record<keyof CategoryInput, string>>;

export type ProductErrors = Partial<Record<keyof ProductInput, string>>;

export type ModifierErrors = Partial<Record<keyof ModifierInput, string>>;

export type ProductModifierErrors = Partial<Record<keyof ProductModifierInput, string>>;

/**
 * One orderable modifier inside the public projection
 * (`public_catalog()` in migration 005 part 5).
 */
export interface PublicCatalogModifier {
  modifierId: string;
  name: string;
  /** Rupiah major units added to (or subtracted from) the product price. */
  priceDelta: number;
  isRequired: boolean;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
}

/**
 * One product in the public projection. The customer sees only active
 * categories and their active products; an unavailable product is still present
 * with `isAvailable: false` so the UI can mark it out of stock.
 */
export interface PublicCatalogProduct {
  categoryId: string;
  categoryName: string;
  categorySortOrder: number;
  productId: string;
  name: string;
  description: string | null;
  /** Rupiah major units — the current catalog price the customer pays. */
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  sortOrder: number;
  modifiers: PublicCatalogModifier[];
}

/**
 * Snapshot of one order item as computed by the server
 * (`resolve_order_item()` in migration 005 part 5, API_CONTRACT.md §27).
 *
 * Every price, name and delta here is read from the catalog by the database; a
 * client may only request `productId`, `quantity` and `modifierIds`. This is
 * what order creation persists so later catalog changes never rewrite history.
 */
export interface OrderItemSnapshot {
  productId: string;
  productNameSnapshot: string;
  categoryId: string;
  unitPriceSnapshot: number;
  quantity: number;
  modifierIds: string[];
  modifierNames: string[];
  modifierDeltas: number[];
  modifiersSubtotal: number;
  subtotal: number;
}

/** Catalog error code raised by `resolve_order_item()`. */
export type OrderItemErrorCode =
  | "P0001"
  | "P0002"
  | "P0003"
  | "P0004"
  | "P0005";

/** A catalog write, for the audit descriptor below. */
export type CatalogEntity = "category" | "product" | "modifier" | "product_modifier";

/** Audit descriptor for one catalog change (AUTH_RBAC_RLS.md §39-§40). */
export interface CatalogAuditEvent {
  entity: CatalogEntity;
  /** "create" | "update" | "archive" | "restore" | "link" | "unlink" */
  action: string;
  /** Id of the affected row, or the product id for a product_modifier link. */
  entityId: string;
  /** Human-readable name for the audit trail. */
  label: string;
  changedFields: string[];
}
