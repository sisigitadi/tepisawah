/**
 * Profile gate tests (Layer 2 — docs/qa/TESTING_STRATEGY.md).
 *
 * `classifyProfile` is the first authorization decision after authentication:
 * an inactive account must not reach protected operations, but its identity and
 * history are preserved (AUTH_RBAC_RLS.md §2.1, §14).
 */
import { describe, expect, it } from "vitest";

import { AUTH_MESSAGES } from "./errors.js";
import { classifyProfile, disabledUserMessage, isProfileActive } from "./profile.js";
import type { Profile } from "@tepisawah/database";

function activeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "user-0001",
    display_name: "Siti",
    phone: "+6281234567890",
    avatar_url: null,
    is_active: true,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

describe("classifyProfile", () => {
  it("classifies an active profile as active", () => {
    const state = classifyProfile(activeProfile());
    expect(state.isActive).toBe(true);
    expect(state.profile?.display_name).toBe("Siti");
    expect(state.error).toBeNull();
  });

  it("keeps the profile but marks an inactive account inactive", () => {
    const state = classifyProfile(activeProfile({ is_active: false }));
    expect(state.isActive).toBe(false);
    // Identity is retained — disabling blocks access, it does not erase history.
    expect(state.profile?.id).toBe("user-0001");
    expect(state.profile?.display_name).toBe("Siti");
  });

  it("treats a missing profile as inactive without granting access", () => {
    const state = classifyProfile(null);
    expect(state.isActive).toBe(false);
    expect(state.profile).toBeNull();
    expect(state.error).toBeNull();
  });
});

describe("isProfileActive", () => {
  it("is true only for a present, active profile", () => {
    expect(isProfileActive(activeProfile())).toBe(true);
    expect(isProfileActive(activeProfile({ is_active: false }))).toBe(false);
    expect(isProfileActive(null)).toBe(false);
  });
});

describe("disabledUserMessage", () => {
  it("returns the safe public message", () => {
    expect(disabledUserMessage()).toBe(AUTH_MESSAGES.userDisabled);
  });
});
