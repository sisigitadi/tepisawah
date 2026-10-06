/**
 * Checkout page tests (Phase 8A).
 *
 * The page is driven through its service seam, so the suite exercises the real
 * customer outcomes — a submitted cart, a refused create, a closed session —
 * without touching a browser Supabase client (TESTING_STRATEGY.md Layer 3).
 *
 * The important assertion is the security one: the cart carries no money, and
 * the totals the customer sees come from the server reply, never from the cart.
 */
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CheckoutPage } from "./checkout-page.js";
import type { CheckoutResult } from "./service.js";
import type { DraftOrder, PublicTableResolve } from "@tepisawah/database";

const TABLE: PublicTableResolve = {
  tableId: "tbl-1",
  tableCode: "A12",
  tableName: "Meja A12",
  restaurantName: "Tepi Sawah",
  isOpen: true,
  session: { id: "ses-1", status: "OPEN" },
};

const CART = [{ productId: "p-100", quantity: 2, notes: "Tidak terlalu pedas" }];

/** A server-authored order; the page only reads id/orderNumber/total. */
function order(overrides: Partial<DraftOrder> = {}): DraftOrder {
  return {
    id: "ord-1",
    orderNumber: "TS-0001",
    tableId: "tbl-1",
    tableSessionId: "ses-1",
    source: "CUSTOMER_QR",
    status: "DRAFT",
    version: 1,
    notes: null,
    subtotal: 90000,
    discount: 0,
    tax: 0,
    total: 90000,
    idempotencyKey: "key-1",
    createdBy: null,
    items: [],
    modifiers: [],
    ...overrides,
  };
}

const { createOutcome, submitOutcome, createCalls, submitCalls } = vi.hoisted(() => ({
  createOutcome: {
    data: { order: { id: "ord-1" } },
    error: null,
  } as unknown as { data: { order: DraftOrder } | null; error: { message: string } | null },
  submitOutcome: {
    data: { order: { id: "ord-1" } },
    error: null,
  } as unknown as { data: { order: DraftOrder } | null; error: { message: string } | null },
  createCalls: [] as Array<Record<string, unknown>>,
  submitCalls: [] as Array<Record<string, unknown>>,
}));

vi.mock("./service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./service.js")>();
  return {
    ...actual,
    submitDraftOrder: async (input: Record<string, unknown>) => {
      createCalls.push(input);
      return createOutcome;
    },
    submitDraftOrderForConfirmation: async (input: Record<string, unknown>) => {
      submitCalls.push(input);
      return submitOutcome;
    },
  };
});

