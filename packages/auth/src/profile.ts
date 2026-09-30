/**
 * Profile resolution and the active/inactive gate (Phase 2).
 *
 * Authentication proves identity; `profiles.is_active` is the first
 * authorization decision on top of it. A signed-in user whose profile is
 * inactive must not reach any protected operation (AUTH_RBAC_RLS.md §2.1,
 * §14). Historical records created by a disabled user are preserved —
 * disabling blocks access, it does not erase history.
 */
import type { Profile } from "@tepisawah/database";

import { AUTH_MESSAGES } from "./errors.js";

/** Outcome of resolving the current user's profile. */
export type ProfileState =
  | { profile: Profile; isActive: true; error: null }
  | { profile: Profile; isActive: false; error: null }
  | { profile: null; isActive: false; error: null }
  | { profile: null; isActive: false; error: { message: string } };

/**
 * Classify a resolved profile.
 *
 * A missing profile after successful authentication means the provisioning
 * trigger did not run; treat it as inactive rather than granting access.
 */
export function classifyProfile(profile: Profile | null): ProfileState {
  if (!profile) return { profile: null, isActive: false, error: null };
  if (!profile.is_active) return { profile, isActive: false, error: null };
  return { profile, isActive: true, error: null };
}

/** True when the profile is present and active. */
export function isProfileActive(profile: Profile | null): boolean {
  return Boolean(profile?.is_active);
}

/** Safe message shown to a disabled user on the access-denied screen. */
export function disabledUserMessage(): string {
  return AUTH_MESSAGES.userDisabled;
}
