/**
 * Demo mode — presentational deployments with generic role accounts.
 *
 * A hosted demo (Vercel preview or a demo tenant) points at a demo backend
 * where one generic account per staff role exists so a presenter or reviewer
 * can walk every workflow without personal credentials. The flag that turns
 * the UI hints on is `VITE_DEMO_MODE` (public — browser-safe, see env.ts):
 *
 *   - demo backends set `VITE_DEMO_MODE=true`;
 *   - production builds leave it unset, so no hint renders and no credential
 *     is surfaced — the apps stay production-ready from the same code path.
 *
 * The account list itself lives in `demo-accounts.json` next to this module —
 * the single source of truth shared by the login UI (via
 * `@tepisawah/auth`'s LoginPanel) and `scripts/seed-demo-users.mjs`, which
 * provisions the matching auth users + role grants on the demo backend.
 * The accounts only exist on the demo backend; the same list is inert in a
 * production deployment because its backend has no such users and the flag
 * never renders the hints.
 */
import demoAccountsJson from "./demo-accounts.json";

/** Public env flag that enables the demo login hints (browser-safe). */
export const DEMO_MODE_KEY = "VITE_DEMO_MODE";

/** One generic demo account, keyed to a seeded staff role. */
export interface DemoAccount {
  /** Role code in `public.roles` (migration 003 / seed baseline). */
  readonly role: string;
  /** Human label shown in the login hint, matching the app language. */
  readonly label: string;
  readonly email: string;
  readonly password: string;
  /** One-line pointer to the workflow this account demonstrates. */
  readonly blurb: string;
}

/**
 * The canonical demo accounts, one per staff role. Treated as immutable —
 * the seed script provisions exactly this list.
 */
export const DEMO_ACCOUNTS: readonly DemoAccount[] = demoAccountsJson;

/** True when the record turns the demo login hints on (`true`/`1`/`yes`). */
export function isDemoMode(record: Record<string, string | undefined>): boolean {
  const raw = (record[DEMO_MODE_KEY] ?? "").trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}
