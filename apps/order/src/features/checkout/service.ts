/**
 * Checkout service (Phase 8A — API_CONTRACT.md §10.1).
 *
 * The customer half of order creation. The cart has already been built from the
 * resolved table context; this turns it into a DRAFT order through
 * `create_draft_order()`.
 *
 * What the customer sends: product ids, modifier ids, quantities, notes. What
 * it never sends: a price, a subtotal, a total, a tax, a status. Those do not
 * exist on `CreateDraftOrderInput`, so they cannot exist on the wire either —
 * the server prices everything from the catalog inside the transaction
 * (MASTER prompt: jangan percaya price/subtotal/total/status dari client).
 *
 * The table context is the authorization anchor for an anonymous customer
 * (AUTH_RBAC_RLS.md §18): the resolved session is the handle the order joins,
 * and the RPC re-validates that the session is OPEN and belongs to this table
 * before writing. This service never trusts a table id the customer did not
 * resolve from the QR.
 */
import {
  createDraftOrder,
  orderItemFingerprint,
  submitOrder,
  type CreateDraftOrderInput,
  type DraftOrder,
  type SubmitOrderInput,
} from "@tepisawah/database";
import type { CartLine as OrderCartLine } from "@tepisawah/orders";

import { getSupabaseClient } from "../../lib/supabase.js";

export interface CheckoutError {
  message: string;
}

export interface CheckoutResult {
  data: { order: DraftOrder } | null;
  error: CheckoutError | null;
}

/**
 * The cart line the checkout page builds: the order domain's intent-only
 * `CartLine` (@tepisawah/orders) plus a display-only catalog label. Note the
 * absence of any money field, which is the whole point of this phase — the
 * domain line cannot carry one, so neither can this; `name` never reaches the
 * wire because the RPC arg builder whitelists fields.
 */
export interface CartLine extends OrderCartLine {
  /** Display-only: the line's catalog label, so the review list is readable. */
  name?: string;
}

export interface SubmitDraftOrderInput {
  tableId: string;
  tableSessionId: string;
  items: CartLine[];
  customerNote?: string | null;
  /** Dedup key so a double-tap or a flaky network creates one order, not two. */
  idempotencyKey?: string | null;
}

/**
 * Compose the dedup key (Phase 8A HIGH-1 fix).
 *
 * An idempotency key dedupes *requests*, not orders (API_CONTRACT.md §2.3): a
 * retry of the same basket must collapse to the first order, but a *different*
 * basket must never come back as the first one. Keying the request on the
 * table or the session alone breaks that — a second, different order at the
 * same table would silently get the first one back.
 *
 * The key is the caller's attempt id (stable across retries of one checkout,
 * fresh for the next one) paired with a fingerprint of the basket contents. A
 * retry re-sends both, so it collapses; a changed basket changes the
 * fingerprint, so it is treated as a new request.
 */
export function checkoutIdempotencyKey(
  attemptId: string,
  items: CartLine[],
): string {
  return `checkout-${attemptId}-${orderItemFingerprint(items)}`;
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
 * Compose the *submit* dedup key (Phase 8B).
 *
 * The submit command is a separate request with its own key
 * (`submit_idempotency_key`), so a double-tap on the second button collapses to
 * the first PENDING_CONFIRMATION result rather than re-running the transition
 * (API_CONTRACT.md §2.3, §14). It pairs the same attempt id with the order id
 * the create step returned: a retry of one submit re-sends both and collapses,
 * while a *different* order — including a second, different order at the same
 * table — carries a different order id and so gets its own key
 * (AUTH_RBAC_RLS.md §18: the table context is the credential, not a dedup
 * scope).
 */
export function checkoutSubmitIdempotencyKey(
  attemptId: string,
  orderId: string,
): string {
  return `checkout-submit-${attemptId}-${orderId}`;
}

/**
 * Submit the customer's cart as a DRAFT order.
 *
 * The caller passes the resolved table context, never a re-typed URL value. The
 * idempotency key is generated here when omitted, so a page that forgets to set
 * one still gets exactly-once submission per submit button press.
 */
export async function submitDraftOrder(
  input: SubmitDraftOrderInput,
): Promise<CheckoutResult> {
  if (!input.tableId || !input.tableSessionId || input.items.length === 0) {
    return { data: null, error: { message: "Pesanan belum lengkap." } };
  }

  const payload: CreateDraftOrderInput = {
    source: "CUSTOMER_QR",
    tableId: input.tableId,
    tableSessionId: input.tableSessionId,
    items: input.items,
    customerNote: input.customerNote ?? null,
    idempotencyKey:
      input.idempotencyKey ?? checkoutIdempotencyKey(newAttemptId(), input.items),
  };

  const result = await createDraftOrder(getSupabaseClient(), payload);
  if (result.error || !result.data) {
    return { data: null, error: { message: result.error?.message ?? "Pesanan gagal dibuat." } };
  }
  return { data: { order: result.data.order }, error: null };
}

/** Input for the second half of the checkout: sending the draft to the kitchen. */
export interface SubmitDraftOrderForConfirmationInput {
  orderId: string;
  tableId: string;
  tableSessionId: string;
  /** Dedup key for the submit command itself. */
  idempotencyKey?: string | null;
}

/**
 * Move a customer draft to PENDING_CONFIRMATION (API_CONTRACT.md §10.2).
 *
 * This is the step the cashier queue actually waits on: the order is not in the
 * queue while it is a DRAFT, so a checkout that stops at the create step leaves
 * the kitchen blind. The command is a single server-side transaction that
 * re-validates the table context, re-derives the total from the live catalog,
 * and refuses a stale price — the customer's browser is never trusted with a
 * status or a price (API_CONTRACT.md §2.2, §27).
 *
 * The anonymous path has no session grant to fall back on, so the table context
 * is required here and is re-checked against the order's own
 * (AUTH_RBAC_RLS.md §18, §30).
 */
export async function submitDraftOrderForConfirmation(
  input: SubmitDraftOrderForConfirmationInput,
): Promise<CheckoutResult> {
  if (!input.orderId || !input.tableId || !input.tableSessionId) {
    return { data: null, error: { message: "Pesanan belum lengkap." } };
  }

  const payload: SubmitOrderInput = {
    source: "CUSTOMER_QR",
    orderId: input.orderId,
    tableId: input.tableId,
    tableSessionId: input.tableSessionId,
    idempotencyKey: input.idempotencyKey ?? null,
  };

  const result = await submitOrder(getSupabaseClient(), payload);
  if (result.error || !result.data) {
    return { data: null, error: { message: result.error?.message ?? "Pesanan gagal dikirim." } };
  }
  return { data: { order: result.data.order }, error: null };
}
