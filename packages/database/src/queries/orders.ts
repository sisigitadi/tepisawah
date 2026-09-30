/**
 * Draft order queries (Phase 8A).
 *
 * Creation is a single SECURITY DEFINER RPC, `create_draft_order()`, because
 * `orders` / `order_items` / `order_item_modifiers` grant no writes to any
 * client role (migrations 008/009): there is no client-side insert path to get
 * wrong. The RPC validates the table context, validates every item against the
 * live catalog, prices everything from authoritative catalog rows, and writes
 * the order with its snapshot lines in one transaction. The client sends
 * references and intent only — it cannot send a price, because the RPC has no
 * price parameter (API_CONTRACT.md §2.2, §10.1).
 *
 * Reading an order back uses the RLS read policies: `orders_staff_read` gates
 * `orders`, and the item/modifier tables inherit from their parent
 * (AUTH_RBAC_RLS.md §28) — see `fetchOrder`. The create path deliberately does
 * NOT read back that way: `order_items` grants SELECT to `authenticated` only,
 * so an anonymous customer's second round trip would return zero rows and
 * yield a partial record. `create_draft_order()` therefore returns the order
 * together with the snapshot lines it just wrote, assembled inside the same
 * SECURITY DEFINER frame, and the create result below is mapped straight from
 * that payload.
 *
 * Results never throw: an error degrades to an explicit failure so callers fail
 * closed (TESTING_STRATEGY).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../generated/index.js";
import {
  describeOrderCreate,
  describeOrderSubmit,
  describeOrderTransition,
  toCreateDraftOrderArgs,
  toSubmitOrderArgs,
  toTransitionOrderArgs,
  toDraftOrder,
  toCustomerOrder,
  toCustomerOrderArgs,
  isValidCreateDraftOrderInput,
  isValidCustomerOrderInput,
  isValidSubmitOrderInput,
  isValidTransitionOrderInput,
  type CreateDraftOrderInput,
  type CustomerOrder,
  type CustomerOrderItemModifierRow,
  type CustomerOrderItemRow,
  type CustomerOrderInput,
  type CustomerOrderRow,
  type DraftOrder,
  type OrderItemModifierRow,
  type OrderItemRow,
  type OrderRow,
  type OrdersAuditEvent,
  type OrderSource,
  type OrderStatus,
  type StaffOrder,
  type StaffOrderItem,
  type SubmitOrderInput,
  type TransitionOrderInput,
} from "../models/index.js";

export interface OrdersQueryError {
  message: string;
}

export interface OrdersQueryResult<T> {
  data: T | null;
  error: OrdersQueryError | null;
}

interface SupabaseFailure {
  message: string;
  code?: string;
}

function failure(error: SupabaseFailure): OrdersQueryError {
  // The RPC raises with errcode 42501 (authorization) or 23xxx / P0002
  // (validation). PostgREST prefixes the message with the code; strip a
  // duplicate leading code so the UI shows a clean sentence.
  const message = error.message?.replace(/^[A-Z0-9]{5}:\s*/, "").trim();
  return { message: message || "Order tidak dapat dibuat." };
}

interface CreateDraftOrderPayload {
  order: OrderRow;
  items: OrderItemRow[];
  modifiers: OrderItemModifierRow[];
}

/** `get_customer_order()` reply: the minimal public projection (§10.3). */
interface CustomerOrderPayload {
  order: CustomerOrderRow;
  items: CustomerOrderItemRow[];
  modifiers: CustomerOrderItemModifierRow[];
}

interface RpcChain {
  single: <T>() => Promise<{ data: T | null; error: SupabaseFailure | null }>;
}

interface UntypedClient {
  rpc: (fn: string, args: Record<string, unknown>) => RpcChain;
}

interface SelectChain {
  eq: (column: string, value: string) => SelectChain;
  in: (column: string, values: string[]) => SelectChain;
  order: (
    column: string,
    options?: { ascending?: boolean },
  ) => Promise<{ data: unknown[] | null; error: SupabaseFailure | null }>;
}

interface UntypedTable {
  select: (columns?: string) => SelectChain;
}

function untypedClient(client: SupabaseClient<Database>): UntypedClient {
  return client as unknown as UntypedClient;
}

function untypedTable(client: SupabaseClient<Database>, table: string): UntypedTable {
  return (client as unknown as { from: (t: string) => UntypedTable }).from(table);
}

function rowsOf<T>(data: unknown[] | null): T[] {
  return Array.isArray(data) ? (data as T[]) : [];
}

