/**
 * Test doubles for the auth suite (Layer 2 — docs/qa/TESTING_STRATEGY.md).
 *
 * `FakeAuth` implements the real {@link SupabaseAuth} contract, so the suite
 * exercises the package's own session logic rather than a re-implementation of
 * it. `profileClientFactory` stands in for the RLS-enforced browser client for
 * `profiles` reads.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProfileRow } from "@tepisawah/database";

import type {
  AuthChangeEvent,
  AuthError,
  AuthRawUser,
  AuthSession,
  SupabaseAuth,
} from "../client.js";

/** Raw user shape carried by the fake (Supabase-native metadata keys). */
export type FakeUser = AuthRawUser;

type Listener = (event: AuthChangeEvent, session: AuthSession | null) => void;

/** Configurable in-memory Supabase auth surface. */
export class FakeAuth implements SupabaseAuth {
  /** User reported by `getUser()` / `getSession()`. */
  currentUser: FakeUser | null = null;
  /** Error returned by `getUser()` / `getSession()`. */
  sessionError: AuthError | null = null;
  /** Error returned by `signInWithPassword()`. */
  signInError: AuthError | null = null;
  /** Error returned by `refreshSession()`. */
  refreshError: AuthError | null = null;
  /** Error returned by `signOut()`. */
  signOutError: AuthError | null = null;
  /** Increments on every `refreshSession()` call. */
  refreshCalls = 0;
  /** True once `signOut()` has run successfully. */
  signedOut = false;

  private listeners: Listener[] = [];

  getSession = async () => ({
    data: { session: this.toSession(this.currentUser) },
    error: this.sessionError,
  });

  getUser = async () => ({
    data: { user: this.currentUser },
    error: this.sessionError,
  });

  signInWithPassword = async (credentials: { email: string; password: string }) => {
    if (this.signInError) {
      return { data: { session: null }, error: this.signInError };
    }
    this.currentUser = { id: "user-0001", email: credentials.email, app_metadata: {} };
    this.signedOut = false;
    this.emit("SIGNED_IN", this.currentUser);
    return { data: { session: this.toSession(this.currentUser) }, error: null };
  };

  refreshSession = async () => {
    this.refreshCalls += 1;
    if (this.refreshError) {
      return { data: { session: null }, error: this.refreshError };
    }
    return { data: { session: this.toSession(this.currentUser) }, error: null };
  };

  signOut = async () => {
    if (this.signOutError) {
      return { error: this.signOutError };
    }
    this.currentUser = null;
    this.signedOut = true;
    this.emit("SIGNED_OUT", null);
    return { error: null };
  };

  onAuthStateChange = (callback: Listener) => {
    this.listeners.push(callback);
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            this.listeners = this.listeners.filter((listener) => listener !== callback);
          },
        },
      },
    };
  };

  /** Emit an auth state event as Supabase would (e.g. TOKEN_REFRESHED). */
  emit(event: AuthChangeEvent, user: FakeUser | null): void {
    const session = this.toSession(user);
    for (const listener of [...this.listeners]) listener(event, session);
  }

  private toSession(user: FakeUser | null): AuthSession | null {
    if (!user) return null;
    return {
      access_token: `access-${user.id}`,
      refresh_token: `refresh-${user.id}`,
      expires_in: 3600,
      user,
    };
  }
}

/**
 * Stand-in for the browser Supabase client for the `/me` reads: `profiles`,
 * `user_roles` and the `current_user_permissions()` RPC. Every answer is
 * mutable so a suite can simulate a mid-session change (e.g. an account
 * disabled or a role revoked while the user is signed in — AUTH_RBAC_RLS.md
 * §16).
 *
 * Defaults model an authenticated staff member with one role, so a suite that
 * only cares about the profile can sign in directly. Use {@link
 * profileClientFactory.setRoles} with an empty list to simulate a customer.
 */
export function profileClientFactory(initialRow: ProfileRow | null): {
  client: SupabaseClient<Database>;
  setRow(next: ProfileRow | null): void;
  setRoles(next: readonly string[]): void;
  setPermissions(next: readonly string[]): void;
} {
  let row = initialRow;
  // A staff role by default: gate 2 (AUTH_RBAC_RLS.md §15) requires one.
  let roles: readonly string[] = ["cashier"];
  let permissions: readonly string[] = [];
  return {
    client: {
      from: (table: string) => ({
        select: () => {
          // `user_roles` join: fetchCurrentUserRoles chains .order().
          if (table === "user_roles") {
            return {
              order: async () => ({
                data: roles.map((code) => ({ role: { code } })),
                error: null,
              }),
            };
          }
          // `profiles` read: fetchCurrentProfile chains .eq().maybeSingle().
          return {
            eq: () => ({
              maybeSingle: async () => ({ data: row, error: null }),
            }),
          };
        },
      }),
      rpc: async (fn: string) => {
        if (fn === "current_user_permissions") {
          return { data: permissions.map((code) => ({ code })), error: null };
        }
        return { data: null, error: null };
      },
    } as unknown as SupabaseClient<Database>,
    setRow(next: ProfileRow | null): void {
      row = next;
    },
    setRoles(next: readonly string[]): void {
      roles = next;
    },
    setPermissions(next: readonly string[]): void {
      permissions = next;
    },
  };
}

/** Build a `profiles` row. */
export function profileRow(overrides: Partial<ProfileRow> = {}): ProfileRow {
  return {
    id: "user-0001",
    display_name: "Siti",
    phone: "+6281234567890",
    avatar_url: null,
    is_active: true,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}
