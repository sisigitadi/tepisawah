/**
 * Client-side permission guards used by route guards and UI affordances.
 *
 * These answers are UX only: they decide what a route renders or what a button
 * shows. The backend re-validates the same permission under RLS on every
 * request (AUTH_RBAC_RLS.md §2.2, §38) — a tampered client claim never grants
 * access to data.
 */
import type { Permission } from "./permissions.js";
import {
  isRole,
  resolvePermissions,
  rolePermissions,
  type Role,
} from "./roles.js";

/** True when `role` grants `permission`. */
export function hasPermission(
  role: Role | undefined | null,
  permission: Permission,
): boolean {
  if (!role) return false;
  return rolePermissions(role).includes(permission);
}

/** True when `role` grants any of `permissions`. */
export function hasAnyPermission(
  role: Role | undefined | null,
  permissions: readonly Permission[],
): boolean {
  if (!role) return false;
  return permissions.some((p) => hasPermission(role, p));
}

/**
 * True when the union of `roles` grants `permission`
 * (AUTH_RBAC_RLS.md §12 — effective permissions are the union over roles).
 */
export function hasPermissionInRoles(
  roles: readonly Role[] | null | undefined,
  permission: Permission,
): boolean {
  return resolvePermissions(roles).includes(permission);
}

/** True when the union of `roles` grants any of `permissions`. */
export function hasAnyPermissionInRoles(
  roles: readonly Role[] | null | undefined,
  permissions: readonly Permission[],
): boolean {
  const granted = resolvePermissions(roles);
  return permissions.some((p) => granted.includes(p));
}

/** Coerce an unknown claim value into a role list, dropping unknown values. */
export function toRoleList(
  claim: unknown,
): Role[] {
  if (Array.isArray(claim)) {
    return claim.filter((value): value is Role => typeof value === "string" && isRole(value));
  }
  if (typeof claim === "string" && isRole(claim)) return [claim];
  return [];
}
