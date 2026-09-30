/**
 * @tepisawah/order — root application component.
 *
 * Providers, router composition and bootstrap run here; no business logic lives
 * in App.tsx.
 */
import type { ReactNode } from "react";
import { AppProviders } from "./providers/index.js";
import { AppRouter } from "./router/index.js";
import { bootstrap } from "./bootstrap/index.js";

/**
 * Initialise global configuration before first render. Public apps keep a
 * no-op bootstrap: staff auth is intentionally not wired here
 * (AUTH_RBAC_RLS.md §15 is a staff-only flow).
 */
void bootstrap();

export function App(): ReactNode {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  );
}
