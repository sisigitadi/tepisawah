/**
 * @tepisawah/order — `order-status` feature (Phase 8B).
 *
 * The customer's read of the order they placed (API_CONTRACT.md §10.3).
 * Anonymous customers have no read grant on `orders`, so the read goes through
 * the `get_customer_order()` SECURITY DEFINER projection, which re-validates the
 * table + OPEN session context against the order's own and returns only the
 * minimal, customer-safe projection — no idempotency keys, no staff actor, no
 * audit or payment data (AUTH_RBAC_RLS.md §18, §27, §30, §34).
 *
 * Public API surface of the feature; deep internal imports are not allowed
 * (REPOSITORY_STRUCTURE.md §43).
 */
export { OrderStatusPage } from "./order-status-page.js";
export {
  clearLastOrderId,
  fetchCustomerOrder,
  isOrderInProgress,
  isOrderSettled,
  labelForOrderStatus,
  readLastOrderId,
  saveLastOrderId,
} from "./service.js";
export type {
  OrderStatusError,
  OrderStatusLookup,
  OrderStatusResult,
} from "./service.js";
