/**
 * RBAC row models — roles, permissions and the caller's effective grants.
 *
 * Mirrors migration `003_roles_permissions` and `docs/database/DATABASE_SCHEMA.md`
 * §7-§10. Only the columns the client needs are modelled; administrative
 * columns such as `is_system` are read through the admin app, not here.
 *
 * Row shapes are deliberately lenient (nullable) because they come from a
 * network boundary; {@link toRoleCode} / {@link toPermissionCodes} normalize
 * them and drop anything malformed rather than throwing.
 */

/** Row shape returned by `select code from roles`. */
export interface RoleCodeRow {
  code: string | null;
}

/** Row shape returned by `select code from permissions`. */
export interface PermissionCodeRow {
  code: string | null;
}

/** Result of resolving the caller's own roles. */
export type RoleCodeResult =
  | { roles: string[]; error: null }
  | { roles: []; error: { message: string } };

/** Result of resolving the caller's effective permissions. */
export type PermissionCodeResult =
  | { permissions: string[]; error: null }
  | { permissions: []; error: { message: string } };

/** Normalize role rows into a sorted, de-duplicated code list. */
export function toRoleCodes(rows: readonly RoleCodeRow[] | null): string[] {
  if (!rows) return [];
  const codes = rows
    .map((row) => row?.code)
    .filter((code): code is string => typeof code === "string" && code.length > 0);
  return [...new Set(codes)].sort();
}

/** Normalize permission rows into a sorted, de-duplicated code list. */
export function toPermissionCodes(rows: readonly PermissionCodeRow[] | null): string[] {
  if (!rows) return [];
  const codes = rows
    .map((row) => row?.code)
    .filter((code): code is string => typeof code === "string" && code.length > 0);
  return [...new Set(codes)].sort();
}
