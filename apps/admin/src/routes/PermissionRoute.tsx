/**
 * @tepisawah/admin — permission route guard.
 *
 * UX/navigation only: hides unreachable UI. Permission checks are enforced by
 * the backend + RLS.
 */
import type { ReactNode } from "react";

export function PermissionRoute({ children }: { children: ReactNode }): ReactNode {
  // not implemented (Phase 0): permission wiring arrives in Phase 1
  return children;
}
