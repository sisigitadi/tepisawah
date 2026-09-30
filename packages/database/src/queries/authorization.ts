/**
 * Authorization queries (Phase 3 — RBAC + RLS).
 *
 * The browser client reads its own grants through the RLS-enforced client.
 * RLS answers the six questions from AUTH_RBAC_RLS.md §21 server-side, so no
 * amount of client tampering can widen these results:
 *
 *   - roles: `user_roles` policy restricts SELECT to the caller's own rows
 *     (or to a `users.roles_manage` holder), and the `roles` policy exposes
 *     only roles the caller holds.
 *   - permissions: the `current_user_permissions()` RPC is SECURITY DEFINER
 *     and returns the union over the caller's roles, but only when the caller's
 *     profile is active — an inactive account resolves to an empty set
 *     (AUTH_RBAC_RLS.md §14).
 *
 * Both results are the `/me` identity payload (AUTH_RBAC_RLS.md §50 item 10).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../generated/index.js";
import {
  toPermissionCodes,
  toRoleCodes,
  type PermissionCodeResult,
  type PermissionCodeRow,
  type RoleCodeResult,
  type RoleCodeRow,
} from "../models/index.js";

/**
 * Resolve the role codes held by the caller.
 *
 * The nested select rides the `user_roles` → `roles` join so a single query
 * returns codes; RLS on both tables scopes it to the caller.
 */
export async function fetchCurrentUserRoles(
  client: SupabaseClient<Database>,
): Promise<RoleCodeResult> {
  const { data, error } = await client
    .from("user_roles")
    .select("role:roles ( code )")
    .order("created_at", { ascending: true });

  if (error) return { roles: [], error: { message: error.message } };

  // Supabase nests the join one level deep: each row is `{ role: { code } }`.
  const rows = (data ?? []) as unknown as { role: RoleCodeRow | null }[];
  const flat: RoleCodeRow[] = rows
    .map((row) => row?.role)
    .filter((row): row is RoleCodeRow => row !== null && row !== undefined);

  return { roles: toRoleCodes(flat), error: null };
}

/**
 * Resolve the effective permission codes for the caller: the union over their
 * roles, computed by the database (AUTH_RBAC_RLS.md §12, §38).
 */
export async function fetchCurrentUserPermissions(
  client: SupabaseClient<Database>,
): Promise<PermissionCodeResult> {
  const { data, error } = await client.rpc("current_user_permissions");

  if (error) return { permissions: [], error: { message: error.message } };

  // `current_user_permissions()` returns `setof text` — a JSON array of code
  // strings (e.g. ["audit.read", …]) — not an array of row objects. Normalize
  // both shapes so the normalizer below always receives row objects; a plain
  // string would otherwise map to {code: undefined} and drop every grant,
  // locking an otherwise-valid staff account out of the panel.
  const raw: unknown = data ?? [];
  const rows: PermissionCodeRow[] = (Array.isArray(raw) ? raw : []).map((item) =>
    typeof item === "string" ? { code: item } : ((item ?? {}) as PermissionCodeRow),
  );

  return { permissions: toPermissionCodes(rows), error: null };
}
