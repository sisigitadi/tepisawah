/**
 * Demo mode tests (packages/config).
 *
 * `isDemoMode` gates the login hints in every staff app, and `DEMO_ACCOUNTS`
 * is the contract the CI seed script provisions against — so both the flag
 * parsing and the account list shape are pinned here.
 */
import { describe, expect, it } from "vitest";

import { DEMO_ACCOUNTS, DEMO_MODE_KEY, isDemoMode } from "../demo.js";
import { ENV_KEYS } from "../env.js";

describe("isDemoMode", () => {
  it("is off for an empty record (clean checkout, production default)", () => {
    expect(isDemoMode({})).toBe(false);
    expect(isDemoMode({ [DEMO_MODE_KEY]: "" })).toBe(false);
    expect(isDemoMode({ [DEMO_MODE_KEY]: undefined })).toBe(false);
  });

  it("is off for arbitrary values", () => {
    expect(isDemoMode({ [DEMO_MODE_KEY]: "false" })).toBe(false);
    expect(isDemoMode({ [DEMO_MODE_KEY]: "0" })).toBe(false);
    expect(isDemoMode({ [DEMO_MODE_KEY]: "on" })).toBe(false);
  });

  it("is on for true/1/yes in any case or whitespace", () => {
    expect(isDemoMode({ [DEMO_MODE_KEY]: "true" })).toBe(true);
    expect(isDemoMode({ [DEMO_MODE_KEY]: "TRUE" })).toBe(true);
    expect(isDemoMode({ [DEMO_MODE_KEY]: " 1 " })).toBe(true);
    expect(isDemoMode({ [DEMO_MODE_KEY]: "Yes" })).toBe(true);
  });

  it("is registered as a public VITE_ key in ENV_KEYS", () => {
    // The flag is browser-safe by design: it must carry the public prefix so a
    // production bundle can never accidentally read a private variable.
    expect(DEMO_MODE_KEY).toMatch(/^VITE_/);
    expect(ENV_KEYS.demoMode).toBe(DEMO_MODE_KEY);
  });
});

describe("DEMO_ACCOUNTS", () => {
  it("covers every seeded staff role exactly once", () => {
    const roles = DEMO_ACCOUNTS.map((account) => account.role).sort();
    // The 3 consolidated roles: owner (admin+supervisor+owner), cashier (cashier+waiter), kitchen
    expect(roles).toEqual(["cashier", "kitchen", "owner"]);
  });

  it("uses the generic demo email domain and a shared password", () => {
    for (const account of DEMO_ACCOUNTS) {
      expect(account.email).toMatch(/@demo\.tepisawah\.id$/);
      expect(account.password).toBe("demo1234");
      expect(account.label).toBeTruthy();
      expect(account.blurb).toBeTruthy();
    }
  });

  it("emails are unique", () => {
    const emails = DEMO_ACCOUNTS.map((account) => account.email);
    expect(new Set(emails).size).toBe(emails.length);
  });
});
