/**
 * Manual order service (Phase 8A — API_CONTRACT.md §11.1).
 *
 * The staff half of draft order creation, mirroring the customer checkout on
 * the app/order side. The waiter picks a table (whose session must already be
 * OPEN), builds lines from the catalog, and submits them. What travels to the
 * backend: product ids, modifier ids, quantities, notes. What never travels:
 * a price, a subtotal, a total, a tax, a status — those fields do not exist on
 * the payload, so they cannot be tampered with
 * (MASTER prompt: jangan percaya price/subtotal/total/status dari client).
 *
 * The RPC `create_draft_order()` is SECURITY DEFINER and re-checks
 * `orders.create_manual` inside the transaction, so a waiter who lost the
 * grant between page load and submit is refused by the backend, not by this
 * file. `can()` below is UX only (AUTH_RBAC_RLS.md §2.2).
 */
import type {
  CreateDraftOrderInput,
  DraftOrder,
  PublicCatalogCategory,
  RestaurantTable,
  SubmitOrderInput,
  TableSession,
} from "@tepisawah/database";
import {
  createDraftOrder,
  fetchActiveTableSession,
  fetchPublicCatalog,
  fetchTables,
  groupCatalogByCategory,
  orderItemFingerprint,
  submitOrder,
} from "@tepisawah/database";

import { getSupabaseClient } from "../../lib/supabase.js";

/** A line the waiter is building. References and intent only — no money. */
export interface ManualOrderLine {
  productId: string;
  quantity: number;
  modifierIds?: string[];
  notes?: string | null;
}

export interface ManualOrderTablesResult {
  data: {
    tables: RestaurantTable[];
    /** Active (OPEN) session per table id; absent when the table has none. */
    sessions: Map<string, TableSession>;
  } | null;
  error: { message: string } | null;
}

export interface ManualOrderCatalogResult {
  data: PublicCatalogCategory[] | null;
  error: { message: string } | null;
}

export interface ManualOrderSubmitInput {
  tableId: string;
  tableSessionId: string;
  items: ManualOrderLine[];
  customerNote?: string | null;
  internalNote?: string | null;
  idempotencyKey?: string | null;
}

export interface ManualOrderResult {
  data: { order: DraftOrder } | null;
  error: { message: string } | null;
}

/**
 * The tables the waiter can serve, each with its active session resolved.
 *
 * Both reads are RLS-gated on `tables.read` / `table_sessions.read`; a waiter
 * without the grants gets an explicit failure, never a silent empty list.
 */
export async function loadManualOrderTables(): Promise<ManualOrderTablesResult> {
  const client = getSupabaseClient();

  const tablesResult = await fetchTables(client);
  if (tablesResult.error || !tablesResult.data) {
    return { data: null, error: { message: tablesResult.error?.message ?? "Daftar meja gagal dimuat." } };
  }

  const sessions = new Map<string, TableSession>();
  for (const table of tablesResult.data) {
    const active = await fetchActiveTableSession(client, table.id);
    if (active.error) {
      return { data: null, error: { message: active.error.message } };
    }
    if (active.data) sessions.set(table.id, active.data);
  }

  return { data: { tables: tablesResult.data, sessions }, error: null };
}

/** The orderable catalog, grouped by category. */
export async function loadManualOrderCatalog(): Promise<ManualOrderCatalogResult> {
  const result = await fetchPublicCatalog(getSupabaseClient());
  if (result.error || !result.data) {
    return { data: null, error: { message: result.error?.message ?? "Menu gagal dimuat." } };
  }
  return { data: groupCatalogByCategory(result.data), error: null };
}

/**
 * Compose the dedup key (Phase 8A HIGH-1 fix).
 *
 * An idempotency key dedupes *requests*, not orders (API_CONTRACT.md §2.3): a
 * retry of the same lines must collapse to the first order, but a *different*
 * set of lines must never come back as the first one. Keying the request on
 * the session or the line count alone breaks that — a second, different order
 * at the same table would silently get the first one back, and adding an item
 * would change the count while *removing* one and adding another might not.
 *
 * The key is the waiter's attempt id (stable across retries of one order,
 * fresh once they start the next) paired with a fingerprint of the lines. A
 * retry re-sends both, so it collapses; changed lines change the fingerprint,
 * so they are treated as a new request.
 */
