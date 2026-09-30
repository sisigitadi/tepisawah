/**
 * Auth context + guard integration tests (Layer 2 — docs/qa/TESTING_STRATEGY.md).
 *
 * Drives the real {@link AuthProvider}, {@link LoginPanel} and the app guard
 * against a fake auth surface and fake `/me` reads, covering the required
 * Phase 2 flows: login success, invalid login, disabled account, session
 * refresh, logout and the unauthorized-route baseline; plus the Phase 3
 * authorization gates: a customer with no staff role never enters an internal
 * application (AUTH_RBAC_RLS.md §15, §17).
 *
 * Security note: the guard under test is UX only. These assertions verify the
 * user is *directed* away from protected UI; actual protection is RLS
 * (AUTH_RBAC_RLS.md §2.2).
 */
import "@testing-library/jest-dom/vitest";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

import { AUTH_MESSAGES } from "./errors.js";
import { AuthProvider, LoginPanel, useAuth } from "./index.js";
import { setAuthClient } from "./client.js";
import {
  FakeAuth,
  profileClientFactory,
  profileRow,
  type FakeUser,
} from "./__tests__/fake-auth.js";

const EMAIL = "siti@tepisawah.id";
const PASSWORD = "correct-horse-battery-staple";

const ACTIVE_USER: FakeUser = { id: "user-0001", email: EMAIL, app_metadata: {} };

/** Renders context state next to the login form for assertion. */
function renderAuth(auth: FakeAuth, client: Parameters<typeof AuthProvider>[0]["supabase"]) {
  function Probe() {
    const { status, profile, error } = useAuth();
    return (
      <>
        <div data-testid="status">{status}</div>
        <div data-testid="display-name">{profile?.display_name ?? "none"}</div>
        <div data-testid="error">{error ?? "none"}</div>
      </>
    );
  }

  return render(
    <AuthProvider supabase={client}>
      <Probe />
      <LoginPanel title="POS — Staff Login" />
    </AuthProvider>,
  );
}

/** Staff-app guard, mirroring the wired guard in each app's routes. */
function Guard({ children }: { children: ReactNode }): ReactNode {
  const { status, isLoading } = useAuth();
  if (isLoading) return <div aria-busy="true">Memuat…</div>;
  if (status === "disabled" || status === "unauthorized") {
    return <section data-testid="access-denied">Akses Ditolak</section>;
  }
  if (status === "unauthenticated") return <LoginPanel title="POS — Staff Login" />;
  return children;
}

function renderGuard(auth: FakeAuth, client: Parameters<typeof AuthProvider>[0]["supabase"]) {
  return render(
    <AuthProvider supabase={client}>
      <Guard>
        <div data-testid="protected">Protected content</div>
      </Guard>
    </AuthProvider>,
  );
}

