/**
 * @tepisawah/auth — offline demo identity.
 *
 * Internal applications (admin, kitchen, waiter, POS) are unusable without a
 * resolved /me identity: every page is guarded by `can()` and renders
 * `AccessDenied` when the permission union is empty. A checkout with placeholder
 * Supabase credentials cannot resolve that identity — the network calls fail, so
 * the guard refuses entry and the pages read as empty.
 *
 * `demoRole` opts a provider into a synthetic identity that skips the network
 * entirely: profile, roles and the permission union are built locally from the
 * same role map the database seeds (AUTH_RBAC_RLS.md §9). It is a preview aid,
 * never an access grant — nothing here is ever sent to a backend and a real
 * deployment simply does not pass the prop.
 */
import { resolvePermissions, type Role } from "@tepisawah/permissions";

import type { Profile } from "@tepisawah/database";

import { resolveAuthorization, type Authorization } from "./authorization.js";
import type { AuthUser } from "./client.js";

const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";

/** The synthetic staff member shown in the app header. */
export function demoUser(role: Role): AuthUser {
  return {
    id: DEMO_USER_ID,
    email: `demo.${role}@tepisawah.local`,
    appMetadata: { role },
  };
}

/** An active staff profile so authorization gate 1 (`is_active`) passes. */
export function demoProfile(): Profile {
  return {
    id: DEMO_USER_ID,
    display_name: "Admin Demo",
    phone: "+62 812 0000 0001",
    avatar_url: null,
    is_active: true,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };
}

/** The full permission union of `role`, resolved through the shared role map. */
export function demoAuthorization(role: Role): Authorization {
  return resolveAuthorization({
    profile: demoProfile(),
    roles: [role],
    permissions: resolvePermissions([role]),
  });
}
