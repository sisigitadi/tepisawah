/**
 * supabase/functions/_shared/response — uniform JSON responses (Phase 1).
 *
 * Production error responses must never leak SQL, stack traces, environment
 * variables or secrets (ENVIRONMENT_CONFIG.md §24). Callers pass a safe public
 * message; the optional detail is logged server-side only.
 */
export interface ErrorResponseOptions {
  /** Safe, user-facing message. */
  message?: string;
  /** Machine-readable error code, e.g. `"ORDER_INVALID_TRANSITION"`. */
  code?: string;
  /** Developer-only detail — logged, never returned to the client. */
  detail?: string;
}

const DEFAULT_MESSAGE = "Terjadi kesalahan. Silakan coba lagi.";

/** Uniform success response. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Uniform error response; never echoes the internal `detail`. */
export function errorResponse(
  status = 500,
  { message = DEFAULT_MESSAGE, code }: ErrorResponseOptions = {},
): Response {
  return jsonResponse({ error: { message, code: code ?? null } }, status);
}

export { DEFAULT_MESSAGE };
