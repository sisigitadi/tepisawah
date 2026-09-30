/**
 * Profile queries (Phase 2).
 *
 * Frontend reads its own profile through the RLS-enforced browser client. RLS
 * permits a row only when `auth.uid() = id`, so no user can read another user's
 * profile regardless of what this module requests (AUTH_RBAC_RLS.md §2.2).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../generated/index.js";
import { toProfile, type Profile, type ProfileRow } from "../models/index.js";

/** Result of a profile lookup — never throws. */
export type ProfileResult =
  | { profile: Profile; error: null }
  | { profile: null; error: null }
  | { profile: null; error: { message: string } };

/** Fetch a profile by user id. */
export async function fetchProfile(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<ProfileResult> {
  const { data, error } = await client
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle<ProfileRow>();

  if (error) return { profile: null, error: { message: error.message } };
  if (!data) return { profile: null, error: null };
  return { profile: toProfile(data), error: null };
}

/** Fetch the profile for the currently authenticated user. */
export async function fetchCurrentProfile(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<ProfileResult> {
  return fetchProfile(client, userId);
}
