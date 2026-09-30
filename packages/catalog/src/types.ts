/**
 * Catalog (menu) domain types: categories, products and modifiers.
 *
 * Contract types only — no business logic (REPOSITORY_STRUCTURE.md §34). Shapes
 * follow the public read contract in API_CONTRACT.md §7.1-§7.3 and the
 * `public_catalog()` projection in migration 005 part 5, so an app maps a
 * database row onto these types without lossy conversion.
 *
 * Prices are carried as rupiah major units matching `products.price`
 * (`numeric(12,2)`) and the API payload (`"price": 45000`). The client is never
 * the source of a price (API_CONTRACT.md §27): the customer order flow receives
 * its prices from `resolve_order_item()`, never from these types alone.
 */
import type { ID, ISODateString } from "@tepisawah/types";

/** One modifier group attached to a product in the public catalog. */
export interface MenuModifier {
  modifierId: ID;
  name: string;
  /** Signed rupiah major units added to (or subtracted from) the product price. */
  priceDelta: number;
  isRequired: boolean;
  /** Minimum selections a customer must pick in this group. */
  minSelect: number;
  /** Maximum selections a customer may pick in this group. */
  maxSelect: number;
  sortOrder: number;
}

/** One product in the customer-facing catalog (API_CONTRACT.md §7.2). */
export interface MenuItem {
  id: ID;
  categoryId: ID;
  name: string;
  description?: string | null;
  /** Current catalog price in rupiah major units. */
  price: number;
  imageUrl?: string | null;
  /** False marks the product out of stock: still visible, not orderable. */
  isAvailable: boolean;
  sortOrder: number;
  modifiers: MenuModifier[];
}

/** A category with the products the customer may order from it. */
export interface MenuCategory {
  id: ID;
  name: string;
  sortOrder: number;
  products: MenuItem[];
}

/**
 * The whole public menu, grouped by category in the server-determined order.
 * Categories whose products were all filtered out do not appear.
 */
export type Menu = MenuCategory[];

/** Admin-facing category record (never part of the public read path). */
export interface AdminCategory {
  id: ID;
  name: string;
  description?: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** Admin-facing product record. */
export interface AdminProduct {
  id: ID;
  categoryId: ID;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  price: number;
  /** Catalog visibility: false removes the product from every catalog read. */
  isActive: boolean;
  isAvailable: boolean;
  sortOrder: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** Admin-facing modifier record. */
export interface AdminModifier {
  id: ID;
  name: string;
  description?: string | null;
  priceDelta: number;
  isActive: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
