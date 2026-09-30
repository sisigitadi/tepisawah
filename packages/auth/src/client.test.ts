/**
 * Auth client injection contract tests (Layer 2).
 *
 * The injected client is the whole seam between the apps and this package
 * (REPOSITORY_STRUCTURE.md §50): the invariant must hold — uninitialised access
 * fails loudly, and only ever with a safe message.
 */
import { beforeEach, describe, expect, it } from "vitest";

import {
  getAuthClient,
  hasAuthClient,
  setAuthClient,
  toAuthUser,
} from "./client.js";
import { FakeAuth } from "./__tests__/fake-auth.js";

describe("auth client injection", () => {
  beforeEach(() => {
    // The module-level singleton is per test file; register a fresh fake.
    setAuthClient(new FakeAuth());
  });

  it("returns the registered client", () => {
    expect(hasAuthClient()).toBe(true);
    expect(getAuthClient()).toBeDefined();
  });

  it("overwrites the previous registration", () => {
    const next = new FakeAuth();
    setAuthClient(next);
    expect(getAuthClient()).toBe(next);
  });

  it("maps a Supabase user onto the package AuthUser shape", () => {
    const user = toAuthUser({
      id: "user-0002",
      email: "kasir@tepisawah.id",
      app_metadata: { role: "cashier" },
    });
    expect(user).toEqual({
      id: "user-0002",
      email: "kasir@tepisawah.id",
      appMetadata: { role: "cashier" },
    });
  });
});