/** Postgres numerics arrive as strings over the wire; money must be a number. */
function toNumber(value: string | number | null): number {
  if (value === null) return 0;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Create a DRAFT order.
 *
 * One round trip. The RPC returns the order together with the snapshot lines it
 * wrote, assembled inside its own SECURITY DEFINER frame, so the result is
 * complete for every caller — including an anonymous customer, who holds no
 * read grant on `order_items` and would otherwise get a silent partial record.
 * Idempotent: the same `idempotencyKey` returns the same order with the same
 * lines, so a retry, a double-tap, or a race that lost the unique index all
 * yield one order (API_CONTRACT.md §2.3).
 *
 * Every price below comes from the server. The input has no money fields, and
 * the totals in the returned record are what the RPC wrote — never echoed from
 * the request.
 */
export async function createDraftOrder(
  client: SupabaseClient<Database>,
  input: CreateDraftOrderInput,
): Promise<OrdersQueryResult<{ order: DraftOrder; audit: OrdersAuditEvent }>> {
  if (!isValidCreateDraftOrderInput(input)) {
    return { data: null, error: { message: "Data order tidak lengkap." } };
  }

  const { data, error } = await untypedClient(client)
    .rpc("create_draft_order", toCreateDraftOrderArgs(input))
    .single<CreateDraftOrderPayload>();

  if (error) return { data: null, error: failure(error) };

  const payload = data;
  if (!payload || !payload.order || payload.order.id === null) {
    return { data: null, error: { message: "Order tidak dapat dibuat." } };
  }

  const items = rowsOf<OrderItemRow>(payload.items);
  const modifiers = rowsOf<OrderItemModifierRow>(payload.modifiers);
  const order = toDraftOrder(payload.order, items, modifiers);

  return {
    data: { order, audit: describeOrderCreate(order) },
    error: null,
  };
}

/**
 * Submit a DRAFT order: DRAFT -> SUBMITTED -> PENDING_CONFIRMATION.
 *
 * One round trip, one server-side transaction. The command re-validates the
 * table context, re-reads the live catalog to confirm the frozen snapshot total
 * is still current, refuses any withdrawn product or stale price, and only then
 * moves the row — writing both transition rows into the history in the same
 * statement (API_CONTRACT.md §10.2, §13, §27, §33). Nothing the client sends
 * can influence a price; the input has no money field and the RPC has no money
 * parameter.
 *
 * Idempotent: the submit key is stored on the row, so a repeat returns the
 * first result verbatim (API_CONTRACT.md §2.3).
 */
export async function submitOrder(
  client: SupabaseClient<Database>,
  input: SubmitOrderInput,
): Promise<OrdersQueryResult<{ order: DraftOrder; audit: OrdersAuditEvent }>> {
  if (!isValidSubmitOrderInput(input)) {
    return { data: null, error: { message: "Data submit order tidak lengkap." } };
  }

  const { data, error } = await untypedClient(client)
    .rpc("submit_order", toSubmitOrderArgs(input))
    .single<CreateDraftOrderPayload>();

  if (error) return { data: null, error: failure(error) };

  const payload = data;
  if (!payload || !payload.order || payload.order.id === null) {
    return { data: null, error: { message: "Order tidak dapat disubmit." } };
  }

  const order = toDraftOrder(
    payload.order,
    rowsOf<OrderItemRow>(payload.items),
    rowsOf<OrderItemModifierRow>(payload.modifiers),
  );

  return {
    data: { order, audit: describeOrderSubmit(order) },
    error: null,
  };
}

/**
 * Read one order with its snapshot lines. RLS-gated: the `orders_staff_read`
 * policy decides visibility, and the item tables inherit from it
 * (AUTH_RBAC_RLS.md §28). Used by staff surfaces; the customer path is a
 * separate, validating read in a later phase.
 */
export async function fetchOrder(
  client: SupabaseClient<Database>,
  orderId: string,
): Promise<OrdersQueryResult<DraftOrder>> {
  if (!orderId) return { data: null, error: { message: "Id order wajib diisi." } };

  const base = untypedTable(client, "orders").select(
    "id, order_number, table_id, table_session_id, source, status, notes, " +
      "subtotal, discount, tax, total, idempotency_key, created_by, created_at, updated_at",
  );

  const result = await base.eq("id", orderId).order("created_at", { ascending: false });
  if (result.error) return { data: null, error: failure(result.error) };

  const row = rowsOf<OrderRow>(result.data)[0];
  if (!row || row.id === null) {
    return { data: null, error: { message: "Order tidak ditemukan." } };
  }

  const itemsResult = await untypedTable(client, "order_items")
    .select("id, order_id, product_id, product_name_snapshot, unit_price_snapshot, quantity, notes, line_total")
    .eq("order_id", row.id)
    .order("created_at", { ascending: true });

  if (itemsResult.error) return { data: null, error: failure(itemsResult.error) };
  const items = rowsOf<OrderItemRow>(itemsResult.data);

  let modifierRows: OrderItemModifierRow[] = [];
  if (items.length > 0) {
    const scoped = await untypedTable(client, "order_item_modifiers")
      .select("id, order_item_id, modifier_id, modifier_name_snapshot, price_delta_snapshot, quantity")
      .in(
        "order_item_id",
        items.map((item) => item.id).filter((id): id is string => id !== null),
      )
      .order("created_at", { ascending: true });
    if (scoped.error) return { data: null, error: failure(scoped.error) };
    modifierRows = rowsOf<OrderItemModifierRow>(scoped.data);
  }

  return { data: toDraftOrder(row, items, modifierRows), error: null };
}

/**
 * List staff orders by status for the operational boards (kitchen KDS, cashier
 * POS queue) with their snapshot lines and resolved table labels.
 *
 * RLS-gated like `fetchOrder`: `orders_staff_read` decides visibility, and the
 * item tables inherit from their parent (AUTH_RBAC_RLS.md §28) — an anonymous
 * caller gets zero rows, never a partial board. The table lookup is a
 * best-effort enrichment: a session without `tables` read still gets its
 * orders, with a placeholder label instead of a hard failure, because a
 * kitchen board must not go blind over a display-name it cannot resolve.
 *
 * Results never throw: an error degrades to an explicit failure so callers
 * fail closed (TESTING_STRATEGY).
 */
export async function fetchOrdersByStatuses(
  client: SupabaseClient<Database>,
  statuses: readonly OrderStatus[],
): Promise<OrdersQueryResult<StaffOrder[]>> {
  if (statuses.length === 0) return { data: [], error: null };

  const result = await untypedTable(client, "orders")
    .select(
      "id, order_number, table_id, table_session_id, source, status, notes, " +
        "subtotal, discount, tax, total, version, created_at, updated_at",
    )
    .in("status", [...statuses])
    .order("created_at", { ascending: true });

  if (result.error) return { data: null, error: failure(result.error) };

  const rows = rowsOf<OrderRow>(result.data).filter(
    (row): row is OrderRow & { id: string } => row.id !== null,
  );

  type StaffItemWithOrder = StaffOrderItem & { orderId: string };
  let items: StaffItemWithOrder[] = [];
  if (rows.length > 0) {
    const itemsResult = await untypedTable(client, "order_items")
      .select(
        "id, order_id, product_id, product_name_snapshot, unit_price_snapshot, quantity, notes, line_total",
      )
      .in("order_id", rows.map((row) => row.id))
      .order("created_at", { ascending: true });
    if (itemsResult.error) return { data: null, error: failure(itemsResult.error) };
    items = rowsOf<OrderItemRow>(itemsResult.data)
      .filter((item) => item.order_id !== null && item.id !== null)
      .map((item) => ({
        orderId: item.order_id as string,
        id: item.id as string,
        productId: item.product_id,
        name: item.product_name_snapshot ?? "Item",
        quantity: toNumber(item.quantity),
        unitPrice: toNumber(item.unit_price_snapshot),
        notes: item.notes,
        lineTotal: toNumber(item.line_total),
      }));
  }

  // Display labels are enrichment, not payload: a denied or empty tables read
  // degrades to a code/-id placeholder rather than failing the board.
  const tableIds = [
    ...new Set(rows.map((row) => row.table_id).filter((id): id is string => id !== null)),
  ];
  const tableLabels = new Map<string, { name: string; code: string }>();
  if (tableIds.length > 0) {
    const tablesResult = await untypedTable(client, "tables")
      .select("id, table_code, name")
      .in("id", tableIds)
      .order("name", { ascending: true });
    if (!tablesResult.error) {
      for (const table of rowsOf<{ id: string | null; table_code: string | null; name: string | null }>(
        tablesResult.data,
      )) {
        if (table.id !== null) {
          tableLabels.set(table.id, {
            name: table.name ?? "",
            code: table.table_code ?? "",
          });
        }
      }
    }
  }

  const orders: StaffOrder[] = rows.map((row) => {
    const label = row.table_id !== null ? tableLabels.get(row.table_id) : undefined;
    const code = label?.code ?? "";
    return {
      id: row.id,
      orderNumber: row.order_number ?? "",
      tableId: row.table_id ?? "",
      tableSessionId: row.table_session_id ?? "",
      tableName: label?.name || (code ? `Meja ${code}` : `Meja ${(row.table_id ?? "").slice(0, 4)}`),
      tableCode: code,
      source: (row.source ?? "CUSTOMER_QR") as OrderSource,
      status: (row.status ?? "DRAFT") as OrderStatus,
      notes: row.notes,
      subtotal: toNumber(row.subtotal),
      discount: toNumber(row.discount),
      tax: toNumber(row.tax),
      total: toNumber(row.total),
      version: toNumber(row.version),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      items: items
        .filter((item) => item.orderId === row.id)
        .map(({ orderId: _orderId, ...item }) => item),
    };
  });

  return { data: orders, error: null };
}

/**
 * Read one customer order with its snapshot lines (API_CONTRACT.md §10.3).
 *
 * One round trip through the `get_customer_order()` SECURITY DEFINER
 * projection. `orders` carries no `anon` read policy by design, so this RPC is
 * the *only* path an anonymous customer has to an order — and it is a
 * validating read, not a lookup: the caller must prove the table + OPEN
 * session the order actually belongs to, and the RPC compares both against the
 * order's own before projecting anything (AUTH_RBAC_RLS.md §18, §27, §30). A
 * public order id alone is not a credential, so one that does not match the
 * caller's context resolves to nothing (§30: "order lookup must not expose
 * arbitrary orders").
 *
 * The projection is deliberately minimal: no idempotency keys, no `created_by`,
 * no status history, no payment or audit data (§10.3 exclusions). The snapshot
 * lines come back with the order because `order_items` grants `authenticated`
 * only — an anonymous customer's own follow-up read through RLS would return
 * zero rows and yield a half-empty receipt (AUTH_RBAC_RLS.md §28).
 *
 * Fails closed: a missing order, a mismatched or closed context, or an
 * archived table all degrade to an explicit "not found" failure rather than a
 * partial record.
 */
export async function getCustomerOrder(
  client: SupabaseClient<Database>,
  input: CustomerOrderInput,
): Promise<OrdersQueryResult<CustomerOrder>> {
  if (!isValidCustomerOrderInput(input)) {
    return { data: null, error: { message: "Data order tidak lengkap." } };
  }

  const { data, error } = await untypedClient(client)
    .rpc("get_customer_order", toCustomerOrderArgs(input))
    .single<CustomerOrderPayload>();

  if (error) return { data: null, error: failure(error) };

  // NULL is the RPC's fail-closed result for every invalid context: unknown
  // order, wrong table, wrong or closed session, archived table
  // (API_CONTRACT.md §30). It is reported as a plain "not found" so the UI
  // cannot tell — and the customer cannot learn — which one it was.
  const payload = data;
  if (!payload || !payload.order || payload.order.id === null) {
    return { data: null, error: { message: "Order tidak ditemukan." } };
  }

  const order = toCustomerOrder(
    payload.order,
    rowsOf<CustomerOrderItemRow>(payload.items),
    rowsOf<CustomerOrderItemModifierRow>(payload.modifiers),
  );

  return { data: order, error: null };
}

/**
 * Transition an order's state (API_CONTRACT.md §13: "Gunakan satu command
 * terpusat" — `POST /orders/:id/transition`).
 *
 * The single authority for every hop after submit: confirm, reject, start,
 * ready, serve, paid, complete, cancel, refund. One round trip, one server-side
 * transaction: the engine derives the actor from the authenticated session,
 * resolves the (current -> requested) pair against its own rule table, checks
 * the permission that pair requires, enforces a reason on the exceptional
 * transitions, locks the row, verifies the optimistic version the caller
 * rendered, and only then moves the status, bumps the version and appends the
 * audit history — all atomically (API_CONTRACT.md §13, §26, §33).
 *
 * Idempotent: an order already at the requested status is a no-op success, so
 * a double-tap or a retry after a network failure yields one transition and
 * one audit row (API_CONTRACT.md §26). A version mismatch is a conflict — the
 * order moved since the caller rendered it.
 *
 * The input cannot express a backward hop, an unauthorized target, an actor or
 * a permission; those are the server's to decide. This layer validates the
 * shape only, so a malformed request is rejected without a round trip.
 */
export async function transitionOrder(
  client: SupabaseClient<Database>,
  input: TransitionOrderInput,
): Promise<OrdersQueryResult<{ order: DraftOrder; audit: OrdersAuditEvent }>> {
  if (!isValidTransitionOrderInput(input)) {
    return { data: null, error: { message: "Data transisi order tidak lengkap." } };
  }

  const { data, error } = await untypedClient(client)
    .rpc("transition_order", toTransitionOrderArgs(input))
    .single<CreateDraftOrderPayload>();

  if (error) return { data: null, error: failure(error) };

  const payload = data;
  if (!payload || !payload.order || payload.order.id === null) {
    return { data: null, error: { message: "Order tidak dapat ditransisikan." } };
  }

  const order = toDraftOrder(
    payload.order,
    rowsOf<OrderItemRow>(payload.items),
    rowsOf<OrderItemModifierRow>(payload.modifiers),
  );

  return {
    data: { order, audit: describeOrderTransition(order) },
    error: null,
  };
}
