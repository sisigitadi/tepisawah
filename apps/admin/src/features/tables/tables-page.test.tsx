/**
 * Tables page tests (Phase 6).
 *
 * The page is driven through its loader and save seams, so the suite exercises
 * real component behaviour (permission gating per action, archive vs delete, QR
 * mint/retire, validation surfacing) without touching a browser Supabase client
 * (docs/qa/TESTING_STRATEGY.md Layer 3).
 */
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TablesPage } from "./tables-page.js";

const READ = "tables.read";
const CREATE = "tables.create";
const UPDATE = "tables.update";
const ARCHIVE = "tables.archive";
const QR_MANAGE = "tables.qr_manage";

type Snapshot = {
  status: "ready" | "error";
  error: string | null;
  tables: unknown[];
  qrs: unknown[];
};

const TABLE = {
  id: "tbl-1",
  tableCode: "A12",
  name: "Meja A12",
  capacity: 4,
  status: "AVAILABLE",
  isActive: true,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const QR = {
  id: "qr-1",
  tableId: "tbl-1",
  token: "token-printed",
  isActive: true,
  createdAt: "2026-01-01T00:00:00Z",
  expiresAt: null,
};

const READY: Snapshot = {
  status: "ready",
  error: null,
  tables: [TABLE],
  qrs: [QR],
};

const { authState, snapshots } = vi.hoisted(() => ({
  authState: {
    read: true,
    create: true,
    update: true,
    archive: true,
    qr: true,
  },
  snapshots: [] as Snapshot[],
}));

const mockSaveTable = vi.fn();
const mockRegenerateQr = vi.fn();
const mockDeactivateQr = vi.fn();

vi.mock("./service.js", () => ({
  loadTables: async () => {
    const snapshot = snapshots.at(-1) ?? READY;
    return {
      tables: snapshot.tables,
      qrs: snapshot.qrs,
      error: snapshot.error,
    };
  },
  activeQrFor: (qrs: { tableId: string; isActive: boolean }[], tableId: string) =>
    qrs.find((qr) => qr.tableId === tableId && qr.isActive) ?? null,
  saveTable: (...args: unknown[]) => mockSaveTable(...args),
  regenerateQr: (...args: unknown[]) => mockRegenerateQr(...args),
  deactivateQr: (...args: unknown[]) => mockDeactivateQr(...args),
}));

vi.mock("@tepisawah/auth", () => ({
  AccessDenied: () => <div data-testid="access-denied">Akses ditolak</div>,
  useAuth: () => ({
    status: "authenticated",
    can: (permission: string) =>
      (permission === READ && authState.read) ||
      (permission === CREATE && authState.create) ||
      (permission === UPDATE && authState.update) ||
      (permission === ARCHIVE && authState.archive) ||
      (permission === QR_MANAGE && authState.qr),
  }),
}));

describe("TablesPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    snapshots.length = 0;
    Object.assign(authState, {
      read: true,
      create: true,
      update: true,
      archive: true,
      qr: true,
    });
    mockSaveTable.mockReset();
    mockRegenerateQr.mockReset();
    mockDeactivateQr.mockReset();
  });

  it("renders the loaded tables", async () => {
    render(<TablesPage />);
    expect(await screen.findByText("A12")).toBeInTheDocument();
    expect(screen.getByText("Meja A12")).toBeInTheDocument();
    expect(screen.getByText("4 kursi")).toBeInTheDocument();
    expect(
      screen.getByText("Tersedia", { selector: ".ui-badge" }),
    ).toBeInTheDocument();
    expect(screen.getByText("QR aktif")).toBeInTheDocument();
  });

  it("shows the access-denied panel without tables.read", async () => {
    authState.read = false;
    render(<TablesPage />);
    expect(await screen.findByTestId("access-denied")).toBeInTheDocument();
  });

  it("shows the load failure with a retry", async () => {
    snapshots.push({
      status: "error",
      error: "permission denied for table tables",
      tables: [],
      qrs: [],
    });
    render(<TablesPage />);
    expect(await screen.findByText("Tidak dapat memuat meja")).toBeInTheDocument();
    expect(screen.getByText(/permission denied/)).toBeInTheDocument();
  });

  it("shows the empty state when no table exists", async () => {
    snapshots.push({ status: "ready", error: null, tables: [], qrs: [] });
    render(<TablesPage />);
    expect(await screen.findByText("Belum ada meja")).toBeInTheDocument();
  });

  it("shows the read-only hint without create or update", async () => {
    authState.create = false;
    authState.update = false;
    render(<TablesPage />);
    expect(await screen.findByText(/Hanya baca/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tambah meja" })).toBeNull();
  });

  it("creates a table through the form", async () => {
    const user = userEvent.setup();
    render(<TablesPage />);
    await screen.findByText("A12");

    await user.click(screen.getByRole("button", { name: "Tambah meja" }));
    const code = await screen.findByRole("textbox", { name: "Kode meja" });
    await user.clear(code);
    await user.type(code, "B13");
    await user.type(
      screen.getByRole("textbox", { name: "Nama meja" }),
      "Meja B13",
    );

    mockSaveTable.mockResolvedValueOnce({
      data: { record: { ...TABLE, tableCode: "B13" }, audit: null },
      error: null,
      fieldErrors: null,
    });
    await user.click(screen.getByRole("button", { name: "Simpan meja" }));

    await waitFor(() => {
      expect(mockSaveTable).toHaveBeenCalledWith(
        null,
        expect.objectContaining({ tableCode: "B13", name: "Meja B13" }),
        null,
      );
    });
  });

  it("surfaces field errors from a rejected save", async () => {
    const user = userEvent.setup();
    render(<TablesPage />);
    await screen.findByText("A12");

    await user.click(screen.getByRole("button", { name: "Tambah meja" }));
    mockSaveTable.mockResolvedValueOnce({
      data: null,
      error: "Validasi gagal.",
      fieldErrors: { tableCode: "Kode meja wajib diisi." },
    });
    await user.click(screen.getByRole("button", { name: "Simpan meja" }));

    expect(await screen.findByText("Kode meja wajib diisi.")).toBeInTheDocument();
  });

  it("archives instead of deleting a table", async () => {
    const user = userEvent.setup();
    render(<TablesPage />);
    await screen.findByText("A12");

    mockSaveTable.mockResolvedValueOnce({
      data: { record: { ...TABLE, isActive: false }, audit: null },
      error: null,
      fieldErrors: null,
    });
    await user.click(screen.getByRole("button", { name: "Nonaktifkan" }));

    await waitFor(() => {
      expect(mockSaveTable).toHaveBeenCalledWith(
        "tbl-1",
        expect.objectContaining({ isActive: false }),
        expect.objectContaining({ id: "tbl-1" }),
      );
    });
  });

  it("restores an archived table", async () => {
    const user = userEvent.setup();
    snapshots.push({
      status: "ready",
      error: null,
      tables: [{ ...TABLE, isActive: false }],
      qrs: [],
    });
    render(<TablesPage />);
    await screen.findByText("Nonaktif");

    mockSaveTable.mockResolvedValueOnce({
      data: { record: TABLE, audit: null },
      error: null,
      fieldErrors: null,
    });
    await user.click(screen.getByRole("button", { name: "Aktifkan" }));

    await waitFor(() => {
      expect(mockSaveTable).toHaveBeenCalledWith(
        "tbl-1",
        expect.objectContaining({ isActive: true }),
        expect.anything(),
      );
    });
  });

  it("mints a QR through one service call", async () => {
    const user = userEvent.setup();
    snapshots.push({ status: "ready", error: null, tables: [TABLE], qrs: [] });
    render(<TablesPage />);
    await screen.findByText("Tanpa QR");

    mockRegenerateQr.mockResolvedValueOnce({
      data: { qr: { ...QR, token: "token-fresh" }, audit: null },
      error: null,
      fieldErrors: null,
    });
    await user.click(screen.getByRole("button", { name: "Buat QR" }));

    await waitFor(() => {
      expect(mockRegenerateQr).toHaveBeenCalledWith("tbl-1", TABLE);
    });
  });

  it("retires the printed QR", async () => {
    const user = userEvent.setup();
    render(<TablesPage />);
    await screen.findByText("QR aktif");

    mockDeactivateQr.mockResolvedValueOnce({
      data: { retired: true, audit: null },
      error: null,
      fieldErrors: null,
    });
    await user.click(screen.getByRole("button", { name: "Hentikan QR" }));

    await waitFor(() => {
      expect(mockDeactivateQr).toHaveBeenCalledWith("tbl-1", TABLE, QR);
    });
  });

  it("hides the QR buttons without tables.qr_manage", async () => {
    authState.qr = false;
    render(<TablesPage />);
    await screen.findByText("A12");
    expect(screen.queryByRole("button", { name: /Buat QR|Perbarui QR/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Hentikan QR" })).toBeNull();
  });

  it("reports a denied QR mint instead of failing silently", async () => {
    const user = userEvent.setup();
    snapshots.push({ status: "ready", error: null, tables: [TABLE], qrs: [] });
    render(<TablesPage />);
    await screen.findByText("Tanpa QR");

    mockRegenerateQr.mockResolvedValueOnce({
      data: null,
      error: "permission denied for function regenerate_table_qr",
      fieldErrors: null,
    });
    await user.click(screen.getByRole("button", { name: "Buat QR" }));

    expect(
      await screen.findByText(/permission denied for function/),
    ).toBeInTheDocument();
  });
});
