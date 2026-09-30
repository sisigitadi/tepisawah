/**
 * Table sessions admin page tests (Phase 7).
 *
 * The page is a thin projection over the `loadSessions` service plus the four
 * server-side commands. What is being protected here is the phase invariant:
 * one session per table holds several orders, closing is a deliberate staff
 * action, and the status shown is always what the database returned — never
 * something the page decided (PROMPT 08, MASTER prompt: backend is authority).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

import { SessionsPage } from "./sessions-page.js";

const READ = "table_sessions.read";
const MANAGE = "table_sessions.manage";

const authState = { read: true, manage: true };

const mockLoadSessions = vi.fn();
const mockOpenSession = vi.fn();
const mockCloseSession = vi.fn();

vi.mock("@tepisawah/ui", () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  StatusBadge: ({ label }: { label: string }) => (
    <span data-testid="ui-badge">{label}</span>
  ),
}));

vi.mock("@tepisawah/auth", () => ({
  AccessDenied: () => <div data-testid="access-denied">Akses ditolak</div>,
  useAuth: () => ({
    status: "authenticated",
    can: (permission: string) =>
      (permission === READ && authState.read) ||
      (permission === MANAGE && authState.manage),
  }),
}));

vi.mock("./service.js", () => ({
  loadSessions: (...args: unknown[]) => mockLoadSessions(...args),
  openSession: (...args: unknown[]) => mockOpenSession(...args),
  closeSession: (...args: unknown[]) => mockCloseSession(...args),
}));

const TABLE = {
  id: "22222222-2222-4222-8222-222222222222",
  tableCode: "A12",
  name: "Meja A12",
  status: "AVAILABLE",
  capacity: 4,
  location: "Bebas rokok" as string | null,
  isActive: true,
};

const OPEN_SESSION = {
  id: "11111111-1111-4111-8111-111111111111",
  tableId: TABLE.id,
  status: "OPEN" as const,
  openedAt: "2026-09-29T08:00:00Z",
  openedBy: "55555555-5555-4555-8555-555555555555",
  closedAt: null,
  closedBy: null,
  orderCount: 2,
};

const CLOSED_SESSION = {
  ...OPEN_SESSION,
  id: "66666666-6666-4666-8666-666666666666",
  status: "CLOSED" as const,
  closedAt: "2026-09-29T10:00:00Z",
  closedBy: "55555555-5555-4555-8555-555555555555",
  orderCount: 2,
};

function resolve(value: unknown): { data: unknown; error: null } {
  return { data: value, error: null };
}

describe("SessionsPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    Object.assign(authState, { read: true, manage: true });
    mockLoadSessions.mockReset();
    mockOpenSession.mockReset();
    mockCloseSession.mockReset();
    mockLoadSessions.mockResolvedValue({
      rows: [
        { table: TABLE, session: OPEN_SESSION, history: [CLOSED_SESSION] },
      ],
      error: null,
    });
  });

  it("renders the loaded session with its accrued order count", async () => {
    render(<SessionsPage />);
    expect(await screen.findByText("A12")).toBeInTheDocument();
    expect(screen.getByText("Meja A12")).toBeInTheDocument();
    expect(screen.getByText("Berlangsung")).toBeInTheDocument();
    // The count is the evidence that one session holds several orders.
    expect(screen.getByText("2 order")).toBeInTheDocument();
  });

  it("shows the access-denied panel without table_sessions.read", async () => {
    authState.read = false;
    render(<SessionsPage />);
    expect(await screen.findByTestId("access-denied")).toBeInTheDocument();
  });

  it("shows the load failure with a retry", async () => {
    mockLoadSessions.mockResolvedValueOnce({
      rows: [],
      error: "permission denied for table table_sessions",
    });
    render(<SessionsPage />);
    expect(await screen.findByText(/permission denied/)).toBeInTheDocument();

    mockLoadSessions.mockResolvedValueOnce({
      rows: [{ table: TABLE, session: OPEN_SESSION, history: [] }],
      error: null,
    });
    await userEvent.setup().click(screen.getByRole("button", { name: "Coba lagi" }));
    expect(await screen.findByText("Berlangsung")).toBeInTheDocument();
  });

  it("shows the empty state when no table exists", async () => {
    mockLoadSessions.mockResolvedValueOnce({ rows: [], error: null });
    render(<SessionsPage />);
    expect(
      await screen.findByText("Belum ada meja. Tambahkan meja pada halaman Meja terlebih dahulu."),
    ).toBeInTheDocument();
  });

  it("shows the loading state first", () => {
    mockLoadSessions.mockReturnValue(new Promise(() => undefined));
    render(<SessionsPage />);
    expect(screen.getByText("Memuat sesi meja…")).toBeInTheDocument();
  });

  it("opens a session for a table without one", async () => {
    const user = userEvent.setup();
    mockLoadSessions.mockResolvedValueOnce({
      rows: [{ table: TABLE, session: null, history: [] }],
      error: null,
    });
    render(<SessionsPage />);
    expect(await screen.findByText("Belum ada sesi")).toBeInTheDocument();

    mockOpenSession.mockResolvedValueOnce(resolve({ session: OPEN_SESSION, audit: null }));
    await user.click(screen.getByRole("button", { name: "Buka sesi" }));

    await waitFor(() => {
      expect(mockOpenSession).toHaveBeenCalledWith(TABLE.id, TABLE.tableCode);
    });
  });

  it("closes an open session", async () => {
    const user = userEvent.setup();
    render(<SessionsPage />);
    await screen.findByText("Berlangsung");

    mockCloseSession.mockResolvedValueOnce(resolve({ session: CLOSED_SESSION, audit: null }));
    await user.click(screen.getByRole("button", { name: "Tutup sesi" }));

    await waitFor(() => {
      expect(mockCloseSession).toHaveBeenCalledWith(OPEN_SESSION.id, TABLE.tableCode);
    });
    expect(await screen.findByText(/Sesi A12 ditutup/)).toBeInTheDocument();
  });

  it("surfaces a duplicate close as a server refusal", async () => {
    const user = userEvent.setup();
    render(<SessionsPage />);
    await screen.findByText("Berlangsung");

    mockCloseSession.mockResolvedValueOnce({
      data: null,
      error: "Table session is already closed",
    });
    await user.click(screen.getByRole("button", { name: "Tutup sesi" }));

    expect(await screen.findByText(/already closed/)).toBeInTheDocument();
  });

  it("surfaces a stale-session refusal from the server", async () => {
    const user = userEvent.setup();
    render(<SessionsPage />);
    await screen.findByText("Berlangsung");

    mockCloseSession.mockResolvedValueOnce({
      data: null,
      error: "Table session not found",
    });
    await user.click(screen.getByRole("button", { name: "Tutup sesi" }));

    expect(await screen.findByText(/not found/)).toBeInTheDocument();
  });

  it("disables the staff actions without table_sessions.manage", async () => {
    authState.manage = false;
    render(<SessionsPage />);
    await screen.findByText("Berlangsung");
    expect(screen.getByRole("button", { name: "Tutup sesi" })).toBeDisabled();
  });

  it("renders a closed session with a reopen control", async () => {
    mockLoadSessions.mockResolvedValueOnce({
      rows: [{ table: TABLE, session: CLOSED_SESSION, history: [CLOSED_SESSION] }],
      error: null,
    });
    render(<SessionsPage />);
    expect(await screen.findByText("Selesai")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buka sesi" })).toBeInTheDocument();
  });

  it("keeps the order count when a session is closed", async () => {
    mockLoadSessions.mockResolvedValueOnce({
      rows: [{ table: TABLE, session: CLOSED_SESSION, history: [CLOSED_SESSION] }],
      error: null,
    });
    render(<SessionsPage />);
    expect(await screen.findByText("2 order")).toBeInTheDocument();
  });
});
