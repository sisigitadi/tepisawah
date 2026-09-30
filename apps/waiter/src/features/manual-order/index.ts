/**
 * @tepisawah/waiter — `manual-order` feature (Phase 8A).
 *
 * Waiter draft order creation (API_CONTRACT.md §11.1). The waiter sends product
 * and modifier references, quantities and notes; prices and totals are computed
 * server-side inside `create_draft_order()`, so no money ever travels from the
 * browser (API_CONTRACT.md §2.2).
 *
 * Public API surface of the feature; deep internal imports are not allowed
 * (REPOSITORY_STRUCTURE.md §43).
 */
export { ManualOrderPage } from "./manual-order-page.js";
export { useManualOrder } from "./use-manual-order.js";
export {
  loadManualOrderCatalog,
  loadManualOrderTables,
  submitManualOrder,
} from "./service.js";
export type {
  ManualOrderCatalogResult,
  ManualOrderLine,
  ManualOrderResult,
  ManualOrderSubmitInput,
  ManualOrderTablesResult,
} from "./service.js";
