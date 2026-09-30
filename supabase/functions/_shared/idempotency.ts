/**
 * supabase/functions/_shared/idempotency — server-side utility (Phase 0 stub).
 *
 * Run `run` exactly once per idempotency key. Browser-specific code is forbidden in _shared (§31).
 */
export function withIdempotency(req: Request, run: () => Promise<Response>): never {
  throw new Error("idempotency: not implemented (Phase 0)");
}
