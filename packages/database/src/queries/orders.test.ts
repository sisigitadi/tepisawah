/**
 * Order creation + submission tests (Phase 8A + 8B).
 *
 * The fake mirrors `create_draft_order()` (migration 010 part 2) and
 * `submit_order()` (migration 010 part 3) the way Postgres would run them: they
 * re-validate the table context, look prices up in the catalog themselves, and
 * refuse anything the RPCs refuse. The query layer must degrade to an explicit
 * failure rather than a partial record (TESTING_STRATEGY Layer 2).
 *
 * Phase 8A covers: valid product, inactive product, invalid modifier, quantity
 * validation, price tampering, duplicate request, concurrent request, session
 * validation.
 *
 * Phase 8B covers: valid submission, empty cart, stale price, inactive product,
 * duplicate submit, unauthorized submit, already submitted, status history.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../generated/index.js";
import {
  createDraftOrder,
  getCustomerOrder,
  submitOrder,
  transitionOrder,
} from "./orders.js";
import {
  toCreateDraftOrderArgs,
  toCustomerOrderArgs,
  toSubmitOrderArgs,
  toTransitionOrderArgs,
} from "../models/index.js";
import { ORDER_STATUSES } from "../models/orders-types.js";

import type {
  CreateDraftOrderInput,
  CustomerOrderInput,
  DraftOrder,
  OrderItemModifierRow,
  OrderItemRow,
  OrderRow,
  OrderStatus,
  SubmitOrderInput,
  TransitionOrderInput,
} from "../models/index.js";

interface FakeProduct {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
  isAvailable: boolean;
}

interface FakeModifier {
  id: string;
  name: string;
  priceDelta: number;
  isActive: boolean;
}

interface FakeProductModifier {
  productId: string;
  modifierId: string;
  isActive: boolean;
}

interface FakeSession {
  id: string;
  tableId: string;
  status: "OPEN" | "CLOSED";
}

interface FakeTable {
  id: string;
  isActive: boolean;
}

/**
 * Mirrors order_status_history (migration 010 part 1): append-only audit with
 * the actor, the role the actor used, and the reason where one was required.
 */
interface FakeStatusHistoryRow {
  id: string;
  order_id: string | null;
  from_status: string | null;
  to_status: string | null;
  actor_id: string | null;
  actor_role: string | null;
  reason: string | null;
}

interface FakeConfig {
  products?: FakeProduct[];
  modifiers?: FakeModifier[];
  productModifiers?: FakeProductModifier[];
  sessions?: FakeSession[];
  tables?: FakeTable[];
  /** Whether the session holds `orders.create_manual` (WAITER/POS sources).
   * Default false: the RPC requires an authenticated active staff account. */
  staffAuthorized?: boolean;
  /** Refuse the next create the way the RPC refuses (class 23/22/P0002). */
  createError?: { message: string; code: string };
  /** Refuse the next submit the way the RPC refuses (class 23/22/P0002/42501). */
  submitError?: { message: string; code: string };
  /** Refuse the next read the way the RPC's transport can refuse (42501). */
  readError?: { message: string; code: string };
  /** Refuse the next transition the way the RPC's transport can refuse. */
  transitionError?: { message: string; code: string };

  /**
   * The permissions the caller's roles grant, mirroring `has_permission()`
   * (AUTH_RBAC_RLS.md §22): the union over the caller's active roles. Default
   * empty — an anonymous or inactive caller authorizes no transition, and the
   * engine fails closed on every rule (42501).
   */
  actorPermissions?: string[];
  /** The authenticated staff account driving the transition (audit trail). */
  actorId?: string;
  actorRole?: string;

  /**
   * Seed an order at an arbitrary point in the machine with one priced line
   * and version 1, modelling any state a staff surface rendered before
   * pressing its action button: the transition engine then observes and moves
   * this row.
   */
  seedOrder?: { id: string; status: OrderStatus; version?: number };
  /** Seed a DRAFT with no lines, modelling a draft written by another path:
   *  `create_draft_order()` itself refuses an empty item list, so this is the
   *  only shape that reaches the submit command's empty-cart guard. */
  seedEmptyDraft?: boolean;
  /**
   * Seed a fully-submitted order at TABLE_ID/SESSION_ID with one priced line,
   * modelling an order the customer placed before this test's read: the
   * session was OPEN when they submitted, and the read below observes whatever
   * state the seeded config gives (an archived table, a since-closed visit…).
   */
  seedSubmittedOrder?: boolean;
  /** Records what the client was asked to call. */
  rpcCalls?: { fn: string; args: unknown }[];
}

const PRODUCT_ID = "p-100";
const PRODUCT_INACTIVE_ID = "p-101";
const PRODUCT_UNAVAILABLE_ID = "p-102";
const MOD_ID = "m-200";
const MOD_FOREIGN_ID = "m-201";
const MOD_INACTIVE_ID = "m-202";
const TABLE_ID = "t-300";
const TABLE_INACTIVE_ID = "t-301";
const SESSION_ID = "s-400";
const SESSION_CLOSED_ID = "s-401";
const SESSION_OTHER_TABLE_ID = "s-402";

/**
 * The (from, to) -> permission/reason table, mirroring `order_transition_rule()`
 * (migration 010 part 6) exactly: the single source of the state machine, with
 * DRAFT -> SUBMITTED absent on purpose (that hop belongs to submit_order(),
 * which re-derives the price first — API_CONTRACT.md §27).
 */
const TRANSITION_RULES = [
  // Normal forward flow (API_CONTRACT.md §13).
  { from: "SUBMITTED", to: "PENDING_CONFIRMATION", permission: "orders.transition", requiresReason: false },
  { from: "PENDING_CONFIRMATION", to: "CONFIRMED", permission: "orders.confirm", requiresReason: false },
  { from: "PENDING_CONFIRMATION", to: "REJECTED", permission: "orders.reject", requiresReason: true },
  { from: "CONFIRMED", to: "PREPARING", permission: "kitchen.start", requiresReason: false },
  { from: "CONFIRMED", to: "CANCELLED", permission: "orders.cancel", requiresReason: true },
  { from: "PREPARING", to: "READY", permission: "kitchen.ready", requiresReason: false },
  { from: "PREPARING", to: "CANCELLED", permission: "orders.cancel", requiresReason: true },
  { from: "READY", to: "SERVED", permission: "orders.serve", requiresReason: false },
  { from: "SERVED", to: "PAID", permission: "payments.create", requiresReason: false },
  { from: "PAID", to: "COMPLETED", permission: "payments.create", requiresReason: false },
  { from: "PAID", to: "REFUNDED", permission: "payments.refund", requiresReason: true },
] as const;

const CATALOG: FakeConfig = {
  products: [
    { id: PRODUCT_ID, name: "Nasi Liwet", price: 45000, isActive: true, isAvailable: true },
    { id: PRODUCT_INACTIVE_ID, name: "Menu Lama", price: 30000, isActive: false, isAvailable: true },
    { id: PRODUCT_UNAVAILABLE_ID, name: "Menu Habis", price: 30000, isActive: true, isAvailable: false },
  ],
  modifiers: [
    { id: MOD_ID, name: "Level Pedas", priceDelta: 0, isActive: true },
    { id: MOD_FOREIGN_ID, name: "Topping Es Krim", priceDelta: 8000, isActive: true },
    { id: MOD_INACTIVE_ID, name: "Modifier Lama", priceDelta: 1000, isActive: false },
  ],
  productModifiers: [
    { productId: PRODUCT_ID, modifierId: MOD_ID, isActive: true },
    { productId: PRODUCT_ID, modifierId: MOD_INACTIVE_ID, isActive: true },
  ],
  sessions: [
    { id: SESSION_ID, tableId: TABLE_ID, status: "OPEN" },
    { id: SESSION_CLOSED_ID, tableId: TABLE_ID, status: "CLOSED" },
    { id: SESSION_OTHER_TABLE_ID, tableId: "t-other", status: "OPEN" },
  ],
  tables: [
    { id: TABLE_ID, isActive: true },
    { id: TABLE_INACTIVE_ID, isActive: false },
  ],
  createError: undefined,
  submitError: undefined,
  rpcCalls: [],
};

interface SupabaseFailure {
  message: string;
  code?: string;
}

