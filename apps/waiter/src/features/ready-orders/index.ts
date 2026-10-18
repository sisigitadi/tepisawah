/**
 * @tepisawah/waiter — `ready-orders` feature.
 *
 * The "Siap Saji" board: orders straight from the database, and
 * the serve action as one guarded `transition_order()` command.
 */
export {
  loadReadyOrders,
  serveOrder,
  startCookingOrder,
  markOrderReady,
} from "./service.js";
export type { OrdersQueryError, OrdersQueryResult, StaffOrder } from "./service.js";
