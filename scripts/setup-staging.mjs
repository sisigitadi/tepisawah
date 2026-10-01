/**
 * scripts/setup-staging.mjs — one-shot staging Supabase provisioning.
 *
 * Gives the CI smoke test (`scripts/smoke-order-chain.mjs`) a dedicated backend
 * so it never touches the development database. Applies, in order:
 *
 *   1. every SQL file under `supabase/migrations/` (sorted — the zero-padded
 *      directory and file names are the order contract),
 *   2. `supabase/seed/development.sql` (idempotent upserts: RBAC baseline,
 *      restaurant settings, catalog, tables/QR, sessions, demo orders),
 *   3. the smoke-test admin account via the Auth Admin API, plus its `admin`
 *      role grant.
 *
 * Why a separate script instead of `scripts/seed-dev.mjs`: that script refuses
 * any host that is not localhost or a preview host (ENVIRONMENT_CONFIG §3), and
 * that guard protects production — it is not relaxed here. Staging is instead
 * gated by an explicit opt-in variable set (`STAGING_*`), so this script can
 * only ever reach a project the operator deliberately targets.
 *
 * Safety:
 *   - The database password and service-role key are read from the
 *     `STAGING_*` variables (or a gitignored root `.env.staging.local`); they
 *     are never logged.
 *   - Migrations are applied once. A marker table records the count; re-runs
 *     skip the schema phase and only re-apply the idempotent seed + admin.
 *
 * Usage:
 *   STAGING_SUPABASE_URL=https://<ref>.supabase.co \
 *   STAGING_SERVICE_ROLE_KEY=<service-role> \
 *   STAGING_DB_PASSWORD=<postgres-password> \
 *   STAGING_ADMIN_EMAIL=admin@tepisawah.id \
 *   STAGING_ADMIN_PASSWORD='<password>' \
 *   pnpm setup:staging
 */
import { readFileSync, readdirSync } from "node:fs";
import { env, exit } from "node:process";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import pg from "pg";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");
const SEED_FILE = join(ROOT, "supabase", "seed", "development.sql");
const ENV_LOCAL = join(ROOT, ".env.staging.local");
const MARKER_TABLE = "staging_schema_version";

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

/** First non-empty variable from a precedence list (explicit overrides first). */
function resolveEnv(...names) {
  for (const name of names) {
    const value = env[name];
    if (value && value.trim()) return value.trim();
  }
  return undefined;
}

const projectUrl = resolveEnv("STAGING_SUPABASE_URL", "VITE_SUPABASE_URL");
const serviceRoleKey = resolveEnv("STAGING_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY");
const dbPassword = resolveEnv("STAGING_DB_PASSWORD", "DB_PASSWORD", "POSTGRES_PASSWORD");
const adminEmail = resolveEnv("STAGING_ADMIN_EMAIL", "SMOKE_ADMIN_EMAIL");
const adminPassword = resolveEnv("STAGING_ADMIN_PASSWORD", "SMOKE_ADMIN_PASSWORD");

const missing = [
  ["STAGING_SUPABASE_URL", projectUrl],
  ["STAGING_SERVICE_ROLE_KEY", serviceRoleKey],
  ["STAGING_DB_PASSWORD", dbPassword],
  ["STAGING_ADMIN_EMAIL", adminEmail],
  ["STAGING_ADMIN_PASSWORD", adminPassword],
]
  .filter(([, value]) => !value)
  .map(([name]) => name);

