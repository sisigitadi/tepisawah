/**
 * @tepisawah/web — provider composition.
 *
 * Compose app-level React providers (realtime, theme) here. The staff
 * `AuthProvider` from `@tepisawah/auth` is deliberately omitted: this is a
 * public app and AUTH_RBAC_RLS.md §15 is a staff-only flow.
 */

import type { ReactNode } from "react";

/**
 * Public provider shell — renders children as-is so the app renders without
 * credentials from a clean checkout.
 */
export function AppProviders({ children }: { children: ReactNode }): ReactNode {
  return children;
}
