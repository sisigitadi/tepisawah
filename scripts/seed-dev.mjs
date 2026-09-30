/**
 * scripts/seed-dev.mjs — development seed boundary (Phase 1).
 *
 * Applies `supabase/seed/development.sql` to a development database only.
 * Safety rails (ENVIRONMENT_CONFIG.md §3, §22; DATABASE_MIGRATION_PLAN.md §40):
 *   - no backend configured        → advisory no-op (clean checkout safe)
 *   - target is not a dev/preview  → REFUSE and exit non-zero
 *   - seed file contains no data   → advisory no-op
 *   - Supabase CLI absent          → guidance, exit 0
 *
 * This script can never mutate a production database.
 */
import { readFileSync } from "node:fs";
import { env, exit } from "node:process";
import { spawnSync } from "node:child_process";

const SEED_FILE = new URL("../supabase/seed/development.sql", import.meta.url);
const serverUrl = env.SUPABASE_URL ?? "";

// No backend configured — nothing to seed.
if (!serverUrl) {
  console.log("seed-dev: SUPABASE_URL not configured — nothing to seed (clean checkout)");
  exit(0);
}

// Production guard: only local or preview hosts are acceptable targets.
const isDevTarget = /^(https?:\/\/)?(localhost|127\.0\.0\.1|preview\.)/i.test(serverUrl);
if (!isDevTarget) {
  console.error(
    `seed-dev: REFUSING to seed non-development target "${serverUrl}".\n` +
      "  Development seed must target localhost or a preview host (ENVIRONMENT_CONFIG §3).",
  );
  exit(1);
}

// Seed boundary file may still be empty of statements.
const seed = readFileSync(SEED_FILE, "utf8");
const statements = seed
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("--"));

if (statements.length === 0) {
  console.log("seed-dev: supabase/seed/development.sql defines no data yet — nothing to seed");
  console.log("  Seed data (roles, permissions, sample catalog) arrives with the schema phases.");
  exit(0);
}

const cli = spawnSync("supabase", ["--version"], { stdio: "ignore", shell: true });
if (cli.status !== 0) {
  console.log(
    "seed-dev: seed data is defined but the Supabase CLI is not installed.\n" +
      "  Install it and run `supabase db reset` / `supabase db push` to apply the seed.",
  );
  exit(0);
}

console.log(`seed-dev: applying ${statements.length} statement(s) to ${serverUrl}`);
const result = spawnSync(
  "supabase",
  ["db", "push", "--local", "--include-seed"],
  { cwd: new URL("../", import.meta.url), shell: true, stdio: "inherit" },
);
exit(result.status === 0 ? 0 : 1);
