/**
 * @tepisawah/admin — `tables` feature (Phase 6).
 *
 * Admin management of the floor: tables, their operational status and their
 * printed QR. Reads and writes ride the RLS-enforced browser client via
 * `./service.js`; the permission checks in the UI are UX-only
 * (AUTH_RBAC_RLS.md §47).
 *
 * Public API surface of the feature; deep internal imports are not allowed
 * (REPOSITORY_STRUCTURE.md §43).
 */
export { TablesPage } from "./tables-page.js";
