/**
 * @tepisawah/staff — bootstrap.
 *
 * Injects the browser Supabase client into the auth package exactly once, so
 * feature code imports only `@tepisawah/auth` (REPOSITORY_STRUCTURE.md §50).
 * Safe from a clean checkout: no network or auth work happens here, only
 * dependency injection.
 */
import { setAuthClient } from "@tepisawah/auth";

import { getSupabaseClient } from "../../lib/supabase.js";

let bootstrapped = false;

/**
 * Wire the auth boundary. Idempotent so React StrictMode double-invocation is
 * harmless.
 */
export function bootstrap(): void {
  if (bootstrapped) return;
  setAuthClient(getSupabaseClient().auth);
  bootstrapped = true;
}
