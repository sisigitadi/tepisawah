/**
 * scripts/validate-schema.mjs — migration & boundary validator (Phase 1).
 *
 * Offline and side-effect free: never touches a database. Enforces the
 * migration conventions from DATABASE_MIGRATION_PLAN.md (§2, §29, §34, §41) and
 * the client-boundary rules from REPOSITORY_STRUCTURE.md (§31–§33):
 *   1. migration entries are named and ordered correctly;
 *   2. no SQL exists outside `supabase/migrations/` (except `supabase/seed/`);
 *   3. migration SQL avoids forbidden/unsafe constructs;
 *   4. no browser app or package imports `supabase/functions/_shared`.
 *
 * Exits 1 on any violation.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { exit } from "node:process";

const ROOT = new URL("../", import.meta.url);
const MIGRATIONS = new URL("supabase/migrations/", ROOT);

let violations = 0;
function fail(message) {
  console.error(`validate-schema: ${message}`);
  violations += 1;
}

/** Accepts `NNN_name` sequence dirs and `YYYYMMDDHHMMSS_name(.sql)` entries. */
function isValidMigrationName(name) {
  return /^\d{3}_[a-z0-9_]+$/.test(name) || /^\d{14}_[a-z0-9_]+(\.sql)?$/.test(name);
}

const entries = readdirSync(MIGRATIONS).sort();
if (entries.length === 0) fail("supabase/migrations/ is empty");

for (const name of entries) {
  if (!isValidMigrationName(name)) {
    fail(`migration entry "${name}" does not match NNN_name or <timestamp>_name convention`);
  }
}

// Scan every committed SQL file for unsafe constructs.
const FORBIDDEN = [
  { pattern: /drop\s+table/i, reason: "DROP TABLE requires explicit approval (migration plan §2)" },
  { pattern: /drop\s+database/i, reason: "DROP DATABASE requires explicit approval" },
  { pattern: /using\s*\(\s*true\s*\)/i, reason: "overly permissive RLS `USING (true)` (§34)" },
  { pattern: /service_role/i, reason: "service-role reference must be reviewed (§31)" },
  { pattern: /\beyj[A-Za-z0-9_-]{10,}/, reason: "possible hardcoded JWT/secret" },
];

function scanSql(file, label) {
  const text = readFileSync(file, "utf8");
  for (const { pattern, reason } of FORBIDDEN) {
    if (pattern.test(text)) fail(`${label}: ${reason}`);
  }
}

for (const name of entries) {
  const path = new URL(`supabase/migrations/${name}`, ROOT);
  if (statSync(path).isDirectory()) {
    const dir = new URL(`${name}/`, MIGRATIONS);
    for (const file of readdirSync(dir).sort()) {
      if (file.endsWith(".sql")) scanSql(new URL(file, dir), `migrations/${name}/${file}`);
    }
  } else if (name.endsWith(".sql")) {
    scanSql(path, `migrations/${name}`);
  }
}

// No SQL may live outside supabase/migrations/ or supabase/seed/.
const SCAN_ROOTS = ["apps", "packages", "scripts"];
for (const root of SCAN_ROOTS) {
  const dir = new URL(`${root}/`, ROOT);
  if (!statSync(dir, { throwIfNoEntry: false })) continue;
  const walk = (d) => {
    for (const entry of readdirSync(d)) {
      const full = new URL(entry, d);
      const st = statSync(full);
      if (st.isDirectory() && !entry.includes("node_modules") && entry !== "dist") walk(new URL(`${entry}/`, d));
      else if (entry.endsWith(".sql")) fail(`SQL outside supabase/: ${root}/${decodeURIComponent(full.href.replace(dir.href, ""))}`);
    }
  };
  walk(dir);
}

// Client boundary: nothing browser-facing may reach the server-only helpers.
// Matched against import *specifiers* (quoted) only, so prose mentions of the
// path in documentation comments do not register as a breach.
const BOUNDARY_LINE = /(?:import|from)\s+["'][^"']*functions\/_shared|import\s*\(\s*["'][^"']*functions\/_shared/;
const BOUNDARY_ROOTS = ["apps", "packages"];
for (const root of BOUNDARY_ROOTS) {
  const dir = new URL(`${root}/`, ROOT);
  const walk = (d) => {
    for (const entry of readdirSync(d)) {
      if (entry === "node_modules" || entry === "dist") continue;
      const full = new URL(entry, d);
      const st = statSync(full);
      if (st.isDirectory()) walk(new URL(`${entry}/`, d));
      else if (/\.(ts|tsx|js)$/.test(entry)) {
        const text = readFileSync(full, "utf8");
        for (const line of text.split("\n")) {
          if (BOUNDARY_LINE.test(line)) {
            fail(`${root} imports supabase/functions/_shared — server-only boundary breach`);
            break;
          }
        }
      }
    }
  };
  walk(dir);
}

if (violations) {
  console.error(`validate-schema: ${violations} violation(s) found`);
  exit(1);
}
console.log(`validate-schema: OK — ${entries.length} migration entr(y/ies), conventions satisfied`);
