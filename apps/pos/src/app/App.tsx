/**
 * @tepisawah/pos — root application component.
 *
 * Providers, router composition and bootstrap run here; no business logic lives
 * in App.tsx.
 */
import type { ReactNode } from "react";
import { AppProviders } from "./providers/index.js";
import { AppRouter } from "./router/index.js";
import { bootstrap } from "./bootstrap/index.js";

/**
 * Initialise global configuration before first render. Bootstrap injects the
 * browser Supabase client into `@tepisawah/auth` — idempotent, no network.
 */
void bootstrap();

export function App(): ReactNode {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  );
}
