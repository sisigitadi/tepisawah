/**
 * @tepisawah/auth — session access helpers.
 *
 * Every helper is async and error-tolerant: apps treat a missing session as an
 * anonymous user rather than an exception (REPOSITORY_STRUCTURE.md §49).
 * Errors are mapped to safe public messages via {@link toAuthMessage}.
 */
import { getAuthClient, toAuthUser, type AuthUser } from "./client.js";
import { toAuthMessage } from "./errors.js";

/** Result of a session lookup — never throws. */
export type SessionResult =
  | { user: AuthUser; error: null }
  | { user: null; error: null }
  | { user: null; error: { message: string } };

/** Resolve the current session, mapping to {@link SessionResult}. */
export async function getCurrentSession(): Promise<SessionResult> {
  const client = getAuthClient();
  const { data, error } = await client.getUser();
  if (error) return { user: null, error: { message: toAuthMessage(error) } };
  if (!data.user) return { user: null, error: null };
  return { user: toAuthUser(data.user), error: null };
}

/** Sign in with email/password, returning the resulting user or error. */
export async function signInWithEmail(
  email: string,
  password: string,
): Promise<SessionResult> {
  const client = getAuthClient();
  const { data, error } = await client.signInWithPassword({ email, password });
  if (error) return { user: null, error: { message: toAuthMessage(error) } };
  if (!data.session) return { user: null, error: { message: toAuthMessage(null) } };
  return { user: toAuthUser(data.session.user), error: null };
}

/** Refresh the current session (token rotation), returning the user or error. */
export async function refreshCurrentSession(): Promise<SessionResult> {
  const client = getAuthClient();
  const { data, error } = await client.refreshSession();
  if (error) return { user: null, error: { message: toAuthMessage(error) } };
  if (!data.session) return { user: null, error: null };
  return { user: toAuthUser(data.session.user), error: null };
}

/** Sign out the current session, surfacing a safe error message. */
export async function signOutCurrent(): Promise<{ error: string | null }> {
  const client = getAuthClient();
  const { error } = await client.signOut();
  return { error: error ? toAuthMessage(error) : null };
}

/** Subscribe to auth state changes; returns an unsubscribe handle. */
export function onAuthState(
  callback: (user: AuthUser | null) => void,
): () => void {
  const client = getAuthClient();
  const { data } = client.onAuthStateChange((_event, session) => {
    callback(session ? toAuthUser(session.user) : null);
  });
  return () => data.subscription.unsubscribe();
}
