/**
 * Catalog API contract surface.
 *
 * Read paths are served directly from Postgres through the `public_catalog()`
 * projection (migration 005 part 5), which applies every filter that makes a
 * menu item orderable: archived categories and products never reach a customer,
 * and unavailable products surface with `isAvailable: false` so the UI can mark
 * them out of stock (API_CONTRACT.md §7.1-§7.3).
 *
 * Writes go through the admin command layer and are exercised through
 * `@tepisawah/database` query helpers; they are deliberately not part of this
 * read-only contract surface.
 */
import type { Menu, MenuItem } from "./types.js";

export interface CatalogApi {
  /** The whole active menu, grouped by category in server order. */
  readMenu(): Promise<Menu>;

  /** Flat product list, optionally narrowed to one category (§7.2). */
  listProducts(categoryId?: string): Promise<MenuItem[]>;

  /** One product with its modifier groups (§7.3). Null when not orderable. */
  readProduct(productId: string): Promise<MenuItem | null>;
}

/**
 * Not wired here: this package is contract-only, so apps bind a concrete
 * adapter to {@link CatalogApi}. The reference binding lives in the apps that
 * need the menu and delegates to `fetchPublicCatalog` / `groupCatalogByCategory`
 * from `@tepisawah/database`, which ride the RLS-enforced browser client.
 */
export const catalogApi: CatalogApi = {
  async readMenu() {
    throw new Error("catalogApi.readMenu: bind an adapter (Phase 5)");
  },
  async listProducts() {
    throw new Error("catalogApi.listProducts: bind an adapter (Phase 5)");
  },
  async readProduct() {
    throw new Error("catalogApi.readProduct: bind an adapter (Phase 5)");
  },
};
