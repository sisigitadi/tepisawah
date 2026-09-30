# Seed data

Separated from migrations (DATABASE_MIGRATION_PLAN.md §37).

```text
supabase/seed/
├── development.sql   # localhost / preview targets only
└── test.sql          # throwaway integration & E2E fixtures
```

## Rules

- **Separated from schema.** Migrations create structure; seed fills data.
- **Deterministic and idempotent.** Re-running must not duplicate or drift.
- **Development only for the dev seed.** `scripts/seed-dev.mjs` refuses any
  target that is not `localhost`, `127.0.0.1` or a `preview.` host.
- **Never in production.** No fake transactions, payments, audit events or
  demo users with weak credentials in production
  (TECHNICAL_ARCHITECTURE.md §39; ENVIRONMENT_CONFIG.md §22).
- **Production-safe seed** — e.g. reference roles/permissions — is handled as
  an explicitly reviewed migration, never as ad-hoc seed data.

## Status

Both files are boundary placeholders with conventions documented in-file. The
first seed statements arrive with the schema phases, once the target tables
(roles, permissions, catalog, tables) exist to receive them.
