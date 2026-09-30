/**
 * Order models (Phase 8A): database row mappers.
 *
 * Mirrors migrations 008/009/010 and docs/database/DATABASE_SCHEMA.md
 * §20-§23. Database snake_case rows map to camelCase application records;
 * money columns arrive as numeric(12,2) which Supabase may deliver as a
 * string, so they are coerced to a number and never trusted as-is (a missing
 * or unparseable money value degrades to 0 and is reported as such by the
 * caller, never invented). An unknown status or source falls back to the
 * default rather than widening the vocabulary.
 *
 * Snapshot columns are the transactional record (§21-§22): they are mapped
 * verbatim, never recomputed from the live catalog, so a receipt always shows
 * what was actually charged.
 */
import type {
  CreateDraftOrderInput,
  CustomerOrder,
  CustomerOrderInput,
  CustomerOrderItem,
  CustomerOrderItemModifier,
  CustomerOrderItemModifierRow,
  CustomerOrderItemRow,
  CustomerOrderRow,
  DraftOrder,
  DraftOrderItem,
  DraftOrderItemModifier,
  OrdersAuditEvent,
  OrderItemModifierRow,
  OrderItemRow,
  OrderRow,
  OrderSource,
  OrderStatus,
  SubmitOrderInput,
  TransitionOrderInput,
} from "./orders-types.js";
import {
  isValidOrderSource,
  isValidOrderStatus,
} from "./orders-validation.js";

export type {
  CreateDraftOrderInput,
  CustomerOrder,
  CustomerOrderInput,
  CustomerOrderItem,
  CustomerOrderItemModifier,
  CustomerOrderItemModifierRow,
  CustomerOrderItemRow,
  CustomerOrderRow,
  DraftOrder,
  DraftOrderItem,
  DraftOrderItemModifier,
  OrderItemModifierRow,
  OrderItemRow,
  OrderRow,
  OrdersAuditEvent,
  OrderSource,
  OrderStatus,
  SubmitOrderInput,
  TransitionOrderInput,
} from "./orders-types.js";

/** numeric(12,2) may arrive as a string; a missing value is 0, never invented. */
export function toMoney(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toStatus(value: string | null | undefined): OrderStatus {
  return isValidOrderStatus(value) ? value : "DRAFT";
}

/**
 * Monotonic version handle. A row written before the version column existed,
 * or a malformed transport value, degrades to 0 — "unknown" — so the caller
 * cannot send a stale expectation about a state it never read
 * (API_CONTRACT.md §26).
 */
function toVersion(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function toSource(value: string | null | undefined): OrderSource {
  return isValidOrderSource(value) ? value : "CUSTOMER_QR";
}

export function toDraftOrderItem(row: OrderItemRow): DraftOrderItem {
  return {
    id: row.id ?? "",
    productId: row.product_id,
    productNameSnapshot: row.product_name_snapshot ?? "",
    unitPriceSnapshot: toMoney(row.unit_price_snapshot),
    quantity: toMoney(row.quantity),
    notes: row.notes,
    lineTotal: toMoney(row.line_total),
  };
}

export function toDraftOrderItemModifier(row: OrderItemModifierRow): DraftOrderItemModifier {
  return {
    id: row.id ?? "",
    orderItemId: row.order_item_id ?? "",
    modifierId: row.modifier_id,
    modifierNameSnapshot: row.modifier_name_snapshot ?? "",
    priceDeltaSnapshot: toMoney(row.price_delta_snapshot),
    quantity: toMoney(row.quantity),
  };
}

/**
 * Assemble the created order from its row plus the item/modifier rows the
 * server snapshotted. The caller reads items and modifiers through RLS, so a
 * caller who cannot see an order simply cannot reach this mapper for it.
 */
export function toDraftOrder(
  row: OrderRow,
  items: OrderItemRow[],
  modifiers: OrderItemModifierRow[],
): DraftOrder {
  return {
    id: row.id ?? "",
    orderNumber: row.order_number ?? "",
    tableId: row.table_id ?? "",
    tableSessionId: row.table_session_id ?? "",
    source: toSource(row.source),
    status: toStatus(row.status),
    notes: row.notes,
    subtotal: toMoney(row.subtotal),
    discount: toMoney(row.discount),
    tax: toMoney(row.tax),
    total: toMoney(row.total),
    idempotencyKey: row.idempotency_key,
    createdBy: row.created_by,
    version: toVersion(row.version),
    items: items.map(toDraftOrderItem),
    modifiers: modifiers.map(toDraftOrderItemModifier),
  };
}

/**
 * Build the RPC arguments. The input carries no money, so the args cannot
 * either — this is where the client's inability to send a price becomes
 * structural rather than merely conventional (API_CONTRACT.md §2.2).
 */
export function toCreateDraftOrderArgs(input: CreateDraftOrderInput): Record<string, unknown> {
  return {
    p_source: input.source,
    p_table_id: input.tableId,
    p_table_session_id: input.tableSessionId,
    p_items: input.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      modifierIds: item.modifierIds ?? [],
      notes: item.notes ?? null,
    })),
    p_customer_note: input.customerNote ?? null,
    p_internal_note: input.internalNote ?? null,
    p_idempotency_key: input.idempotencyKey ?? null,
  };
}

