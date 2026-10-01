/**
 * @tepisawah/waiter — ready-to-serve board service.
 *
 * The "Siap Saji" tab reads its cards straight from the database through the
 * `orders_staff_read` RLS policy (migration 008 part 1): every READY order is
 * plated in the kitchen and waiting for a waiter to carry it out. Serving is
 * one guarded `transition_order()` command — READY -> SERVED under
 * `orders.serve` — with the optimistic version the card rendered
 * (API_CONTRACT.md §13, §26; the transition engine maps this hop onto
 * `orders.serve` per AUTH_RBAC_RLS.md §9).
 *
 * No fixture, no second source of truth: what the waiter sees is exactly what
 * the kitchen marked ready.
 */
import {
  fetchOrdersByStatuses,
  transitionOrder,
  type DraftOrder,
  type OrdersQueryError,
  type OrdersQueryResult,
  type StaffOrder,
} from "@tepisawah/database";

import { getSupabaseClient } from "../../lib/supabase.js";

export type { OrdersQueryError, OrdersQueryResult, StaffOrder };

/** The only status the waiter acts on: plated, not yet carried out. */
const BOARD_STATUSES = ["READY"] as const;

/** Every READY order, oldest first — longest wait served first. */
export function loadReadyOrders(): Promise<OrdersQueryResult<StaffOrder[]>> {
  return fetchOrdersByStatuses(getSupabaseClient(), BOARD_STATUSES);
}

/** READY -> SERVED (`orders.serve`), guarded server-side. */
export function serveOrder(
  order: StaffOrder,
): Promise<OrdersQueryResult<{ order: DraftOrder }>> {
  return transitionOrder(getSupabaseClient(), {
    orderId: order.id,
    toStatus: "SERVED",
    expectedVersion: order.version,
  });
}
