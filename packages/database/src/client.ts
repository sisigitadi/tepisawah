/**
 * @tepisawah/database — browser Supabase client boundary.
 *
 * THIS IS THE ONLY Supabase client safe to import from a browser app. It is
 * always created from the public anon key. The service-role key belongs to
 * `supabase/functions/_shared/` and must never reach this module or any app
 * bundle (ENVIRONMENT_CONFIG.md §5–§6, §34; REPOSITORY_STRUCTURE.md §37).
 *
 * Values are injected by the caller (apps read them through their `lib/env.ts`
 * + `@tepisawah/config`); this package never reads environment variables itself
 * so it stays testable and build-tool agnostic.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./generated/index.js";

/** Inputs required to build a browser-safe Supabase client. */
export interface BrowserClientOptions {
  /** Public Supabase project URL (`VITE_SUPABASE_URL`). */
  supabaseUrl: string;
  /** Public anon/publishable key (`VITE_SUPABASE_ANON_KEY`). Never a service-role key. */
  supabaseAnonKey: string;
}

/**
 * Build the browser Supabase client.
 *
 * Throws synchronously when either value is missing — callers fail fast at the
 * point of use rather than silently operating against an unconfigured backend
 * (ENVIRONMENT_CONFIG.md §17).
 */
export function createBrowserSupabaseClient(
  options: BrowserClientOptions,
): SupabaseClient<Database> {
  if (!options.supabaseUrl) {
    throw new Error("createBrowserSupabaseClient: supabaseUrl is required");
  }
  if (!options.supabaseAnonKey) {
    throw new Error("createBrowserSupabaseClient: supabaseAnonKey is required");
  }
  if (options.supabaseUrl.includes("service_role")) {
    throw new Error("createBrowserSupabaseClient: refusing service-role URL in browser client");
  }
  return createClient<Database>(options.supabaseUrl, options.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

/** Re-export so apps never need a direct `@supabase/supabase-js` dependency. */
export type { SupabaseClient };
