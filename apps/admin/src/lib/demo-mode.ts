/**
 * @tepisawah/admin — demo-mode detection.
 *
 * The preview build ships placeholder Supabase values. Real calls against them
 * hang or fail, so the service layer checks this flag first and serves the
 * in-memory seed instead of hitting the network. A deployment with a real URL
 * never trips it, so production behavior is untouched.
 */
import { env } from "./env.js";

let override: boolean | null = null;

/** Force demo mode on or off (tests). */
export function setDemoMode(value: boolean | null): void {
  override = value;
}

/** True when the configured backend is the unreachable preview placeholder. */
export function isDemoMode(): boolean {
  if (override !== null) return override;
  return (
    env.supabaseUrl.includes("local-preview") ||
    env.supabaseAnonKey.includes("placeholder")
  );
}
