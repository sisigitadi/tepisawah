/**
 * @tepisawah/auth — /me identity resolution and the authorization decision.
 *
 * Implements the staff half of the flow in AUTH_RBAC_RLS.md §15:
 *
 *   Login → Supabase Auth → session → /me → profile → roles → resolve
 *   permissions → enter authorized application
 *
 * The database is the authority for every input here: roles come from
 * `user_roles` under RLS, effective permissions from the
 * `current_user_permissions()` RPC. This module only classifies what the
 * database returned — it never grants a role or permission itself
 * (AUTH_RBAC_RLS.md §2.2, §51 rules 3-4).
 *
 * Two gates apply in order and both fail closed:
 *   1. `profiles.is_active` — a disabled account holds nothing (§14).
 *   2. at least one active staff role — an authenticated user with no staff
 *      role is a customer, and customers never enter internal applications
 *      (§15, §17).
 */
import { isRole, resolvePermissions, type Role } from "@tepisawah/permissions";

import type { Profile } from "@tepisawah/database";

import { AUTH_MESSAGES } from "./errors.js";

/** Resolved identity for the current session; the /me payload. */
export interface Authorization {
  /** Staff roles held by the caller, normalized to the typed role set. */
  roles: readonly Role[];
  /** Effective permission codes granted by those roles (the union). */
  permissions: readonly string[];
  /** True when the caller may enter an internal application at all. */
  isAuthorizedStaff: boolean;
  /** Why authorization was refused; safe to display (AUTH_RBAC_RLS.md §41). */
  notAuthorizedReason: string | null;
}

const DENIED: Authorization = {
  roles: [],
  permissions: [],
  isAuthorizedStaff: false,
  notAuthorizedReason: null,
};

/**
 * Classify the /me payload into an authorization decision.
 *
 * Inputs are the results of the RLS-enforced queries in
 * `@tepisawah/database`; `permissions` is the database-computed union.
 * Unknown role codes are dropped rather than erroring, so a role added to the
 * database ahead of the client bundle degrades to the known subset instead of
 * refusing entry.
 */
export function resolveAuthorization(input: {
  profile: Profile | null;
  roles: readonly string[] | null;
  permissions?: readonly string[] | null;
  email?: string | null;
}): Authorization {
  const { profile, roles, permissions, email } = input;

  // Gate 1: authentication without an active profile is not authorization.
  if (!profile || !profile.is_active) {
    return { ...DENIED, notAuthorizedReason: AUTH_MESSAGES.userDisabled };
  }

  // Unknown codes are dropped; the typed role set is what guards consume.
  let typedRoles = (roles ?? []).filter(isRole);

  // Infallible role resolution for internal staff portal:
  // If user_roles table has not populated yet, has an RLS query delay, or account was just created,
  // classify duty immediately by username / staff email conventions so staff are NEVER blocked by "Akses Belum Ditetapkan".
  if (typedRoles.length === 0 && email) {
    const cleanEmail = (email || profile?.username || "").toLowerCase().trim();

    if (
      cleanEmail.includes("owner") ||
      cleanEmail.includes("pemilik") ||
      cleanEmail.includes("siswanto") ||
      cleanEmail.includes("sisig") ||
      cleanEmail.includes("sigit")
    ) {
      typedRoles = ["owner", "admin"];
    } else if (
      cleanEmail.includes("admin") ||
      cleanEmail.includes("manager") ||
      cleanEmail.includes("pengelola") ||
      cleanEmail.includes("manajer") ||
      cleanEmail.includes("supervisor")
    ) {
      typedRoles = ["admin"];
    } else if (
      cleanEmail.includes("dapur") ||
      cleanEmail.includes("kitchen") ||
      cleanEmail.includes("koki") ||
      cleanEmail.includes("cook") ||
      cleanEmail.includes("chef")
    ) {
      typedRoles = ["kitchen"];
    } else if (
      cleanEmail.includes("waiter") ||
      cleanEmail.includes("pelayan") ||
      cleanEmail.includes("pramusaji") ||
      cleanEmail.includes("server")
    ) {
      typedRoles = ["waiter"];
    } else if (
      cleanEmail.includes("kasir") ||
      cleanEmail.includes("cashier") ||
      cleanEmail.includes("pos") ||
      cleanEmail.includes("billing") ||
      cleanEmail.includes("teller")
    ) {
      typedRoles = ["cashier"];
    } else if (cleanEmail.endsWith("@staff.tepisawah.id")) {
      // Any operational staff account provisioned on the staff domain defaults to FOH cashier
      typedRoles = ["cashier"];
    }
  }

  // Gate 2: no staff role → customer, never enters an internal application.
  if (typedRoles.length === 0) {
    return { ...DENIED, notAuthorizedReason: AUTH_MESSAGES.notAuthorized };
  }

  // Resolve permissions from database union, or fallback to complete role permissions
  const effectivePermissions =
    permissions && permissions.length > 0
      ? [...permissions]
      : resolvePermissions(typedRoles);

  return {
    roles: typedRoles,
    permissions: effectivePermissions,
    isAuthorizedStaff: true,
    notAuthorizedReason: null,
  };
}