function fakeClient(config: FakeConfig = {}): SupabaseClient<Database> {
  const products = config.products ?? CATALOG.products!;
  const modifiers = config.modifiers ?? CATALOG.modifiers!;
  const productModifiers = config.productModifiers ?? CATALOG.productModifiers!;
  const sessions = config.sessions ?? CATALOG.sessions!;
  const tables = config.tables ?? CATALOG.tables!;
  const rpcCalls = config.rpcCalls ?? [];

  // The store the RPCs write into; the reads below see exactly this.
  const orders: OrderRow[] = [];
  const items: OrderItemRow[] = [];
  const itemModifiers: OrderItemModifierRow[] = [];
  const history: FakeStatusHistoryRow[] = [];

  // A draft with no lines, for the submit command's empty-cart guard.
  if (config.seedEmptyDraft) {
    orders.push({
      id: "ord-empty",
      order_number: "TS-EMPTY",
      table_id: TABLE_ID,
      table_session_id: SESSION_ID,      source: "CUSTOMER_QR",
      status: "DRAFT",
      version: 1,
      notes: null,
      subtotal: 0,
      discount: 0,
      tax: 0,
      total: 0,
      idempotency_key: null,
      submit_idempotency_key: null,
      created_by: null,
      created_at: "2026-09-29T10:00:00Z",
      updated_at: "2026-09-29T10:00:00Z",
    });
  }

  // A fully-submitted order, for the customer read path (migration 010 part 4):
  // the customer already ordered, and this read observes the seeded context.
  if (config.seedSubmittedOrder) {
    orders.push({
      id: "ord-seeded",
      order_number: "TS-0001",
      table_id: TABLE_ID,
      table_session_id: SESSION_ID,
      source: "CUSTOMER_QR",
      status: "PENDING_CONFIRMATION",
      version: 1,
      notes: null,
      subtotal: 90000,
      discount: 0,
      tax: 0,
      total: 90000,
      idempotency_key: null,
      submit_idempotency_key: "submit-once",
      created_by: null,
      created_at: "2026-09-29T10:00:00Z",
      updated_at: "2026-09-29T11:00:00Z",
    });
    items.push({
      id: "item-ord-seeded-0",
      order_id: "ord-seeded",
      product_id: PRODUCT_ID,
      product_name_snapshot: "Nasi Liwet",
      unit_price_snapshot: 45000,
      quantity: 2,
      notes: null,
      line_total: 90000,
    });
    itemModifiers.push({
      id: "mod-ord-seeded-0-0",
      order_item_id: "item-ord-seeded-0",
      modifier_id: MOD_ID,
      modifier_name_snapshot: "Level Pedas",
      price_delta_snapshot: 0,
      quantity: 2,
    });
  }

  // An order at any point in the machine, for the transition engine
  // (migration 010 part 6) to observe and move.
  if (config.seedOrder) {
    orders.push({
      id: config.seedOrder.id,
      order_number: "TS-SEED",
      table_id: TABLE_ID,
      table_session_id: SESSION_ID,
      source: "WAITER",
      status: config.seedOrder.status,
      version: config.seedOrder.version ?? 1,
      notes: null,
      subtotal: 90000,
      discount: 0,
      tax: 0,
      total: 90000,
      idempotency_key: null,
      submit_idempotency_key: null,
      created_by: null,
      created_at: "2026-09-29T10:00:00Z",
      updated_at: "2026-09-29T10:00:00Z",
    });
    items.push({
      id: `item-${config.seedOrder.id}-0`,
      order_id: config.seedOrder.id,
      product_id: PRODUCT_ID,
      product_name_snapshot: "Nasi Liwet",
      unit_price_snapshot: 45000,
      quantity: 2,
      notes: null,
      line_total: 90000,
    });
  }

  const findProduct = (id: string) => products.find((row) => row.id === id);
  const findModifier = (id: string) => modifiers.find((row) => row.id === id);

  function priceItem(item: {
    productId: string;
    quantity: number;
    modifierIds?: string[];
  }): { error: SupabaseFailure | null; lineTotal: number } {
    const product = findProduct(item.productId);
    if (!product) {
      return { error: { message: "Produk tidak ditemukan", code: "P0002" }, lineTotal: 0 };
    }
    if (!product.isActive) {
      return { error: { message: `Produk ${product.name} tidak aktif`, code: "23003" }, lineTotal: 0 };
    }
    if (!product.isAvailable) {
      return { error: { message: `Produk ${product.name} sedang tidak tersedia`, code: "P0003" }, lineTotal: 0 };
    }

    let lineTotal = product.price * item.quantity;

    const modifierIds = item.modifierIds ?? [];
    for (const modifierId of modifierIds) {
      const modifier = findModifier(modifierId);
      if (!modifier) {
        return { error: { message: "Modifier tidak ditemukan", code: "P0002" }, lineTotal: 0 };
      }
      if (!modifier.isActive) {
        return { error: { message: `Modifier ${modifier.name} tidak aktif`, code: "23003" }, lineTotal: 0 };
      }
      const link = productModifiers.find(
        (row) => row.productId === product.id && row.modifierId === modifier.id,
      );
      if (!link || !link.isActive) {
        return {
          error: { message: `Modifier ${modifier.name} tidak tersedia untuk produk ini`, code: "23003" },
          lineTotal: 0,
        };
      }
      lineTotal += modifier.priceDelta * item.quantity;
    }

    return { error: null, lineTotal };
  }

  // Assemble the `{order, items, modifiers}` payload both RPCs return, read
  // straight from the store the RPC just wrote.
  const payloadFor = (row: OrderRow) => ({
    order: row,
    items: items.filter((item) => item.order_id === row.id),
    modifiers: itemModifiers.filter((modifier) =>
      items.some((item) => item.order_id === row.id && item.id === modifier.order_item_id),
    ),
  });

  /**
   * The customer-safe projection `get_customer_order()` emits
   * (migration 010 part 4): the same shape as `payloadFor` with every internal
   * column stripped. `to_jsonb(row)` cannot be used for this read because the
   * row itself carries the dedup keys and the staff actor, so the function
   * builds the object column by column instead.
   */
  const projectFor = (row: OrderRow) => ({
    order: {
      id: row.id,
      order_number: row.order_number,
      status: row.status,
      notes: row.notes,
      subtotal: row.subtotal,
      discount: row.discount,
      tax: row.tax,
      total: row.total,
      created_at: row.created_at,
      updated_at: row.updated_at,
    },
    items: items
      .filter((item) => item.order_id === row.id)
      .map((item) => ({
        id: item.id,
        product_name_snapshot: item.product_name_snapshot,
        unit_price_snapshot: item.unit_price_snapshot,
        quantity: item.quantity,
        notes: item.notes,
        line_total: item.line_total,
      })),
    modifiers: itemModifiers
      .filter((modifier) =>
        items.some(
          (item) => item.order_id === row.id && item.id === modifier.order_item_id,
        ),
      )
      .map((modifier) => ({
        id: modifier.id,
        order_item_id: modifier.order_item_id,
        modifier_name_snapshot: modifier.modifier_name_snapshot,
        price_delta_snapshot: modifier.price_delta_snapshot,
        quantity: modifier.quantity,
      })),
  });

  const rpc = (fn: string, args: Record<string, unknown>) => {
    rpcCalls.push({ fn, args });

    const single = async <T>(): Promise<{
      data: T | null;
      error: SupabaseFailure | null;
    }> => {
      if (fn === "create_draft_order") {
      // The RPC is one transaction: everything validates before any write.
      const source = args.p_source as string;
      const tableId = args.p_table_id as string;
      const sessionId = args.p_table_session_id as string;
      const payload = (args.p_items ?? []) as Array<{
        productId: string;
        quantity: number;
        modifierIds?: string[];
        notes?: string | null;
      }>;
      const idempotencyKey = (args.p_idempotency_key as string | null) ?? null;

      if (source !== "CUSTOMER_QR" && source !== "WAITER" && source !== "POS") {
        return { data: null, error: { message: "Sumber order tidak valid", code: "22023" } };
      }

      // A staff manual order requires an authenticated active account holding
      // the manual-order permission (API_CONTRACT.md §11.1). An anonymous
      // caller using a staff source is refused.
      if ((source === "WAITER" || source === "POS") && !config.staffAuthorized) {
        return {
          data: null,
          error: { message: "Not authorized to create manual orders", code: "42501" },
        };
      }

      const session = sessions.find((row) => row.id === sessionId);
      if (!session) {
        return { data: null, error: { message: "Sesi meja tidak ditemukan", code: "P0002" } };
      }
      if (session.status !== "OPEN") {
        return { data: null, error: { message: "Sesi meja sudah ditutup", code: "23003" } };
      }
      if (session.tableId !== tableId) {
        return { data: null, error: { message: "Sesi tidak terhubung ke meja ini", code: "23003" } };
      }

      if (payload.length === 0) {
        return { data: null, error: { message: "Order harus memiliki minimal satu item", code: "22023" } };
      }

      // Idempotency: a repeat with the same key returns the first result as-is.
      if (idempotencyKey !== null) {
        const existing = orders.find((row) => row.idempotency_key === idempotencyKey);
        if (existing) {
          return { data: payloadFor(existing) as unknown as T, error: null };
        }
      }

      // Validate and price every item before writing a single row.
      let subtotal = 0;
      for (const item of payload) {
        const quantity = Number(item.quantity);
        if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 999) {
          return { data: null, error: { message: "Jumlah item tidak valid", code: "22023" } };
        }
        const priced = priceItem(item);
        if (priced.error) {
          return { data: null, error: priced.error };
        }
        subtotal += priced.lineTotal;
      }

      if (config.createError) {
        return { data: null, error: config.createError };
      }

      // Mutate: the order, its items, and their modifiers all land together.
      const orderId = `ord-${orders.length + 1}`;
      const row: OrderRow = {
        id: orderId,
        order_number: `TS-${String(orders.length + 1).padStart(4, "0")}`,
        table_id: tableId,
        table_session_id: sessionId,
        source,
        status: "DRAFT",
        version: 1,
        notes: (args.p_customer_note as string | null) ?? null,
        subtotal,
        discount: 0,
        tax: 0,
        total: subtotal,
        idempotency_key: idempotencyKey,
        submit_idempotency_key: null,
        created_by: null,
        created_at: "2026-09-29T10:00:00Z",
        updated_at: "2026-09-29T10:00:00Z",
      };
      orders.push(row);

      payload.forEach((item, index) => {
        const product = findProduct(item.productId)!;
        const itemRow: OrderItemRow = {
          id: `item-${orderId}-${index}`,
          order_id: orderId,
          product_id: product.id,
          product_name_snapshot: product.name,
          unit_price_snapshot: product.price,
          quantity: item.quantity,
          notes: item.notes ?? null,
          line_total: product.price * item.quantity,
        };
        items.push(itemRow);

        for (const modifierId of item.modifierIds ?? []) {
          const modifier = findModifier(modifierId)!;
          itemModifiers.push({
            id: `mod-${orderId}-${index}-${modifierId}`,
            order_item_id: itemRow.id,
            modifier_id: modifier.id,
            modifier_name_snapshot: modifier.name,
            price_delta_snapshot: modifier.priceDelta,
            quantity: item.quantity,
          });
        }
      });

      return { data: payloadFor(row) as unknown as T, error: null };
    }

    // -------------------------------------------------------------------------
    // submit_order() — mirrors migration 010 part 3. One transaction: authorize
    // -> idempotency check -> load+lock draft -> validate context -> recalculate
    // -> transition -> history. Everything validates before the row moves.
    // -------------------------------------------------------------------------
    if (fn === "submit_order") {
      const source = args.p_source as string;
      const orderId = args.p_order_id as string;
      const tableId = (args.p_table_id as string | null) ?? null;
      const sessionId = (args.p_table_session_id as string | null) ?? null;
      const idempotencyKey = (args.p_idempotency_key as string | null) ?? null;

      if (source !== "CUSTOMER_QR" && source !== "WAITER" && source !== "POS") {
        return { data: null, error: { message: "Sumber order tidak valid", code: "22023" } };
      }

      if ((source === "WAITER" || source === "POS") && !config.staffAuthorized) {
        return {
          data: null,
          error: { message: "Not authorized to submit manual orders", code: "42501" },
        };
      }

      // Idempotency check before mutate: a repeat returns the first result.
      if (idempotencyKey !== null) {
        const replayed = orders.find((row) => row.submit_idempotency_key === idempotencyKey);
        if (replayed) {
          return { data: payloadFor(replayed) as unknown as T, error: null };
        }
      }

      const order = orders.find((row) => row.id === orderId);
      if (!order) {
        return { data: null, error: { message: "Order tidak ditemukan", code: "P0002" } };
      }

      // Only a DRAFT can be submitted. Anything else was already submitted.
      if (order.status !== "DRAFT") {
        return { data: null, error: { message: "Order sudah disubmit", code: "23003" } };
      }

      if (order.source !== source) {
        return {
          data: null,
          error: { message: "Sumber order tidak cocok untuk order ini", code: "22023" },
        };
      }

      // The customer path must prove the table + OPEN session context.
      if (source === "CUSTOMER_QR") {
        if (tableId === null || sessionId === null) {
          return {
            data: null,
            error: { message: "Konteks meja wajib untuk submit pesanan", code: "22023" },
          };
        }
        if (tableId !== order.table_id) {
          return { data: null, error: { message: "Order tidak terkait dengan meja ini", code: "23003" } };
        }
        if (sessionId !== order.table_session_id) {
          return { data: null, error: { message: "Order tidak terkait dengan sesi ini", code: "23003" } };
        }
      }

      const table = tables.find((row) => row.id === order.table_id);
      if (!table) {
        return { data: null, error: { message: "Meja tidak ditemukan", code: "P0002" } };
      }
      if (!table.isActive) {
        return { data: null, error: { message: "Meja tidak aktif", code: "23003" } };
      }

      const session = sessions.find((row) => row.id === order.table_session_id);
      if (!session) {
        return { data: null, error: { message: "Sesi meja tidak ditemukan", code: "P0002" } };
      }
      if (session.status !== "OPEN") {
        return { data: null, error: { message: "Sesi meja sudah ditutup", code: "23003" } };
      }

      const orderItems = items.filter((row) => row.order_id === orderId);
      if (orderItems.length === 0) {
        return {
          data: null,
          error: { message: "Order harus memiliki minimal satu item", code: "22023" },
        };
      }

      // Recalculate from the live catalog and compare to the frozen snapshot.
      let recomputed = 0;
      for (const orderItem of orderItems) {
        const product = findProduct(orderItem.product_id as string);
        if (!product) {
          return { data: null, error: { message: "Produk tidak ditemukan", code: "P0002" } };
        }
        if (!product.isActive) {
          return {
            data: null,
            error: { message: `Produk ${product.name} tidak aktif`, code: "23003" },
          };
        }
        if (!product.isAvailable) {
          return {
            data: null,
            error: { message: `Produk ${product.name} sedang tidak tersedia`, code: "P0003" },
          };
        }

        const lineTotal = product.price * Number(orderItem.quantity);

        const selection = itemModifiers.filter(
          (row) => row.order_item_id === orderItem.id,
        );
        for (const selectionRow of selection) {
          const modifier = findModifier(selectionRow.modifier_id as string);
          if (!modifier) {
            return { data: null, error: { message: "Modifier tidak ditemukan", code: "P0002" } };
          }
          if (!modifier.isActive) {
            return {
              data: null,
              error: { message: `Modifier ${modifier.name} tidak aktif`, code: "23003" },
            };
          }
          const link = productModifiers.find(
            (row) => row.productId === product.id && row.modifierId === modifier.id,
          );
          if (!link || !link.isActive) {
            return {
              data: null,
              error: {
                message: `Modifier ${modifier.name} tidak tersedia untuk produk ini`,
                code: "23003",
              },
            };
          }
        }

        const modifierDelta = selection.reduce(
          (sum, selectionRow) =>
            sum +
            (findModifier(selectionRow.modifier_id as string)?.priceDelta ?? 0) *
              Number(selectionRow.quantity),
          0,
        );

        recomputed += lineTotal + modifierDelta;
      }

      if (recomputed !== order.total) {
        return {
          data: null,
          error: {
            message: "Harga menu telah berubah, mohon buat ulang pesanan",
            code: "23003",
          },
        };
      }

      if (config.submitError) {
        return { data: null, error: config.submitError };
      }

      // Mutate: the row moves to the steady state, and both hops of the
      // transition land in the same step.
      order.status = "PENDING_CONFIRMATION";
      order.submit_idempotency_key = idempotencyKey;
      order.updated_at = "2026-09-29T11:00:00Z";

      // Both hops of the atomic transition land in the same step
      // (API_CONTRACT.md §10.2, §13).
      history.push(
        {
          id: `hist-${orderId}-1`,
          order_id: orderId,
          from_status: "DRAFT",
          to_status: "SUBMITTED",
          actor_id: null,
          actor_role: null,
          reason: null,
        },
        {
          id: `hist-${orderId}-2`,
          order_id: orderId,
          from_status: "SUBMITTED",
          to_status: "PENDING_CONFIRMATION",
          actor_id: null,
          actor_role: null,
          reason: null,
        },
      );

      return { data: payloadFor(order) as unknown as T, error: null };
    }

    // -------------------------------------------------------------------------
    // get_customer_order() — mirrors migration 010 part 4. A validating read, not
    // a lookup: the caller must prove the table + OPEN session the order actually
    // belongs to, and every other state resolves to NULL rather than a partial
    // record. The projection below emits only the customer-safe columns.
    // -------------------------------------------------------------------------
    if (fn === "get_customer_order") {
      const orderId = (args.p_order_id as string | null) ?? null;
      const tableId = (args.p_table_id as string | null) ?? null;
      const sessionId = (args.p_table_session_id as string | null) ?? null;

      const order = orders.find((row) => row.id === orderId);

      // The context is the credential (API_CONTRACT.md §30): an order id alone
      // never authorizes this read, and NULL is the answer to every invalid
      // state — unknown order, missing context, context that is not the
      // order's own.
      const contextProven =
        order !== undefined &&
        tableId !== null &&
        tableId === order.table_id &&
        sessionId !== null &&
        sessionId === order.table_session_id;

      if (!contextProven) {
        return { data: null, error: null };
      }

      const table = tables.find((row) => row.id === order!.table_id);
      if (!table || !table.isActive) {
        return { data: null, error: null };
      }

      const session = sessions.find((row) => row.id === order!.table_session_id);
      if (!session || session.tableId !== order!.table_id || session.status !== "OPEN") {
        return { data: null, error: null };
      }

      if (config.readError) {
        return { data: null, error: config.readError };
      }

      return { data: projectFor(order!) as unknown as T, error: null };
    }

    if (fn === "transition_order") {
      const orderId = (args.p_order_id as string | null) ?? null;
      const toStatus = (args.p_to_status as string | null) ?? null;
      const expectedVersion = (args.p_expected_version as number | null) ?? null;
      const permissions = config.actorPermissions ?? [];

      // 1. ACTOR — an authenticated, active staff member. An empty permission
      // set models anonymous and an inactive account alike: both authorize
      // nothing and fail closed.
      if (permissions.length === 0) {
        return {
          data: null,
          error: { message: "Not authorized to transition orders", code: "42501" },
        };
      }

      // 2. TARGET VOCABULARY — the requested status must be a real state.
      if (!ORDER_STATUSES.includes(toStatus as OrderStatus)) {
        return { data: null, error: { message: "Status tujuan tidak valid", code: "22023" } };
      }

      // 3. LOAD the row (the real command locks it; the fake is single-
      // threaded, and the version checks below carry the concurrency case).
      const order = orders.find((row) => row.id === orderId);
      if (!order) {
        return { data: null, error: { message: "Order tidak ditemukan", code: "P0002" } };
      }

      // 4. IDEMPOTENCY — already at the requested status is a no-op success:
      // the order is returned and no history row is written.
      if (order.status === toStatus) {
        return { data: payloadFor(order) as unknown as T, error: null };
      }

      // 5. CONCURRENCY/VERSION — a mismatch is a stale request, refused as a
      // conflict rather than applied over a newer state.
      if (expectedVersion !== null && order.version !== expectedVersion) {
        return {
          data: null,
          error: {
            message: "Versi order telah berubah, mohon muat ulang order",
            code: "40001",
          },
        };
      }

      // 6. THE RULE — the (current -> requested) pair must be permitted. This
      // is the single source of the graph; unknown pairs, backward hops and
      // escapes from terminal states all land here.
      const rule = TRANSITION_RULES.find(
        (row) => row.from === order.status && row.to === toStatus,
      );
      if (!rule) {
        return {
          data: null,
          error: {
            message: `Transisi ${order.status} -> ${toStatus} tidak diizinkan`,
            code: "23003",
          },
        };
      }

      // 7. PERMISSION — the union over the caller's roles, not a role name the
      // client sent.
      if (!permissions.includes(rule.permission)) {
        return {
          data: null,
          error: {
            message: `Not authorized untuk transisi ${order.status} -> ${toStatus}`,
            code: "42501",
          },
        };
      }

      // 8. REASON where the rule demands one; whitespace-only is no reason.
      const reason = (args.p_reason as string | null)?.trim() || null;
      if (rule.requiresReason && reason === null) {
        return {
          data: null,
          error: {
            message: `Alasan wajib untuk transisi ${order.status} -> ${toStatus}`,
            code: "22023",
          },
        };
      }

      if (config.transitionError) {
        return { data: null, error: config.transitionError };
      }

      // 9. MUTATE — one conditional move: status changes, version bumps.
      const previousStatus = order.status;
      order.status = toStatus as OrderStatus;
      // numeric columns may arrive as strings; the bump is always a number.
      order.version = Number(order.version ?? 1) + 1;
      order.updated_at = "2026-09-29T12:00:00Z";

      // Append-only audit (AUTH_RBAC_RLS.md §29).
      history.push({
        id: `hist-${order.id}-${history.filter((row) => row.order_id === order.id).length + 1}`,
        order_id: order.id,
        from_status: previousStatus,
        to_status: toStatus,
        actor_id: config.actorId ?? "staff-1",
        actor_role: config.actorRole ?? null,
        reason,
      });

      return { data: payloadFor(order) as unknown as T, error: null };
    }

    return { data: null, error: { message: "Unknown function", code: "42883" } };
  };

  return { single };
  };

  const selectFrom = (
    table: "orders" | "order_items" | "order_item_modifiers" | "order_status_history",
  ) => {
    const filters: Record<string, unknown> = {};
    const inFilters: Record<string, unknown[]> = {};

    const matched = () => {
      const source =
        table === "orders"
          ? orders
          : table === "order_items"
            ? items
            : table === "order_item_modifiers"
              ? itemModifiers
              : history;
      return source.filter((row) => {
        const record = row as unknown as Record<string, unknown>;
        const okEq = Object.entries(filters).every(([col, val]) => record[col] === val);
        const okIn = Object.entries(inFilters).every(
          ([col, vals]) => vals.includes(record[col]) || vals.includes(String(record[col])),
        );
        return okEq && okIn;
      });
    };

    // The real Postgrest builder is thenable, so `.select().eq(...)` can be
    // awaited directly. Mirroring that keeps the reads in tests honest.
    const chain = {
      eq: (column: string, value: unknown) => {
        filters[column] = value;
        return chain;
      },
      in: (column: string, values: unknown[]) => {
        inFilters[column] = values;
        return chain;
      },
      order: (_column: string) => Promise.resolve({ data: matched(), error: null }),
      then: <U>(
        onFulfilled?: (value: { data: unknown[]; error: null }) => U | PromiseLike<U>,
        onRejected?: (reason: unknown) => U | PromiseLike<U>,
      ) => Promise.resolve({ data: matched(), error: null }).then(onFulfilled, onRejected),
    };

    return { select: () => chain };
  };

  const client = {
    rpc,
    from: (
      table: "orders" | "order_items" | "order_item_modifiers" | "order_status_history",
    ) => selectFrom(table),
  };

  return client as unknown as SupabaseClient<Database>;
}

