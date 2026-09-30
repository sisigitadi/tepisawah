# Tests

Cross-cutting test suites live here (see `docs/implementation/MASTER_CLINE_PROMPT.md` §51):

- `unit/` — package and app unit tests
- `integration/` — workspace and backend integration tests
- `security/` — RLS and authorization tests
- `e2e/` — end-to-end app flows

Unit tests for a package or app live next to the code:

- `packages/<package>/src/**/*.test.ts`
- `apps/<app>/src/**/*.test.ts`

## Test runner

Vitest (with the jsdom environment and React Testing Library) was selected in
Phase 2. Per-package suites run through each package's `test` script:

```bash
pnpm run test      # all suites
pnpm --filter @tepisawah/auth test
```

## Phase 2 status

Auth + profiles suites live next to the code (`packages/auth/src`,
`packages/database/src`). Integration, security and e2e suites arrive with the
phases that own those concerns.
