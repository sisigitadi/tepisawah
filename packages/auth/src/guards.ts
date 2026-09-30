/**
 * @tepisawah/auth — role resolution and client-side guards.
 *
 * The staff role is carried as an app_metadata claim by Supabase auth
 * (REPOSITORY_STRUCTURE.md §34); the database is the single owner of
 * permission grants, so these helpers are for UI affordances and route
 * gating only, never for enforcement.
 */
import {
  hasAnyPermissionInRoles,
  hasPermissionInRoles,
  isRole,
  toRoleList,
  type Permission,
  type Role,
} from "@tepisawah/permissions";

import type { AuthUser } from "./client.js";

/** app_metadata key carrying the staff role(s). */
export const ROLE_CLAIM = "role";

/** Claim shape stored in the Supabase auth user's app_metadata. */
export interface AuthClaims {
  role?: string;
}

/**
 * Read the staff role off a user's app_metadata.
 * Returns null when the claim is absent or not a known role.
 */
export function getRole(user: AuthUser | null | undefined): Role | null {
  const roles = getRoles(user);
  const primary = roles[0];
  return primary === undefined ? null : primary;
}

/**
 * Read every staff role off a user's app_metadata.
 *
 * A user may hold several roles; effective permissions are the union
 * (AUTH_RBAC_RLS.md §12). Unknown values are dropped.
 */
export function getRoles(user: AuthUser | null | undefined): Role[] {
  if (!user) return [];
  const claims = user.appMetadata as AuthClaims;
  return toRoleList(claims[ROLE_CLAIM]);
}

/** True when the user holds the given permission. */
export function userHasPermission(
  user: AuthUser | null | undefined,
  permission: Permission,
): boolean {
  return hasPermissionInRoles(getRoles(user), permission);
}

/** True when the user holds any of the given permissions. */
export function userHasAnyPermission(
  user: AuthUser | null | undefined,
  permissions: readonly Permission[],
): boolean {
  return hasAnyPermissionInRoles(getRoles(user), permissions);
}

/** True when the user holds the given role. */
export function userHasRole(
  user: AuthUser | null | undefined,
  role: Role,
): boolean {
  return getRoles(user).includes(role);
}

/** True when the user is signed in. */
export function isAuthenticated(user: AuthUser | null | undefined): boolean {
  return user !== null && user !== undefined;
}
