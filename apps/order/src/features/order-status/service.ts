/**
 * Order status service (Phase 8B — API_CONTRACT.md §10.3).
 *
 * The customer's read of the order they placed. Anonymous customers hold no
 * read grant on `orders` at all (migration 008 part 1), so this goes through
 * the `get_customer_order()` SECURITY DEFINER projection, which re-validates
 * the table + OPEN session context against the order's own before projecting a
 * single column (AUTH_RBAC_RLS.md §18, §27, §30).
 *
 * The order id is not a credential (API_CONTRACT.md §30). This service never
 * looks one up without the table context the QR resolved — the two travel
 * together — so a customer who only knows an order number cannot read another
 * table's order. The server compares both ids against the order's own.
 *
 * What comes back is the minimal public projection: no idempotency keys, no
 * staff actor, no status history, no payment or audit data (§10.3 exclusions).
 * The service adds nothing to it — every money field the page renders is the
 * server's own snapshot value, never re-derived in the browser
 * (DATABASE_SCHEMA.md §21-§22).
 */
import {
  getCustomerOrder,
  ORDER_STATUSES,
  type CustomerOrder,
  type OrderStatus,
  type PublicTableResolve,
} from "@tepisawah/database";

import { getSupabaseClient } from "../../lib/supabase.js";

export interface OrderStatusError {
  message: string;
}

export interface OrderStatusResult {
  data: CustomerOrder | null;
  error: OrderStatusError | null;
}

/** The lookup the page performs: the order plus the context that authorizes it. */
export interface OrderStatusLookup {
  orderId: string;
  tableId: string;
  tableSessionId: string;
}

/**
 * Fetch the customer's order for status display.
 *
 * The resolved table context is the whole authorization for an anonymous
 * caller, so it is required here rather than defaulted — the request never
 * reaches the backend without it (AUTH_RBAC_RLS.md §18). An order that is not
 * this table's, in this OPEN session, resolves to an explicit "not found" and
 * the page says nothing about anyone else's order.
 */
export async function fetchCustomerOrder(
  input: OrderStatusLookup,
): Promise<OrderStatusResult> {
  if (!input.orderId || !input.tableId || !input.tableSessionId) {
    return { data: null, error: { message: "Pesanan belum lengkap." } };
  }

  const result = await getCustomerOrder(getSupabaseClient(), input);
  if (result.error || !result.data) {
    return {
      data: null,
      error: { message: result.error?.message ?? "Order tidak ditemukan." },
    };
  }
  return { data: result.data, error: null };
}

/**
 * Indonesian labels for the order state machine, for the customer's status
 * screen. The states come from the server (API_CONTRACT.md §13); an unknown
 * value is never widened into the vocabulary, it falls back to a neutral
 * label rather than being invented as something it is not.
 */
const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  DRAFT: "Draft pesanan",
  SUBMITTED: "Sedang dikirim ke dapur",
  PENDING_CONFIRMATION: "Menunggu konfirmasi kasir",
  CONFIRMED: "Pesanan dikonfirmasi",
  PREPARING: "Sedang dipersiapkan",
  READY: "Siap disajikan",
  SERVED: "Sudah disajikan",
  PAID: "Sudah dibayar",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
  REJECTED: "Ditolak",
  VOID: "Dibatalkan",
  REFUNDED: "Pembayaran dikembalikan",
};

export function labelForOrderStatus(status: OrderStatus): string {
  return ORDER_STATUS_LABELS[status] ?? "Status pesanan";
}

/** Statuses where the order is still moving toward the customer. */
export function isOrderInProgress(status: OrderStatus): boolean {
  return (
    status === "SUBMITTED" ||
    status === "PENDING_CONFIRMATION" ||
    status === "CONFIRMED" ||
    status === "PREPARING"
  );
}

/** Statuses the customer should see as finished, successfully or not. */
export function isOrderSettled(status: OrderStatus): boolean {
  return (
    status === "SERVED" ||
    status === "PAID" ||
    status === "COMPLETED" ||
    status === "CANCELLED" ||
    status === "REJECTED" ||
    status === "VOID" ||
    status === "REFUNDED"
  );
}

/**
 * Last-order persistence, scoped per table.
 *
 * A QR visit is one browser session, and the customer refreshes the tab or
 * re-scans the sticker to check on their order. Remembering the id they just
 * placed keeps the status page on screen across that refresh. The id is not a
 * secret and stores nothing the server does not re-validate: `get_customer_order()`
 * still compares it against the table + OPEN session, so a stale or borrowed id
 * resolves to nothing (API_CONTRACT.md §30).
 */
const LAST_ORDER_STORAGE_KEY = "tepisawah:last-order";

function storageFor(tableId: string): string {
  return `${LAST_ORDER_STORAGE_KEY}:${tableId}`;
}

/** True where sessionStorage is usable (a browser, not the test jsdom guard). */
function hasSessionStorage(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function saveLastOrderId(tableId: string, orderId: string): void {
  if (!hasSessionStorage() || !tableId || !orderId) return;
  window.sessionStorage.setItem(storageFor(tableId), orderId);
}

export function readLastOrderId(tableId: string): string | null {
  if (!hasSessionStorage() || !tableId) return null;
  return window.sessionStorage.getItem(storageFor(tableId));
}

export function clearLastOrderId(tableId: string): void {
  if (!hasSessionStorage() || !tableId) return;
  window.sessionStorage.removeItem(storageFor(tableId));
}

/** Re-export so the feature's own status vocabulary stays single-sourced. */
export { ORDER_STATUSES };
export type { CustomerOrder, OrderStatus, PublicTableResolve };
