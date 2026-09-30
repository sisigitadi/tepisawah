/**
 * @tepisawah/web — bootstrap.
 *
 * Provider init, auth init and global config go here; keep App.tsx free of
 * bootstrap logic.
 */

/**
 * Public apps keep a no-op bootstrap: `@tepisawah/auth` staff login is
 * intentionally not wired here (AUTH_RBAC_RLS.md §15 is a staff-only flow).
 * The anon Supabase client for public data reads is injected when the catalog
 * phase lands. Safe from a clean checkout: no network or auth work.
 */
export async function bootstrap(): Promise<void> {
  // Intentionally empty — public app, no staff auth.
}
