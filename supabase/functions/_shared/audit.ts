/**
 * supabase/functions/_shared/audit — server-side utility (Phase 0 stub).
 *
 * Persist an audit-log entry. Browser-specific code is forbidden in _shared (§31).
 */
export function writeAudit(entry: Record<string, unknown>): never {
  throw new Error("audit: not implemented (Phase 0)");
}
