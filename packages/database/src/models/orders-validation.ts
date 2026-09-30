/**
 * Order validation predicates (Phase 8A).
 *
 * Input-shape checks that run before the RPC is called, so a malformed payload
 * is rejected without a round trip. These are UX/safety only — the real
 * authority is `create_draft_order()` server-side (MASTER prompt: frontend
 * permission hanya UX). No money value exists in the input to validate,
 * because the input type has no money field.
 */
import type {
  CreateDraftOrderInput,
  CustomerOrderInput,
  DraftOrderItemInput,
  OrderSource,
  OrderStatus,
  SubmitOrderInput,
  TransitionOrderInput,
} from "./orders-types.js";
import { ORDER_EXCEPTION_STATUSES, ORDER_SOURCES, ORDER_STATUSES } from "./orders-types.js";

export function isValidOrderStatus(value: string | null | undefined): value is OrderStatus {
  return value !== null && value !== undefined && (ORDER_STATUSES as readonly string[]).includes(value);
}

export function isValidOrderSource(value: string | null | undefined): value is OrderSource {
  return value !== null && value !== undefined && (ORDER_SOURCES as readonly string[]).includes(value);
}

/** Quantity must be positive and sane; the server re-checks this (§20 rules). */
export function isValidItemQuantity(value: number | null | undefined): boolean {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= 999
  );
}

export function isValidDraftItemInput(value: DraftOrderItemInput | null | undefined): boolean {
  if (!value) return false;
  if (typeof value.productId !== "string" || value.productId === "") return false;
  if (!isValidItemQuantity(value.quantity)) return false;
  if (value.modifierIds !== undefined && value.modifierIds !== null) {
    if (!Array.isArray(value.modifierIds)) return false;
    if (!value.modifierIds.every((id) => typeof id === "string" && id !== "")) {
      return false;
    }
  }
  if (value.notes !== undefined && value.notes !== null && typeof value.notes !== "string") {
    return false;
  }
  return true;
}

/**
 * Shape gate for the whole create payload. An empty item list is invalid: the
 * server refuses it too (API_CONTRACT.md test list, and an empty order is not
 * an order). A customer draft carries the customer note only; `internalNote`
 * is ignored for CUSTOMER_QR sources by the caller, not trusted to be absent.
 */
export function isValidCreateDraftOrderInput(value: CreateDraftOrderInput | null | undefined): boolean {
  if (!value) return false;
  if (!isValidOrderSource(value.source)) return false;
  if (typeof value.tableId !== "string" || value.tableId === "") return false;
  if (typeof value.tableSessionId !== "string" || value.tableSessionId === "") return false;
  if (!Array.isArray(value.items) || value.items.length === 0) return false;
  if (!value.items.every(isValidDraftItemInput)) return false;
  return true;
}

/**
 * Shape gate for the submit payload (API_CONTRACT.md §10.2).
 *
 * The customer path is anonymous, so the table context IS the credential: both
 * ids are required for the server to compare them against the order's own
 * (AUTH_RBAC_RLS.md §18, §30). A staff submit is authorized by its session
 * grant, so the context is optional at this layer — the server still re-checks
 * that the order's session is OPEN for every source.
 *
 * No money and no item list exist on the input, so there is nothing price-shaped
 * to validate here; the stale-price check is a server-side recalculation
 * (API_CONTRACT.md §27).
 */
export function isValidSubmitOrderInput(value: SubmitOrderInput | null | undefined): boolean {
  if (!value) return false;
  if (typeof value.orderId !== "string" || value.orderId === "") return false;
  if (!isValidOrderSource(value.source)) return false;
  if (value.source === "CUSTOMER_QR") {
    if (typeof value.tableId !== "string" || value.tableId === "") return false;
    if (typeof value.tableSessionId !== "string" || value.tableSessionId === "") return false;
  }
  return true;
}

/**
 * The states an exceptional transition may end in (API_CONTRACT.md §13:
 * "Every exceptional transition requires reason and audit"). The engine
 * requires a non-empty reason for each of these.
 */
