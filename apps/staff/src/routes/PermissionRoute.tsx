/**
 * @tepisawah/staff — permission route guard.
 *
 * UX/navigation only: hides UI the session cannot use. Permission checks are
 * enforced by the backend + RLS (AUTH_RBAC_RLS.md §2.2, §34) — bypassing this
 * guard grants nothing.
 */
import { useEffect, type ReactNode } from "react";

import { AccessDenied, useAuth } from "@tepisawah/auth";
import type { Permission } from "@tepisawah/permissions";
import { getPrimaryRoomForRoles } from "../lib/navigation.js";

export interface PermissionRouteProps {
  /** The permission the guarded content requires. */
  permission: Permission;
  children: ReactNode;
}

export function PermissionRoute({ permission, children }: PermissionRouteProps): ReactNode {
  const { can, isLoading, roles, user } = useAuth();

  if (isLoading) {
    return (
      <div
        aria-busy="true"
        style={{
          minHeight: "40vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#183a1d",
          fontWeight: 600,
        }}
      >
        Memuat ruang kerja operasional…
      </div>
    );
  }

  useEffect(() => {
    if (!can(permission) && typeof window !== "undefined") {
      const primary = getPrimaryRoomForRoles(roles, user?.email);
      const currentPath = window.location.pathname.replace(/\/+$/, "") || "/";
      if (currentPath !== `/${primary}`) {
        window.location.replace(`/${primary}`);
      }
    }
  }, [can, permission, roles, user?.email]);

  if (!can(permission)) {
    return null;
  }

  return children;
}
