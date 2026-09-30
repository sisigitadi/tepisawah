/**
 * @tepisawah/auth — React context for the current session and identity.
 *
 * The provider owns a single subscription to auth state changes
 * (REPOSITORY_STRUCTURE.md §50). On every session event it resolves the /me
 * identity (AUTH_RBAC_RLS.md §15, §50 item 10):
 *
 *   session → profile → roles → effective permissions → authorization
 *
 * and applies both authorization gates in order:
 *   1. `profiles.is_active` — a disabled account holds nothing (§14).
 *   2. at least one staff role — an authenticated customer never enters an
 *      internal application (§15, §17).
 *
 * Roles and permissions are read from the database through the RLS-enforced
 * browser client, never from a client-supplied claim: the database is the
 * authority (AUTH_RBAC_RLS.md §2.2, §51 rules 3-4). On session change the
 * provider clears local state, refreshes the identity and re-evaluates the
 * gates, so a disabled, revoked or re-roled account is reflected immediately
 * (AUTH_RBAC_RLS.md §16).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Profile } from "@tepisawah/database";
import {
  fetchCurrentProfile,
  fetchCurrentUserPermissions,
  fetchCurrentUserRoles,
} from "@tepisawah/database";
import type { Permission, Role } from "@tepisawah/permissions";

import { getCurrentSession, onAuthState, signInWithEmail, signOutCurrent } from "./session.js";
import { classifyProfile, isProfileActive } from "./profile.js";
import { AUTH_MESSAGES, toAuthMessage } from "./errors.js";
import { resolveAuthorization, type Authorization } from "./authorization.js";
import type { AuthUser } from "./client.js";

/** Loading phases the consumer renders against. */
export type AuthStatus =
  | "loading"
  | "authenticated"
  | "unauthenticated"
  | "disabled"
  | "unauthorized";

/** Value exposed by {@link AuthProvider}. */
export interface AuthContextValue {
  /** Resolved user, or null when anonymous / unresolved. */
  user: AuthUser | null;
  /** Resolved profile, or null when absent / unresolved. */
  profile: ReturnType<typeof classifyProfile>["profile"];
  /** Staff roles resolved from the database for this session. */
  roles: readonly Role[];
  /** Effective permission codes resolved from the database (the union). */
  permissions: readonly string[];
  /** Coarse state for UI branching. */
  status: AuthStatus;
  /** True until the first session + identity lookup settles. */
  isLoading: boolean;
  /** Safe public message; cleared on success. */
  error: string | null;
  /** Sign in with email + password. */
  signIn: (email: string, password: string) => Promise<void>;
  /** Sign out the current session. */
  signOut: () => Promise<void>;
  /** True when the session holds `permission` (UX only — backend re-validates). */
  can: (permission: Permission) => boolean;
}

const NO_GRANTS: Authorization = {
  roles: [],
  permissions: [],
  isAuthorizedStaff: false,
  notAuthorizedReason: null,
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Provider that resolves and tracks the current session and identity.
 *
 * @param supabase the browser client (anon key, RLS-enforced) from the app's
 * `lib/supabase.ts`. Profile, roles and permissions are read through it; auth
 * state comes from the injected auth client.
 */
export function AuthProvider({
  children,
  supabase,
}: {
  children: ReactNode;
  supabase: SupabaseClient<Database>;
}): ReactNode {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authorization, setAuthorization] = useState<Authorization>(NO_GRANTS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Resolve the /me identity for a user and apply the authorization gates. */
  const resolveIdentity = useCallback(
    async (next: AuthUser | null) => {
      if (!next) {
        setProfile(null);
        setAuthorization(NO_GRANTS);
        return NO_GRANTS;
      }

      // Profile first: gate 1 (is_active) decides whether to even look further.
      const profileResult = await fetchCurrentProfile(supabase, next.id);
      if (profileResult.error) {
        setError(toAuthMessage(profileResult.error));
        setProfile(null);
        setAuthorization(NO_GRANTS);
        return NO_GRANTS;
      }
      const state = classifyProfile(profileResult.profile);
      setProfile(state.profile);
      if (!state.isActive) {
        setError(AUTH_MESSAGES.userDisabled);
        setAuthorization({ ...NO_GRANTS, notAuthorizedReason: AUTH_MESSAGES.userDisabled });
        return { ...NO_GRANTS, notAuthorizedReason: AUTH_MESSAGES.userDisabled };
      }

      // Gates passed so far: load roles and the database-computed union.
      const [rolesResult, permissionsResult] = await Promise.all([
        fetchCurrentUserRoles(supabase),
        fetchCurrentUserPermissions(supabase),
      ]);

      // A failed grant read must never widen access: treat any error as none.
      if (rolesResult.error) setError(toAuthMessage(rolesResult.error));
      if (permissionsResult.error) setError(toAuthMessage(permissionsResult.error));

      const resolved = resolveAuthorization({
        profile: state.profile,
        roles: rolesResult.error ? [] : rolesResult.roles,
        permissions: permissionsResult.error ? [] : permissionsResult.permissions,
      });
      setAuthorization(resolved);
      if (!resolved.isAuthorizedStaff && resolved.notAuthorizedReason) {
        setError(resolved.notAuthorizedReason);
      }
      return resolved;
    },
    [supabase],
  );

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      const result = await getCurrentSession();
      if (!active) return;
      if (result.error) setError(result.error.message);
      setUser(result.user);
      await resolveIdentity(result.user);
      setIsLoading(false);
    }

    void bootstrap();
    const unsubscribe = onAuthState(async (next) => {
      if (!active) return;
      setUser(next);
      setError(null);
      await resolveIdentity(next);
      setIsLoading(false);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [resolveIdentity]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const result = await signInWithEmail(email, password);
      if (result.error) {
        setError(result.error.message);
        throw new Error(result.error.message);
      }
      setError(null);
      setUser(result.user);
      // A disabled or un-roled user authenticates successfully but is gated here.
      const resolved = await resolveIdentity(result.user);
      if (result.user && !resolved.isAuthorizedStaff) {
        setError(resolved.notAuthorizedReason ?? AUTH_MESSAGES.unknown);
      }
    },
    [resolveIdentity],
  );

  const signOut = useCallback(async () => {
    const result = await signOutCurrent();
    if (result.error) {
      setError(result.error);
      throw new Error(result.error);
    }
    setError(null);
    setUser(null);
    setProfile(null);
    setAuthorization(NO_GRANTS);
  }, []);

  const status: AuthStatus = isLoading
    ? "loading"
    : user
      ? isProfileActive(profile)
        ? authorization.isAuthorizedStaff
          ? "authenticated"
          : "unauthorized"
        : "disabled"
      : "unauthenticated";

  const can = useCallback(
    (permission: Permission): boolean => authorization.permissions.includes(permission),
    [authorization.permissions],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      roles: authorization.roles,
      permissions: authorization.permissions,
      status,
      isLoading,
      error,
      signIn,
      signOut,
      can,
    }),
    [user, profile, authorization, status, isLoading, error, signIn, signOut, can],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Access the current auth context; throws when used outside {@link AuthProvider}. */
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return value;
}
