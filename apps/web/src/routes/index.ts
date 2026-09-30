/**
 * @tepisawah/web — route table.
 *
 * Route composition lives here; guards are UX/navigation only — security is
 * enforced by the backend + RLS.
 */
import type { ReactNode } from "react";

export { ProtectedRoute } from "./ProtectedRoute.js";
export { PermissionRoute } from "./PermissionRoute.js";

/**
 * No router library is wired yet — route composition lands with the feature
 * phases. This is a public app: `ProtectedRoute` stays a passthrough and staff
 * auth is not wired (AUTH_RBAC_RLS.md §15 is a staff-only flow).
 */
export function Routes(): ReactNode {
  return null;
}
