/**
 * Environment access — single source of truth for Vite env vars.
 *
 * This is the ONLY module allowed to read `import.meta.env`. Validation and
 * typing live in `@tepisawah/config` (ENVIRONMENT_CONFIG.md §16–§17); this
 * module just supplies the raw record. Fail-fast happens at point of use
 * (`lib/supabase.ts`) and at build time (`scripts/check-env.mjs --strict`), so
 * typecheck and builds stay green from a clean checkout.
 */
import {
  ENV_KEYS,
  getSupabasePublicConfig,
  isDemoMode,
  readEnv,
  resolveEnvironment,
  type EnvRecord,
  type SupabasePublicConfig,
} from "@tepisawah/config";

const record: EnvRecord = import.meta.env;

/** Raw, non-throwing snapshot. Empty strings when unconfigured. */
export const env = {
  supabaseUrl: readEnv(record, ENV_KEYS.supabaseUrl),
  supabaseAnonKey: readEnv(record, ENV_KEYS.supabaseAnonKey),
  environment: resolveEnvironment(record),
  appBaseUrl: readEnv(record, ENV_KEYS.appBaseUrl),
  /** Demo deployments only: enables the /demo presentation hub. */
  demoMode: isDemoMode(record),
  /** Optional per-app demo URLs (`id=url,id=url`) for the /demo hub links. */
  demoAppUrls: readEnv(record, "VITE_DEMO_APP_URLS"),
} as const;

/**
 * Validated public Supabase config. Throws {@link MissingEnvError} when the
 * required public values are missing — call this (indirectly, via
 * `getSupabaseClient`) at the point a backend connection is actually needed.
 */
export function requireSupabaseConfig(): SupabasePublicConfig {
  return getSupabasePublicConfig(record);
}
