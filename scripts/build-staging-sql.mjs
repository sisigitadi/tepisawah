/**
 * scripts/build-staging-sql.mjs — build the one-shot staging bootstrap document.
 *
 * Concatenates every migration under `supabase/migrations/` (sorted — the
 * zero-padded directory and file names are the order contract) followed by the
 * idempotent `supabase/seed/development.sql` and an admin-account block, into a
 * single SQL file.
 *
 * Why this exists: the staging project's direct Postgres endpoint is IPv6-only
 * and unreachable from this workstation (DNS returns ENODATA for the `db.`
 * subdomain's A records), so `pg` cannot apply the schema from here. The Supabase
 * dashboard's SQL Editor can. This script produces exactly what gets pasted
 * there, so the staging backend is built from the same committed migrations and
 * seed as everything else — nothing hand-assembled, nothing drifting.
 *
 * The resulting file is re-runnable: the migrations use `create ... if not
 * exists` / `create or replace` / `drop ... if exists`, the seed upserts on
 * conflict, and the admin block only inserts what is missing.
 *
 * The admin block provisions the app-level half of the smoke-test login — the
 * active profile and the `admin` role grant — against a login created in the
 * Supabase Dashboard. It deliberately does NOT write auth.users / auth.identities:
 * directly-inserted auth rows are unreliable on this Supabase version and make
 * GoTrue's sign-in path answer 500 "Database error querying schema", even with a
 * companion identity row. Creating the login in the Dashboard is the only path
 * verified to work. Because the block touches only the public schema it carries
 * no password, and its email is read from the gitignored `.env.staging.local`
 * so the document is paste-and-run; if it is absent it emits a loud placeholder
 * instead.
 *
 * Usage: pnpm build:staging   →  supabase/staging-bootstrap.sql
 *        Then paste it into the staging project's SQL Editor and Run.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import { exit } from "node:process";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");
const SEED_FILE = join(ROOT, "supabase", "seed", "development.sql");
const STAGING_ENV = join(ROOT, ".env.staging.local");
const OUT_FILE = join(ROOT, "supabase", "staging-bootstrap.sql");

const rule = "-".repeat(78);

// ─────────────────────────────────────────────────────────────────────────────
// Staging admin credentials (gitignored override file; never logged)
// ─────────────────────────────────────────────────────────────────────────────

/** Minimal KEY=VALUE parser, mirroring scripts/setup-staging.mjs. */
function parseEnvFile(file) {
  const out = {};
  try {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      out[key] = value;
    }
  } catch {
    // No override file — placeholders are emitted below.
  }
  return out;
}

const stagingEnv = parseEnvFile(STAGING_ENV);
const adminEmail = stagingEnv.STAGING_ADMIN_EMAIL;

if (!adminEmail) {
  console.warn(
    "build-staging-sql: WARNING — STAGING_ADMIN_EMAIL is not set in\n" +
      "  .env.staging.local. The bootstrap document was still written, but its\n" +
      "  admin block targets a placeholder address you MUST edit in the SQL\n" +
      "  Editor before running it.",
  );
}

