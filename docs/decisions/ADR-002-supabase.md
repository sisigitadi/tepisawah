# ADR-2: Supabase as the backend boundary

- Status: Proposed
- Date: 2026-09-28

## Context

Auth, Postgres, realtime and edge functions must sit behind one boundary so apps stay thin and authorization is enforced server-side. Business commands need transaction orchestration and privileged processing that cannot live in the browser.

## Decision

To be recorded when the decision is made (Phase 1+).

## Consequences

To be recorded with the decision.
