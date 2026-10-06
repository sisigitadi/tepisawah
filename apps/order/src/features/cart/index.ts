/**
 * @tepisawah/order — `cart` feature (Phase 4).
 *
 * The customer's basket: a map keyed by product id that the menu page's
 * steppers mutate, projected into the order domain's list vocabulary for
 * checkout. Money exists here only as display, read from the public catalog;
 * what leaves the feature is references and intent (API_CONTRACT.md §10.1).
 *
 * Public API surface of the feature; deep internal imports are not allowed
 * (REPOSITORY_STRUCTURE.md §43).
 */
export { CartDrawer } from "./cart-drawer.js";
export type { CartDrawerProps } from "./cart-drawer.js";
export { prepareCustomerNote } from "./cart-drawer.js";
export * from "./selectors.js";
export type {
  CartEntry,
  CartLine,
  CartLineView,
  CartMap,
  PublicCatalogModifier,
  PublicCatalogProduct,
} from "./types.js";
export { EMPTY_CART } from "./types.js";
