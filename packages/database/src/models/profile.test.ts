/**
 * Profile model normalization tests (Layer 2 — docs/qa/TESTING_STRATEGY.md).
 *
 * `toProfile` is the boundary between a raw Supabase row and the application
 * record, so its defaults are asserted explicitly: an unreadable `is_active`
 * must never degrade into an active account (AUTH_RBAC_RLS.md §14 — fail
 * closed). The true column default lives in the database (DATABASE_SCHEMA.md
 * §6.2); this normalizer only mirrors what it could actually read.
 */
import { describe, expect, it } from "vitest";

import { toProfile, type ProfileRow } from "./profile.js";

function row(overrides: Partial<ProfileRow> = {}): ProfileRow {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    display_name: "Siti",
    phone: "+6281234567890",
    avatar_url: null,
    is_active: true,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

describe("toProfile", () => {
  it("maps a complete row unchanged", () => {
    const profile = toProfile(row());

    expect(profile).toEqual({
      id: "11111111-1111-1111-1111-111111111111",
      display_name: "Siti",
      phone: "+6281234567890",
      avatar_url: null,
      is_active: true,
      created_at: "2026-09-01T00:00:00Z",
      updated_at: "2026-09-01T00:00:00Z",
    });
  });

  it("defaults a null display_name to an empty string", () => {
    expect(toProfile(row({ display_name: null })).display_name).toBe("");
  });

  it("treats a null is_active as inactive (fail closed)", () => {
    expect(toProfile(row({ is_active: null })).is_active).toBe(false);
  });

  it("preserves an explicit is_active false", () => {
    expect(toProfile(row({ is_active: false })).is_active).toBe(false);
  });

  it("defaults null timestamps to an empty string", () => {
    const profile = toProfile(row({ created_at: null, updated_at: null }));
    expect(profile.created_at).toBe("");
    expect(profile.updated_at).toBe("");
  });
});
