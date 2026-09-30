/**
 * Manual order page tests (Phase 8A).
 *
 * The page is driven through its service seam, so the suite exercises the real
 * waiter outcomes — picking a table whose session is open, building lines, and
 * a server refusal — without touching a browser Supabase client
 * (TESTING_STRATEGY.md Layer 3).
 *
 * The load seam returns typed fixtures rather than SQL, and the submit seam is
 * asserted by payload: what the waiter sends must carry references only, never
 * a price (API_CONTRACT.md §11.1, §2.2).
 */
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ManualOrderPage } from "./manual-order-page.js";
import type {
  ManualOrderCatalogResult,
  ManualOrderResult,
  ManualOrderSubmitInput,
  ManualOrderTablesResult,
} from "./service.js";

const TABLES: ManualOrderTablesResult = {
  data: {
    tables: [
      {
        id: "tbl-1",
        tableCode: "A12",
        name: "Meja A12",
        capacity: 4,
        status: "AVAILABLE",
        isActive: true,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ],
    sessions: new Map([["tbl-1", { id: "ses-1", tableId: "tbl-1", status: "OPEN" } as never]]),
  },
  error: null,
};

const CATALOG: ManualOrderCatalogResult = {
  data: [
    {
      id: "cat-1",
      name: "Makanan",
      sortOrder: 1,
      products: [
        {
          categoryId: "cat-1",
          categoryName: "Makanan",
          categorySortOrder: 1,
          productId: "p-100",
          name: "Nasi Liwet",
          description: null,
          price: 45000,
          imageUrl: null,
          isAvailable: true,
          sortOrder: 1,
          modifiers: [],
        },
        {
          categoryId: "cat-1",
          categoryName: "Makanan",
          categorySortOrder: 1,
          productId: "p-200",
          name: "Ayam Bakar",
          description: null,
          price: 30000,
          imageUrl: null,
          isAvailable: false,
          sortOrder: 2,
          modifiers: [],
        },
      ],
    },
  ],
  error: null,
};

const { tables, catalog, captured, submitOutcome, confirmOutcome, confirmCalls } = vi.hoisted(() => ({
  tables: { data: null as ManualOrderTablesResult["data"], error: null as ManualOrderTablesResult["error"] },
  catalog: { data: null as ManualOrderCatalogResult["data"], error: null as ManualOrderCatalogResult["error"] },
  captured: { input: null as ManualOrderSubmitInput | null },
  submitOutcome: {
    data: null as ManualOrderResult["data"],
    error: null as ManualOrderResult["error"],
  },
  confirmOutcome: {
    data: null as ManualOrderResult["data"],
    error: null as ManualOrderResult["error"],
  },
  confirmCalls: [] as Array<{ orderId: string; idempotencyKey: string | null | undefined }>,
}));

vi.mock("./service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./service.js")>();
  return {
    ...actual,
    loadManualOrderTables: async () => tables,
    loadManualOrderCatalog: async () => catalog,
    submitManualOrder: async (input: ManualOrderSubmitInput) => {
      captured.input = input;
      return submitOutcome;
    },
    submitManualOrderForConfirmation: async (input: {
      orderId: string;
      idempotencyKey: string | null | undefined;
    }) => {
      confirmCalls.push(input);
      return confirmOutcome;
    },
  };
});

function prime(): void {
  tables.data = TABLES.data;
  tables.error = null;
  catalog.data = CATALOG.data;
  catalog.error = null;
  captured.input = null;
  confirmCalls.length = 0;
  confirmOutcome.data = {
    order: {
      id: "ord-1",
      orderNumber: "TS-20260929-0001",
      tableId: "tbl-1",
      tableSessionId: "ses-1",
      source: "WAITER",
      status: "PENDING_CONFIRMATION",
      version: 1,
      notes: null,
      subtotal: 90000,
      discount: 0,
      tax: 0,
      total: 90000,
      idempotencyKey: "k",
      createdBy: "staff-1",
      items: [],
      modifiers: [],
    },
  };
  confirmOutcome.error = null;
  submitOutcome.data = {
    order: {
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
      idempotencyKey: "k",
      createdBy: "staff-1",
      items: [],
      modifiers: [],
    },
  };
  submitOutcome.error = null;
}

async function chooseTable(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  // Wait for the table option to land before selecting it.
  await screen.findByText("A12 — Meja A12");
  await user.selectOptions(screen.getByLabelText("Meja"), "tbl-1");
  // The catalog card renders once a table is chosen.
  await screen.findByText("Nasi Liwet");
}

