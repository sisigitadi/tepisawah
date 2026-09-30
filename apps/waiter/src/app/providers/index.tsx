/**
 * @tepisawah/waiter — provider composition.
 *
 * Composes app-level React providers. The `AuthProvider` receives the
 * RLS-enforced browser client; the service-role key is never reachable here.
 */
import type { ReactNode } from "react";

import { AuthProvider } from "@tepisawah/auth";

import { getSupabaseClient } from "../../lib/supabase.js";

export function AppProviders({ children }: { children: ReactNode }): ReactNode {
  return <AuthProvider supabase={getSupabaseClient()}>{children}</AuthProvider>;
}
