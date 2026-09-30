/**
 * Typed, validated, centralized environment access
 * (ENVIRONMENT_CONFIG.md §16–§17).
 *
 * Every environment variable the workspace reads is declared here. Apps read
 * `import.meta.env` once (in their `src/lib/env.ts`) and hand the record to
 * these helpers; nothing else in `packages/` or `apps/` may read environment
 * variables directly.
 *
 * Fail-fast policy: required values throw {@link MissingEnvError} only when
 * actually read — never at import time — so typecheck, tests and production
 * builds stay green from a clean, unconfigured checkout. Build-time validation
 * is performed by `scripts/check-env.mjs --strict`.
 */
import { ENVIRONMENTS, resolveEnvironment, type Environment } from "./environments.js";

/** Every environment variable name used by the workspace. */
export const ENV_KEYS = {
  /** Public — safe in browser bundles (`VITE_` prefix). */
  supabaseUrl: "VITE_SUPABASE_URL",
  supabaseAnonKey: "VITE_SUPABASE_ANON_KEY",
  /** Server-side only — never prefixed with `VITE_`. */
  serverSupabaseUrl: "SUPABASE_URL",
  serviceRoleKey: "SUPABASE_SERVICE_ROLE_KEY",
  paymentProviderSecret: "PAYMENT_PROVIDER_SECRET",
  paymentWebhookSecret: "PAYMENT_WEBHOOK_SECRET",
  /** Application metadata. */
  appEnv: "APP_ENV",
  appBaseUrl: "APP_BASE_URL",
} as const;

/** A record shaped like `import.meta.env` or `process.env`. */
export type EnvRecord = Record<string, string | undefined>;

/** Public Supabase configuration safe to pass into a browser client. */
export interface SupabasePublicConfig {
  readonly supabaseUrl: string;
  readonly supabaseAnonKey: string;
  readonly environment: Environment;
}

/** Raised when a required environment variable is missing. */
export class MissingEnvError extends Error {
  readonly keys: readonly string[];
  constructor(keys: readonly string[]) {
    super(`Missing required environment variable(s): ${keys.join(", ")}`);
    this.name = "MissingEnvError";
    this.keys = keys;
  }
}

/** Read an optional variable; missing values become `""`. */
export function readEnv(record: EnvRecord, key: string): string {
  return (record[key] ?? "").trim();
}

/**
 * Read a required variable. Throws {@link MissingEnvError} when missing so the
 * caller fails fast instead of running against an unconfigured backend.
 */
export function requireEnv(record: EnvRecord, key: string): string {
  const value = readEnv(record, key);
  if (!value) {
    throw new MissingEnvError([key]);
  }
  return value;
}

/**
 * Resolve and validate the public Supabase configuration.
 *
 * Returns only browser-safe values. The service-role key is deliberately NOT
 * part of this object — it must never enter a browser bundle.
 */
export function getSupabasePublicConfig(record: EnvRecord): SupabasePublicConfig {
  const missing = [
    ENV_KEYS.supabaseUrl,
    ENV_KEYS.supabaseAnonKey,
  ].filter((key) => !readEnv(record, key));

  if (missing.length) {
    throw new MissingEnvError(missing);
  }

  return Object.freeze({
    supabaseUrl: readEnv(record, ENV_KEYS.supabaseUrl),
    supabaseAnonKey: readEnv(record, ENV_KEYS.supabaseAnonKey),
    environment: resolveEnvironment(record),
  });
}

/** True when the server-side Supabase URL + service-role key are configured. */
export function isServiceRoleConfigured(record: EnvRecord): boolean {
  return Boolean(
    readEnv(record, ENV_KEYS.serverSupabaseUrl) &&
      readEnv(record, ENV_KEYS.serviceRoleKey),
  );
}

/**
 * Guard against accidentally pointing tooling at production.
 *
 * Development/preview tooling (`scripts/seed-dev.mjs`) must refuse to mutate a
 * database that does not present as a local or preview host
 * (ENVIRONMENT_CONFIG.md §3, §22; DATABASE_MIGRATION_PLAN.md §40).
 */
export function isDevelopmentTarget(record: EnvRecord): boolean {
  const url = readEnv(record, ENV_KEYS.serverSupabaseUrl);
  if (!url) return true; // unconfigured ⇒ no target ⇒ treated as safe/no-op
  return /^(https?:\/\/)?(localhost|127\.0\.0\.1|preview\.)/i.test(url);
}

export { ENVIRONMENTS, resolveEnvironment, type Environment };
