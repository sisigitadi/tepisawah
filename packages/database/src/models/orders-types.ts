/**
 * Order type contracts (Phase 8A: draft order creation).
 *
 * Canonical field lists come from docs/database/DATABASE_SCHEMA.md §20 (orders),
 * §21 (order_items), §22 (order_item_modifiers), and docs/api/API_CONTRACT.md
 * §10.1 (Create Draft Order) / §11.1 (Create Waiter Order).
 *
 * THE CREATE CONTRACT (API_CONTRACT.md §10.1): the client sends only
 * references and intent — product/modifier ids, quantity, notes, source, and
 * the table context. It never sends money and never sends status. The
 * `CreateDraftOrderInput` type below is the exhaustive list of what a client is
 * permitted to supply; there is deliberately no `subtotal`, `total`, `tax`,
 * `discount` or `status` field on it. `create_draft_order()` reads prices from
 * the catalog server-side and computes everything else (MASTER prompt: jangan
 * percaya price/subtotal/total/status dari client).
 *
 * Order status is the full state machine from the MASTER prompt, including the
 * exception states. DRAFT is the only state this phase creates; every later
 * transition is a guarded command in a later phase.
 */

/** Entry state of the order state machine; every order is born here. */
export const ORDER_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "PENDING_CONFIRMATION",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "SERVED",
  "PAID",
  "COMPLETED",
  // Exception states.
  "CANCELLED",
  "REJECTED",
  "VOID",
  "REFUNDED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** A draft may only leave DRAFT by being submitted (API_CONTRACT.md §13). */
export const ORDER_EXCEPTION_STATUSES = [
  "CANCELLED",
  "REJECTED",
  "VOID",
  "REFUNDED",
] as const;

/** Who the order came from (DATABASE_SCHEMA.md §20). */
export const ORDER_SOURCES = ["CUSTOMER_QR", "WAITER", "POS"] as const;

export type OrderSource = (typeof ORDER_SOURCES)[number];

/**
 * One line item the client wants to add. Nothing here is money: `productId`
 * and `modifierIds` are references, `quantity` and `notes` are intent.
 */
export interface DraftOrderItemInput {
  productId: string;
  quantity: number;
  /** Modifier ids chosen for this item; validated against `product_modifiers`. */
  modifierIds?: string[];
  notes?: string | null;
}

/**
 * The full create payload (API_CONTRACT.md §10.1 + §11.1). `internalNote` is
 * staff-only and must never be rendered for a customer
 * (AUTH_RBAC_RLS.md §46).
 */
export interface CreateDraftOrderInput {
  source: OrderSource;
  tableId: string;
  tableSessionId: string;
  items: DraftOrderItemInput[];
  customerNote?: string | null;
  internalNote?: string | null;
  /** Dedup key; a repeat returns the first result verbatim (§2.3). */
  idempotencyKey?: string | null;
}

/**
 * Submit a DRAFT order (API_CONTRACT.md §10.2 / §11.2). The client sends the
 * order it wants to submit, who is submitting it, the table context that
 * authorizes a customer submit, and a dedup key. It sends no money and no
 * item list — the draft already holds its snapshot lines, and the server
 * re-derives the total from the live catalog to detect a stale price
 * (API_CONTRACT.md §27).
 */
export interface SubmitOrderInput {
  orderId: string;
  source: OrderSource;
  /** Required for CUSTOMER_QR: the table the submit is being made from. */
  tableId?: string | null;
  /** Required for CUSTOMER_QR: the OPEN session the submit is being made in. */
  tableSessionId?: string | null;
  /** Dedup key; a repeat returns the first result verbatim (§2.3). */
  idempotencyKey?: string | null;
}

/** One item as the server recorded it, with its frozen catalog snapshot. */
export interface DraftOrderItem {
  id: string;
  productId: string | null;
  productNameSnapshot: string;
  unitPriceSnapshot: number;
  quantity: number;
  notes: string | null;
  lineTotal: number;
}

/** A modifier selection as the server recorded it. */
export interface DraftOrderItemModifier {
  id: string;
  orderItemId: string;
  modifierId: string | null;
  modifierNameSnapshot: string;
  priceDeltaSnapshot: number;
  quantity: number;
}

/**
 * The created order. Every money field was computed by the backend; the client
 * may display them but may never send them back as an update.
 */
export interface DraftOrder {
  id: string;
  orderNumber: string;
  tableId: string;
  tableSessionId: string;
  source: OrderSource;
  status: OrderStatus;
  notes: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  idempotencyKey: string | null;
  createdBy: string | null;
  /**
   * Monotonic optimistic-concurrency handle. Bumped by every transition; a
   * caller that wants to guard against a stale read sends it back as
   * `expectedVersion` (API_CONTRACT.md §26).
   */
  version: number;
  items: DraftOrderItem[];
  modifiers: DraftOrderItemModifier[];
}

/** Raw `create_draft_order()` RPC reply shape (the `orders` row). */
export interface OrderRow {
  id: string | null;
  order_number: string | null;
  table_id: string | null;
  table_session_id: string | null;
  source: string | null;
  status: string | null;
  notes: string | null;
  subtotal: string | number | null;
  discount: string | number | null;
  tax: string | number | null;
  total: string | number | null;
  idempotency_key: string | null;
  /** Dedup key for the submit command (Phase 8B). */
  submit_idempotency_key: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  /** Monotonic version, bumped by every `transition_order()` call. */
  version: string | number | null;
}

