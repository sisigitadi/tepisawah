/**
 * Manual order service tests (Phase 8A).
 *
 * The seam under test is the wire: what the waiter app actually hands to
 * `create_draft_order()`. The WAITER source must be stamped here (the page
 * never sends it), and the payload must carry references and intent only — no
 * price, subtotal, total or tax can exist on it (API_CONTRACT.md §2.2, §11.1).
 *
 * `@tepisawah/database` is mocked so the suite asserts the call, not a database
 * (TESTING_STRATEGY.md Layer 2).
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CreateDraftOrderInput, DraftOrder, SubmitOrderInput } from "@tepisawah/database";

import {
  manualOrderSubmitIdempotencyKey,
  submitManualOrder,
  submitManualOrderForConfirmation,
} from "./service.js";

const ORDER: DraftOrder = {
  id: "ord-1",
  orderNumber: "TS-20260929-0001",
  tableId: "tbl-1",
  tableSessionId: "ses-1",
  source: "WAITER",
  status: "DRAFT",
  version: 1,
  notes: null,
  subtotal: 90000,
  discount: 0,
  tax: 0,
  total: 90000,
  idempotencyKey: "k-1",
  createdBy: "staff-1",
  items: [],
  modifiers: [],
};

const { sent, submitted, createOutcome, submitOutcome } = vi.hoisted(() => ({
  sent: { input: null as CreateDraftOrderInput | null },
  submitted: { input: null as SubmitOrderInput | null },
  createOutcome: { resolved: true },
  submitOutcome: { resolved: true },
}));

vi.mock("../../lib/supabase.js", () => ({
  getSupabaseClient: () => ({ mocked: true }),
}));

vi.mock("@tepisawah/database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tepisawah/database")>();
  return {
    ...actual,
    createDraftOrder: async (_client: unknown, input: CreateDraftOrderInput) => {
      sent.input = input;
      return createOutcome.resolved
        ? { data: { order: ORDER, items: [], modifiers: [] }, error: null }
        : { data: null, error: { message: "Not authorized to create manual orders" } };
    },
    fetchActiveTableSession: async () => ({ data: null, error: null }),
    fetchPublicCatalog: async () => ({ data: [], error: null }),
    fetchTables: async () => ({ data: [], error: null }),
    groupCatalogByCategory: () => [],
    submitOrder: async (_client: unknown, input: SubmitOrderInput) => {
      submitted.input = input;
      return submitOutcome.resolved
        ? { data: { order: { ...ORDER, status: "PENDING_CONFIRMATION" }, items: [], modifiers: [] }, error: null }
        : { data: null, error: { message: "Not authorized to submit orders" } };
    },
  };
});

describe("submitManualOrder", () => {
  afterEach(() => {
    sent.input = null;
    submitted.input = null;
    createOutcome.resolved = true;
    submitOutcome.resolved = true;
  });

  it("stamps the WAITER source the backend authorizes on", async () => {
    await submitManualOrder({
      tableId: "tbl-1",
      tableSessionId: "ses-1",
      items: [{ productId: "p-100", quantity: 2, notes: "tidak pedas" }],
    });

    expect(sent.input).not.toBeNull();
    expect(sent.input!.source).toBe("WAITER");
    expect(sent.input!.tableId).toBe("tbl-1");
    expect(sent.input!.tableSessionId).toBe("ses-1");
    expect(sent.input!.items).toEqual([
      { productId: "p-100", quantity: 2, notes: "tidak pedas" },
    ]);
  });

  it("cannot send a price, subtotal, total or tax — the payload has no money fields", async () => {
    await submitManualOrder({
      tableId: "tbl-1",
      tableSessionId: "ses-1",
      items: [{ productId: "p-100", quantity: 1 }],
    });

    expect(JSON.stringify(sent.input)).not.toMatch(/(unitPrice|priceDelta|subtotal|total|tax|paymentStatus)/);
  });

  it("defaults notes to null and generates an idempotency key when omitted", async () => {
    await submitManualOrder({
      tableId: "tbl-1",
      tableSessionId: "ses-1",
      items: [{ productId: "p-100", quantity: 1 }],
    });

    expect(sent.input!.customerNote).toBeNull();
    expect(sent.input!.internalNote).toBeNull();
    expect(sent.input!.idempotencyKey).not.toBeNull();
  });

  it("fails closed on an incomplete order instead of calling the backend", async () => {
    await submitManualOrder({ tableId: "", tableSessionId: "", items: [] });

    expect(sent.input).toBeNull();
  });

  it("returns the backend refusal verbatim when the session lost the grant", async () => {
    createOutcome.resolved = false;
    const result = await submitManualOrder({
      tableId: "tbl-1",
      tableSessionId: "ses-1",
      items: [{ productId: "p-100", quantity: 1 }],
    });

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe("Not authorized to create manual orders");
  });
});

describe("submitManualOrderForConfirmation", () => {
  afterEach(() => {
    submitted.input = null;
    submitOutcome.resolved = true;
  });

  it("stamps the WAITER source and sends the order id only — no table context", async () => {
    await submitManualOrderForConfirmation({ orderId: "ord-1" });

    expect(submitted.input).not.toBeNull();
    expect(submitted.input!.source).toBe("WAITER");
    expect(submitted.input!.orderId).toBe("ord-1");
    // The staff path is authorized by its session grant, so no table ids are
    // sent (AUTH_RBAC_RLS.md §34).
    expect(submitted.input).not.toHaveProperty("tableId");
    expect(submitted.input).not.toHaveProperty("tableSessionId");
  });

  it("cannot send money — the payload has no money fields", async () => {
    await submitManualOrderForConfirmation({ orderId: "ord-1" });

    expect(JSON.stringify(submitted.input)).not.toMatch(/(unitPrice|priceDelta|subtotal|total|tax|paymentStatus)/);
  });

  it("generates a submit key scoped to the order when omitted", async () => {
    await submitManualOrderForConfirmation({ orderId: "ord-1" });

    expect(submitted.input!.idempotencyKey).not.toBeNull();
    expect(submitted.input!.idempotencyKey).toContain("ord-1");
  });

  it("forwards the caller key unchanged so a retry collapses", async () => {
    const key = manualOrderSubmitIdempotencyKey("attempt-1", "ord-1");
    await submitManualOrderForConfirmation({ orderId: "ord-1", idempotencyKey: key });

    expect(submitted.input!.idempotencyKey).toBe(key);
  });

  it("fails closed without an order id", async () => {
    submitted.input = null;
    const result = await submitManualOrderForConfirmation({ orderId: "" });

    expect(submitted.input).toBeNull();
    expect(result.data).toBeNull();
  });

  it("returns the backend refusal verbatim when the grant was dropped", async () => {
    submitOutcome.resolved = false;
    const result = await submitManualOrderForConfirmation({ orderId: "ord-1" });

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe("Not authorized to submit orders");
  });

  it("hands back the order the server transitioned, not a client-authored one", async () => {
    const result = await submitManualOrderForConfirmation({ orderId: "ord-1" });

    expect(result.data?.order.status).toBe("PENDING_CONFIRMATION");
    expect(result.data?.order.orderNumber).toBe("TS-20260929-0001");
  });
});

describe("manualOrderSubmitIdempotencyKey", () => {
  it("differs per order so two drafts never share a submit key", () => {
    expect(manualOrderSubmitIdempotencyKey("a1", "ord-1")).not.toBe(
      manualOrderSubmitIdempotencyKey("a1", "ord-2"),
    );
  });

  it("is stable for the same attempt and order so a retry collapses", () => {
    expect(manualOrderSubmitIdempotencyKey("a1", "ord-1")).toBe(
      manualOrderSubmitIdempotencyKey("a1", "ord-1"),
    );
  });
});