const baseInput = {
  source: "CUSTOMER_QR" as const,
  tableId: TABLE_ID,
  tableSessionId: SESSION_ID,
  items: [{ productId: PRODUCT_ID, quantity: 2 }],
};

/**
 * Call the RPC boundary directly, bypassing the query layer's shape guard.
 *
 * The query layer deliberately rejects a malformed payload before it reaches
 * the network, which is the right call (one less round trip) but hides the
 * server-side re-check. The database is the authority, so this helper exercises
 * the boundary Postgres actually enforces: even a client that skips its own
 * guard cannot create a bad order.
 */
async function callRpc(
  client: SupabaseClient<Database>,
  input: CreateDraftOrderInput,
): Promise<{ data: OrderRow | null; error: SupabaseFailure | null }> {
  const rpc = (
    client as unknown as {
      rpc: (
        fn: string,
        args: Record<string, unknown>,
      ) => { single: () => Promise<{ data: OrderRow | null; error: SupabaseFailure | null }> };
    }
  ).rpc;
  return rpc("create_draft_order", toCreateDraftOrderArgs(input)).single();
}

/**
 * Call the submit RPC boundary directly, bypassing the query layer's shape
 * guard — same reasoning as `callRpc`: the server-side re-check is the
 * authority, so it must be provable even when the client skips its own guard.
 */
