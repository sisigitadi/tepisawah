/**
 * scripts/check-env.mjs — environment validation (Phase 1).
 *
 * Reads `.env.example` as the registry of required variables and reports which
 * are set in `process.env`. Without `--strict` it is advisory (exit 0) so a
 * clean, unconfigured checkout stays green in CI; with `--strict` a missing
 * required variable fails the run (ENVIRONMENT_CONFIG.md §17).
 *
 * Also scans committed example files for accidentally-pasted real values, so a
 * secret can never be committed unnoticed (ENVIRONMENT_CONFIG.md §6, §19).
 */
import { readFileSync } from "node:fs";
import { argv, env, exit } from "node:process";

const EXAMPLE = new URL("../.env.example", import.meta.url);

/** Keys that must never carry a `VITE_` prefix (server-side only). */
const SERVER_SIDE = new Set([
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "PAYMENT_PROVIDER_SECRET",
  "PAYMENT_WEBHOOK_SECRET",
  "INTERNAL_API_SECRET",
]);

/**
 * Documented but defaulted, so they are reported yet never fail `--strict`:
 * `APP_ENV` falls back to `development` (`@tepisawah/config`) and `APP_BASE_URL`
 * is optional site metadata (ENVIRONMENT_CONFIG.md §7).
 */
const OPTIONAL = new Set(["APP_ENV", "APP_BASE_URL"]);

const strict = argv.includes("--strict");

const example = readFileSync(EXAMPLE, "utf8");
const required = [...example.matchAll(/^([A-Z0-9_]+)=/gm)].map((m) => m[1]);

console.log("check-env: required variables");
const missing = [];
for (const key of required) {
  const server = SERVER_SIDE.has(key);
  const set = Boolean(env[key]);
  if (!set && !OPTIONAL.has(key)) missing.push(key);
  const tag = server ? "server" : "public ";
  console.log(`  ${set ? "OK    " : "MISSING"} [${tag}] ${key}`);
}

// Committed-secret scan: example files must contain placeholders only.
const exampleFiles = [".env.example"];
const SECRETISH = /(SUPABASE_SERVICE_ROLE_KEY|SERVICE_ROLE|PAYMENT_(PROVIDER|WEBHOOK)_SECRET)\s*=\s*\S{12,}/;
let leaked = 0;
for (const file of exampleFiles) {
  const text = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  for (const line of text.split("\n")) {
    if (SECRETISH.test(line) && !/\=\s*$/.test(line)) {
      console.error(`check-env: SECRET VALUE in ${file}: ${line.split("=")[0]}=***`);
      leaked += 1;
    }
  }
}
if (leaked) {
  console.error(`check-env: ${leaked} committed secret value(s) found`);
  exit(1);
}

// A server-side key must never be exposed under a VITE_ prefix.
for (const key of Object.keys(env)) {
  if (key.startsWith("VITE_") && /SERVICE_ROLE|_SECRET/.test(key)) {
    console.error(`check-env: server-side key exposed as VITE_ prefix: ${key}`);
    exit(1);
  }
}

if (missing.length && strict) {
  console.error(`check-env: ${missing.length} required variable(s) missing (strict mode)`);
  exit(1);
}
if (missing.length) {
  console.log(`check-env: advisory complete — ${missing.length} missing, run with --strict to enforce`);
} else {
  console.log("check-env: all required variables present");
}