/** Describe a successful create for the audit/log surface. */
export function describeOrderCreate(order: DraftOrder): OrdersAuditEvent {
  return {
    kind: "create",
    orderId: order.id,
    orderNumber: order.orderNumber,
    total: order.total,
  };
}

/**
 * Build the submit RPC arguments. Only the order reference, the source, the
 * authorizing table context, and the dedup key are sent — no money, no items,
 * no status (API_CONTRACT.md §2.2, §10.2).
 */
export function toSubmitOrderArgs(input: SubmitOrderInput): Record<string, unknown> {
  return {
    p_order_id: input.orderId,
    p_source: input.source,
    p_table_id: input.tableId ?? null,
    p_table_session_id: input.tableSessionId ?? null,
    p_idempotency_key: input.idempotencyKey ?? null,
  };
}

/** Describe a successful submit for the audit/log surface. */
export function describeOrderSubmit(order: DraftOrder): OrdersAuditEvent {
  return {
    kind: "submit",
    orderId: order.id,
    orderNumber: order.orderNumber,
    total: order.total,
  };
}

// -----------------------------------------------------------------------------
// Centralized order state transition (Phase 8C — API_CONTRACT.md §13).
//
// The transition command is the single authority for order state. These mappers
// only build its arguments and describe its result; every rule — which pair is
// allowed, which permission authorizes it, whether a reason is required —
// lives in `order_transition_rule()` server-side. The input deliberately
// carries no actor and no permission: the backend derives the actor from the
// authenticated session (API_CONTRACT.md §13, §2.2).
// -----------------------------------------------------------------------------

/**
 * Build the transition arguments. The client expresses intent only: the order,
 * the target status, an optional reason, and the optimistic version it
 * rendered. There is no actor, no role, no permission field — and no money or
 * item field either, because a transition never re-prices or rewrites lines
 * (API_CONTRACT.md §2.2, §27).
 */
export function toTransitionOrderArgs(
  input: TransitionOrderInput,
): Record<string, unknown> {
  return {
    p_order_id: input.orderId,
    p_to_status: input.toStatus,
    p_reason: input.reason ?? null,
    p_expected_version: input.expectedVersion ?? null,
  };
}

/** Describe a successful transition for the audit/log surface. */
export function describeOrderTransition(order: DraftOrder): OrdersAuditEvent {
  return {
    kind: "transition",
    orderId: order.id,
    orderNumber: order.orderNumber,
    total: order.total,
  };
}

// -----------------------------------------------------------------------------
// Customer order status read (Phase 8B — API_CONTRACT.md §10.3).
//
// The mappers below work only with the minimal public projection
// `get_customer_order()` returns. They cannot surface an internal field,
// because the RPC never emits one: no idempotency key, no `created_by`, no
// status history. A caller who cannot prove the table context gets NULL from
// the RPC and never reaches these mappers at all.
// -----------------------------------------------------------------------------

export function toCustomerOrderItem(row: CustomerOrderItemRow): CustomerOrderItem {
  return {
    id: row.id ?? "",
    productNameSnapshot: row.product_name_snapshot ?? "",
    unitPriceSnapshot: toMoney(row.unit_price_snapshot),
    quantity: toMoney(row.quantity),
    notes: row.notes,
    lineTotal: toMoney(row.line_total),
  };
}

export function toCustomerOrderItemModifier(
  row: CustomerOrderItemModifierRow,
): CustomerOrderItemModifier {
  return {
    id: row.id ?? "",
    orderItemId: row.order_item_id ?? "",
    modifierNameSnapshot: row.modifier_name_snapshot ?? "",
    priceDeltaSnapshot: toMoney(row.price_delta_snapshot),
    quantity: toMoney(row.quantity),
  };
}

/**
 * Assemble the customer-visible order from the RPC's public projection. The
 * snapshot lines are mapped verbatim — a receipt shows exactly what was
 * charged, never a re-derivation from the live catalog (DATABASE_SCHEMA.md
 * §21-§22). An unknown status still falls back rather than widening the
 * vocabulary.
 */
export function toCustomerOrder(
  row: CustomerOrderRow,
  items: CustomerOrderItemRow[],
  modifiers: CustomerOrderItemModifierRow[],
): CustomerOrder {
  return {
    id: row.id ?? "",
    orderNumber: row.order_number ?? "",
    status: toStatus(row.status),
    notes: row.notes,
    subtotal: toMoney(row.subtotal),
    discount: toMoney(row.discount),
    tax: toMoney(row.tax),
    total: toMoney(row.total),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: items.map(toCustomerOrderItem),
    modifiers: modifiers.map(toCustomerOrderItemModifier),
  };
}

/**
 * Build the lookup arguments. Only the order reference and the authorizing
 * context are sent; there is nothing else to send — this is a read
 * (API_CONTRACT.md §10.3, §30).
 */
export function toCustomerOrderArgs(
  input: CustomerOrderInput,
): Record<string, unknown> {
  return {
    p_order_id: input.orderId,
    p_table_id: input.tableId,
    p_table_session_id: input.tableSessionId,
  };
}
