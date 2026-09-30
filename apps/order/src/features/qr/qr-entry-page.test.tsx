/**
 * QR entry page tests (Phase 6).
 *
 * The page is driven through its service seam, so the suite exercises the real
 * customer outcomes — valid QR, invalid QR, inactive table, changed table
 * configuration — without touching a browser Supabase client
 * (docs/qa/TESTING_STRATEGY.md Layer 3).
 */
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { QrEntryPage } from "./qr-entry-page.js";
import type { QrEntryError } from "./service.js";
import type { PublicTableResolve } from "@tepisawah/database";

interface ResolveOutcome {
  data: PublicTableResolve | null;
  error: QrEntryError | null;
}

const RESOLVED: PublicTableResolve = {
  tableId: "tbl-1",
  tableCode: "A12",
  tableName: "Meja A12",
  restaurantName: "Tepi Sawah",
  isOpen: true,
  session: null,
};

const { resolves } = vi.hoisted(() => ({
  resolves: { data: null, error: null } as ResolveOutcome,
}));

vi.mock("./service.js", () => ({
  resolveQrEntry: async () => resolves,
}));

const ORIGINAL_LOCATION = window.location;

function setLocation(search: string): void {
  Object.defineProperty(window, "location", {
    value: new URL(`https://tepisawah.id/order${search}`),
    writable: true,
  });
}

describe("QrEntryPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    Object.defineProperty(window, "location", {
      value: ORIGINAL_LOCATION,
      writable: true,
    });
    resolves.data = RESOLVED;
    resolves.error = null;
  });

  it("resolves a valid QR and shows the table context", async () => {
    resolves.data = RESOLVED;
    resolves.error = null;
    render(<QrEntryPage params={{ table: "A12", t: "token-printed" }} />);

    expect(await screen.findByText("Meja A12")).toBeInTheDocument();
    expect(screen.getByText("Tepi Sawah")).toBeInTheDocument();
    expect(screen.getByText(/siap menerima pesanan/)).toBeInTheDocument();
    const start = screen.getByRole("button", { name: "Mulai pesanan" });
    expect(start).toBeEnabled();
  });

  it("never renders the token", async () => {
    resolves.data = RESOLVED;
    resolves.error = null;
    render(<QrEntryPage params={{ table: "A12", t: "token-printed" }} />);
    await screen.findByText("Meja A12");
    expect(document.body.textContent).not.toContain("token-printed");
  });

  it("starts an order at the resolved table", async () => {
    resolves.data = RESOLVED;
    resolves.error = null;
    const onStart = vi.fn();
    const user = userEvent.setup();
    render(
      <QrEntryPage params={{ table: "A12", t: "token-printed" }} onStart={onStart} />,
    );
    await user.click(await screen.findByRole("button", { name: "Mulai pesanan" }));
    expect(onStart).toHaveBeenCalledWith(RESOLVED);
  });

  it("shows a clear message for an invalid QR", async () => {
    resolves.data = null;
    resolves.error = {
      message:
        "QR tidak valid. Meja tidak ditemukan, QR sudah dinonaktifkan, atau meja sedang tidak aktif.",
    };
    render(<QrEntryPage params={{ table: "ZZ9", t: "token-wrong" }} />);

    expect(await screen.findByText("QR tidak dapat digunakan")).toBeInTheDocument();
    expect(screen.getByText(/QR tidak valid/)).toBeInTheDocument();
  });

  it("treats an inactive table as an unresolvable QR", async () => {
    resolves.data = null;
    resolves.error = {
      message:
        "QR tidak valid. Meja tidak ditemukan, QR sudah dinonaktifkan, atau meja sedang tidak aktif.",
    };
    render(<QrEntryPage params={{ table: "A12", t: "token-printed" }} />);

    expect(await screen.findByText("QR tidak dapat digunakan")).toBeInTheDocument();
  });

  it("reflects a changed table configuration", async () => {
    resolves.data = { ...RESOLVED, tableCode: "B13", tableName: "Meja B13" };
    resolves.error = null;
    render(<QrEntryPage params={{ table: "B13", t: "token-printed" }} />);

    expect(
      await screen.findByRole("heading", { name: "Meja B13" }),
    ).toBeInTheDocument();
  });

  it("gates entry when the restaurant is closed", async () => {
    resolves.data = { ...RESOLVED, isOpen: false };
    resolves.error = null;
    render(<QrEntryPage params={{ table: "A12", t: "token-printed" }} />);

    expect(await screen.findByText(/tidak menerima pesanan/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mulai pesanan" })).toBeDisabled();
  });

  it("reads the QR payload from the URL when no params are passed", async () => {
    resolves.data = RESOLVED;
    resolves.error = null;
    setLocation("?table=A12&t=token-printed");

    render(<QrEntryPage />);
    expect(await screen.findByText("Meja A12")).toBeInTheDocument();
  });

  it("shows the active dining session staff have opened", async () => {
    resolves.data = {
      ...RESOLVED,
      session: { id: "ses-1", status: "OPEN" },
    };
    resolves.error = null;
    render(<QrEntryPage params={{ table: "A12", t: "token-printed" }} />);

    expect(
      await screen.findByText(/Sesi meja sudah dibuka staf/),
    ).toBeInTheDocument();
  });

  it("tells the customer their order joins the open session", async () => {
    const onStart = vi.fn();
    const table: PublicTableResolve = {
      ...RESOLVED,
      session: { id: "ses-1", status: "OPEN" },
    };
    resolves.data = table;
    resolves.error = null;
    const user = userEvent.setup();
    render(
      <QrEntryPage
        params={{ table: "A12", t: "token-printed" }}
        onStart={onStart}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Mulai pesanan" }));
    expect(onStart).toHaveBeenCalledWith(table);
  });

  it("shows the idle hint before staff open the session", async () => {
    resolves.data = RESOLVED;
    resolves.error = null;
    render(<QrEntryPage params={{ table: "A12", t: "token-printed" }} />);

    expect(
      await screen.findByText(/Sesi meja belum dibuka/),
    ).toBeInTheDocument();
  });

  it("never renders the session id", async () => {
    resolves.data = {
      ...RESOLVED,
      session: { id: "11111111-1111-4111-8111-111111111111", status: "OPEN" },
    };
    resolves.error = null;
    render(<QrEntryPage params={{ table: "A12", t: "token-printed" }} />);
    await screen.findByText(/Sesi meja sudah dibuka staf/);
    expect(
      document.body.textContent,
    ).not.toContain("11111111-1111-4111-8111-111111111111");
  });

  it("retries after a failure", async () => {
    resolves.data = null;
    resolves.error = { message: "QR tidak terbaca: token QR kosong." };
    const user = userEvent.setup();
    render(<QrEntryPage params={{ table: "A12" }} />);

    expect(await screen.findByText("QR tidak dapat digunakan")).toBeInTheDocument();
    resolves.data = RESOLVED;
    resolves.error = null;
    await user.click(screen.getByRole("button", { name: "Pindai ulang" }));

    expect(await screen.findByText("Meja A12")).toBeInTheDocument();
  });
});
