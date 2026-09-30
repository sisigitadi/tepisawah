/**
 * supabase/functions/_shared/errors — server-side utility (Phase 0 stub).
 *
 * Build a uniform error response. Browser-specific code is forbidden in _shared (§31).
 */
export function httpError(status: number, message: string): never {
  throw new Error("errors: not implemented (Phase 0)");
}
