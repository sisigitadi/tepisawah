/**
 * scripts/smoke-staging.mjs — run the order chain smoke test against staging.
 *
 * Thin wrapper around `scripts/smoke-order-chain.mjs`. That script is
 * environment-agnostic: it reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
 * and `SMOKE_ADMIN_*` from the process environment first, then from `.env.local`
 * — which on a configured workstation means *development*. The staging
 * credentials therefore live under their own `STAGING_*` names — in a
 * gitignored `.env.staging.local` on a workstation, or as step env in CI — and
 * this script is the only place they are translated onto the names the smoke
 * test expects. CI runs this same wrapper (`pnpm smoke:staging` in
 * `.github/workflows/ci.yml`) with the `STAGING_*` secrets, so both entry
 * points share one code path and one contract.
 *
 * The mapping is deliberately one-way and staging-scoped: nothing here ever
 * falls back to `.env.local`, so `pnpm smoke:staging` cannot silently target the
 * development backend. Precedence for each `STAGING_*` name is the process
 * environment first, then the local file — the same order `setup-staging.mjs`
 * uses, so an exported variable overrides the file without editing it.
 *
 * Prerequisite: the smoke test imports the built ESM barrel
 * `packages/database/dist/database.js`. Build it once with
 * `pnpm --filter @tepisawah/database build` (CI's Build step does this before
 * the smoke step).
 *
 * Usage:
 *   pnpm smoke:staging                 full chain, deletes the order it created
 *   pnpm smoke:staging --keep          leave the PAID test order in staging
 *   pnpm smoke:staging --table A1      target a specific table
 *   pnpm smoke:staging --email x --password y   override the staff login
 *
 * Any further arguments are forwarded to the smoke test verbatim.
 */
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { env, exit } from "node:process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const ENV_LOCAL = join(ROOT, ".env.staging.local");
const SMOKE_SCRIPT = join(ROOT, "scripts", "smoke-order-chain.mjs");
const DATABASE_BUNDLE = join(ROOT, "packages", "database", "dist", "database.js");

/** The names the smoke test reads → where the staging value comes from. */
const MAPPING = {
  VITE_SUPABASE_URL: "STAGING_SUPABASE_URL",
  VITE_SUPABASE_ANON_KEY: "STAGING_SUPABASE_ANON_KEY",
  SMOKE_ADMIN_EMAIL: "STAGING_ADMIN_EMAIL",
  SMOKE_ADMIN_PASSWORD: "STAGING_ADMIN_PASSWORD",
  SUPABASE_SERVICE_ROLE_KEY: "STAGING_SERVICE_ROLE_KEY",
};

// ─────────────────────────────────────────────────────────────────────────────
// Configuration resolution
// ─────────────────────────────────────────────────────────────────────────────

/** Minimal KEY=VALUE parser for a gitignored local override file. */
function parseEnvFile(file) {
  try {
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return;
        const eq = trimmed.indexOf("=");
        if (eq < 1) return;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (!(key in env)) env[key] = value;
      });
  } catch {
    // No override file — process environment only.
  }
}

parseEnvFile(ENV_LOCAL);

/** Resolve a staging variable from the process environment, then the file. */
function resolveStaging(name) {
  const value = env[name];
  return value && value.trim() ? value.trim() : undefined;
}

// Undefined values are dropped on purpose: env vars are strings, so passing
// `undefined` through would reach the child as the literal "undefined" and be
// treated as a real (invalid) key.
const resolved = Object.fromEntries(
  Object.entries(MAPPING)
    .map(([target, source]) => [target, resolveStaging(source)])
    .filter(([, value]) => value !== undefined),
);

const REQUIRED = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "SMOKE_ADMIN_EMAIL",
  "SMOKE_ADMIN_PASSWORD",
];
const missing = REQUIRED.filter((target) => !resolved[target]);

if (missing.length) {
  console.error(
    "smoke:staging: missing required staging configuration:\n  " +
      missing
        .map(
          (target) =>
            `${target} (set ${MAPPING[target]}, or add it to .env.staging.local)`,
        )
        .join("\n  ") +
      "\n  SUPABASE_SERVICE_ROLE_KEY is optional — without it the run leaves\n" +
      "  one PAID test order behind and prints the SQL to remove it.",
  );
  exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Preflight
// ─────────────────────────────────────────────────────────────────────────────

try {
  readFileSync(DATABASE_BUNDLE);
} catch {
  console.error(
    "smoke:staging: packages/database/dist/database.js is not built.\n" +
      "  Build it first:\n" +
      "    pnpm --filter @tepisawah/database build",
  );
  exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Run
// ─────────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

console.log(`smoke:staging: targeting ${resolved.VITE_SUPABASE_URL}`);
if (!resolved.SUPABASE_SERVICE_ROLE_KEY) {
  console.log(
    "smoke:staging: no service-role key — the test order will be left behind (use --keep to silence this)",
  );
}

const child = spawn(process.execPath, [SMOKE_SCRIPT, ...args], {
  stdio: "inherit",
  env: { ...env, ...resolved },
});

child.on("error", (error) => {
  console.error(`smoke:staging: cannot start the smoke test — ${error.message}`);
  exit(1);
});

child.on("exit", (code) => {
  exit(code ?? 1);
});
