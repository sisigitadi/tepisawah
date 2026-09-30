/**
 * @tepisawah/pos — payment queue service.
 *
 * The cashier terminal reads its queue straight from the database through the
 * `orders_staff_read` RLS policy (migration 008 part 1): an authenticated,
 * active staff session holding `orders.read` sees the operational orders. The
 * queue lists SERVED orders — food is with the guest, money is not — and
 * settlement moves one through the guarded `transition_order()` command,
 * which re-checks `payments.create` and the optimistic version server-side
 * (API_CONTRACT.md §13, §26). The browser never sends a status it invented
 * and never a price: the bill shown is the server's own frozen snapshot.
 */
import {
  fetchOrdersByStatuses,
  fetchPublicCatalog,
  transitionOrder,
  type DraftOrder,
  type OrdersQueryError,
  type OrdersQueryResult,
  type StaffOrder,
} from "@tepisawah/database";

import type { BillItem, QueueOrder } from "../data/terminal.js";
import { getSupabaseClient } from "./supabase.js";

export type { OrdersQueryError, OrdersQueryResult };

/** The only status a cashier acts on: SERVED waits for money, nothing else. */
const QUEUE_STATUSES = ["SERVED"] as const;

/** The cashier's queue: every SERVED order, oldest first, ready to settle. */
export async function loadPayQueue(): Promise<{
  orders: QueueOrder[];
  error: string | null;
}> {
  const [ordersResult, catalogResult] = await Promise.all([
    fetchOrdersByStatuses(getSupabaseClient(), QUEUE_STATUSES),
    // The catalog is anon-readable: it contributes only the food/drink label
    // per line, so its failure degrades the badge, not the queue.
    fetchPublicCatalog(getSupabaseClient()),
  ]);

  if (ordersResult.error) {
    return { orders: [], error: ordersResult.error.message };
  }

  const categoryOf = new Map<string, string>();
  for (const product of catalogResult.data ?? []) {
    categoryOf.set(product.productId, product.categoryName);
  }

  return {
    orders: (ordersResult.data ?? []).map((order) => toQueueOrder(order, categoryOf)),
    error: null,
  };
}

/** SERVED -> PAID (`payments.create`), guarded server-side. */
export function settleOrder(
  order: QueueOrder,
): Promise<OrdersQueryResult<{ order: DraftOrder }>> {
  if (!order.orderId) {
    return Promise.resolve({
      data: null,
      error: { message: "Order ini tidak terhubung ke database." },
    });
  }
  return transitionOrder(getSupabaseClient(), {
    orderId: order.orderId,
    toStatus: "PAID",
    expectedVersion: order.version ?? null,
  });
}

function categoryFor(
  productId: string | null,
  categoryOf: Map<string, string>,
): BillItem["category"] {
  const name = productId === null ? "" : (categoryOf.get(productId) ?? "");
  return /minuman/i.test(name) ? "MINUMAN" : "MAKANAN";
}

function toQueueOrder(
  order: StaffOrder,
  categoryOf: Map<string, string>,
): QueueOrder {
  return {
    // The selection/react key is the database id; the human handle is `ticket`.
    id: order.id,
    orderId: order.id,
    ticket: `#${order.orderNumber}`,
    table: order.tableName,
    area: order.tableCode,
    channel: order.source === "CUSTOMER_QR" ? "qr" : "waiter",
    status: "waiting",
    time: formatWibTime(order.createdAt),
    pax: 1,
    items: order.items.map((item) => ({
      id: item.id,
      name: item.name,
      category: categoryFor(item.productId, categoryOf),
      qty: item.quantity,
      price: item.unitPrice,
      note: item.notes ?? undefined,
      // A SERVED order's lines are with the guest by definition.
      station: "Sudah disajikan",
    })),
    // The receipt of record is the server's frozen snapshot (§27).
    bill: {
      subtotal: order.subtotal,
      discount: order.discount,
      tax: order.tax,
      total: order.total,
    },
    version: order.version,
  };
}

function formatWibTime(iso: string | null): string {
  if (iso === null) return "—";
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "—";
  return `${new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(then))} WIB`;
}