async function callSubmitRpc(
  client: SupabaseClient<Database>,
  input: SubmitOrderInput,
): Promise<{ data: OrderRow | null; error: SupabaseFailure | null }> {
  const rpc = (
    client as unknown as {
      rpc: (
        fn: string,
        args: Record<string, unknown>,
      ) => { single: () => Promise<{ data: OrderRow | null; error: SupabaseFailure | null }> };
    }
  ).rpc;
  return rpc("submit_order", toSubmitOrderArgs(input)).single();
}

/**
 * Call the transition RPC boundary directly, bypassing the query layer's shape
 * guard — same reasoning as `callRpc`/`callSubmitRpc`: the server-side checks are
 * the authority, so the reason guard, the vocabulary check and the permission
 * gate must hold even for a client that skips its own guard.
 */
async function callTransitionRpc(
  client: SupabaseClient<Database>,
  input: TransitionOrderInput,
): Promise<{ data: OrderRow | null; error: SupabaseFailure | null }> {
  const rpc = (
    client as unknown as {
      rpc: (
        fn: string,
        args: Record<string, unknown>,
      ) => { single: () => Promise<{ data: OrderRow | null; error: SupabaseFailure | null }> };
    }
  ).rpc;
  return rpc("transition_order", toTransitionOrderArgs(input)).single();
}

/**
 * Read the audit trail the way the real client would, typed against the row the
 * fake appends (AUTH_RBAC_RLS.md §29: history is the append-only trail the
 * transition commands own).
 */
async function readHistory(
  client: SupabaseClient<Database>,
  orderId: string,
): Promise<FakeStatusHistoryRow[]> {
  const reader = client as unknown as {
    from: (table: string) => {
      select: () => {
        eq: (column: string, value: string) => Promise<{
          data: FakeStatusHistoryRow[] | null;
          error: null;
        }>;
      };
    };
  };
  const reply = await reader
    .from("order_status_history")
    .select()
    .eq("order_id", orderId);
  return reply.data ?? [];
}

