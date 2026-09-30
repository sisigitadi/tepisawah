/**
 * @tepisawah/admin — root application component.
 *
 * Providers, router composition and bootstrap run here; no business logic lives
 * in App.tsx.
 */
import type { ReactNode } from "react";
import { AppProviders } from "./providers/index.js";
import { AppRouter } from "./router/index.js";
import { ProtectedRoute } from "../routes/ProtectedRoute.js";
import { bootstrap } from "./bootstrap/index.js";

/**
 * Initialise global configuration before first render. Bootstrap injects the
 * browser Supabase client into `@tepisawah/auth` — idempotent, no network.
 */
void bootstrap();

export function App(): ReactNode {
  return (
    <AppProviders>
      {/* With a real backend the panel requires a staff session: unauthenticated
          users get the login panel, inactive/roleless accounts get access-denied
          (AUTH_RBAC_RLS.md §14-§15). Demo builds resolve the identity locally and
          pass straight through. */}
      <ProtectedRoute>
        <AppRouter />
      </ProtectedRoute>
    </AppProviders>
  );
}
