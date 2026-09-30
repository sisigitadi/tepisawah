/**
 * @tepisawah/auth — permission route guard (Phase 3).
 *
 * UX/navigation only. It decides what a route renders based on the permissions
 * the database granted the session; the backend re-validates the same
 * permission under RLS on every request, so a tampered client never reaches
 * protected data (AUTH_RBAC_RLS.md §2.2, §37, §38).
 *
 * Denial never discloses which permission is missing: the caller sees the same
 * generic access-denied screen either way (AUTH_RBAC_RLS.md §41).
 *
 * Place inside a `ProtectedRoute` so authentication and the active/profile gate
 * are applied first; this guard then applies the permission gate.
 */
import type { ReactNode } from "react";
import type { Permission } from "@tepisawah/permissions";

import { useAuth } from "./auth-context.js";
import { AccessDenied } from "./access-denied.js";
import { LoginPanel } from "./login-panel.js";

/** Default staff-app login heading. */
const DEFAULT_TITLE = "Staff Login";

/**
 * Gate `children` behind one or more permissions.
 *
 * @param permissions permission codes the route requires.
 * @param requireAll true when every code must be held; false (default) when
 *   holding any one of them is enough.
 */
export function PermissionRoute({
  permissions,
  requireAll = false,
  title = DEFAULT_TITLE,
  children,
}: {
  permissions: readonly Permission[];
  requireAll?: boolean;
  title?: string;
  children: ReactNode;
}): ReactNode {
  const { status, isLoading, can } = useAuth();

  if (isLoading) return <div aria-busy="true">Memuat…</div>;
  if (status === "unauthenticated") return <LoginPanel title={title} />;
  if (status === "disabled" || status === "unauthorized") return <AccessDenied />;

  const allowed = requireAll
    ? permissions.every((permission) => can(permission))
    : permissions.some((permission) => can(permission));

  return allowed ? children : <AccessDenied />;
}