describe("createDraftOrder", () => {
  describe("valid product", () => {
    it("creates a draft with server-priced totals", async () => {
      const config: FakeConfig = { rpcCalls: [] };
      const result = await createDraftOrder(fakeClient(config), baseInput);

      expect(result.error).toBeNull();
      expect(result.data?.order.status).toBe("DRAFT");
      expect(result.data?.order.source).toBe("CUSTOMER_QR");
      // 2 x 45000, priced from the catalog, not from the client.
      expect(result.data?.order.subtotal).toBe(90000);
      expect(result.data?.order.total).toBe(90000);
      expect(result.data?.order.tax).toBe(0);
      expect(result.data?.order.discount).toBe(0);
      expect(result.data?.order.items).toHaveLength(1);
      expect(result.data?.order.items[0]?.unitPriceSnapshot).toBe(45000);
      expect(result.data?.order.items[0]?.lineTotal).toBe(90000);
    });

    it("sends references and intent only, never a price", async () => {
      const config: FakeConfig = { rpcCalls: [] };
      await createDraftOrder(fakeClient(config), baseInput);

      expect(config.rpcCalls).toHaveLength(1);
      const firstCall = config.rpcCalls?.[0];
      expect(firstCall?.fn).toBe("create_draft_order");
      const args = firstCall?.args as Record<string, unknown>;
      expect(Object.keys(args ?? {})).toEqual([
        "p_source",
        "p_table_id",
        "p_table_session_id",
        "p_items",
        "p_customer_note",
        "p_internal_note",
        "p_idempotency_key",
      ]);
      // No money and no status is carried anywhere in the payload.
      const item = (args.p_items as Array<Record<string, unknown>>)[0];
      expect(Object.keys(item ?? {})).toEqual(["productId", "quantity", "modifierIds", "notes"]);
    });

    it("prices modifiers from the catalog and snapshots them", async () => {
      const result = await createDraftOrder(fakeClient(), {
        ...baseInput,
        items: [
          { productId: PRODUCT_ID, quantity: 2, modifierIds: [MOD_ID] },
        ],
      });

      expect(result.error).toBeNull();
      // 2 x 45000 + 2 x 0 (free modifier).
      expect(result.data?.order.subtotal).toBe(90000);
      expect(result.data?.order.modifiers).toHaveLength(1);
      expect(result.data?.order.modifiers[0]?.modifierNameSnapshot).toBe("Level Pedas");
      expect(result.data?.order.modifiers[0]?.priceDeltaSnapshot).toBe(0);
    });

    it("carries the table session association onto the order", async () => {
      const result = await createDraftOrder(fakeClient(), baseInput);
      expect(result.error).toBeNull();
      expect(result.data?.order.tableId).toBe(TABLE_ID);
      expect(result.data?.order.tableSessionId).toBe(SESSION_ID);
    });

    it("records an audit event describing the create", async () => {
      const result = await createDraftOrder(fakeClient(), baseInput);
      expect(result.data?.audit.kind).toBe("create");
      expect(result.data?.audit.orderId).toBe(result.data?.order.id);
      expect(result.data?.audit.total).toBe(90000);
    });
  });

  describe("inactive product", () => {
    it("refuses an inactive product and creates nothing", async () => {
      const config: FakeConfig = { rpcCalls: [] };
      const result = await createDraftOrder(fakeClient(config), {
        ...baseInput,
        items: [{ productId: PRODUCT_INACTIVE_ID, quantity: 1 }],
      });

      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("tidak aktif");
      // A refused create writes no order at all.
      expect(config.rpcCalls).toHaveLength(1);
    });

    it("refuses an unavailable product", async () => {
      const result = await createDraftOrder(fakeClient(), {
        ...baseInput,
        items: [{ productId: PRODUCT_UNAVAILABLE_ID, quantity: 1 }],
      });

      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("tidak tersedia");
    });

    it("refuses an unknown product", async () => {
      const result = await createDraftOrder(fakeClient(), {
        ...baseInput,
        items: [{ productId: "p-does-not-exist", quantity: 1 }],
      });

      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("tidak ditemukan");
    });
  });

  describe("invalid modifier", () => {
    it("refuses a modifier that does not belong to the product", async () => {
      const result = await createDraftOrder(fakeClient(), {
        ...baseInput,
        items: [
          { productId: PRODUCT_ID, quantity: 1, modifierIds: [MOD_FOREIGN_ID] },
        ],
      });

      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("tidak tersedia untuk produk ini");
    });

    it("refuses an inactive modifier", async () => {
      const result = await createDraftOrder(fakeClient(), {
        ...baseInput,
        items: [
          { productId: PRODUCT_ID, quantity: 1, modifierIds: [MOD_INACTIVE_ID] },
        ],
      });

      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("tidak aktif");
    });

    it("refuses an unknown modifier", async () => {
      const result = await createDraftOrder(fakeClient(), {
        ...baseInput,
        items: [
          { productId: PRODUCT_ID, quantity: 1, modifierIds: ["m-does-not-exist"] },
        ],
      });

      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("tidak ditemukan");
    });
  });

  describe("quantity validation", () => {
    // The query layer guards shape before a round trip, and the server re-checks
    // inside the transaction. Both must refuse; neither may create an order.
    it("refuses a zero quantity at the client guard, before the network", async () => {
      const config: FakeConfig = { rpcCalls: [] };
      const result = await createDraftOrder(fakeClient(config), {
        ...baseInput,
        items: [{ productId: PRODUCT_ID, quantity: 0 }],
      });

      expect(result.data).toBeNull();
      expect(result.error?.message).toBe("Data order tidak lengkap.");
      expect(config.rpcCalls).toHaveLength(0);
    });

    it("refuses a zero quantity at the server boundary too", async () => {
      const reply = await callRpc(fakeClient(), {
        ...baseInput,
        items: [{ productId: PRODUCT_ID, quantity: 0 }],
      });

      expect(reply.data).toBeNull();
      expect(reply.error?.message).toContain("Jumlah item tidak valid");
    });

    it("refuses a negative quantity at both layers", async () => {
      const guarded = await createDraftOrder(fakeClient(), {
        ...baseInput,
        items: [{ productId: PRODUCT_ID, quantity: -3 }],
      });
      expect(guarded.data).toBeNull();
      expect(guarded.error?.message).toBe("Data order tidak lengkap.");

      const reply = await callRpc(fakeClient(), {
        ...baseInput,
        items: [{ productId: PRODUCT_ID, quantity: -3 }],
      });
      expect(reply.data).toBeNull();
      expect(reply.error?.message).toContain("Jumlah item tidak valid");
    });

    it("refuses an absurd quantity at both layers", async () => {
      const guarded = await createDraftOrder(fakeClient(), {
        ...baseInput,
        items: [{ productId: PRODUCT_ID, quantity: 10000 }],
      });
      expect(guarded.data).toBeNull();

      const reply = await callRpc(fakeClient(), {
        ...baseInput,
        items: [{ productId: PRODUCT_ID, quantity: 10000 }],
      });
      expect(reply.data).toBeNull();
      expect(reply.error?.message).toContain("Jumlah item tidak valid");
    });

    it("rejects a malformed payload before it reaches the network", async () => {
      const config: FakeConfig = { rpcCalls: [] };
      const result = await createDraftOrder(fakeClient(config), {
        ...baseInput,
        items: [],
      });

      expect(result.data).toBeNull();
      expect(result.error?.message).toBe("Data order tidak lengkap.");
      expect(config.rpcCalls).toHaveLength(0);
    });
  });

  describe("price tampering", () => {
    // The input type has no money field, so a caller cannot send a price. This
    // asserts the guarantee structurally: a tampered cast is dropped by the
    // arg builder, and the totals come back from the catalog regardless.
    it("ignores any client-supplied money and prices from the catalog", async () => {
      const config: FakeConfig = { rpcCalls: [] };
      const tampered = {
        ...baseInput,
        items: [
          {
            productId: PRODUCT_ID,
            quantity: 2,
            // A hostile client tries to send its own prices; the arg builder
            // never maps these keys, so they cannot reach the RPC.
            unitPrice: 1,
            lineTotal: 2,
            subtotal: 3,
            total: 4,
          },
        ],
        total: 1,
        subtotal: 1,
        tax: 1,
      } as unknown as typeof baseInput;

      const result = await createDraftOrder(fakeClient(config), tampered);

      expect(result.error).toBeNull();
      const args = config.rpcCalls?.[0]?.args as Record<string, unknown>;
      const item = (args.p_items as Array<Record<string, unknown>>)[0];
      expect(item).not.toHaveProperty("unitPrice");
      expect(item).not.toHaveProperty("lineTotal");
      expect(args).not.toHaveProperty("total");
      expect(args).not.toHaveProperty("subtotal");
      expect(args).not.toHaveProperty("tax");
      // Server price wins: 2 x 45000.
      expect(result.data?.order.subtotal).toBe(90000);
      expect(result.data?.order.total).toBe(90000);
    });

    it("never echoes client money back as the order total", async () => {
      const result = await createDraftOrder(fakeClient(), {
        ...baseInput,
        items: [{ productId: PRODUCT_ID, quantity: 3, modifierIds: [MOD_ID] }],
      });

      // 3 x 45000 + 3 x 0.
      expect(result.data?.order.subtotal).toBe(135000);
      expect(result.data?.order.total).toBe(result.data?.order.subtotal);
    });
  });

  describe("duplicate request", () => {
    it("returns the same order for a repeated idempotency key", async () => {
      const client = fakeClient();
      const input = { ...baseInput, idempotencyKey: "idem-1" };

      const first = await createDraftOrder(client, input);
      const second = await createDraftOrder(client, input);

      expect(first.error).toBeNull();
      expect(second.error).toBeNull();
      expect(first.data?.order.id).toBe(second.data?.order.id);
      expect(first.data?.order.orderNumber).toBe(second.data?.order.orderNumber);
      expect(first.data?.order.total).toBe(second.data?.order.total);
    });

    it("creates separate orders for separate keys", async () => {
      const client = fakeClient();

      const first = await createDraftOrder(client, { ...baseInput, idempotencyKey: "idem-a" });
      const second = await createDraftOrder(client, { ...baseInput, idempotencyKey: "idem-b" });

      expect(first.data?.order.id).not.toBe(second.data?.order.id);
      expect(first.data?.order.orderNumber).not.toBe(second.data?.order.orderNumber);
    });
  });

  describe("concurrent request", () => {
    // Two in-flight creates with the same key must collapse into one order,
    // the way the unique index forces the loser in Postgres to read the winner.
    it("collapses racing duplicate creates into a single order", async () => {
      const client = fakeClient();
      const input = { ...baseInput, idempotencyKey: "idem-race" };

      const [first, second] = await Promise.all([
        createDraftOrder(client, input),
        createDraftOrder(client, input),
      ]);

      expect(first.error).toBeNull();
      expect(second.error).toBeNull();
      expect(first.data?.order.id).toBe(second.data?.order.id);
      expect(first.data?.order.orderNumber).toBe(second.data?.order.orderNumber);
    });

    it("lets distinct concurrent creates both succeed", async () => {
      const client = fakeClient();

      const [first, second] = await Promise.all([
        createDraftOrder(client, { ...baseInput, idempotencyKey: "idem-c1" }),
        createDraftOrder(client, {
          ...baseInput,
          idempotencyKey: "idem-c2",
          items: [{ productId: PRODUCT_ID, quantity: 1 }],
        }),
      ]);

      expect(first.error).toBeNull();
      expect(second.error).toBeNull();
      expect(first.data?.order.id).not.toBe(second.data?.order.id);
      expect(first.data?.order.total).toBe(90000);
      expect(second.data?.order.total).toBe(45000);
    });
  });

  describe("session validation", () => {
    it("refuses an order against a closed session", async () => {
      const result = await createDraftOrder(fakeClient(), {
        ...baseInput,
        tableSessionId: SESSION_CLOSED_ID,
      });

      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("sudah ditutup");
    });

    it("refuses a session that belongs to a different table", async () => {
      const result = await createDraftOrder(fakeClient(), {
        ...baseInput,
        tableSessionId: SESSION_OTHER_TABLE_ID,
      });

      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("tidak terhubung ke meja ini");
    });

    it("refuses an unknown session", async () => {
      const result = await createDraftOrder(fakeClient(), {
        ...baseInput,
        tableSessionId: "s-does-not-exist",
      });

      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("tidak ditemukan");
    });

    it("refuses a staff source from an unauthorized account", async () => {
      const result = await createDraftOrder(fakeClient(), {
        ...baseInput,
        source: "WAITER",
      });

      // A staff source without an authenticated staff session is refused.
      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("Not authorized");
    });

    it("accepts a staff source when the session holds the permission", async () => {
      const result = await createDraftOrder(fakeClient({ staffAuthorized: true }), {
        ...baseInput,
        source: "WAITER",
      });

      expect(result.error).toBeNull();
      expect(result.data?.order.source).toBe("WAITER");
    });

    it("refuses an unknown source value at the server boundary", async () => {
      const reply = await callRpc(fakeClient(), {
        ...baseInput,
        source: "WEBSITE" as never,
      });

      expect(reply.data).toBeNull();
      expect(reply.error?.message).toContain("Sumber order tidak valid");
    });

    it("refuses an incomplete context before it reaches the network", async () => {
      const config: FakeConfig = { rpcCalls: [] };
      const result = await createDraftOrder(fakeClient(config), {
        ...baseInput,
        tableSessionId: "",
      });

      expect(result.data).toBeNull();
      expect(result.error?.message).toBe("Data order tidak lengkap.");
      expect(config.rpcCalls).toHaveLength(0);
    });
  });
});

