/**
 * @tepisawah/waiter — ready-to-serve board service.
 *
 * The "Siap Saji" tab reads its cards straight from the database through the
 * `orders_staff_read` RLS policy (migration 008 part 1):
 * - If kitchen KDS is active: every READY order plated in the kitchen.
 * - If kitchen KDS is disabled: active orders (CONFIRMED, PREPARING, READY)
 *   so waiters can track cooking or directly serve food to guests.
 * Serving is one guarded `transition_order()` command.
 */
import {
  fetchOrdersByStatuses,
  transitionOrder,
  type DraftOrder,
  type OrdersQueryError,
  type OrdersQueryResult,
  type StaffOrder,
} from "@tepisawah/database";
import { loadOrderFlowSettings } from "@tepisawah/config";

import { getSupabaseClient } from "../../lib/supabase.js";

export type { OrdersQueryError, OrdersQueryResult, StaffOrder };

/**
 * Memuat pesanan untuk papan siap saji / dapur pramusaji.
 * Jika modul dapur aktif: memuat pesanan READY dari KDS.
 * Jika modul dapur nonaktif: memuat pesanan CONFIRMED, PREPARING, dan READY agar pramusaji
 * dapat memonitor proses memasak dan langsung mengantar ke tamu.
 */
export function loadReadyOrders(): Promise<OrdersQueryResult<StaffOrder[]>> {
  const settings = loadOrderFlowSettings();
  if (settings.kitchenEnabled) {
    return fetchOrdersByStatuses(getSupabaseClient(), ["READY"]);
  }

  if (settings.kitchenBypassMode === "manual_cook_serve") {
    return fetchOrdersByStatuses(getSupabaseClient(), ["CONFIRMED", "PREPARING", "READY"]);
  }

  return fetchOrdersByStatuses(getSupabaseClient(), ["CONFIRMED", "READY"]);
}

/** Transisi ke status SERVED (`orders.serve`), berlaku dari READY, PREPARING, atau CONFIRMED. */
export function serveOrder(
  order: StaffOrder,
): Promise<OrdersQueryResult<{ order: DraftOrder }>> {
  return transitionOrder(getSupabaseClient(), {
    orderId: order.id,
    toStatus: "SERVED",
    expectedVersion: order.version,
  });
}

/** Mulai memasak: CONFIRMED -> PREPARING (`kitchen.start`) */
export function startCookingOrder(
  order: StaffOrder,
): Promise<OrdersQueryResult<{ order: DraftOrder }>> {
  return transitionOrder(getSupabaseClient(), {
    orderId: order.id,
    toStatus: "PREPARING",
    expectedVersion: order.version,
  });
}

/** Selesai memasak: PREPARING -> READY (`kitchen.ready`) */
export function markOrderReady(
  order: StaffOrder,
): Promise<OrdersQueryResult<{ order: DraftOrder }>> {
  return transitionOrder(getSupabaseClient(), {
    orderId: order.id,
    toStatus: "READY",
    expectedVersion: order.version,
  });
}
