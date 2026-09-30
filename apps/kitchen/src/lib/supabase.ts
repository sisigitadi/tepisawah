/**
 * Supabase client accessor — the browser boundary.
 *
 * Returns the anon-key client from `@tepisawah/database`. The service-role key
 * is never read here; `import.meta.env.SUPABASE_SERVICE_ROLE_KEY` and any
 * `VITE_`-prefixed secret are out of scope for browser code
 * (ENVIRONMENT_CONFIG.md §5–§6).
 *
 * Lazily instantiated and validated on first call, so importing this module
 * costs nothing and a missing configuration fails fast only when something
 * actually tries to talk to the backend.
 */
import { createBrowserSupabaseClient, type Database, type SupabaseClient } from "@tepisawah/database";

import { requireSupabaseConfig } from "./env.js";

let client: SupabaseClient<Database> | null = null;

/** The browser-safe Supabase client (anon key, RLS-enforced). */
export function getSupabaseClient(): SupabaseClient<Database> {
  if (client) return client;
  const config = requireSupabaseConfig();
  client = createBrowserSupabaseClient(config);
  return client;
}

/** True once the client has been constructed. Mainly for tests. */
export function hasSupabaseClient(): boolean {
  return client !== null;
}

/** Reset the cached client (tests only). */
export function resetSupabaseClient(): void {
  client = null;
}
