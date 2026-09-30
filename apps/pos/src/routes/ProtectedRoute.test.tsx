/**
 * POS protected-route guard tests (Layer 2 — docs/qa/TESTING_STRATEGY.md).
 *
 * Exercises the real wired guard in `apps/pos`: unauthenticated visitors are
 * shown the staff login panel instead of protected content, an
 * authenticated-but-disabled account is shown access denied, and an
 * authenticated customer with no staff role is denied entry. The guard is UX
 * only — enforcement is RLS (AUTH_RBAC_RLS.md §2.2).
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

import { ProtectedRoute } from "./ProtectedRoute.js";

/** Minimal fake auth surface satisfying {@link SupabaseAuth}. */
const fakeAuth = (overrides: {
  user?: AuthRawUser | null;
}): SupabaseAuth => {
  let currentUser: AuthRawUser | null = overrides.user ?? null;
  return {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: currentUser }, error: null }),
    signInWithPassword: async (credentials: { email: string; password: string }) => {
      const user: AuthRawUser = {
        id: "user-0001",
        email: credentials.email,
        app_metadata: {},
      };
      currentUser = user;
      return {
        data: {
          session: {
            access_token: "access",
            refresh_token: "refresh",
            expires_in: 3600,
            user,
          },
        },
        error: null,
      };
    },
    signOut: async () => {
      currentUser = null;
      return { error: null };
    },
    refreshSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({
      data: { subscription: { unsubscribe: () => undefined } },
    }),
  };
};

/**
 * Minimal fake of the RLS-enforced client for the `/me` reads: `profiles`,
 * `user_roles` and the `current_user_permissions()` RPC. `roles` defaults to a
 * staff role so gate 2 (AUTH_RBAC_RLS.md §15) is satisfied; pass `[]` to
 * simulate a customer.
 */
const fakeProfilesClient = (
  row: ProfileRow | null,
  roles: readonly string[] = ["cashier"],
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

/** Render the real guard inside a provider, with the fake auth client wired. */
function renderGuard(
  auth: SupabaseAuth,
  row: ProfileRow | null,
  roles: readonly string[] = ["cashier"],
) {
  setAuthClient(auth);
  return render(
    <AuthProvider supabase={fakeProfilesClient(row, roles)}>
      <ProtectedRoute>
        <div data-testid="protected">Protected content</div>
      </ProtectedRoute>
    </AuthProvider>,
  );
}

describe("POS ProtectedRoute", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the login panel instead of protected content when unauthenticated", async () => {
    renderGuard(fakeAuth({ user: null }), ACTIVE_ROW);

    await waitFor(() => expect(screen.getByText("POS — Staff Login")).toBeInTheDocument());
    expect(screen.queryByTestId("protected")).not.toBeInTheDocument();
  });

  it("renders protected content for an authenticated, active user", async () => {
    renderGuard(fakeAuth({ user: { id: "user-0001", email: "siti@tepisawah.id" } }), ACTIVE_ROW);

    await waitFor(() => expect(screen.getByTestId("protected")).toBeInTheDocument());
  });

  it("renders access denied for an authenticated but disabled user", async () => {
    renderGuard(
      fakeAuth({ user: { id: "user-0001", email: "siti@tepisawah.id" } }),
      { ...ACTIVE_ROW, is_active: false },
    );

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByText("Akses Ditolak")).toBeInTheDocument();
    expect(screen.queryByTestId("protected")).not.toBeInTheDocument();
  });

  it("renders access denied for an authenticated customer with no staff role", async () => {
    renderGuard(
      fakeAuth({ user: { id: "user-0001", email: "siti@tepisawah.id" } }),
      ACTIVE_ROW,
      [],
    );

    await waitFor(() => expect(screen.getByText("Akses Ditolak")).toBeInTheDocument());
    expect(screen.queryByTestId("protected")).not.toBeInTheDocument();
  });
});
