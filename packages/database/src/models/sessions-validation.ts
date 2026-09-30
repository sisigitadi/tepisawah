/**
 * Table session validation predicates (Phase 7).
 *
 * Guard clauses the query layer runs before it touches the network, so a
 * malformed request degrades to field errors instead of a rejected SQL call
 * (AUTH_RBAC_RLS.md §47: validate before mutate). Status membership is the one
 * that matters most: an unknown status must never be forwarded to the database,
 * where the CHECK constraint would reject it anyway — but only after a
 * round trip. Tests for these predicates are the Phase 7 MEDIUM carry-over from
 * the catalog package (same rationale as TESTING_STRATEGY §3).
 */
import type { SessionStatus } from "./sessions-types.js";

export const SESSION_STATUSES: readonly SessionStatus[] = ["OPEN", "CLOSED"];

/** True when the value is one of the two documented statuses. */
export function isValidSessionStatus(value: string): value is SessionStatus {
  return (SESSION_STATUSES as readonly string[]).includes(value);
}

/** True while the session can still accept orders. */
export function isSessionOpen(status: string): boolean {
  return status === "OPEN";
}

/**
 * True when the attach payload has a session id, an order id and a non-blank
 * code. Order-code shape is owned by Phase 8 (`orders`), so this only checks
 * presence — the backend re-checks everything before it writes.
 */
export function isValidAttachOrderInput(input: {
  sessionId: string;
  orderId: string;
  orderCode: string;
}): boolean {
  return (
    input.sessionId.trim().length > 0 &&
    input.orderId.trim().length > 0 &&
    input.orderCode.trim().length > 0
  );
}
