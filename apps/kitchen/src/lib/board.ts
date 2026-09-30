/**
 * @tepisawah/kitchen — live board service.
 *
 * The KDS reads its tickets straight from the database through the
 * `orders_staff_read` RLS policy (migration 008 part 1): an authenticated,
 * active staff session holding `orders.read` sees the operational orders, and
 * the item rows inherit that visibility (AUTH_RBAC_RLS.md §28). Status moves
 * ride the single guarded command `transition_order()` — the server derives
 * the actor, checks `kitchen.start` / `kitchen.ready`, verifies the version
 * the board rendered and writes the audit history (API_CONTRACT.md §13, §26).
 *
 * No fixture, no second source of truth: what the kitchen sees is what the
 * customer ordered, priced and snapshotted server-side.
 */
import {
  fetchOrdersByStatuses,
  transitionOrder,
  type DraftOrder,
  type OrdersQueryError,
  type OrdersQueryResult,
  type StaffOrder,
} from "@tepisawah/database";

import { getSupabaseClient } from "./supabase.js";

export type {
  DraftOrder,
  OrdersQueryError,
  OrdersQueryResult,
  StaffOrder,
};

/** The statuses the KDS displays; SERVED leaves the board (waiter took it). */
export const BOARD_STATUSES = ["CONFIRMED", "PREPARING", "READY"] as const;

/** Every ticket on the board right now, oldest first. */
export function loadBoard(): Promise<OrdersQueryResult<StaffOrder[]>> {
  return fetchOrdersByStatuses(getSupabaseClient(), BOARD_STATUSES);
}

/** CONFIRMED -> PREPARING (`kitchen.start`), guarded server-side. */
export function startCooking(
  order: StaffOrder,
): Promise<OrdersQueryResult<{ order: DraftOrder }>> {
  return transitionOrder(getSupabaseClient(), {
    orderId: order.id,
    toStatus: "PREPARING",
    expectedVersion: order.version,
  });
}

/** PREPARING -> READY (`kitchen.ready`), guarded server-side. */
export function markReady(
  order: StaffOrder,
): Promise<OrdersQueryResult<{ order: DraftOrder }>> {
  return transitionOrder(getSupabaseClient(), {
    orderId: order.id,
    toStatus: "READY",
    expectedVersion: order.version,
  });
}
