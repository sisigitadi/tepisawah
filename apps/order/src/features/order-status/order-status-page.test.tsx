/**
 * Order status page tests (Phase 8B — API_CONTRACT.md §10.3).
 *
 * The page is driven through its service seam, so the suite exercises the real
 * customer outcomes — an order that resolves, one that does not, a refresh —
 * without touching a browser Supabase client (TESTING_STRATEGY.md Layer 3).
 *
 * The important assertion is the security one: the table context travels with
 * the order id on every read, because the id alone is not a credential
 * (AUTH_RBAC_RLS.md §18, §30). The page renders only what the server's
 * projection returns — no money is ever computed in the browser.
 */
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OrderStatusPage } from "./order-status-page.js";
import type { OrderStatusResult } from "./service.js";
import type { CustomerOrder, PublicTableResolve } from "@tepisawah/database";

const TABLE: PublicTableResolve = {
  tableId: "tbl-1",
  tableCode: "A12",
  tableName: "Meja A12",
  restaurantName: "Tepi Sawah",
  isOpen: true,
  session: { id: "ses-1", status: "OPEN" },
};

/** A server-authored projection; the page renders it verbatim. */
function order(overrides: Partial<CustomerOrder> = {}): CustomerOrder {
  return {
    id: "ord-1",
    orderNumber: "TS-0001",
    status: "PENDING_CONFIRMATION",
    notes: null,
    subtotal: 90000,
    discount: 0,
    tax: 0,
    total: 90000,
    createdAt: "2026-09-29T10:00:00Z",
    updatedAt: "2026-09-29T11:00:00Z",
    items: [
      {
        id: "item-1",
        productNameSnapshot: "Nasi Liwet",
        unitPriceSnapshot: 45000,
        quantity: 2,
        notes: null,
        lineTotal: 90000,
      },
    ],
    modifiers: [
      {
        id: "mod-1",
        orderItemId: "item-1",
        modifierNameSnapshot: "Level Pedas",
        priceDeltaSnapshot: 0,
        quantity: 2,
      },
    ],
    ...overrides,
  };
}

const { outcome, calls } = vi.hoisted(() => ({
  outcome: {
    data: null as CustomerOrder | null,
    error: null as { message: string } | null,
  } as unknown as OrderStatusResult,
  calls: [] as Array<Record<string, string>>,
}));

vi.mock("./service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./service.js")>();
  return {
    ...actual,
    fetchCustomerOrder: async (input: Record<string, string>) => {
      calls.push(input);
      return outcome;
    },
  };
});

describe("OrderStatusPage", () => {
  beforeEach(() => {
    // The hoisted outcome starts empty, so seed a successful read before each
    // test; a test that wants the not-found screen overrides these two.
    outcome.data = order();
    outcome.error = null;
  });

  afterEach(() => {
    cleanup();
    outcome.data = order();
    outcome.error = null;
    calls.length = 0;
  });

  it("renders the server's order number, status and lines", async () => {
    render(<OrderStatusPage table={TABLE} orderId="ord-1" />);

    expect(
      await screen.findByRole("heading", { name: "Pesanan TS-0001" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Menunggu konfirmasi kasir"),
    ).toBeInTheDocument();
    expect(screen.getByText("2×")).toBeInTheDocument();
    expect(screen.getByText("Nasi Liwet")).toBeInTheDocument();
    // The modifier selection travels with its line (AUTH_RBAC_RLS.md §28).
    expect(screen.getByText("Level Pedas")).toBeInTheDocument();
    // The total is the server's number, never re-derived in the browser.
    expect(
      screen.getByText(/90[.]000/, { selector: "strong" }),
    ).toBeInTheDocument();
  });

  it("shows the kitchen progress hint while the order is being made", async () => {
    outcome.data = order({ status: "PREPARING" });
    render(<OrderStatusPage table={TABLE} orderId="ord-1" />);

    expect(await screen.findByText("Sedang dipersiapkan")).toBeInTheDocument();
    expect(
      screen.getByText(/Pesanan Anda sedang diproses/),
    ).toBeInTheDocument();
  });

  it("shows the customer's own order note, never a staff internal note", async () => {
    outcome.data = order({ notes: "Tidak terlalu pedas" });
    render(<OrderStatusPage table={TABLE} orderId="ord-1" />);

    expect(await screen.findByText(/Tidak terlalu pedas/)).toBeInTheDocument();
  });

  it("sends the table context with the order id on every read", async () => {
    render(<OrderStatusPage table={TABLE} orderId="ord-1" />);

    await screen.findByRole("heading", { name: "Pesanan TS-0001" });

    // The order id alone is not a credential: the table id and the OPEN
    // session id travel with it so the server can compare both against the
    // order's own (API_CONTRACT.md §30).
    expect(calls).toEqual([
      { orderId: "ord-1", tableId: "tbl-1", tableSessionId: "ses-1" },
    ]);
  });

  it("refetches on demand without changing the context it sends", async () => {
    const user = userEvent.setup();
    render(<OrderStatusPage table={TABLE} orderId="ord-1" />);
    await screen.findByRole("heading", { name: "Pesanan TS-0001" });

    await user.click(screen.getByRole("button", { name: "Periksa status" }));

    expect(
      await screen.findByRole("heading", { name: "Pesanan TS-0001" }),
    ).toBeInTheDocument();
    expect(calls).toEqual([
      { orderId: "ord-1", tableId: "tbl-1", tableSessionId: "ses-1" },
      { orderId: "ord-1", tableId: "tbl-1", tableSessionId: "ses-1" },
    ]);
  });

  it("says only that the order was not found when the context does not match", async () => {
    outcome.data = null;
    outcome.error = { message: "Order tidak ditemukan." };
    render(<OrderStatusPage table={TABLE} orderId="ord-1" />);

    expect(await screen.findByText(/Order tidak ditemukan/)).toBeInTheDocument();
    // No other table's order data is ever rendered.
    expect(
      screen.queryByRole("heading", { name: /TS-0001/ }),
    ).not.toBeInTheDocument();
  });

  it("does not invent a status for a value the server did not send", async () => {
    outcome.data = order({ status: "CONFIRMED" });
    render(<OrderStatusPage table={TABLE} orderId="ord-1" />);

    // A known state maps to its known label rather than being widened.
    expect(await screen.findByText("Pesanan dikonfirmasi")).toBeInTheDocument();
  });

  it("calls back when the customer leaves the status screen", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(<OrderStatusPage table={TABLE} orderId="ord-1" onBack={onBack} />);

    await screen.findByRole("heading", { name: "Pesanan TS-0001" });
    await user.click(screen.getByRole("button", { name: "Kembali ke meja" }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("surfaces the not-found screen when the session is missing", async () => {
    outcome.data = null;
    outcome.error = { message: "Order tidak ditemukan." };
    render(<OrderStatusPage table={{ ...TABLE, session: null }} orderId="ord-1" />);

    // An empty session context cannot authorize anything, so the request
    // carries an empty handle and the read resolves to nothing.
    expect(calls).toEqual([
      { orderId: "ord-1", tableId: "tbl-1", tableSessionId: "" },
    ]);
    expect(await screen.findByText(/Order tidak ditemukan/)).toBeInTheDocument();
  });
});
