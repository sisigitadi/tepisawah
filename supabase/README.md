# Tepi Sawah — Supabase

Supabase project structure for local development, preview and production.

```text
supabase/
├── config.toml          # local development configuration only
├── migrations/          # versioned, ordered, deterministic SQL
├── functions/           # edge functions (server-side only)
│   └── _shared/         # shared server-side helpers — never imported by apps
├── seed/                # development/test seed, separated from schema
└── README.md
```

## Migration conventions

Source of truth: `docs/database/DATABASE_MIGRATION_PLAN.md`.

- **Every schema change is a migration.** No manual production schema changes
  (TECHNICAL_ARCHITECTURE.md §38).
- **Ordering.** Migrations are numbered by dependency order
  (`001_extensions` … `017_indexes`). Directory form is used so a migration may
  contain several ordered `.sql` files; the Supabase CLI timestamp form
  (`20260927000100_name.sql`) is equally accepted.
- **Linear first.** Branches may run in parallel once the parent dependency
  exists, but keep the initial sequence linear and auditable.
- **Deterministic and idempotent.** A migration must apply cleanly to an empty
  database (migration plan §38).
- **Never edit an applied migration.** Create a new one instead
  (REPOSITORY_STRUCTURE.md §29).
- **No destructive changes without explicit approval** (`DROP TABLE`,
  `DROP DATABASE`) — flagged by `scripts/validate-schema.mjs`.
- **RLS last.** Structure first, then indexes, then functions/triggers, then
  RLS policies — matching the migration dependency graph.
- **No secrets in SQL.** Provider credentials stay in the environment
  (migration plan §12; ENVIRONMENT_CONFIG.md §6).

Current status: migration directories exist as placeholders only. The first SQL
arrives with the schema phases; Phase 1 establishes the runner conventions and
tooling, not the tables.

## Client boundaries

Two physically separated Supabase clients exist, and the separation is enforced
by repository layout, not just convention:

| Client | Location | Key | Reachable from apps? |
| --- | --- | --- | --- |
| Browser (RLS-enforced) | `packages/database/src/client.ts` | anon | yes |
| Server (privileged) | `supabase/functions/_shared/supabase.ts` | service-role | **no** |

The server client lives outside `packages/` and is not exported through any
`@tepisawah/*` workspace package, so no browser bundle can reach it. The browser
client accepts only the anon key and rejects a service-role URL on construction.
`scripts/validate-schema.mjs` scans `apps/` and `packages/` for any import of
`functions/_shared` and fails the build on a breach.

Edge functions should prefer `getSessionClient(authorizationHeader)` so every
query is evaluated by RLS as the calling user; `getServiceRoleClient()` is only
for operations RLS cannot express.

## Environments

Development, preview and production are separated
(`docs/environment/ENVIRONMENT_CONFIG.md`): each has its own Supabase project,
credentials, and data. Production migrations run only after development and
preview pass (migration plan §40). Local configuration lives in `config.toml`;
production configuration is managed by the deployment pipeline and is never
committed here.

## Tooling

```bash
node scripts/check-env.mjs --strict   # validate required environment variables
node scripts/validate-schema.mjs      # migration conventions + boundary checks
node scripts/generate-types.mjs       # supabase gen types (no-ops without the CLI)
node scripts/seed-dev.mjs             # apply development seed (refuses non-dev targets)
node scripts/verify-build.mjs         # verify build outputs + boundary artifacts
```

All scripts are safe from a clean checkout: none fails CI when a backend is
unreachable, and none can mutate a production database.
