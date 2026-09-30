/**
 * @tepisawah/auth — Supabase auth client wrapper.
 *
 * The real `@supabase/supabase-js` client is injected by the app at bootstrap
 * (REPOSITORY_STRUCTURE.md §50: no runtime Supabase dependency in Phase 0).
 * This module defines the contract the apps program against and the thin
 * session-oriented helpers built on top of it.
 *
 * The injected contract intentionally mirrors the raw Supabase payload shapes
 * (snake_case metadata) so `client.auth` satisfies it structurally. App-facing
 * code never touches those raw shapes: it uses the normalized {@link AuthUser}
 * produced by {@link toAuthUser}.
 */

/**
 * Raw auth user record as Supabase returns it. Metadata is snake_case in the
 * JWT claims; lenient so test doubles stay small. Never used directly by
 * feature code — normalize via {@link toAuthUser}.
 */
export interface AuthRawUser {
  id: string;
  email?: string | null;
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
}

/**
 * Auth user shape the package exposes to apps. Metadata is normalised to
 * camelCase; this is the only auth-user type feature code should consume.
 */
export interface AuthUser {
  id: string;
  email: string | undefined;
  /** Raw JWT claims for callers that need role / app metadata. */
  appMetadata: Record<string, unknown>;
}

/**
 * Supabase auth surface — the tolerant subset the packages and apps rely on.
 *
 * Every method declares a single, permissive result shape. Supabase itself
 * returns discriminated unions (session-or-error); each union member is
 * assignable to these shapes, so both the real client and hand-written test
 * doubles satisfy the contract.
 */
export interface SupabaseAuth {
  getSession(): Promise<{
    data: { session: AuthSession | null };
    error: AuthError | null;
  }>;
  getUser(): Promise<{
    data: { user: AuthRawUser | null };
    error: AuthError | null;
  }>;
  signInWithPassword(credentials: {
    email: string;
    password: string;
  }): Promise<{ data: { session: AuthSession | null }; error: AuthError | null }>;
  signOut(): Promise<{ error: AuthError | null }>;
  refreshSession(): Promise<{
    data: { session: AuthSession | null };
    error: AuthError | null;
  }>;
  onAuthStateChange(
    callback: (event: AuthChangeEvent, session: AuthSession | null) => void,
  ): { data: { subscription: { unsubscribe(): void } } };
}

/** Session shape (subset). */
export interface AuthSession {
  access_token: string;
  refresh_token: string | null | undefined;
  expires_in: number | null | undefined;
  user: AuthRawUser;
}

/** Supabase auth error shape. */
export interface AuthError {
  message: string;
  code?: string;
}

/**
 * Auth state change events. Mirrors the full Supabase event set so the injected
 * client satisfies the contract structurally; the package only acts on a
 * subset (session.ts ignores the event kind and re-derives state).
 */
export type AuthChangeEvent =
  | "INITIAL_SESSION"
  | "PASSWORD_RECOVERY"
  | "SIGNED_IN"
  | "SIGNED_OUT"
  | "TOKEN_REFRESHED"
  | "USER_UPDATED"
  | "MFA_CHALLENGE_VERIFIED";

/**
 * Invariant: the injected client must be registered exactly once, before any
 * consumer reads it. Apps call this from `src/bootstrap/`.
 */
let injected: SupabaseAuth | null = null;

/** Register the concrete Supabase auth surface. */
export function setAuthClient(client: SupabaseAuth): void {
  injected = client;
}

/** Access the registered client; throws if bootstrap has not run. */
export function getAuthClient(): SupabaseAuth {
  if (!injected) {
    throw new Error("auth client not initialised (call setAuthClient during bootstrap)");
  }
  return injected;
}

/** True once a client has been registered. */
export function hasAuthClient(): boolean {
  return injected !== null;
}

/**
 * Map a raw Supabase auth user record onto the package {@link AuthUser}.
 *
 * Normalises snake_case claims to camelCase and never fails on missing
 * metadata: an absent claim set becomes an empty object, not undefined.
 */
export function toAuthUser(user: AuthRawUser): AuthUser {
  return {
    id: user.id,
    email: user.email ?? undefined,
    appMetadata: user.app_metadata ?? {},
  };
}