export function isExceptionalTransitionTarget(
  value: string | null | undefined,
): boolean {
  return (
    value !== null &&
    value !== undefined &&
    (ORDER_EXCEPTION_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * Shape gate for the transition payload (API_CONTRACT.md §13).
 *
 * The target must be a state the machine knows; the reason is required here
 * *only* for the exceptional targets, mirroring the engine's own rule, so a
 * client cannot ship a cancel without one. Nothing here decides whether a
 * (from, to) pair is permitted — the server's rule table does (MASTER prompt:
 * do not duplicate state transition rules in frontend modules; this is a shape
 * check, not a state-machine re-implementation).
 */
export function isValidTransitionOrderInput(
  value: TransitionOrderInput | null | undefined,
): boolean {
  if (!value) return false;
  if (typeof value.orderId !== "string" || value.orderId === "") return false;
  if (!isValidOrderStatus(value.toStatus)) return false;
  if (
    isExceptionalTransitionTarget(value.toStatus) &&
    (value.reason === undefined ||
      value.reason === null ||
      value.reason.trim() === "")
  ) {
    return false;
  }
  if (
    value.expectedVersion !== undefined &&
    value.expectedVersion !== null &&
    (typeof value.expectedVersion !== "number" ||
      !Number.isInteger(value.expectedVersion) ||
      value.expectedVersion < 0)
  ) {
    return false;
  }
  return true;
}

/**
 * Deterministic fingerprint of a draft-order item list (Phase 8A HIGH-1 fix).
 *
 * Idempotency keys dedupe *requests*, not orders (API_CONTRACT.md §2.3): a
 * retried submit of the same basket must collapse to the first order, while a
 * different basket must never collide with it. Keying the request on the table
 * or the session alone breaks that — a second, different order at the same
 * table would silently get the first one back. Fingerprinting the content, and
 * pairing it with a caller-held attempt id, makes a retry reuse the key and a
 * new order get a fresh one.
 *
 * The fingerprint is order-independent of the array order only up to line order
 * — lines are deliberately kept in basket order, so two baskets built
 * identically look identical, which is exactly the property a retry needs.
 * Modifier ids are sorted within a line, so their order in the UI does not
 * matter. No money field is consulted: the fingerprint describes what the
 * customer *ordered*, and prices come from the server anyway.
 */
export function orderItemFingerprint(
  items: DraftOrderItemInput[] | null | undefined,
): string {
  if (!items || items.length === 0) return "empty";

  const lines = items.map((item) =>
    [
      item.productId,
      String(item.quantity),
      [...(item.modifierIds ?? [])].sort().join(","),
      item.notes?.trim() ?? "",
    ].join("|"),
  );

  return hash(lines.join(";"));
}

/**
 * Shape gate for the customer status lookup (API_CONTRACT.md §10.3).
 *
 * The anonymous path has no session grant, so the table context IS the
 * credential the RPC compares against the order's own
 * (AUTH_RBAC_RLS.md §18, §30): an order id on its own never reaches the
 * database. All three ids are required here so an incomplete request is
 * rejected without a round trip — the server re-checks every one of them
 * inside the SECURITY DEFINER frame.
 */
export function isValidCustomerOrderInput(
  value: CustomerOrderInput | null | undefined,
): boolean {
  if (!value) return false;
  if (typeof value.orderId !== "string" || value.orderId === "") return false;
  if (typeof value.tableId !== "string" || value.tableId === "") return false;
  if (typeof value.tableSessionId !== "string" || value.tableSessionId === "") return false;
  return true;
}

/**
 * Small deterministic hash (djb2) so the key stays short on the wire. The
 * fingerprint is a dedup handle, not a security primitive — the server's unique
 * index is what actually enforces dedup.
 */
function hash(value: string): string {
  let h = 5381;
  for (let index = 0; index < value.length; index += 1) {
    h = ((h << 5) + h + value.charCodeAt(index)) | 0;
  }
  return (h >>> 0).toString(36);
}