/** Escape single quotes for a SQL string literal. */
const lit = (value) => String(value).replace(/'/g, "''");
const emailLit = lit(adminEmail || "admin@tepisawah.id");

// ─────────────────────────────────────────────────────────────────────────────
// Migration discovery (sorted paths == application order)
// ─────────────────────────────────────────────────────────────────────────────

const migrationFiles = readdirSync(MIGRATIONS_DIR, { recursive: true })
  .filter((p) => p.endsWith(".sql"))
  .sort();

if (!migrationFiles.length) {
  console.error("build-staging-sql: no migration files found under supabase/migrations/");
  exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin-account block
// ─────────────────────────────────────────────────────────────────────────────

const adminBlock = `-- ${rule}
-- ADMIN ACCOUNT — the smoke test signs in as this user.
-- ${rule}
-- The login itself is created in the Supabase Dashboard (Authentication →
-- Users → Add user, Auto Confirm ON, password = STAGING_ADMIN_PASSWORD). This
-- block provisions only the app-level half against that login.
--
-- Why not insert auth.users here: directly-inserted auth.* rows are unreliable
-- on this Supabase version. Even with a companion auth.identities row, GoTrue's
-- sign-in path answers 500 "Database error querying schema" for them, while
-- Dashboard-created users sign in fine. Writing the login where GoTrue writes it
-- is the only path verified to work — the dev project's admin is created the
-- same way (see grant-admin-role.sql).
--
-- This block touches only the public schema, so it is safe to re-run at any
-- time, and it carries no password — the bootstrap document stays secret-free
-- apart from the seed data.
--
--   1. public.profiles row, active.
--   2. the \`admin\` role grant in public.user_roles, which is what
--      fetchCurrentUserRoles() reads through RLS. Without it the panel shows
--      "unauthorized".
--
-- >>> If the login uses a different address, change it in the two places <<<
-- >>> below before running.                                           <<<
-- Plain SQL only (no PL/pgSQL): safe in the Supabase SQL Editor.

-- 1. public.profiles
insert into public.profiles (id, display_name, is_active)
select auth.users.id, split_part(auth.users.email, '@', 1), true
from auth.users
where auth.users.email = '${emailLit}'
on conflict (id) do update set is_active = true;

-- 2. the admin role grant
insert into public.user_roles (user_id, role_id)
select auth.users.id, roles.id
from auth.users, public.roles
where auth.users.email = '${emailLit}'
  and roles.code = 'admin'
on conflict (user_id, role_id) do nothing;

-- Verification — the smoke admin must appear with the admin role and exactly
-- one identity. If identities is 0, the login has not been created in the
-- Dashboard yet; if email_confirmed is false, Auto Confirm was left off.
select u.email,
       u.email_confirmed_at is not null as email_confirmed,
       p.is_active,
       r.code as role,
       (select count(*) from public.role_permissions rp where rp.role_id = r.id)
         as permission_count,
       (select count(*) from auth.identities i where i.user_id = u.id)
         as identities
from auth.users u
join public.profiles  p on p.id = u.id
join public.user_roles ur on ur.user_id = u.id
join public.roles     r on r.id = ur.role_id
where r.code = 'admin';
`;

// ─────────────────────────────────────────────────────────────────────────────
// Assemble
// ─────────────────────────────────────────────────────────────────────────────

const header = `-- ${rule}
-- TEPI SAWAH — STAGING BOOTSTRAP. GENERATED, DO NOT EDIT BY HAND.
--
-- Builds the dedicated staging backend that the CI order-chain smoke test runs
-- against, so it never touches the development database. Produced by
-- \`scripts/build-staging-sql.mjs\` from the committed \`supabase/migrations/*\`,
-- \`supabase/seed/development.sql\` and the staging admin credentials — re-run
-- that script after adding a migration, changing the seed, or rotating the
-- admin password. Never edit this file.
--
-- HOW TO APPLY (once, or after any change above):
--   1. Open the \`tepisawah-staging\` project in the Supabase dashboard.
--   2. Go to SQL Editor → New query.
--   3. Paste this whole file and Run.
--
-- It is re-runnable: schema statements are \`if not exists\` / \`create or
-- replace\` / \`drop if exists\`, every seed statement upserts on conflict, and
-- the admin block only inserts what is missing — so a partial first run can
-- simply be retried in full.
--
-- PREREQUISITE: the smoke-test login must exist first. Create it in the
-- dashboard (Authentication → Users → Add user, Auto Confirm ON) with the
-- password from .env.staging.local. The admin block here then grants that
-- login the admin role; it does not create the login itself — directly-inserted
-- auth.* rows make GoTrue's sign-in path answer 500.
-- ${rule}
`;

const parts = [
  header,
  ...migrationFiles.map((rel) => {
    const sql = readFileSync(join(MIGRATIONS_DIR, rel), "utf8");
    return `-- ${rule}\n-- MIGRATION: ${rel}\n-- ${rule}\n\n${sql.trimEnd()}\n`;
  }),
  `-- ${rule}\n-- SEED: supabase/seed/development.sql\n-- ${rule}\n\n${readFileSync(SEED_FILE, "utf8").trimEnd()}\n`,
  adminBlock,
];

writeFileSync(OUT_FILE, parts.join("\n"));

console.log(
  `build-staging-sql: wrote ${relative(ROOT, OUT_FILE)} ` +
    `(${migrationFiles.length} migrations + seed + admin, ` +
    `${parts.join("\n").split("\n").length} lines)`,
);
console.log("  Paste it into the staging project's SQL Editor and Run.");
if (!adminEmail) {
  console.log("  ⚠ Edit the admin email literals before running — placeholder address in use.");
}
