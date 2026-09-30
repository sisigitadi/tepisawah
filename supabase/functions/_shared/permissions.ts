/**
 * supabase/functions/_shared/permissions — server-side utility (Phase 0 stub).
 *
 * Authorize `permission` for the caller of `req`. Browser-specific code is forbidden in _shared (§31).
 */
export function requirePermission(req: Request, permission: string): never {
  throw new Error("permissions: not implemented (Phase 0)");
}