export function manualOrderIdempotencyKey(
  attemptId: string,
  items: ManualOrderLine[],
): string {
  return `waiter-${attemptId}-${orderItemFingerprint(items)}`;
}

/**
 * A fresh attempt id for a caller that did not supply one.
 */
function newAttemptId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Submit the waiter's lines as a DRAFT order.
 *
 * The session id comes from the resolved active session, never from a URL or a
 * re-typed value. An idempotency key is generated per submit attempt when the
 * caller omits one, so a double-tap creates one order, not two.
 */
export async function submitManualOrder(
  input: ManualOrderSubmitInput,
): Promise<ManualOrderResult> {
  if (!input.tableId || !input.tableSessionId || input.items.length === 0) {
    return { data: null, error: { message: "Pesanan belum lengkap." } };
  }

  const payload: CreateDraftOrderInput = {
    source: "WAITER",
    tableId: input.tableId,
    tableSessionId: input.tableSessionId,
    items: input.items,
    customerNote: input.customerNote ?? null,
    internalNote: input.internalNote ?? null,
    idempotencyKey:
      input.idempotencyKey ?? manualOrderIdempotencyKey(newAttemptId(), input.items),
  };

  const result = await createDraftOrder(getSupabaseClient(), payload);
  if (result.error || !result.data) {
    return { data: null, error: { message: result.error?.message ?? "Pesanan gagal dibuat." } };
  }
  return { data: { order: result.data.order }, error: null };
}

/** Input for sending the waiter's draft to the kitchen. */
export interface SubmitManualOrderForConfirmationInput {
  orderId: string;
  /** Dedup key for the submit command itself. */
  idempotencyKey?: string | null;
}

/**
 * Compose the *submit* dedup key (Phase 8B).
 *
 * The submit command stores its own key (`submit_idempotency_key`), so a
 * double-tap on the send step collapses to the first PENDING_CONFIRMATION
 * result instead of re-running the transition (API_CONTRACT.md §2.3, §14). It
 * pairs the waiter's attempt id with the order id the create step returned: a
 * retry re-sends both and collapses, while any other order carries a different
 * id and gets its own key.
 */
export function manualOrderSubmitIdempotencyKey(
  attemptId: string,
  orderId: string,
): string {
  return `waiter-submit-${attemptId}-${orderId}`;
}

/**
 * Move a waiter draft to PENDING_CONFIRMATION (API_CONTRACT.md §11.2).
 *
 * A draft that was never sent is invisible to the cashier queue, which filters
   * on PENDING_CONFIRMATION (API_CONTRACT.md §12.1) — this step is what puts it
 * there. The command re-checks the waiter's `orders.create_manual` grant inside
 * its own transaction and re-derives the total from the live catalog, refusing
 * a stale price rather than charging one (API_CONTRACT.md §2.2, §27).
 *
 * The staff path is authorized by its session grant rather than a table
 * context, so no table ids are sent here — the server still re-validates that
 * the order's own session is OPEN (AUTH_RBAC_RLS.md §34).
 */
export async function submitManualOrderForConfirmation(
  input: SubmitManualOrderForConfirmationInput,
): Promise<ManualOrderResult> {
  if (!input.orderId) {
    return { data: null, error: { message: "Pesanan belum lengkap." } };
  }

  const payload: SubmitOrderInput = {
    source: "WAITER",
    orderId: input.orderId,
    idempotencyKey:
      input.idempotencyKey ??
      manualOrderSubmitIdempotencyKey(newAttemptId(), input.orderId),
  };

  const result = await submitOrder(getSupabaseClient(), payload);
  if (result.error || !result.data) {
    return { data: null, error: { message: result.error?.message ?? "Pesanan gagal dikirim." } };
  }
  return { data: { order: result.data.order }, error: null };
}
