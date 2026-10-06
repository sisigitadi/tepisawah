/**
 * @tepisawah/order — `cart` feature types.
 *
 * The customer's basket is held as a map keyed by product id (one entry per
 * product, its quantity folded into that entry), because that is the shape the
 * menu page's +/- steppers mutate. The order domain's list vocabulary
 * (`CartLine` from `@tepisawah/orders`) is what the basket is projected into
 * for checkout, so the map is a UI concern and the domain stays list-shaped
 * (REPOSITORY_STRUCTURE.md §34).
 */
import type { CartLine, CartLineView } from "@tepisawah/orders";
import type {
  PublicCatalogModifier,
  PublicCatalogProduct,
} from "@tepisawah/database";

/**
 * One product's mutable basket state: how many the customer wants, which
 * required modifiers they chose on the card, and the note they attached.
 */
export interface CartEntry {
  quantity: number;
  modifierIds: string[];
  notes: string | null;
}

/** The basket map the menu page edits and the router persists across views. */
export type CartMap = Record<string, CartEntry>;

/** An empty basket, shared so no caller rebuilds it. */
export const EMPTY_CART: CartMap = {};

/** The display-ready basket line, resolved against the live catalog. */
export type { CartLine, CartLineView };

/** The catalog projection the cart resolves against. */
export type { PublicCatalogModifier, PublicCatalogProduct };
