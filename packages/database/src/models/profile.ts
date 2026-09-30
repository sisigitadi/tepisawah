/**
 * Profile — application record for an authenticated user.
 *
 * Mirrors migration `002_profiles` and `docs/database/DATABASE_SCHEMA.md` §6.2.
 * The profile carries no secrets: no password, token or key is ever stored here
 * (AUTH_RBAC_RLS.md §5).
 */
export interface Profile {
  /** auth.users.id — the profile PK. */
  id: string;
  display_name: string;
  phone: string | null;
  avatar_url: string | null;
  /** False blocks internal authorization (AUTH_RBAC_RLS.md §14). */
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Row shape returned by `select * from profiles`. */
export interface ProfileRow {
  id: string;
  display_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Normalize a raw database row into a {@link Profile}, applying defaults.
 *
 * `is_active` requires an explicit true: a NULL flag (or a column the caller
 * cannot read) must never degrade into an active account. This fails closed
 * (AUTH_RBAC_RLS.md §14) — an unresolvable activation state blocks access
 * instead of granting it.
 */
export function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    display_name: row.display_name ?? "",
    phone: row.phone,
    avatar_url: row.avatar_url,
    is_active: row.is_active === true,
    created_at: row.created_at ?? "",
    updated_at: row.updated_at ?? "",
  };
}
