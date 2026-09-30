/**
 * @tepisawah/order — `qr` feature (Phase 6).
 *
 * Customer QR entry: resolves the printed table sticker through the
 * `resolve_table_qr()` projection and presents the ordering context. The
 * resolution is server-side; this feature holds no authorization
 * (AUTH_RBAC_RLS.md §18).
 *
 * Public API surface of the feature; deep internal imports are not allowed
 * (REPOSITORY_STRUCTURE.md §43).
 */
export { QrEntryPage } from "./qr-entry-page.js";
export { resolveQrEntry } from "./service.js";
export type { QrEntryError, QrEntryResult } from "./service.js";
