/**
 * supabase/functions/service-request — business command (Phase 0 contract stub).
 *
 * Owned here per §34: transaction orchestration, provider calls and privileged
 * server-side processing stay backend-side. Apps call this function; they never
 * reproduce its logic.
 *
 * Phase 0: returns 501 and does not touch the database.
 */

Deno.serve(async (_req: Request) => {
  return new Response(
    JSON.stringify({ error: "not implemented (Phase 0)" }),
    { status: 501, headers: { "content-type": "application/json" } },
  );
});