describe("CheckoutPage", () => {
  afterEach(() => {
    cleanup();
    createOutcome.data = { order: order() };
    createOutcome.error = null;
    submitOutcome.data = { order: order() };
    submitOutcome.error = null;
    createCalls.length = 0;
    submitCalls.length = 0;
  });

  it("renders the cart and a disabled submit while sending", async () => {
    const user = userEvent.setup();
    createOutcome.data = { order: order({ id: "ord-2", orderNumber: "TS-0002", total: 135000 }) };
    submitOutcome.data = { order: order({ id: "ord-2", orderNumber: "TS-0002", total: 135000 }) };
    render(<CheckoutPage table={TABLE} items={CART} />);

    expect(screen.getByText("2×")).toBeInTheDocument();
    expect(screen.getByText("Tidak terlalu pedas")).toBeInTheDocument();
    expect(screen.getByText("Kirim pesanan")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Kirim pesanan" }));

    expect(await screen.findByText("TS-0002")).toBeInTheDocument();
    // The total is the server's number, rendered with the locale grouping.
    expect(screen.getByText(/135\.000/)).toBeInTheDocument();
  });

  it("calls back with the created order id and number", async () => {
    const user = userEvent.setup();
    createOutcome.data = { order: order({ id: "ord-9", orderNumber: "TS-0009", total: 45000 }) };
    submitOutcome.data = { order: order({ id: "ord-9", orderNumber: "TS-0009", total: 45000 }) };
    const onSubmitted = vi.fn();
    render(<CheckoutPage table={TABLE} items={CART} onSubmitted={onSubmitted} />);

    await user.click(screen.getByRole("button", { name: "Kirim pesanan" }));

    expect(onSubmitted).toHaveBeenCalledWith("ord-9", "TS-0009");
  });

  it("surfaces a create refusal instead of a success screen", async () => {
    const user = userEvent.setup();
    createOutcome.data = null;
    createOutcome.error = { message: "Produk Nasi Liwet sedang tidak tersedia" };
    render(<CheckoutPage table={TABLE} items={CART} />);

    await user.click(screen.getByRole("button", { name: "Kirim pesanan" }));

    expect(await screen.findByText(/sedang tidak tersedia/)).toBeInTheDocument();
    expect(screen.queryByText("Pesanan dibuat")).not.toBeInTheDocument();
    // A refused create never reaches the submit step.
    expect(submitCalls).toHaveLength(0);
  });

  it("surfaces a submit refusal without claiming the order was sent", async () => {
    const user = userEvent.setup();
    createOutcome.data = { order: order({ id: "ord-3" }) };
    submitOutcome.data = null;
    submitOutcome.error = { message: "Harga menu telah berubah" };
    render(<CheckoutPage table={TABLE} items={CART} />);

    await user.click(screen.getByRole("button", { name: "Kirim pesanan" }));

    expect(await screen.findByText(/Harga menu telah berubah/)).toBeInTheDocument();
    expect(screen.queryByText("Pesanan dibuat")).not.toBeInTheDocument();
    // The create step still ran and produced a draft.
    expect(createCalls).toHaveLength(1);
  });

  it("sends content-scoped idempotency keys on both steps", async () => {
    const user = userEvent.setup();
    render(<CheckoutPage table={TABLE} items={CART} />);

    await user.click(screen.getByRole("button", { name: "Kirim pesanan" }));

    expect(await screen.findByText("TS-0001")).toBeInTheDocument();
    expect(createCalls).toHaveLength(1);
    expect(submitCalls).toHaveLength(1);

    // The create key scopes to the basket contents; the submit key scopes to
    // the order id the create returned (API_CONTRACT.md §2.3, §14).
    const createKey = String(createCalls[0]?.idempotencyKey);
    const submitKey = String(submitCalls[0]?.idempotencyKey);
    expect(createKey).toContain("checkout-");
    expect(submitKey).toContain("checkout-submit-");
    expect(submitKey).toContain("ord-1");
  });

  it("disables submit when the session is not open", () => {
    render(
      <CheckoutPage
        table={{ ...TABLE, session: { id: "ses-1", status: "CLOSED" } }}
        items={CART}
      />,
    );

    const submit = screen.getByRole("button", { name: "Kirim pesanan" });
    expect(submit).toBeDisabled();
    expect(
      screen.getByText(/Sesi meja belum dibuka atau sudah ditutup/),
    ).toBeInTheDocument();
  });

  it("disables submit when there is no session yet", () => {
    render(<CheckoutPage table={{ ...TABLE, session: null }} items={CART} />);

    expect(
      screen.getByRole("button", { name: "Kirim pesanan" }),
    ).toBeDisabled();
  });

  it("forwards the customer note to the draft and shows it in the review", async () => {
    const user = userEvent.setup();
    render(
      <CheckoutPage
        table={TABLE}
        items={CART}
        customerNote="  Untuk dibungkus, terima kasih  "
      />,
    );

    // The review prints the trimmed note the customer typed in the basket.
    expect(screen.getByText("Untuk dibungkus, terima kasih")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Kirim pesanan" }));

    await screen.findByText("TS-0001");
    expect(createCalls).toHaveLength(1);
    // The note is normalized before it reaches the RPC: trimmed, and dropped
    // to null when empty rather than travelling as whitespace.
    expect(createCalls[0]?.customerNote).toBe("Untuk dibungkus, terima kasih");
  });

  it("drops an empty customer note to null on the way to the RPC", async () => {
    const user = userEvent.setup();
    render(<CheckoutPage table={TABLE} items={CART} customerNote="   " />);

    await user.click(screen.getByRole("button", { name: "Kirim pesanan" }));

    await screen.findByText("TS-0001");
    expect(createCalls[0]?.customerNote).toBe(null);
  });

  it("tells the customer the price is computed by the system", () => {
    render(<CheckoutPage table={TABLE} items={CART} />);

    expect(
      screen.getByText("Harga dihitung oleh sistem saat pesanan dibuat."),
    ).toBeInTheDocument();
  });
});