describe("auth context", () => {
  let auth: FakeAuth;
  let profiles: ReturnType<typeof profileClientFactory>;

  beforeEach(() => {
    auth = new FakeAuth();
    setAuthClient(auth);
    profiles = profileClientFactory(profileRow());
  });

  afterEach(() => {
    cleanup();
  });

  it("starts as unauthenticated with no session", async () => {
    renderAuth(auth, profiles.client);
    expect(screen.getByTestId("status")).toHaveTextContent("loading");
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
    expect(screen.getByTestId("display-name")).toHaveTextContent("none");
  });

  it("logs in successfully and loads the profile", async () => {
    const user = userEvent.setup();
    renderAuth(auth, profiles.client);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));

    await user.type(screen.getByLabelText("Email"), EMAIL);
    await user.type(screen.getByLabelText("Kata sandi"), PASSWORD);
    await user.click(screen.getByRole("button", { name: "Masuk" }));

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    expect(screen.getByTestId("display-name")).toHaveTextContent("Siti");
    expect(screen.getByTestId("error")).toHaveTextContent("none");
    expect(auth.signedOut).toBe(false);
  });

  it("shows the safe public message on invalid login", async () => {
    auth.signInError = { message: "Invalid login credentials", code: undefined };
    const user = userEvent.setup();
    renderAuth(auth, profiles.client);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));

    await user.type(screen.getByLabelText("Email"), EMAIL);
    await user.type(screen.getByLabelText("Kata sandi"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Masuk" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(AUTH_MESSAGES.invalidCredentials),
    );
    expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated");
    expect(screen.queryByTestId("display-name")?.textContent ?? "none").toBe("none");
  });

  it("blocks a disabled account even though authentication succeeded", async () => {
    auth.currentUser = ACTIVE_USER;
    profiles.setRow(profileRow({ is_active: false }));

    renderAuth(auth, profiles.client);

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("disabled"));
    expect(screen.getByTestId("display-name")).toHaveTextContent("Siti");
    expect(screen.getByTestId("error")).toHaveTextContent(AUTH_MESSAGES.userDisabled);
  });

  it("re-evaluates the gate when a refreshed session changes the profile", async () => {
    auth.currentUser = ACTIVE_USER;
    renderAuth(auth, profiles.client);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));

    // Account is disabled while the user is signed in (AUTH_RBAC_RLS.md §16).
    profiles.setRow(profileRow({ is_active: false }));
    auth.emit("TOKEN_REFRESHED", ACTIVE_USER);

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("disabled"));
    expect(screen.getByTestId("error")).toHaveTextContent(AUTH_MESSAGES.userDisabled);
  });

  it("stays authenticated across a token refresh", async () => {
    auth.currentUser = ACTIVE_USER;
    renderAuth(auth, profiles.client);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));

    auth.emit("TOKEN_REFRESHED", ACTIVE_USER);

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    expect(screen.getByTestId("display-name")).toHaveTextContent("Siti");
  });

  it("signs out and returns to unauthenticated", async () => {
    auth.currentUser = ACTIVE_USER;
    function SignOutProbe() {
      const { status, signOut } = useAuth();
      return (
        <>
          <div data-testid="status">{status}</div>
          <button type="button" onClick={() => void signOut()}>
            Keluar
          </button>
        </>
      );
    }
    const user = userEvent.setup();
    render(
      <AuthProvider supabase={profiles.client}>
        <SignOutProbe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));

    await user.click(screen.getByRole("button", { name: "Keluar" }));

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
    expect(auth.signedOut).toBe(true);
  });

  it("clears the profile on sign out so no identity lingers", async () => {
    auth.currentUser = ACTIVE_USER;
    function Probe() {
      const { profile, signOut } = useAuth();
      return (
        <>
          <div data-testid="display-name">{profile?.display_name ?? "none"}</div>
          <button type="button" onClick={() => void signOut()}>
            Keluar
          </button>
        </>
      );
    }
    const user = userEvent.setup();
    render(
      <AuthProvider supabase={profiles.client}>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("display-name")).toHaveTextContent("Siti"));

    await user.click(screen.getByRole("button", { name: "Keluar" }));

    await waitFor(() => expect(screen.getByTestId("display-name")).toHaveTextContent("none"));
  });
});

describe("protected route guard", () => {
  let auth: FakeAuth;
  let profiles: ReturnType<typeof profileClientFactory>;

  beforeEach(() => {
    auth = new FakeAuth();
    setAuthClient(auth);
    profiles = profileClientFactory(profileRow());
  });

  afterEach(() => {
    cleanup();
  });

  it("shows login instead of protected content on an unauthorized route", async () => {
    renderGuard(auth, profiles.client);

    await waitFor(() => expect(screen.getByText("POS — Staff Login")).toBeInTheDocument());
    expect(screen.queryByTestId("protected")).not.toBeInTheDocument();
    expect(auth.currentUser).toBeNull();
  });

  it("renders protected content for an authenticated, active user", async () => {
    auth.currentUser = ACTIVE_USER;
    renderGuard(auth, profiles.client);

    await waitFor(() => expect(screen.getByTestId("protected")).toBeInTheDocument());
  });

  it("shows access denied for an authenticated but disabled user", async () => {
    auth.currentUser = ACTIVE_USER;
    profiles.setRow(profileRow({ is_active: false }));
    renderGuard(auth, profiles.client);

    await waitFor(() => expect(screen.getByTestId("access-denied")).toBeInTheDocument());
    expect(screen.getByTestId("access-denied")).toHaveTextContent("Akses Ditolak");
    expect(screen.queryByTestId("protected")).not.toBeInTheDocument();
  });

  it("denies an authenticated customer who holds no staff role", async () => {
    // Gate 2 (AUTH_RBAC_RLS.md §15): an authenticated user with no staff role
    // is a customer, and a customer never enters an internal application.
    auth.currentUser = ACTIVE_USER;
    profiles.setRoles([]);
    renderGuard(auth, profiles.client);

    await waitFor(() => expect(screen.getByTestId("access-denied")).toBeInTheDocument());
    expect(screen.queryByTestId("protected")).not.toBeInTheDocument();
  });

  it("shows a loading state until the session resolves", async () => {
    renderGuard(auth, profiles.client);
    expect(screen.getByText("Memuat…")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("POS — Staff Login")).toBeInTheDocument());
  });
});
