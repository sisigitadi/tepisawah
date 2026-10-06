/**
 * Staff portal launcher tests (Layer 2 — docs/qa/TESTING_STRATEGY.md).
 *
 * The portal is navigation only — authorization is re-enforced by each linked
 * app and by RLS — so what matters here is the role → app matrix: a staff
 * member sees exactly the apps their roles grant, in canonical order, and the
 * links resolve to the configured URL (or the local dev port when unset).
 */
import "@testing-library/jest-dom/vitest";

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

import {
  AuthProvider,
  setAuthClient,
  type AuthRawUser,
  type SupabaseAuth,
} from "@tepisawah/auth";
import type { Database, ProfileRow, SupabaseClient } from "@tepisawah/database";

import { PortalPage } from "./PortalPage.js";

/** Minimal fake auth surface satisfying {@link SupabaseAuth}. */
const fakeAuth = (user: AuthRawUser | null): SupabaseAuth => ({
  getSession: async () => ({ data: { session: null }, error: null }),
  getUser: async () => ({ data: { user }, error: null }),
  signInWithPassword: async () => ({ data: { session: null }, error: null }),
  signOut: async () => ({ error: null }),
  refreshSession: async () => ({ data: { session: null }, error: null }),
  onAuthStateChange: () => ({
    data: { subscription: { unsubscribe: () => undefined } },
  }),
});

/**
 * Minimal fake of the RLS-enforced client for the `/me` reads: `profiles`,
 * `user_roles` and the `current_user_permissions()` RPC (same shape as the
 * other staff apps' guard tests).
 */
const fakeProfilesClient = (
  row: ProfileRow | null,
  roles: readonly string[],
): SupabaseClient<Database> =>
  ({
    from: (table: string) => ({
      select: () => {
        if (table === "user_roles") {
          return {
            order: async () => ({
              data: roles.map((code) => ({ role: { code } })),
              error: null,
            }),
          };
        }
        return {
          eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }),
        };
      },
    }),
    rpc: async (fn: string) =>
      fn === "current_user_permissions"
        ? { data: [{ code: "dashboard.view" }], error: null }
        : { data: null, error: null },
  }) as unknown as SupabaseClient<Database>;

const ACTIVE_ROW: ProfileRow = {
  id: "user-0001",
  display_name: "Siti",
  phone: null,
  avatar_url: null,
  is_active: true,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};

/** Render the launcher for a user holding `roles` (defaults to one staff role
 *  so the protected route gate is satisfied). */
function renderPortal(roles: readonly string[]) {
  setAuthClient(
    fakeAuth({ id: "user-0001", email: "siti@tepisawah.id", app_metadata: {} }),
  );
  return render(
    <AuthProvider supabase={fakeProfilesClient(ACTIVE_ROW, roles)}>
      <PortalPage />
    </AuthProvider>,
  );
}

describe("Staff portal launcher", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows the greeting and role chips for the signed-in staff member", async () => {
    renderPortal(["cashier"]);

    await waitFor(() =>
      expect(screen.getByText(/Selamat datang, Siti/)).toBeInTheDocument(),
    );
    expect(screen.getByText("cashier")).toBeInTheDocument();
  });

  it("shows POS and Layanan Meja for cashier", async () => {
    renderPortal(["cashier"]);

    await waitFor(() =>
      expect(screen.getByText("Kasir POS & Meja")).toBeInTheDocument(),
    );
    expect(screen.getByText("Layanan Antar Meja")).toBeInTheDocument();
    expect(screen.queryByText("Owner & Admin Console")).not.toBeInTheDocument();
    expect(screen.queryByText("Kitchen Display (KDS)")).not.toBeInTheDocument();
  });

  it("shows POS and Layanan Meja for waiter (backward-compat alias to cashier role group)", async () => {
    renderPortal(["waiter"]);

    await waitFor(() =>
      expect(screen.getByText("Kasir POS & Meja")).toBeInTheDocument(),
    );
    expect(screen.getByText("Layanan Antar Meja")).toBeInTheDocument();
    expect(screen.queryByText("Owner & Admin Console")).not.toBeInTheDocument();
  });

  it("shows only Kitchen display for kitchen staff", async () => {
    renderPortal(["kitchen"]);

    await waitFor(() =>
      expect(screen.getByText("Kitchen Display (KDS)")).toBeInTheDocument(),
    );
    expect(screen.queryByText("Kasir POS & Meja")).not.toBeInTheDocument();
  });

  it("shows all operational apps for owner, admin, and supervisor", async () => {
    for (const role of ["owner", "admin", "supervisor"] as const) {
      renderPortal([role]);
      await waitFor(() =>
        expect(screen.getByText("Kasir POS & Meja")).toBeInTheDocument(),
      );
      expect(screen.getByText("Owner & Admin Console")).toBeInTheDocument();
      expect(screen.getByText("Kitchen Display (KDS)")).toBeInTheDocument();
      expect(screen.getByText("Layanan Antar Meja")).toBeInTheDocument();
      cleanup();
    }
  });

  it("unions apps across multiple roles in canonical order", async () => {
    renderPortal(["kitchen", "cashier"]);

    await waitFor(() =>
      expect(screen.getByText("Kasir POS & Meja")).toBeInTheDocument(),
    );
    expect(screen.getByText("Kitchen Display (KDS)")).toBeInTheDocument();
    expect(screen.getByText("Layanan Antar Meja")).toBeInTheDocument();
    // Canonical order in APPS: pos, kitchen, waiter.
    const names = screen.getAllByRole("link").map((link) => {
      const name = link.querySelector(".staff-app-name");
      return name?.textContent?.trim();
    });
    expect(names).toEqual(["Kasir POS & Meja", "Kitchen Display (KDS)", "Layanan Antar Meja"]);
  });

  it("links to the local dev ports when no deployment override is set", async () => {
    renderPortal(["cashier"]);

    const pos = await waitFor(() =>
      screen.getByRole("link", { name: /Kasir POS & Meja/ }),
    );
    expect(pos).toHaveAttribute("href", "http://127.0.0.1:5175");
  });
});
