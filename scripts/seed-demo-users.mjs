/**
 * scripts/seed-demo-users.mjs — provision the generic demo role accounts.
 *
 * Creates (or normalizes) one auth user per staff role on the demo backend,
 * so a hosted demo deployment (`VITE_DEMO_MODE=true`) can hand every account
 * to a presenter or reviewer. The account list is the canonical JSON at
 * `packages/config/src/demo-accounts.json` — the exact list the login panel
 * renders — so the UI and the backend can never drift apart.
 *
 * Per account this script:
 *   1. creates the auth user via the Auth Admin API (never raw SQL inserts
 *      into auth.users — those logins break with 500 on this Supabase
 *      version, see scripts/setup-staging.mjs),
 *   2. or, when the email already exists, resets its password to the demo
 *      value so re-runs converge instead of diverging,
 *   3. upserts an active `profiles` row and grants the matching role in
 *      `user_roles` over the direct Postgres connection.
 *
 * Configuration (explicit opt-in only — the script is inert without it):
 *   DEMO_SUPABASE_URL      (falls back to STAGING_SUPABASE_URL)
 *   DEMO_SERVICE_ROLE_KEY  (falls back to STAGING_SERVICE_ROLE_KEY)
 *   DEMO_DB_PASSWORD       (falls back to STAGING_DB_PASSWORD)
 * or a gitignored `.env.staging.local` providing the STAGING_* names, which
 * is how local runs share the CI credentials.
 *
 * Run: pnpm seed:demo
 */
import { readFileSync } from "node:fs";
import { env, exit } from "node:process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import pg from "pg";
import { loadEnvFile } from "./env-file.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const ACCOUNTS_FILE = join(ROOT, "packages", "config", "src", "demo-accounts.json");
const ENV_LOCAL = join(ROOT, ".env.staging.local");

loadEnvFile(ENV_LOCAL);

/** First non-empty variable from a precedence list (explicit overrides first). */
function resolveEnv(...names) {
  for (const name of names) {
    const value = env[name];
    if (value && value.trim()) return value.trim();
  }
  return undefined;
}

const projectUrl = resolveEnv("DEMO_SUPABASE_URL", "STAGING_SUPABASE_URL");
const serviceRoleKey = resolveEnv("DEMO_SERVICE_ROLE_KEY", "STAGING_SERVICE_ROLE_KEY");
const dbPassword = resolveEnv("DEMO_DB_PASSWORD", "STAGING_DB_PASSWORD");

const missing = [
  ["DEMO_SUPABASE_URL", projectUrl],
  ["DEMO_SERVICE_ROLE_KEY", serviceRoleKey],
  ["DEMO_DB_PASSWORD", dbPassword],
]
  .filter(([, value]) => !value)
  .map(([name]) => name);

if (missing.length) {
  console.error(
    "seed-demo-users: missing required configuration:\n  " +
      missing
        .map((m) => `${m} (or the matching STAGING_* secret / .env.staging.local entry)`)
        .join("\n  ") +
      "\nSee the header of this script for the full usage.",
  );
  exit(1);
}

const accounts = JSON.parse(readFileSync(ACCOUNTS_FILE, "utf8"));
if (!Array.isArray(accounts) || accounts.length === 0) {
  console.error(`seed-demo-users: no accounts defined in ${ACCOUNTS_FILE}`);
  exit(1);
}

const projectHost = new URL(projectUrl).hostname;
const connectionUri = `postgresql://postgres:${encodeURIComponent(
  dbPassword,
)}@db.${projectHost}:5432/postgres`;
const client = new pg.Client({ connectionString: connectionUri });

/** Auth Admin API headers. */
function adminHeaders() {
  return {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
    "content-type": "application/json",
  };
}

/**
 * Create the auth user, or normalize an existing one's password.
 * Returns the user's id either way.
 */
async function ensureAuthUser(account) {
  const created = await fetch(`${projectUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({
      email: account.email,
      password: account.password,
      email_confirm: true,
      user_metadata: { display_name: `${account.label} (Demo)` },
    }),
  });

  if (created.ok) {
    const user = await created.json();
    console.log(`seed-demo-users: created ${account.email} (${account.role})`);
    return user.id;
  }

  if (created.status !== 409 && created.status !== 422) {
    const detail = await created.text();
    throw new Error(
      `creating ${account.email} failed (${created.status}): ${detail}`,
    );
  }

  // Already exists from a previous run — look it up and reset the password so
  // the demo credentials stay true no matter who changed them last.
  const { rows } = await client.query(
    "select id from auth.users where email = $1",
    [account.email],
  );
  const userId = rows[0]?.id;
  if (!userId) {
    throw new Error(`${account.email} exists in Auth but not in auth.users`);
  }

  const updated = await fetch(`${projectUrl}/auth/v1/admin/users/${userId}`, {
    method: "PUT",
    headers: adminHeaders(),
    body: JSON.stringify({ password: account.password }),
  });
  if (!updated.ok) {
    const detail = await updated.text();
    throw new Error(
      `password reset for ${account.email} failed (${updated.status}): ${detail}`,
    );
  }
  console.log(`seed-demo-users: ${account.email} exists — password reset`);
  return userId;
}

/** Upsert the active profile and grant the role over Postgres. */
async function ensureProfileAndRole(userId, account) {
  await client.query(
    `insert into public.profiles (id, display_name, is_active)
     values ($1, $2, true)
     on conflict (id) do update set
       display_name = excluded.display_name,
       is_active    = true`,
    [userId, `${account.label} (Demo)`],
  );

  const { rowCount } = await client.query(
    `insert into public.user_roles (user_id, role_id)
     select $1, r.id from public.roles r where r.code = $2
     on conflict (user_id, role_id) do nothing`,
    [userId, account.role],
  );

  console.log(
    rowCount
      ? `seed-demo-users: role '${account.role}' granted to ${account.email}`
      : `seed-demo-users: role '${account.role}' already held by ${account.email}`,
  );
}

let code = 0;
try {
  console.log(`seed-demo-users: targeting ${projectUrl} (${accounts.length} demo accounts)`);
  await client.connect();
  for (const account of accounts) {
    const userId = await ensureAuthUser(account);
    await ensureProfileAndRole(userId, account);
  }
  console.log("seed-demo-users: done — demo accounts are ready");
} catch (error) {
  if (["ENOTFOUND", "ECONNREFUSED", "ETIMEDOUT"].includes(error.code)) {
    console.error(
      `seed-demo-users: cannot reach the database at db.${projectHost} (${error.code}).\n` +
        "  Run this from CI (workflow_dispatch) or against a reachable project.",
    );
  } else {
    console.error(`seed-demo-users: FAILED — ${error.message}`);
  }
  code = 1;
} finally {
  await client.end().catch(() => {});
}
exit(code);
