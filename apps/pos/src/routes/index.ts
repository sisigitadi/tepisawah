/**
 * @tepisawah/pos — route table.
 *
 * Route composition lives here; guards are UX/navigation only — security is
 * enforced by the backend + RLS.
 */
import type { ReactNode } from "react";

export { ProtectedRoute } from "./ProtectedRoute.js";
export { PermissionRoute } from "./PermissionRoute.js";

/**
 * No router library is wired yet — route composition lands with the feature
 * phases. The guards above are already usable: `ProtectedRoute` gates staff
 * apps on the auth + profile state from `@tepisawah/auth`.
 */
export function Routes(): ReactNode {
  return null;
}