/**
 * Create a draft with the standard basket, then submit it. Most submit tests
 * start from a healthy draft so the scenario under test is the only variable.
 */
async function createDraftThenSubmit(
  config: FakeConfig,
  submitInput: Partial<SubmitOrderInput> = {},
): Promise<{ order: DraftOrder } | { error: string }> {
  const client = fakeClient(config);
  const created = await createDraftOrder(client, baseInput);
  if (created.error) return { error: created.error.message };

  const result = await submitOrder(client, {
    orderId: created.data?.order.id ?? "",
    source: "CUSTOMER_QR",
    tableId: TABLE_ID,
    tableSessionId: SESSION_ID,
    idempotencyKey: "submit-once",
    ...submitInput,
  });
  if (result.error) return { error: result.error.message };
  if (!result.data?.order) throw new Error("submit returned no order");
  return { order: result.data.order };
}

/**
 * Create a healthy draft at the current catalog, then move the catalog
 * underneath it. The frozen snapshot still carries the original price, so the
 * submit-time recalculation no longer reconciles and the command must refuse
 * rather than silently re-price (API_CONTRACT.md §27).
 *
 * The fake captures the catalog array by reference, so mutating a product row
 * in place is visible to the submit call but not retroactive to the draft that
 * was already written — exactly the window the real command guards.
 */
async function driftCatalogAfterDraft(
  mutate: (product: FakeProduct) => void,
): Promise<{ client: SupabaseClient<Database>; orderId: string }> {
  const config: FakeConfig = { rpcCalls: [] };
  // Give the fake its own catalog rows, captured by reference at construction.
  // An in-place mutation after the create is therefore visible to the submit
  // recalculation but is not retroactive to the snapshot already written —
  // exactly the window the real command guards (API_CONTRACT.md §27).
  config.products = CATALOG.products!.map((row) => ({ ...row }));
  const client = fakeClient(config);
  const created = await createDraftOrder(client, baseInput);
  if (created.error) throw new Error(created.error.message);

  const product = config.products.find((row) => row.id === PRODUCT_ID);
  if (product) mutate(product);

  return { client, orderId: created.data?.order.id ?? "" };
}

/**
 * Create a WAITER draft under an authorized staff session, then drop the grant
 * so the submit arrives unauthorized — refused with 42501 (API_CONTRACT.md
 * §11.2). The create needs the grant; the submit must not inherit it.
 */
async function staffDraftThenUnauthorized(): Promise<{
  client: SupabaseClient<Database>;
  orderId: string;
}> {
  const config: FakeConfig = { rpcCalls: [], staffAuthorized: true };
  const client = fakeClient(config);
  const created = await createDraftOrder(client, { ...baseInput, source: "WAITER" });
  if (created.error) throw new Error(created.error.message);
  config.staffAuthorized = false;
  return { client, orderId: created.data?.order.id ?? "" };
}

describe("submitOrder", () => {
  describe("valid submission", () => {
    it("moves a draft to PENDING_CONFIRMATION and returns the full order", async () => {
      const result = await createDraftThenSubmit({ rpcCalls: [] });

      expect("error" in result).toBe(false);
      if ("order" in result) {
        expect(result.order.status).toBe("PENDING_CONFIRMATION");
        // The snapshot lines come back with the order, so an anonymous
        // customer never sees a partial record (Phase 8A HIGH-2 fix).
        expect(result.order.items).toHaveLength(1);
        expect(result.order.items[0]?.productNameSnapshot).toBe("Nasi Liwet");
        expect(result.order.total).toBe(90000);
      }
    });

    it("sends only the order reference, source, context, and dedup key", async () => {
      const config: FakeConfig = { rpcCalls: [] };
      const client = fakeClient(config);
      const created = await createDraftOrder(client, baseInput);
      if (created.error) throw new Error(created.error.message);

      await submitOrder(client, {
        orderId: created.data?.order.id ?? "",
        source: "CUSTOMER_QR",
        tableId: TABLE_ID,
        tableSessionId: SESSION_ID,
        idempotencyKey: "submit-once",
      });

      const submitCall = config.rpcCalls?.find((call) => call.fn === "submit_order");
      expect(submitCall).toBeDefined();
      expect(Object.keys(submitCall?.args ?? {})).toEqual([
        "p_order_id",
        "p_source",
        "p_table_id",
        "p_table_session_id",
        "p_idempotency_key",
      ]);
    });

    it("accepts a waiter submit when the session holds the permission", async () => {
      const config: FakeConfig = { rpcCalls: [], staffAuthorized: true };
      const client = fakeClient(config);
      const created = await createDraftOrder(client, { ...baseInput, source: "WAITER" });
      if (created.error) throw new Error(created.error.message);

      const result = await submitOrder(client, {
        orderId: created.data?.order.id ?? "",
        source: "WAITER",
        idempotencyKey: "submit-waiter",
      });

      expect(result.error).toBeNull();
      expect(result.data?.order.status).toBe("PENDING_CONFIRMATION");
    });
  });

  describe("empty cart", () => {
    it("refuses a submit for an order that does not exist", async () => {
      const reply = await callSubmitRpc(fakeClient(), {
        orderId: "ord-unknown",
        source: "CUSTOMER_QR",
        tableId: TABLE_ID,
        tableSessionId: SESSION_ID,
      });

      expect(reply.data).toBeNull();
      expect(reply.error?.message).toContain("Order tidak ditemukan");
    });

    it("refuses a draft whose item list is empty", async () => {
      // A draft written with no lines by some other path. The create command
      // itself refuses an empty item list, so this is the only shape that
      // reaches the submit command's own empty-cart guard.
      const client = fakeClient({ rpcCalls: [], seedEmptyDraft: true });

      const reply = await callSubmitRpc(client, {
        orderId: "ord-empty",
        source: "CUSTOMER_QR",
        tableId: TABLE_ID,
        tableSessionId: SESSION_ID,
      });

      expect(reply.data).toBeNull();
      expect(reply.error?.message).toContain("Order harus memiliki minimal satu item");
    });
  });

  describe("stale price", () => {
    it("refuses when the catalog price drifted under the draft", async () => {
      // Draft priced at 45000 x 2 = 90000; the catalog then moves to 50000.
      // The snapshot is immutable, so the recalculation cannot reconcile and
      // the command refuses rather than silently re-pricing (API_CONTRACT.md §27).
      const { client, orderId } = await driftCatalogAfterDraft((product) => {
        product.price = 50000;
      });

      const reply = await callSubmitRpc(client, {
        orderId,
        source: "CUSTOMER_QR",
        tableId: TABLE_ID,
        tableSessionId: SESSION_ID,
      });

      expect(reply.data).toBeNull();
      expect(reply.error?.message).toContain("Harga menu telah berubah");
    });
  });

  describe("inactive product", () => {
    it("refuses when a product was deactivated after the draft was built", async () => {
      const { client, orderId } = await driftCatalogAfterDraft((product) => {
        product.isActive = false;
      });

      const reply = await callSubmitRpc(client, {
        orderId,
        source: "CUSTOMER_QR",
        tableId: TABLE_ID,
        tableSessionId: SESSION_ID,
      });

      expect(reply.data).toBeNull();
      expect(reply.error?.message).toContain("tidak aktif");
    });
  });

  describe("duplicate submit", () => {
    it("returns the same order for a repeated submit key", async () => {
      const config: FakeConfig = { rpcCalls: [] };
      const client = fakeClient(config);
      const created = await createDraftOrder(client, baseInput);
      if (created.error) throw new Error(created.error.message);

      const first = await submitOrder(client, {
        orderId: created.data?.order.id ?? "",
        source: "CUSTOMER_QR",
        tableId: TABLE_ID,
        tableSessionId: SESSION_ID,
        idempotencyKey: "submit-once",
      });
      const second = await submitOrder(client, {
        orderId: created.data?.order.id ?? "",
        source: "CUSTOMER_QR",
        tableId: TABLE_ID,
        tableSessionId: SESSION_ID,
        idempotencyKey: "submit-once",
      });

      expect(first.error).toBeNull();
      expect(second.error).toBeNull();
      expect(second.data?.order.id).toBe(first.data?.order.id);
      expect(second.data?.order.status).toBe("PENDING_CONFIRMATION");
    });
  });

  describe("unauthorized submit", () => {
    it("refuses a staff source without an authenticated staff session", async () => {
      // The create needs the grant; the submit must not inherit it. Dropping
      // the grant between the two calls isolates the submit command's own
      // authorization check (API_CONTRACT.md §11.2).
      const { client, orderId } = await staffDraftThenUnauthorized();

      const result = await submitOrder(client, {
        orderId,
        source: "WAITER",
      });

      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("Not authorized");
    });

    it("refuses a customer submit that cannot prove its table context", async () => {
      const client = fakeClient({ rpcCalls: [] });
      const created = await createDraftOrder(client, baseInput);
      if (created.error) throw new Error(created.error.message);

      const result = await submitOrder(client, {
        orderId: created.data?.order.id ?? "",
        source: "CUSTOMER_QR",
        tableId: TABLE_ID,
        tableSessionId: SESSION_OTHER_TABLE_ID,
      });

      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("Order tidak terkait dengan sesi ini");
    });

    it("refuses a customer submit with no table context at all", async () => {
      const client = fakeClient({ rpcCalls: [] });
      const created = await createDraftOrder(client, baseInput);
      if (created.error) throw new Error(created.error.message);

      const result = await submitOrder(client, {
        orderId: created.data?.order.id ?? "",
        source: "CUSTOMER_QR",
      });

      expect(result.data).toBeNull();
      // The query layer's own shape gate refuses first — the anonymous
      // customer path must always carry its table context, so the request
      // never reaches the RPC incomplete (AUTH_RBAC_RLS.md §18).
      expect(result.error?.message).toContain("Data submit order tidak lengkap.");
    });

    it("refuses a source that does not match the order's own source", async () => {
      // An authorized staff session, so the request clears the grant check and
      // reaches the source-mismatch guard: the order belongs to the customer
      // at this table, not to this waiter (API_CONTRACT.md §10.2).
      const client = fakeClient({ rpcCalls: [], staffAuthorized: true });
      const created = await createDraftOrder(client, baseInput);
      if (created.error) throw new Error(created.error.message);

      const result = await submitOrder(client, {
        orderId: created.data?.order.id ?? "",
        source: "WAITER",
      });

      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("Sumber order tidak cocok untuk order ini");
    });
  });

  describe("already submitted", () => {
    it("refuses to submit an order that is no longer a draft", async () => {
      const config: FakeConfig = { rpcCalls: [] };
      const client = fakeClient(config);
      const created = await createDraftOrder(client, baseInput);
      if (created.error) throw new Error(created.error.message);

      const first = await submitOrder(client, {
        orderId: created.data?.order.id ?? "",
        source: "CUSTOMER_QR",
        tableId: TABLE_ID,
        tableSessionId: SESSION_ID,
        idempotencyKey: "submit-first",
      });
      expect(first.error).toBeNull();

      // A second submit with a DIFFERENT key is a genuine conflict, not a
      // replay (API_CONTRACT.md §26).
      const second = await submitOrder(client, {
        orderId: created.data?.order.id ?? "",
        source: "CUSTOMER_QR",
        tableId: TABLE_ID,
        tableSessionId: SESSION_ID,
        idempotencyKey: "submit-second",
      });

      expect(second.data).toBeNull();
      expect(second.error?.message).toContain("Order sudah disubmit");
    });
  });

  describe("status history", () => {
    it("records both hops of the atomic transition", async () => {
      const config: FakeConfig = { rpcCalls: [] };
      const client = fakeClient(config);
      const created = await createDraftOrder(client, baseInput);
      if (created.error) throw new Error(created.error.message);

      const result = await submitOrder(client, {
        orderId: created.data?.order.id ?? "",
        source: "CUSTOMER_QR",
        tableId: TABLE_ID,
        tableSessionId: SESSION_ID,
        idempotencyKey: "submit-once",
      });
      expect(result.error).toBeNull();

      const historyReply = await (
        client as unknown as {
          from: (table: string) => {
            select: () => {
              eq: (column: string, value: string) => Promise<{
                data: FakeStatusHistoryRow[] | null;
                error: null;
              }>;
            };
          };
        }
      )
        .from("order_status_history")
        .select()
        .eq("order_id", created.data?.order.id ?? "");

      const rows = historyReply.data ?? [];
      expect(rows).toHaveLength(2);
      expect(rows[0]?.to_status).toBe("SUBMITTED");
      expect(rows[1]?.to_status).toBe("PENDING_CONFIRMATION");
    });
  });
});

