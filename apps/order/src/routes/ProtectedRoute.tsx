/**
 * @tepisawah/order — protected route guard.
 *
 * Public app: stays a passthrough. Staff auth is not wired here
 * (AUTH_RBAC_RLS.md §15 is a staff-only flow); anything customer-facing that
 * needs a session arrives with the customer-flow phase.
 */
import type { ReactNode } from "react";

export function ProtectedRoute({ children }: { children: ReactNode }): ReactNode {
  return children;
}
