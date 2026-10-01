/**
 * @tepisawah/pos — `orders` feature.
 *
 * Cashier order handling: the confirmation queue between submit and the
 * kitchen. Reads ride the `orders_staff_read` RLS policy; commands are the
 * guarded `transition_order()` calls (API_CONTRACT.md §12.1, §13).
 *
 * Public API surface of the feature; deep internal imports are not allowed
 * (REPOSITORY_STRUCTURE.md §43).
 */
export { ConfirmQueuePage } from "./confirm-queue-page.js";
export {
  confirmOrder,
  loadConfirmationQueue,
  rejectOrder,
} from "./service.js";
export type { OrdersQueryError, OrdersQueryResult, StaffOrder } from "./service.js";
