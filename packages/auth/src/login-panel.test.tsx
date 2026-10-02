/**
 * LoginPanel demo-mode tests.
 *
 * Drives the real {@link AuthProvider} + {@link LoginPanel} against the fake
 * auth surface. The demo hint card is the presenter-facing surface for the
 * generic role accounts: it must render only when the app passes
 * `demoAccounts` (production builds never do), and a click must fill the form
 * with that account's credentials so a reviewer can enter any role instantly
 * through the normal sign-in path.
 */
import "@testing-library/jest-dom/vitest";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { DemoAccount } from "@tepisawah/config";

import { AuthProvider, LoginPanel } from "./index.js";
import { setAuthClient } from "./client.js";
import { FakeAuth, profileClientFactory, profileRow } from "./__tests__/fake-auth.js";

const ACCOUNTS: readonly DemoAccount[] = [
  {
    role: "cashier",
    label: "Kasir",
    email: "kasir@demo.tepisawah.id",
    password: "demo1234",
    blurb: "Konfirmasi pesanan & pembayaran",
  },
  {
    role: "kitchen",
    label: "Dapur",
    email: "dapur@demo.tepisawah.id",
    password: "demo1234",
    blurb: "Antrian dapur",
  },
];

describe("LoginPanel demo hints", () => {
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

  function renderPanel(props: Parameters<typeof LoginPanel>[0] = {}) {
    return render(
      <AuthProvider supabase={profiles.client}>
        <LoginPanel title="POS — Staff Login" {...props} />
      </AuthProvider>,
    );
  }

  it("renders no demo section by default (production path)", async () => {
    renderPanel();
    await screen.findByRole("button", { name: "Masuk" });
    expect(screen.queryByTestId("demo-accounts")).toBeNull();
    expect(screen.getByRole("heading", { name: "POS — Staff Login" })).toBeInTheDocument();
  });

  it("lists one clickable entry per demo account", () => {
    renderPanel({ demoAccounts: ACCOUNTS });
    expect(screen.getByTestId("demo-accounts")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kasir" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dapur" })).toBeInTheDocument();
    // Every account's email stays discoverable for presenters, but the form
    // itself is filled by clicking — not by typing from a README.
    expect(screen.getAllByText(/@demo\.tepisawah\.id/)).toHaveLength(ACCOUNTS.length);
  });

  it("fills email + password when a demo account is clicked", async () => {
    const user = userEvent.setup();
    renderPanel({ demoAccounts: ACCOUNTS });

    await user.click(screen.getByRole("button", { name: "Dapur" }));

    const email = screen.getByLabelText(/Email/i);
    const password = screen.getByLabelText(/Kata sandi/i);
    expect(email).toHaveValue("dapur@demo.tepisawah.id");
    expect(password).toHaveValue("demo1234");
  });

  it("signs in through the normal auth path after a demo fill", async () => {
    const user = userEvent.setup();
    renderPanel({ demoAccounts: ACCOUNTS });

    await user.click(screen.getByRole("button", { name: "Kasir" }));
    await user.click(screen.getByRole("button", { name: "Masuk" }));

    // The demo fill feeds the ordinary sign-in path: FakeAuth records the
    // session and no error alert is raised.
    await waitFor(() => expect(auth.currentUser?.email).toBe("kasir@demo.tepisawah.id"));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
