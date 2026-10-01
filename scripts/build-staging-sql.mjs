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
 * The admin block mirrors the dev project's `create-admin-user.sql`: it writes
 * auth.users + auth.identities (GoTrue's sign-in path needs the identities row —
 * without it sign-in 500s), the profile, and the `admin` role grant. Its email
 * and password are read from the gitignored `.env.staging.local` so the document
 * is paste-and-run; if those are absent it emits a loud placeholder instead.
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
const adminPassword = stagingEnv.STAGING_ADMIN_PASSWORD;

if (!adminEmail || !adminPassword) {
  console.warn(
    "build-staging-sql: WARNING — STAGING_ADMIN_EMAIL / STAGING_ADMIN_PASSWORD\n" +
      "  are not set in .env.staging.local. The bootstrap document was still\n" +
      "  written, but its admin block carries placeholder values you MUST edit\n" +
      "  in the SQL Editor before running it.",
  );
}

/** Escape single quotes for a SQL string literal. */
const lit = (value) => String(value).replace(/'/g, "''");
const emailLit = lit(adminEmail || "admin@tepisawah.id");
// Deliberately invalid placeholder: if it ever reaches the database it fails
// loudly rather than silently creating a account with a garbage password.
const passwordLit = lit(adminPassword || "CHANGE_ME_IN_SQL_EDITOR");

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
-- Same idempotent pattern as the dev project's create-admin-user.sql:
--   1. auth.users row with a bcrypt-hashed password and email_confirmed_at set,
--      so sign-in works and no confirmation email is sent.
--   2. auth.identities row — GoTrue's sign-in path reads this relation; a
--      directly-inserted auth.users row without it 500s on login.
--   3. public.profiles row, active.
--   4. the \`admin\` role grant in public.user_roles, which is what
--      fetchCurrentUserRoles() reads through RLS. Without it the panel shows
--      "unauthorized".
-- Plain SQL only (no PL/pgSQL): safe in the Supabase SQL Editor.
with params as (
  select '${emailLit}'::text as v_email,
         '${passwordLit}'::text as v_password
),
created as (
  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password,
     email_confirmed_at, created_at, updated_at,
     raw_app_meta_data, raw_user_meta_data, is_super_admin)
  select
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    v_email,
    crypt(v_password, gen_salt('bf', 10)),
    now(), now(), now(),
    '{"role":"admin"}'::jsonb, '{}'::jsonb, false
  from params
  where not exists (select 1 from auth.users u where u.email = params.v_email)
  returning id, email
),
resolved as (
  select id, email from created
  union all
  select u.id, u.email
  from auth.users u, params
  where u.email = params.v_email
    and not exists (select 1 from created)
),
identity as (
  insert into auth.identities
    (id, user_id, provider_id, provider, identity_data,
     created_at, updated_at, last_sign_in_at)
  -- email is a GENERATED column on identities in this Supabase version, derived
  -- from identity_data, so it is not written directly.
  select
    gen_random_uuid(),
    resolved.id,
    resolved.id::text,
    'email',
    jsonb_build_object('sub', resolved.id::text, 'email', resolved.email),
    now(), now(), now()
  from resolved
  where not exists (select 1 from auth.identities i where i.user_id = resolved.id)
),
profile as (
  insert into public.profiles (id, display_name, is_active)
  select resolved.id, split_part(params.v_email, '@', 1), true
  from resolved, params
  on conflict (id) do update set is_active = true
  returning id
)
insert into public.user_roles (user_id, role_id)
select profile.id, roles.id
from profile, public.roles
where roles.code = 'admin'
on conflict (user_id, role_id) do nothing;

-- Verification — the smoke admin must appear with the admin role.
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
if (!adminEmail || !adminPassword) {
  console.log("  ⚠ Edit the admin `params` CTE before running — placeholder credentials in use.");
}
