/**
 * scripts/seed-demo-users.mjs — provision the generic demo role accounts.
 *
 * Creates (or normalizes) one auth user per staff role on the demo backend,
 * so a hosted demo deployment (`VITE_DEMO_MODE=true`) can hand a presenter or
 * reviewer every workflow without personal credentials. The account list is
 * the canonical JSON at `packages/config/src/demo-accounts.json` — the exact
 * list the login panel renders — so the UI and the backend can never drift
 * apart.
 *
 * Per account this script:
 *   1. creates the auth user via the Auth Admin API (never raw SQL inserts
 *      into auth.users — those logins break with 500 on this Supabase
 *      version, see scripts/setup-staging.mjs),
 *   2. or, when the email already exists, resets its password to the demo
 *      value so re-runs converge instead of diverging,
 *   3. upserts an active `profiles` row and grants the matching role in
 *      `user_roles` over PostgREST.
 *
 * Everything goes over HTTPS — the management REST surface only — so the
 * script runs from anywhere that can reach the project URL: a workstation
 * behind a NAT that blocks direct Postgres (port 5432), or CI. It needs no
 * database password; the service role key bypasses row-level security on the
 * profile and role tables, which is exactly what seeding requires.
 *
 * Configuration (explicit opt-in only — the script is inert without it):
 *   DEMO_SUPABASE_URL      (falls back to STAGING_SUPABASE_URL)
 *   DEMO_SERVICE_ROLE_KEY  (falls back to STAGING_SERVICE_ROLE_KEY)
 * or a gitignored `.env.staging.local` providing the STAGING_* names, which
 * is how local runs share the CI credentials.
 *
 * Run: pnpm seed:demo
 */
import { readFileSync } from "node:fs";
import { env, exit } from "node:process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
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

const missing = [
  ["DEMO_SUPABASE_URL", projectUrl],
  ["DEMO_SERVICE_ROLE_KEY", serviceRoleKey],
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

/** Admin/PostgREST headers. The service role key bypasses RLS. */
function adminHeaders() {
  return {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
    "content-type": "application/json",
  };
}

async function restFetch(path, options = {}) {
  const response = await fetch(`${projectUrl}${path}`, {
    ...options,
    headers: { ...adminHeaders(), ...options.headers },
  });
  return response;
}

/**
 * Load every auth user so an existing demo account can be found by email.
 * Paginates until the backend stops returning a next page; demo backends hold
 * a bounded roster, so this stays a couple of round trips.
 */
async function loadExistingEmails() {
  const byEmail = new Map();
  let page = 1;
  for (;;) {
    const response = await restFetch(
      `/auth/v1/admin/users?page=${page}&per_page=200`,
    );
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(
        `listing auth users failed (${response.status}): ${detail}`,
      );
    }
    const payload = await response.json();
    const users = payload.users ?? [];
    for (const user of users) {
      if (user.email) byEmail.set(user.email.toLowerCase(), user.id);
    }
    const next = payload.next_page ?? payload.nextPage;
    if (!next || users.length === 0) break;
    page = next;
  }
  return byEmail;
}

/**
 * Create the auth user, or normalize an existing one's password.
 * Returns the user's id either way.
 */
async function ensureAuthUser(account, existing) {
  const created = await restFetch("/auth/v1/admin/users", {
    method: "POST",
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

  // 409/422 here means the email is already taken; anything else is a real
  // failure and must not be swallowed.
  if (created.status !== 409 && created.status !== 422) {
    const detail = await created.text();
    throw new Error(
      `creating ${account.email} failed (${created.status}): ${detail}`,
    );
  }

  const userId = existing.get(account.email.toLowerCase());
  if (!userId) {
    throw new Error(
      `${account.email} was reported as existing but is absent from the user list`,
    );
  }

  const updated = await restFetch(`/auth/v1/admin/users/${userId}`, {
    method: "PUT",
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

/** Upsert an active profile over PostgREST (select-then-write, schema-agnostic). */
async function ensureProfile(userId, account) {
  const label = `${account.label} (Demo)`;
  const selectResponse = await restFetch(
    `/rest/v1/profiles?id=eq.${userId}&select=id`,
  );
  if (!selectResponse.ok) {
    const detail = await selectResponse.text();
    throw new Error(`reading profile for ${account.email} failed (${selectResponse.status}): ${detail}`);
  }
  const found = await selectResponse.json();

  if (found.length > 0) {
    const updateResponse = await restFetch(
      `/rest/v1/profiles?id=eq.${userId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ display_name: label, is_active: true }),
      },
    );
    if (!updateResponse.ok) {
      const detail = await updateResponse.text();
      throw new Error(`updating profile for ${account.email} failed (${updateResponse.status}): ${detail}`);
    }
  } else {
    const insertResponse = await restFetch("/rest/v1/profiles", {
      method: "POST",
      body: JSON.stringify({ id: userId, display_name: label, is_active: true }),
    });
    if (!insertResponse.ok) {
      const detail = await insertResponse.text();
      throw new Error(`inserting profile for ${account.email} failed (${insertResponse.status}): ${detail}`);
    }
  }
}

/** Grant the role over PostgREST, idempotently. */
async function ensureRole(userId, account) {
  const roleResponse = await restFetch(
    `/rest/v1/roles?code=eq.${encodeURIComponent(account.role)}&select=id`,
  );
  if (!roleResponse.ok) {
    const detail = await roleResponse.text();
    throw new Error(`looking up role '${account.role}' failed (${roleResponse.status}): ${detail}`);
  }
  const roles = await roleResponse.json();
  if (roles.length === 0) {
    throw new Error(
      `role '${account.role}' is not seeded on the target backend — run the schema migrations first`,
    );
  }
  const roleId = roles[0].id;

  const linkResponse = await restFetch(
    `/rest/v1/user_roles?user_id=eq.${userId}&role_id=eq.${roleId}&select=user_id`,
  );
  if (!linkResponse.ok) {
    const detail = await linkResponse.text();
    throw new Error(`checking role grant for ${account.email} failed (${linkResponse.status}): ${detail}`);
  }
  const linked = await linkResponse.json();
  if (linked.length > 0) {
    console.log(
      `seed-demo-users: role '${account.role}' already held by ${account.email}`,
    );
    return;
  }

  const grantResponse = await restFetch("/rest/v1/user_roles", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, role_id: roleId }),
  });
  if (!grantResponse.ok) {
    const detail = await grantResponse.text();
    throw new Error(`granting role '${account.role}' to ${account.email} failed (${grantResponse.status}): ${detail}`);
  }
  console.log(`seed-demo-users: role '${account.role}' granted to ${account.email}`);
}

let code = 0;
try {
  console.log(`seed-demo-users: targeting ${projectUrl} (${accounts.length} demo accounts)`);
  const existing = await loadExistingEmails();
  for (const account of accounts) {
    const userId = await ensureAuthUser(account, existing);
    await ensureProfile(userId, account);
    await ensureRole(userId, account);
  }
  console.log("seed-demo-users: done — demo accounts are ready");
} catch (error) {
  if (["ENOTFOUND", "ECONNREFUSED", "ETIMEDOUT"].includes(error.code)) {
    console.error(
      `seed-demo-users: cannot reach ${projectUrl} (${error.code}).\n` +
        "  Check the project URL and network egress, or run this from CI (workflow_dispatch).",
    );
  } else {
    console.error(`seed-demo-users: FAILED — ${error.message}`);
  }
  code = 1;
}
exit(code);
