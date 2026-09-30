/**
 * supabase/functions/_shared/supabase — SERVER-SIDE client factory.
 *
 * BOUNDARY: this file lives outside `packages/` and is not exported through any
 * `@tepisawah/*` workspace package, so it is physically impossible for a
 * browser app to import it. It reads the service-role key from the Deno
 * environment and must stay server-side only
 * (REPOSITORY_STRUCTURE.md §31; ENVIRONMENT_CONFIG.md §6, §34).
 *
 * Edge functions import the client from the Supabase-hosted ESM CDN, which is
 * the documented Deno import convention for edge functions.
 */
// @ts-expect-error — Deno URL import; not part of the workspace TS project.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Minimal generated-database contract until `supabase gen types` is run. */
export interface Database {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

function requireEnv(key: string): string {
  const value = Deno?.env?.get(key);
  if (!value) {
    throw new Error(`_shared/supabase: required server variable "${key}" is not set`);
  }
  return value;
}

/**
 * Privileged client authenticated with the service-role key.
 *
 * Use ONLY for operations RLS cannot express, and always behind an explicit
 * authorization check. Never return this client or its service-role key to a
 * response body.
 */
export function getServiceRoleClient(): SupabaseClient<Database> {
  return createClient<Database>(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

/**
 * Client scoped to the caller's session.
 *
 * Pass the request's `Authorization` header so RLS evaluates every query as the
 * authenticated user. This is the preferred client for edge functions — RLS is
 * the security boundary, not the function's own logic
 * (TECHNICAL_ARCHITECTURE.md §20; AUTH_RBAC_RLS.md).
 */
export function getSessionClient(authHeader: string | null): SupabaseClient<Database> {
  const url = requireEnv("SUPABASE_URL");
  const anonKey = Deno?.env?.get("VITE_SUPABASE_ANON_KEY") ?? Deno?.env?.get("SUPABASE_ANON_KEY");
  if (!anonKey) {
    throw new Error("_shared/supabase: public anon key is not set");
  }
  return createClient<Database>(url, anonKey, {
    global: { headers: authHeader ? { Authorization: authHeader } : {} },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
