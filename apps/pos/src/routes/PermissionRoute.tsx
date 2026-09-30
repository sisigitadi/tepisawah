/**
 * @tepisawah/pos — permission route guard.
 *
 * UX/navigation only: hides UI the session cannot use. Permission checks are
 * enforced by the backend + RLS (AUTH_RBAC_RLS.md §2.2, §34) — bypassing this
 * guard grants nothing.
 */
import type { ReactNode } from "react";

import { AccessDenied, useAuth } from "@tepisawah/auth";
import type { Permission } from "@tepisawah/permissions";

export interface PermissionRouteProps {
  /** The permission the guarded content requires. */
  permission: Permission;
  children: ReactNode;
}

export function PermissionRoute({ permission, children }: PermissionRouteProps): ReactNode {
  const { can, isLoading } = useAuth();

  if (isLoading) return <div aria-busy="true">Memuat…</div>;
  if (!can(permission)) return <AccessDenied />;
  return children;
}
