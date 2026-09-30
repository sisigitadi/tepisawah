/**
 * Client-side guard tests (Layer 2 — docs/qa/TESTING_STRATEGY.md).
 *
 * These assert the UX contract only: what a route or button reveals based on
 * the app_metadata claim. The security boundary is RLS, which re-validates
 * every grant server-side (AUTH_RBAC_RLS.md §2.2, §38).
 */
import { PERMISSIONS, ROLES } from "@tepisawah/permissions";
import { describe, expect, it } from "vitest";

import type { AuthUser } from "./client.js";
import {
  getRole,
  getRoles,
  isAuthenticated,
  userHasAnyPermission,
  userHasPermission,
  userHasRole,
} from "./guards.js";

function user(appMetadata: Record<string, unknown> = {}): AuthUser {
  return { id: "11111111-1111-1111-1111-111111111111", email: "siti@tepisawah.id", appMetadata };
}

describe("getRole / getRoles", () => {
  it("returns null when no role claim is present", () => {
    // Regression: an empty role list must surface as null, never undefined
    // (noUncheckedIndexedAccess makes roles[0] Role | undefined).
    expect(getRole(user())).toBeNull();
  });

  it("returns null when the claim holds no known role", () => {
    expect(getRole(user({ role: "superuser" }))).toBeNull();
    expect(getRoles(user({ role: "superuser" }))).toEqual([]);
  });

  it("drops unknown values and keeps known roles", () => {
    expect(getRoles(user({ role: ["superuser", ROLES.kitchen] }))).toEqual([
      ROLES.kitchen,
    ]);
  });

  it("reads a single role claim", () => {
    expect(getRole(user({ role: ROLES.cashier }))).toBe(ROLES.cashier);
  });

  it("reads several role claims, reporting the first as primary", () => {
    const roles = getRoles(user({ role: [ROLES.kitchen, ROLES.waiter] }));
    expect(roles).toEqual([ROLES.kitchen, ROLES.waiter]);
    expect(getRole(user({ role: [ROLES.kitchen, ROLES.waiter] }))).toBe(
      ROLES.kitchen,
    );
  });

  it("resolves no roles for absent users", () => {
    expect(getRoles(null)).toEqual([]);
    expect(getRoles(undefined)).toEqual([]);
    expect(getRole(null)).toBeNull();
  });
});

describe("userHasPermission / userHasAnyPermission", () => {
  it("grants a permission held by the role", () => {
    expect(userHasPermission(user({ role: ROLES.cashier }), PERMISSIONS.PAYMENTS_CREATE)).toBe(true);
  });

  it("denies a permission the role does not hold", () => {
    expect(userHasPermission(user({ role: ROLES.kitchen }), PERMISSIONS.PAYMENTS_CREATE)).toBe(false);
    expect(userHasPermission(user({ role: ROLES.waiter }), PERMISSIONS.ROLES_MANAGE)).toBe(false);
  });

  it("denies every permission when no role is present", () => {
    expect(userHasPermission(user(), PERMISSIONS.CATALOG_READ)).toBe(false);
  });

  it("unions permissions across held roles", () => {
    // kitchen alone cannot manage roles; admin can. Holding both grants it.
    const both = user({ role: [ROLES.kitchen, ROLES.admin] });
    expect(userHasPermission(both, PERMISSIONS.KITCHEN_START)).toBe(true);
    expect(userHasPermission(both, PERMISSIONS.ROLES_MANAGE)).toBe(true);
  });

  it("satisfies any-of semantics", () => {
    expect(
      userHasAnyPermission(user({ role: ROLES.kitchen }), [
        PERMISSIONS.PAYMENTS_CREATE,
        PERMISSIONS.KITCHEN_START,
      ]),
    ).toBe(true);
    expect(
      userHasAnyPermission(user({ role: ROLES.kitchen }), [
        PERMISSIONS.PAYMENTS_CREATE,
        PERMISSIONS.ROLES_MANAGE,
      ]),
    ).toBe(false);
  });
});

describe("userHasRole / isAuthenticated", () => {
  it("reports held and unheld roles", () => {
    expect(userHasRole(user({ role: ROLES.supervisor }), ROLES.supervisor)).toBe(true);
    expect(userHasRole(user({ role: ROLES.supervisor }), ROLES.owner)).toBe(false);
  });

  it("isAuthenticated reflects user presence only", () => {
    expect(isAuthenticated(user())).toBe(true);
    expect(isAuthenticated(null)).toBe(false);
    expect(isAuthenticated(undefined)).toBe(false);
  });
});