describe("ManualOrderPage", () => {
  afterEach(() => {
    cleanup();
  });

  it("loads tables and menu, then lets the waiter build and submit an order", async () => {
    prime();
    const user = userEvent.setup();
    render(<ManualOrderPage />);

    await chooseTable(user);

    expect(screen.getByText(/Sesi meja aktif/)).toBeInTheDocument();
    expect(screen.getByText(/Rp 45[.]000/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Tambah Nasi Liwet" }));

    expect(screen.getByRole("button", { name: "Buat order draf" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Buat order draf" }));

    expect(await screen.findByText("TS-20260929-0001")).toBeInTheDocument();
    // The total is the server's number, not a sum the app computed.
    expect(screen.getByText(/90[.]000/)).toBeInTheDocument();
    expect(captured.input).not.toBeNull();
    expect(captured.input!.tableSessionId).toBe("ses-1");
    expect(captured.input!.items).toEqual([{ productId: "p-100", quantity: 1 }]);
    // The payload carries references and intent only — no money anywhere; the
    // WAITER source stamp itself is asserted in service.test.ts.
    expect(JSON.stringify(captured.input)).not.toMatch(/(unitPrice|subtotal|total|tax)/);
  });

  it("sends the draft to the cashier queue with a submit-scoped idempotency key", async () => {
    prime();
    const user = userEvent.setup();
    render(<ManualOrderPage />);

    await chooseTable(user);
    await user.click(screen.getByRole("button", { name: "Tambah Nasi Liwet" }));
    await user.click(screen.getByRole("button", { name: "Buat order draf" }));

    // The draft exists but has not reached the queue yet.
    expect(await screen.findByText("Pesanan dibuat")).toBeInTheDocument();
    expect(screen.getByText(/belum terlihat oleh kasir/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kirim order" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Kirim order" }));

    expect(await screen.findByText("Pesanan dikirim")).toBeInTheDocument();
    expect(screen.getByText(/antrian konfirmasi kasir/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Kirim order" })).not.toBeInTheDocument();

    // The submit step targets the draft the create step returned, and its key
    // is scoped to that order so a double-tap collapses (API_CONTRACT.md §14).
    expect(confirmCalls).toHaveLength(1);
    expect(confirmCalls[0]!.orderId).toBe("ord-1");
    expect(confirmCalls[0]!.idempotencyKey).toContain("ord-1");
  });

  it("surfaces a submit refusal without claiming the order was sent", async () => {
    prime();
    confirmOutcome.data = null;
    confirmOutcome.error = { message: "Harga menu telah berubah" };
    const user = userEvent.setup();
    render(<ManualOrderPage />);

    await chooseTable(user);
    await user.click(screen.getByRole("button", { name: "Tambah Nasi Liwet" }));
    await user.click(screen.getByRole("button", { name: "Buat order draf" }));
    await user.click(screen.getByRole("button", { name: "Kirim order" }));

    expect(await screen.findByText(/Harga menu telah berubah/)).toBeInTheDocument();
    // The draft card is still there, so the waiter can retry the send.
    expect(screen.getByText("Pesanan dibuat")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kirim order" })).toBeEnabled();
  });

  it("blocks an unavailable product from entering the order", async () => {
    prime();
    const user = userEvent.setup();
    render(<ManualOrderPage />);

    await chooseTable(user);

    expect(screen.getByText("Habis")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tambah Ayam Bakar" })).toBeDisabled();
  });

  it("keeps submit disabled until a table with an open session is chosen", async () => {
    prime();
    const user = userEvent.setup();
    render(<ManualOrderPage />);

    // No table yet — wait for the load to settle before asserting on the form.
    await screen.findByText("Pilih meja untuk mulai memesan.");
    expect(screen.getByRole("button", { name: "Buat order draf" })).toBeDisabled();

    await chooseTable(user);
    await user.click(screen.getByRole("button", { name: "Tambah Nasi Liwet" }));
    expect(screen.getByRole("button", { name: "Buat order draf" })).toBeEnabled();
  });

  it("refuses to order against a table whose session is not open", async () => {
    prime();
    tables.data = {
      tables: TABLES.data!.tables,
      sessions: new Map(), // no OPEN session for tbl-1
    };
    const user = userEvent.setup();
    render(<ManualOrderPage />);

    await chooseTable(user);

    expect(screen.getByText(/Sesi meja belum dibuka/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buat order draf" })).toBeDisabled();
  });

  it("surfaces a server refusal instead of the success card", async () => {
    prime();
    submitOutcome.data = null;
    submitOutcome.error = { message: "Produk Nasi Liwet sedang tidak tersedia" };
    const user = userEvent.setup();
    render(<ManualOrderPage />);

    await chooseTable(user);
    await user.click(screen.getByRole("button", { name: "Tambah Nasi Liwet" }));
    await user.click(screen.getByRole("button", { name: "Buat order draf" }));

    expect(await screen.findByText(/sedang tidak tersedia/)).toBeInTheDocument();
    expect(screen.queryByText("Pesanan dibuat")).not.toBeInTheDocument();
  });

  it("reports a load failure instead of an empty page", async () => {
    prime();
    tables.data = null;
    tables.error = { message: "Daftar meja gagal dimuat." };
    render(<ManualOrderPage />);

    expect(await screen.findByText("Daftar meja gagal dimuat.")).toBeInTheDocument();
    expect(screen.queryByText("Order manual")).not.toBeInTheDocument();
  });

  it("bumps, notes and removes lines from the order", async () => {
    prime();
    const user = userEvent.setup();
    render(<ManualOrderPage />);

    await chooseTable(user);
    await user.click(screen.getByRole("button", { name: "Tambah Nasi Liwet" }));
    await user.click(screen.getByRole("button", { name: "Tambah Nasi Liwet" }));

    expect(screen.getByText("2")).toBeInTheDocument();

    const notes = screen.getByPlaceholderText("mis. tidak pedas");
    await user.type(notes, "tidak pedas");
    expect(notes).toHaveValue("tidak pedas");

    await user.click(screen.getByRole("button", { name: "Kurang Nasi Liwet" }));
    expect(screen.getByText("1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Kurang Nasi Liwet" }));
    expect(screen.queryByPlaceholderText("mis. tidak pedas")).not.toBeInTheDocument();
  });
});