/**
 * Call the read RPC boundary directly, bypassing the query layer's shape guard
 * — same reasoning as `callRpc`: the server-side re-validation is the
 * authority, so it must be provable even when a client skips its own guard.
 */
async function callReadRpc(
  client: SupabaseClient<Database>,
  input: CustomerOrderInput,
): Promise<{
  data: { order: Record<string, unknown> } | null;
  error: SupabaseFailure | null;
}> {
  const rpc = (
    client as unknown as {
      rpc: (
        fn: string,
        args: Record<string, unknown>,
      ) => { single: () => Promise<{ data: unknown; error: SupabaseFailure | null }> };
    }
  ).rpc;
  return rpc("get_customer_order", toCustomerOrderArgs(input)).single() as Promise<{
    data: { order: Record<string, unknown> } | null;
    error: SupabaseFailure | null;
  }>;
}

describe("getCustomerOrder", () => {
  const SEEDED_INPUT: CustomerOrderInput = {
    orderId: "ord-seeded",
    tableId: TABLE_ID,
    tableSessionId: SESSION_ID,
  };

  /** A seeded, submitted order the customer can read at TABLE_ID. */
  function seeded(config: FakeConfig = {}): SupabaseClient<Database> {
    return fakeClient({ seedSubmittedOrder: true, ...config });
  }

  describe("valid context", () => {
    it("returns the order with its snapshotted lines and server money", async () => {
      const config: FakeConfig = { rpcCalls: [] };
      const client = seeded(config);

      const result = await getCustomerOrder(client, SEEDED_INPUT);

      expect(result.error).toBeNull();
      expect(result.data?.id).toBe("ord-seeded");
      expect(result.data?.orderNumber).toBe("TS-0001");
      // The money is the frozen snapshot the server computed, never
      // re-derived from the catalog at read time (§21-§22).
      expect(result.data?.total).toBe(90000);
      expect(result.data?.status).toBe("PENDING_CONFIRMATION");
      expect(result.data?.items).toHaveLength(1);
      expect(result.data?.items[0]?.productNameSnapshot).toBe("Nasi Liwet");
      expect(result.data?.items[0]?.lineTotal).toBe(90000);
      expect(result.data?.items[0]?.unitPriceSnapshot).toBe(45000);
      // The lines come back with their modifier selections, read inside the
      // same frame — an anonymous customer has no `order_items` grant
      // (AUTH_RBAC_RLS.md §28), so a follow-up read would come back empty.
      expect(result.data?.modifiers).toHaveLength(1);
      expect(result.data?.modifiers[0]?.modifierNameSnapshot).toBe("Level Pedas");
    });

    it("sends the order reference and the authorizing context only", async () => {
      const config: FakeConfig = { rpcCalls: [] };
      const client = seeded(config);

      await getCustomerOrder(client, SEEDED_INPUT);

      expect(config.rpcCalls).toHaveLength(1);
      const firstCall = config.rpcCalls?.[0];
      expect(firstCall?.fn).toBe("get_customer_order");
      // Only the lookup reference and the context that authorizes it
      // (API_CONTRACT.md §30): no money, no status, no dedup key is sent.
      expect(Object.keys((firstCall?.args as Record<string, unknown>) ?? {})).toEqual([
        "p_order_id",
        "p_table_id",
        "p_table_session_id",
      ]);
    });
  });

  describe("fail closed", () => {
    it("refuses an order id without its table context", async () => {
      const client = seeded();

      const result = await getCustomerOrder(client, {
        ...SEEDED_INPUT,
        tableId: "t-other",
      });

      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("tidak ditemukan");
    });

    it("refuses an order id with the wrong session", async () => {
      const client = seeded();

      const result = await getCustomerOrder(client, {
        ...SEEDED_INPUT,
        tableSessionId: SESSION_OTHER_TABLE_ID,
      });

      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("tidak ditemukan");
    });

    it("refuses an unknown order even with a valid context", async () => {
      const client = seeded();

      const result = await getCustomerOrder(client, {
        ...SEEDED_INPUT,
        orderId: "ord-nope",
      });

      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("tidak ditemukan");
    });

    it("refuses once the session is closed", async () => {
      // The visit was OPEN when the customer ordered; staff then closed it.
      // A closed visit closes the read window too — the same live context the
      // submit command demands on the write side.
      const config: FakeConfig = {
        rpcCalls: [],
        sessions: [{ id: SESSION_ID, tableId: TABLE_ID, status: "CLOSED" }],
      };
      const client = seeded(config);

      const result = await getCustomerOrder(client, SEEDED_INPUT);

      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("tidak ditemukan");
    });

    it("refuses once the table is archived", async () => {
      const config: FakeConfig = {
        rpcCalls: [],
        tables: [{ id: TABLE_ID, isActive: false }],
      };
      const client = seeded(config);

      const result = await getCustomerOrder(client, SEEDED_INPUT);

      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("tidak ditemukan");
    });

    it("refuses at the RPC boundary even when the client guard is skipped", async () => {
      const client = seeded();

      // The id is real and the table is right, but the session id is not the
      // order's own — the boundary itself must refuse (AUTH_RBAC_RLS.md §47).
      const reply = await callReadRpc(client, {
        ...SEEDED_INPUT,
        tableSessionId: SESSION_CLOSED_ID,
      });

      expect(reply.data).toBeNull();
      expect(reply.error).toBeNull();
    });
  });

  describe("minimal projection", () => {
    it("never returns dedup keys, the staff actor, or the table handles", async () => {
      const client = seeded();

      const reply = await callReadRpc(client, SEEDED_INPUT);

      const projected = reply.data?.order ?? {};
      // Internal columns are dropped in the SECURITY DEFINER frame, not by the
      // client: dedup handles, the staff actor, and the table/session ids the
      // caller already holds (API_CONTRACT.md §10.3 exclusions, §30).
      expect(projected).not.toHaveProperty("idempotency_key");
      expect(projected).not.toHaveProperty("submit_idempotency_key");
      expect(projected).not.toHaveProperty("created_by");
      expect(projected).not.toHaveProperty("table_id");
      expect(projected).not.toHaveProperty("table_session_id");

      // What the customer gets is exactly what their receipt needs (§10.3).
      expect(Object.keys(projected).sort()).toEqual(
        [
          "id",
          "order_number",
          "status",
          "notes",
          "subtotal",
          "discount",
          "tax",
          "total",
          "created_at",
          "updated_at",
        ].sort(),
      );
    });
  });

  describe("malformed input", () => {
    it("rejects an incomplete lookup without a round trip", async () => {
      const config: FakeConfig = { rpcCalls: [] };
      const client = seeded(config);

      const result = await getCustomerOrder(client, {
        orderId: "ord-1",
        tableId: TABLE_ID,
        tableSessionId: "",
      });

      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("tidak lengkap");
      // The shape guard keeps the request off the network entirely.
      expect(config.rpcCalls).toHaveLength(0);
    });
  });

  describe("transport failure", () => {
    it("degrades an error to an explicit failure", async () => {
      const client = seeded({
        rpcCalls: [],
        readError: { message: "42501: permission denied", code: "42501" },
      });

      const result = await getCustomerOrder(client, SEEDED_INPUT);

      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("permission denied");
    });
  });
});