if (missing.length) {
  console.error(
    "setup-staging: missing required configuration:\n  " +
      missing.map((m) => `${m} (or a .env.staging.local entry)`).join("\n  ") +
      "\nSee the header of this script for the full usage.",
  );
  exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Migration discovery (sorted paths == application order)
// ─────────────────────────────────────────────────────────────────────────────

const migrationFiles = readdirSync(MIGRATIONS_DIR, { recursive: true })
  .filter((p) => p.endsWith(".sql"))
  .map((p) => join(MIGRATIONS_DIR, p))
  .sort();

if (!migrationFiles.length) {
  console.error("setup-staging: no migration files found under supabase/migrations/");
  exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1 + 2. Schema + seed over the direct Postgres connection
// ─────────────────────────────────────────────────────────────────────────────

// The DB host is `db.<project host>`; Supabase exposes the direct connection on
// 5432 as the `postgres` role. The password is URL-encoded so special
// characters cannot break the connection string.
const projectHost = new URL(projectUrl).hostname;
const connectionUri = `postgresql://postgres:${encodeURIComponent(
  dbPassword,
)}@db.${projectHost}:5432/postgres`;

const client = new pg.Client({ connectionString: connectionUri });

async function applySchema() {
  const { rows } = await client.query(
    `select to_regclass('public.${MARKER_TABLE}') as marker`,
  );
  if (rows[0]?.marker) {
    const { rows: version } = await client.query(
      `select count from public.${MARKER_TABLE} order by applied_at desc limit 1`,
    );
    console.log(
      `setup-staging: schema already provisioned (${version[0]?.count ?? "?"} migrations) — skipping schema phase`,
    );
    return;
  }

  console.log(`setup-staging: applying ${migrationFiles.length} migration(s)`);
  for (const file of migrationFiles) {
    const sql = readFileSync(file, "utf8");
    await client.query(sql);
    console.log(`  + ${relative(ROOT, file)}`);
  }

  await client.query(`
    create table if not exists public.${MARKER_TABLE} (
      applied_at timestamptz not null default now(),
      count      integer      not null
    )
  `);
  await client.query(
    `insert into public.${MARKER_TABLE} (count) values ($1)`,
    [migrationFiles.length],
  );
  console.log("setup-staging: schema applied and marked");
}

async function applySeed() {
  const seed = readFileSync(SEED_FILE, "utf8");
  await client.query(seed);
  console.log("setup-staging: seed applied (RBAC, settings, catalog, tables, demo orders)");
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Smoke-test admin account (Auth Admin API + role grant)
// ─────────────────────────────────────────────────────────────────────────────

async function ensureAdminUser() {
  let userId;

  const created = await fetch(`${projectUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: { display_name: "Admin" },
    }),
  });

  if (created.ok) {
    userId = (await created.json()).id;
    console.log(`setup-staging: created admin user ${adminEmail}`);
  } else if (created.status === 409 || created.status === 422) {
    // Already exists from a previous run — look it up directly.
    const { rows } = await client.query(
      "select id from auth.users where email = $1",
      [adminEmail],
    );
    userId = rows[0]?.id;
    if (!userId) throw new Error(`admin user exists in Auth but not in auth.users for ${adminEmail}`);
    console.log(`setup-staging: admin user ${adminEmail} already exists — reusing`);
  } else {
    const detail = await created.text();
    throw new Error(`admin user creation failed (${created.status}): ${detail}`);
  }

  // The handle_new_user trigger (migration 002) normally creates the profile,
  // but a user minted before that migration ran would not have one, so this is
  // a defensive upsert rather than an assumption.
  await client.query(
    `insert into public.profiles (id, display_name, is_active)
     values ($1, 'Admin', true)
     on conflict (id) do nothing`,
    [userId],
  );

  await client.query(
    `insert into public.user_roles (user_id, role_id)
     select $1, r.id from public.roles r where r.code = 'admin'
     on conflict (user_id, role_id) do nothing`,
    [userId],
  );
  console.log("setup-staging: admin profile + admin role granted");
}

// ─────────────────────────────────────────────────────────────────────────────
// Run
// ─────────────────────────────────────────────────────────────────────────────

let code = 0;
try {
  console.log(`setup-staging: connecting to db.${projectHost}`);
  await client.connect();
  await applySchema();
  await applySeed();
  await ensureAdminUser();
  console.log("setup-staging: done — staging is ready for the smoke test");
} catch (error) {
  console.error(`setup-staging: FAILED — ${error.message}`);
  code = 1;
} finally {
  await client.end();
}
exit(code);
