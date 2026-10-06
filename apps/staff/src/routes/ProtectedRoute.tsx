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
import { DEMO_ACCOUNTS } from "@tepisawah/config";

import { env } from "../lib/env.js";

export function ProtectedRoute({ children }: { children: ReactNode }): ReactNode {
  const { status, isLoading } = useAuth();

  if (isLoading) return <div aria-busy="true">Memuat…</div>;
  if (status === "disabled" || status === "unauthorized") return <AccessDenied />;
  if (status === "unauthenticated") {
    return (
      // The bare `LoginPanel` is wrapped so the portal can style the login
      // surface without touching the shared `@tepisawah/auth` component.
      <div className="staff-login">
        <LoginPanel
          title="Portal Staf — Masuk"
          // Demo deployments only: the generic role accounts with click-to-fill.
          demoAccounts={env.demoMode ? DEMO_ACCOUNTS : undefined}
        />
      </div>
    );
  }
  return children;
}
