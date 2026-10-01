/**
 * @tepisawah/waiter — `ready-orders` feature.
 *
 * The "Siap Saji" board: every READY order straight from the database, and
 * the serve action (READY -> SERVED under `orders.serve`) as one guarded
 * `transition_order()` command (API_CONTRACT.md §13, §26).
 *
 * Public API surface of the feature; deep internal imports are not allowed
 * (REPOSITORY_STRUCTURE.md §43).
 */
export { loadReadyOrders, serveOrder } from "./service.js";
export type { OrdersQueryError, OrdersQueryResult, StaffOrder } from "./service.js";
