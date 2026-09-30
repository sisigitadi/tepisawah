/**
 * Settings page tests (Phase 4).
 *
 * The page is driven through its loader and save seams, so the suite exercises
 * real component behaviour (permission gating, validation surfacing, toast
 * feedback) without touching a browser Supabase client
 * (docs/qa/TESTING_STRATEGY.md Layer 3).
 */
import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppRouter } from "../../app/router/index.js";
import { SettingsPage } from "./settings-page.js";

// The schema pins the singleton row to this id (migration 004 part 1).
const SETTINGS_ID = "11111111-1111-4111-8111-111111111111";
const READ = "settings.read";
const MANAGE = "settings.manage";

type LoaderResult = {
  status: "ready" | "error";
  error: string | null;
  settings: {
    id: string;
    restaurantName: string;
    address: string;
    phone: string | null;
    email: string | null;
    timezone: string;
    currency: string;
    logoUrl: string | null;
    primaryColor: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  rows: {
    id: string;
    dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
    isClosed: boolean;
    openTime: string;
    closeTime: string;
  }[];
};

const READY: LoaderResult = {
  status: "ready",
  error: null,
  settings: {
    id: SETTINGS_ID,
    restaurantName: "Tepi Sawah",
    address: "Jl. Raya Sawah",
    phone: null,
    email: null,
    timezone: "Asia/Jakarta",
    currency: "IDR",
    logoUrl: null,
    primaryColor: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  rows: [
    { id: "d1", dayOfWeek: 1, isClosed: false, openTime: "09:00", closeTime: "21:00" },
    { id: "d0", dayOfWeek: 0, isClosed: true, openTime: "", closeTime: "" },
  ],
};

const { authState, loaders } = vi.hoisted(() => ({
  authState: { read: true, manage: true },
  loaders: [] as Array<{
    status: "ready" | "error";
    error: string | null;
    settings: unknown;
    rows: unknown[];
  }>,
}));

const mockSaveSettings = vi.fn();
const mockSaveHours = vi.fn();

vi.mock("./service.js", () => ({
  loadSettings: async () => {
    const snapshot = (loaders as LoaderResult[]).at(-1) ?? READY;
    return {
      settings: snapshot.settings,
      hours: (snapshot.rows as LoaderResult["rows"]).map((row) => ({
        id: row.id,
        dayOfWeek: row.dayOfWeek,
        isClosed: row.isClosed,
        openTime: row.openTime || null,
        closeTime: row.closeTime || null,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      })),
      error: snapshot.error,
    };
  },
  saveSettings: (...args: unknown[]) => mockSaveSettings(...args),
  saveHours: (...args: unknown[]) => mockSaveHours(...args),
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

function pushLoader(result: LoaderResult) {
  loaders.push(result);
}

describe("SettingsPage", () => {
  // RTL auto-cleanup needs `globals: true`; this suite runs with them off, so
  // unmount explicitly or every assertion sees the previous render too.
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    loaders.length = 0;
    authState.read = true;
    authState.manage = true;
    mockSaveSettings.mockReset();
    mockSaveHours.mockReset();
  });

  it("renders the loaded configuration", async () => {
    pushLoader(READY);
    render(<SettingsPage />);
    // Await a form value, not the heading: inputs hydrate one render after the
    // header via an effect, so the value is the true "ready" anchor.
    expect(await screen.findByDisplayValue("Tepi Sawah")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Jl. Raya Sawah")).toBeInTheDocument();
    expect(screen.getByText("Pengaturan Restoran")).toBeInTheDocument();
  });

  it("shows the access-denied panel when the session cannot read settings", async () => {
    authState.read = false;
    pushLoader(READY);
    render(<SettingsPage />);
    expect(await screen.findByTestId("access-denied")).toBeInTheDocument();
  });

  it("disables saving without settings.manage", async () => {
    authState.manage = false;
    pushLoader(READY);
    render(<SettingsPage />);
    expect(await screen.findByText("Hanya baca")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Simpan Pengaturan" })).toBeDisabled();
  });

  it("surfaces validation errors without saving", async () => {
    pushLoader(READY);
    mockSaveSettings.mockResolvedValue({
      data: null,
      error: "Validasi gagal.",
      fieldErrors: { restaurantName: "Nama restoran wajib diisi." },
    });
    const user = userEvent.setup();
    render(<SettingsPage />);
    const name = await screen.findByDisplayValue("Tepi Sawah");
    await user.clear(name);
    fireEvent.click(screen.getByRole("button", { name: "Simpan Pengaturan" }));
    await waitFor(() => expect(mockSaveSettings).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Nama restoran wajib diisi.")).toBeInTheDocument();
  });

  it("confirms a successful save", async () => {
    pushLoader(READY);
    mockSaveSettings.mockResolvedValue({
      data: {
        settings: {
          id: SETTINGS_ID,
          restaurantName: "Tepi Sawah Baru",
          address: "Jl. Raya Sawah",
          phone: null,
          email: null,
          timezone: "Asia/Jakarta",
          currency: "IDR",
          logoUrl: null,
          primaryColor: null,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
        audit: {
          action: "SETTINGS_UPDATED",
          entityType: "restaurant_settings",
          entityId: SETTINGS_ID,
          changedFields: ["restaurantName"],
          metadata: {},
        },
      },
      error: null,
      fieldErrors: null,
    });
    const user = userEvent.setup();
    render(<SettingsPage />);
    const name = await screen.findByDisplayValue("Tepi Sawah");
    await user.clear(name);
    await user.type(name, "Tepi Sawah Baru");
    await user.click(screen.getByRole("button", { name: "Simpan Pengaturan" }));
    expect(await screen.findByText("Pengaturan tersimpan")).toBeInTheDocument();
    expect(mockSaveSettings).toHaveBeenCalledTimes(1);
  });

  it("shows an error toast when the backend denies the write", async () => {
    pushLoader(READY);
    mockSaveSettings.mockResolvedValue({
      data: null,
      error: 'permission denied for table "restaurant_settings"',
      fieldErrors: null,
    });
    const user = userEvent.setup();
    render(<SettingsPage />);
    await screen.findByDisplayValue("Tepi Sawah");
    await user.click(screen.getByRole("button", { name: "Simpan Pengaturan" }));
    expect(await screen.findByText("Gagal menyimpan")).toBeInTheDocument();
  });

  it("renders one row per configured day on the hours tab", async () => {
    pushLoader(READY);
    const user = userEvent.setup();
    render(<SettingsPage />);
    await screen.findByText("Pengaturan Restoran");
    await user.click(screen.getByRole("tab", { name: "Jam Operasional" }));
    expect(screen.getByText("Senin")).toBeInTheDocument();
    expect(screen.getByText("Minggu")).toBeInTheDocument();
    expect(screen.getAllByDisplayValue("09:00")).toHaveLength(1);
  });

  it("shows an error toast when the hours write is denied", async () => {
    pushLoader(READY);
    mockSaveHours.mockResolvedValue({
      data: null,
      error: 'permission denied for table "operating_hours"',
      fieldErrors: null,
    });
    const user = userEvent.setup();
    render(<SettingsPage />);
    await screen.findByText("Pengaturan Restoran");
    await user.click(screen.getByRole("tab", { name: "Jam Operasional" }));
    await user.click(screen.getByRole("button", { name: "Simpan Jam Operasional" }));
    expect(await screen.findByText("Gagal menyimpan")).toBeInTheDocument();
  });

  it("composes into the app router navigation", async () => {
    pushLoader(READY);
    const user = userEvent.setup();
    render(<AppRouter />);
    await user.click(screen.getByRole("button", { name: "Pengaturan" }));
    expect(await screen.findByText("Pengaturan Restoran")).toBeInTheDocument();
  });
});
