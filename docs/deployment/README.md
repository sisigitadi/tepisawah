# Deployment

Per-app deployment targets (§53):

| App      | Domain                 |
| -------- | ---------------------- |
| web      | tepisawah.id           |
| order    | order.tepisawah.id     |
| pos      | pos.tepisawah.id       |
| kitchen  | kitchen.tepisawah.id   |
| waiter   | waiter.tepisawah.id    || admin    | admin.tepisawah.id    |
| staff    | staff.tepisawah.id    |

Each app builds independently via `pnpm --filter @tepisawah/<app> build`.

## Phase 0 status

No deployment configuration exists yet. Pipelines and environment provisioning
arrive once Phase 1 stabilizes the backend boundary.
