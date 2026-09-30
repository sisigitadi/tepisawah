/**
 * @tepisawah/admin — provider composition.
 *
 * Composes app-level React providers. The `AuthProvider` receives the
 * RLS-enforced browser client; the service-role key is never reachable here.
 */
import type { ReactNode } from "react";

import { AuthProvider } from "@tepisawah/auth";
import { ROLES } from "@tepisawah/permissions";

import { getSupabaseClient } from "../../lib/supabase.js";
import { isDemoMode } from "../../lib/demo-mode.js";

export function AppProviders({ children }: { children: ReactNode }): ReactNode {
  // Preview builds run against an unreachable backend; resolve a synthetic
  // admin identity locally so the guarded pages render. A real deployment
  // leaves demoRole unset and identity comes from the database.
  const demoRole = isDemoMode() ? ROLES.admin : undefined;
  return (
    <AuthProvider supabase={getSupabaseClient()} demoRole={demoRole}>
      {children}
    </AuthProvider>
  );
}
