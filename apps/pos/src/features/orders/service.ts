/**
 * @tepisawah/pos — cashier confirmation service.
 *
 * The queue the cashier must act on: every PENDING_CONFIRMATION order, i.e.
 * one a customer or waiter just submitted and no staff member has confirmed
 * yet (API_CONTRACT.md §12.1 — the cashier queue filters on exactly this
 * status). Reads ride the `orders_staff_read` RLS policy through the shared
 * `fetchOrdersByStatuses` helper; the two commands are single guarded
 * `transition_order()` calls — the server derives the actor, checks
 * `orders.confirm` / `orders.reject`, and writes the audit history
 * (API_CONTRACT.md §13, §26).
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

/** The only status awaiting a cashier decision. */
const QUEUE_STATUSES = ["PENDING_CONFIRMATION"] as const;

/** The confirmation queue: every PENDING_CONFIRMATION order, oldest first. */
export function loadConfirmationQueue(): Promise<OrdersQueryResult<StaffOrder[]>> {
  return fetchOrdersByStatuses(getSupabaseClient(), QUEUE_STATUSES);
}

/** PENDING_CONFIRMATION -> CONFIRMED (`orders.confirm`), guarded server-side. */
export function confirmOrder(
  order: StaffOrder,
): Promise<OrdersQueryResult<{ order: DraftOrder }>> {
  return transitionOrder(getSupabaseClient(), {
    orderId: order.id,
    toStatus: "CONFIRMED",
    expectedVersion: order.version,
  });
}

/** PENDING_CONFIRMATION -> REJECTED (`orders.reject`), guarded server-side. */
export function rejectOrder(
  order: StaffOrder,
  reason: string,
): Promise<OrdersQueryResult<{ order: DraftOrder }>> {
  return transitionOrder(getSupabaseClient(), {
    orderId: order.id,
    toStatus: "REJECTED",
    reason,
    expectedVersion: order.version,
  });
}
