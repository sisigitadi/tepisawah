/**
 * @tepisawah/staff — protected route guard.
 *
 * UX/navigation only: shows the staff login panel to unauthenticated visitors
 * and access-denied for inactive accounts (§14) and for authenticated accounts
 * that hold no staff role (§15). Authorization is enforced by the backend +
 * RLS, never by this guard (AUTH_RBAC_RLS.md §2.2).
 */
import type { ReactNode } from "react";

import { AccessDenied, LoginPanel, useAuth } from "@tepisawah/auth";

export function ProtectedRoute({ children }: { children: ReactNode }): ReactNode {
  const { status, isLoading } = useAuth();

  if (isLoading) return <div aria-busy="true">Memuat…</div>;
  if (status === "disabled" || status === "unauthorized") return <AccessDenied />;
  if (status === "unauthenticated") {
    return (
      <div className="staff-login">
        <LoginPanel title="Portal Staf — Masuk" />
      </div>
    );
  }
  return children;
}