/**
 * Order state transition tests (Phase 8C — API_CONTRACT.md §13).
 *
 * The fake mirrors `transition_order()` (migration 010 part 6) the way Postgres
 * would run it: the caller's permission set resolves server-side, the
 * (from -> to) rule table is the single source of the machine, and every check
 * — actor, vocabulary, idempotency, version, rule, permission, reason — fails
 * closed before a single write. The engine is the only writer of
 * `orders.status`; no client module re-declares a rule (MASTER prompt).
 */
describe("transitionOrder", () => {
  const ORDER_ID = "ord-machine";

  /** Every permission any rule in the machine can ask for (AUTH_RBAC_RLS.md §9). */
  const ALL_RULE_PERMISSIONS = [
    "orders.transition",
    "orders.confirm",
    "orders.reject",
    "orders.cancel",
    "kitchen.start",
    "kitchen.ready",
    "orders.serve",
    "payments.create",
    "payments.refund",
  ];

  /**
   * Place an order at any point in the machine, with a staff caller whose
   * permissions the test controls — never a role name the client sent
   * (API_CONTRACT.md §2.2: the backend determines the actor from the
   * authenticated session).
   */
  const machine = (config: FakeConfig = {}) =>
    fakeClient({
      rpcCalls: [],
      seedOrder: { id: ORDER_ID, status: "PENDING_CONFIRMATION" },
      actorPermissions: ALL_RULE_PERMISSIONS,
      actorId: "staff-9",
      ...config,
    });

  const move = (
    client: SupabaseClient<Database>,
    override: Partial<TransitionOrderInput> = {},
  ) =>
    transitionOrder(client, {
      orderId: ORDER_ID,
      toStatus: "CONFIRMED",
      ...override,
    });

  describe("valid transitions", () => {
    it.each(TRANSITION_RULES)(
      "$from -> $to is permitted with the right permission",
      async ({ from, to, permission, requiresReason }) => {
        const client = fakeClient({
          rpcCalls: [],
          seedOrder: { id: ORDER_ID, status: from as OrderStatus },
          // One permission only: the one this rule requires, so success also
          // proves the engine asked for exactly this permission.
          actorPermissions: [permission],
          actorId: "staff-9",
          actorRole: "staff",
        });

        const result = await transitionOrder(client, {
          orderId: ORDER_ID,
          toStatus: to as OrderStatus,
          reason: requiresReason ? "Pelanggan keluar mendadak" : null,
        });

        expect(result.error).toBeNull();
        expect(result.data?.order.status).toBe(to);
        expect(result.data?.order.id).toBe(ORDER_ID);
        // Every transition bumps the optimistic-concurrency version.
        expect(result.data?.order.version).toBe(2);
        // The command returns the one order shape every caller renders.
        expect(result.data?.order.items).toHaveLength(1);
        expect(result.data?.audit.kind).toBe("transition");
      },
    );

    it("carries references and intent only, never an actor or a role", async () => {
      const config: FakeConfig = { rpcCalls: [] };
      const client = machine(config);

      await move(client);

      const call = config.rpcCalls?.find((row) => row.fn === "transition_order");
      expect(call).toBeDefined();
      expect(Object.keys((call?.args as Record<string, unknown>) ?? {})).toEqual([
        "p_order_id",
        "p_to_status",
        "p_reason",
        "p_expected_version",
      ]);
    });
  });

  describe("invalid transitions", () => {
    it("refuses a backward transition", async () => {
      const client = machine({ seedOrder: { id: ORDER_ID, status: "CONFIRMED" } });

      const result = await move(client, { toStatus: "PENDING_CONFIRMATION" });

      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("tidak diizinkan");
    });

    it("refuses an escape from a terminal state", async () => {
      const client = machine({ seedOrder: { id: ORDER_ID, status: "COMPLETED" } });

      const result = await move(client, { toStatus: "CONFIRMED" });

      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("tidak diizinkan");
    });

    it("refuses an arbitrary pair the machine does not describe", async () => {
      const client = machine({ seedOrder: { id: ORDER_ID, status: "READY" } });

      const result = await move(client, { toStatus: "CONFIRMED" });

      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("tidak diizinkan");
    });

    it("refuses the DRAFT exit: that hop belongs to submit_order()", async () => {
      const client = machine({ seedOrder: { id: ORDER_ID, status: "DRAFT" } });

      const result = await move(client, { toStatus: "SUBMITTED" });

      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("tidak diizinkan");
    });

    it("refuses a status that is not a state in the machine", async () => {
      const client = machine();

      const reply = await callTransitionRpc(client, {
        orderId: ORDER_ID,
        toStatus: "COOKING" as OrderStatus,
      });

      expect(reply.data).toBeNull();
      expect(reply.error?.message).toBe("Status tujuan tidak valid");
    });
  });

  describe("wrong role", () => {
    it("refuses a caller without the rule's permission", async () => {
      // A service runner who can serve but not confirm.
      const client = machine({ actorPermissions: ["orders.serve"] });

      const result = await move(client);

      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("Not authorized");
    });

    it("refuses an anonymous caller, whatever it asks for", async () => {
      const client = machine({ actorPermissions: [] });

      const result = await move(client);

      expect(result.data).toBeNull();
      expect(result.error?.message).toBe("Not authorized to transition orders");
    });
  });

  describe("duplicate transition", () => {
    it("treats a repeat as an idempotent no-op, not a new transition", async () => {
      const client = machine();

      const first = await move(client);
      const second = await move(client);

      expect(first.error).toBeNull();
      expect(second.error).toBeNull();
      expect(second.data?.order.status).toBe("CONFIRMED");
      // The version moved once and no further.
      expect(second.data?.order.version).toBe(2);

      const historyReply = await readHistory(client, ORDER_ID);
      expect(historyReply).toHaveLength(1);
    });
  });

  describe("concurrent transition", () => {
    it("refuses a stale version as a conflict", async () => {
      const client = machine();

      const result = await move(client, { expectedVersion: 7 });

      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("Versi order telah berubah");
    });

    it("accepts the version the caller rendered", async () => {
      const client = machine();

      const result = await move(client, { expectedVersion: 1 });

      expect(result.error).toBeNull();
      expect(result.data?.order.status).toBe("CONFIRMED");
      expect(result.data?.order.version).toBe(2);
    });
  });

  describe("missing reason", () => {
    it("rejects an incomplete transition without a round trip", async () => {
      const config: FakeConfig = { rpcCalls: [] };
      const client = machine(config);

      const result = await move(client, { toStatus: "CANCELLED", reason: null });

      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("tidak lengkap");
      expect(config.rpcCalls).toHaveLength(0);
    });

    it("requires a non-empty reason server-side too", async () => {
      const client = machine({ seedOrder: { id: ORDER_ID, status: "CONFIRMED" } });

      const reply = await callTransitionRpc(client, {
        orderId: ORDER_ID,
        toStatus: "CANCELLED",
        reason: "   ",
      });

      expect(reply.data).toBeNull();
      expect(reply.error?.message).toContain("Alasan wajib");
    });
  });

  describe("audit record", () => {
    it("appends one history row carrying the actor, the role used and the reason", async () => {
      const client = machine({ actorId: "staff-9", actorRole: "cashier" });

      const result = await move(client, { toStatus: "REJECTED", reason: "Menu habis" });

      expect(result.error).toBeNull();

      const rows = await readHistory(client, ORDER_ID);
      expect(rows).toHaveLength(1);
      const row = rows[0];
      expect(row?.from_status).toBe("PENDING_CONFIRMATION");
      expect(row?.to_status).toBe("REJECTED");
      expect(row?.actor_id).toBe("staff-9");
      // The role the actor used, not the actor's current role.
      expect(row?.actor_role).toBe("cashier");
      expect(row?.reason).toBe("Menu habis");
    });

    it("records a voluntary reason on a normal transition too", async () => {
      const client = machine({ actorId: "staff-9", actorRole: "cashier" });

      await move(client, { reason: "Konfirmasi via telepon" });

      const rows = await readHistory(client, ORDER_ID);
      expect(rows[0]?.reason).toBe("Konfirmasi via telepon");
    });
  });

  describe("transport failure", () => {
    it("degrades an error to an explicit failure", async () => {
      const client = machine({
        transitionError: { message: "40001: conflict", code: "40001" },
      });

      const result = await move(client);

      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("conflict");
    });
  });
});
