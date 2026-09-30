/**
 * @tepisawah/admin — `catalog` feature (Phase 5).
 *
 * Admin management of the centralized menu source of truth: categories,
 * products, modifiers and their links. Reads and writes ride the RLS-enforced
 * browser client via `./service.js`; the permission checks in the UI are UX-only
 * (AUTH_RBAC_RLS.md §47).
 *
 * Public API surface of the feature; deep internal imports are not allowed
 * (REPOSITORY_STRUCTURE.md §43).
 */
export { CatalogPage } from "./catalog-page.js";
