/**
 * @tepisawah/admin — protected route guard.
 *
 * UX/navigation only: redirects unauthenticated users to the login panel and
 * shows access-denied for inactive accounts (§14) and for authenticated
 * accounts that hold no staff role (§15). Authorization is enforced by the
 * backend + RLS, never by this guard (AUTH_RBAC_RLS.md §2.2).
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
      <LoginPanel
        title="Panel Pengelola — Masuk Staf"
        // Demo deployments only: the generic role accounts with click-to-fill.
        demoAccounts={env.demoMode ? DEMO_ACCOUNTS : undefined}
      />
    );
  }
  return children;
}