/** Raw `order_items` row shape. */
export interface OrderItemRow {
  id: string | null;
  order_id: string | null;
  product_id: string | null;
  product_name_snapshot: string | null;
  unit_price_snapshot: string | number | null;
  quantity: string | number | null;
  notes: string | null;
  line_total: string | number | null;
}

/** Raw `order_item_modifiers` row shape. */
export interface OrderItemModifierRow {
  id: string | null;
  order_item_id: string | null;
  modifier_id: string | null;
  modifier_name_snapshot: string | null;
  price_delta_snapshot: string | number | null;
  quantity: string | number | null;
}

/**
 * The states an order may be submitted from. Only a DRAFT can be submitted
 * (API_CONTRACT.md §13); anything else is either already in flight or in an
 * exception state.
 */
export const SUBMITTABLE_STATUSES = ["DRAFT"] as const;

/**
 * The observable steady state after a successful submit. The command writes
 * DRAFT -> SUBMITTED -> PENDING_CONFIRMATION atomically, and the row rests here
 * — this is the state the cashier queue filters on (API_CONTRACT.md §12.1).
 */
export const SUBMITTED_STATUS = "PENDING_CONFIRMATION" as const;

/**
 * Transition an order's state (API_CONTRACT.md §13 —
 * `POST /orders/:id/transition`: "Gunakan satu command terpusat").
 *
 * The client sends only *intent*: which order, which target status, an
 * optional reason, and the version it rendered. It sends no actor, no role and
 * no permission — the backend derives the actor from the authenticated session
 * and resolves the required permission from the transition rule itself
 * (API_CONTRACT.md §2.2, §13; MASTER prompt: never trust a client status or
 * role). This input is deliberately not able to express a backward hop, a
 * self-transition or a DRAFT exit: those are properties of the server-side
 * rule table, not of the request.
 */
export interface TransitionOrderInput {
  orderId: string;
  toStatus: OrderStatus;
  /** Mandatory for exceptional transitions (cancel/refund); optional elsewhere. */
  reason?: string | null;
  /**
   * The version the caller rendered. A mismatch is a stale request and fails
   * as a conflict rather than overwriting a newer state
   * (API_CONTRACT.md §26).
   */
  expectedVersion?: number | null;
}

/** Audit descriptor for the create event, for the UI to describe the change. */
export interface OrdersAuditEvent {
  kind: "create" | "submit" | "transition";
  orderId: string;
  orderNumber: string;
  total: number;
}

// -----------------------------------------------------------------------------
// Customer order status read (Phase 8B — API_CONTRACT.md §10.3).
//
// `GET /public/orders/:id`: a customer may read ONLY the order tied to a valid
// table/session context (AUTH_RBAC_RLS.md §18, §27, §30). The id alone is not a
// credential, so the lookup input always carries the context the QR resolved.
// The projection the server returns is deliberately minimal — it carries no
// internal permission, audit, supplier/internal, payment-credential or
// sensitive-staff field (§10.3 exclusions). That is why this type has no
// `idempotencyKey`, no `createdBy`, and no history: the create/submit contract
// above is the operational shape staff work with, this one is what a customer's
// receipt needs.
// -----------------------------------------------------------------------------

/**
 * The lookup input (API_CONTRACT.md §10.3 + §30). The order id identifies the
 * record; the table + session context is what authorizes reading it.
 */
export interface CustomerOrderInput {
  orderId: string;
  tableId: string;
  tableSessionId: string;
}

/** One snapshotted line the customer ordered (DATABASE_SCHEMA.md §21). */
export interface CustomerOrderItem {
  id: string;
  productNameSnapshot: string;
  unitPriceSnapshot: number;
  quantity: number;
  notes: string | null;
  lineTotal: number;
}

/** One modifier selection on a line, at its frozen snapshot price (§22). */
export interface CustomerOrderItemModifier {
  id: string;
  orderItemId: string;
  modifierNameSnapshot: string;
  priceDeltaSnapshot: number;
  quantity: number;
}

/**
 * The customer-visible order. Every field below comes from the server's own
 * projection; there is no `createdBy`, no idempotency key, and no status
 * history on it, because `get_customer_order()` does not return them
 * (API_CONTRACT.md §10.3).
 */
export interface CustomerOrder {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  /** The customer's own order-level note; never the staff internal note. */
  notes: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  createdAt: string | null;
  updatedAt: string | null;
  items: CustomerOrderItem[];
  modifiers: CustomerOrderItemModifier[];
}

/** Raw `get_customer_order()` RPC reply: the `order` object it projected. */
export interface CustomerOrderRow {
  id: string | null;
  order_number: string | null;
  status: string | null;
  notes: string | null;
  subtotal: string | number | null;
  discount: string | number | null;
  tax: string | number | null;
  total: string | number | null;
  created_at: string | null;
  updated_at: string | null;
}

/** Raw projected item row inside the RPC reply. */
export interface CustomerOrderItemRow {
  id: string | null;
  product_name_snapshot: string | null;
  unit_price_snapshot: string | number | null;
  quantity: string | number | null;
  notes: string | null;
  line_total: string | number | null;
}

/** Raw projected modifier row inside the RPC reply. */
export interface CustomerOrderItemModifierRow {
  id: string | null;
  order_item_id: string | null;
  modifier_name_snapshot: string | null;
  price_delta_snapshot: string | number | null;
  quantity: string | number | null;
}
