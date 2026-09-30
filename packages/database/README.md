# @tepisawah/database

> **Status: Phase 0 scaffold.** Client wiring, generated types, and query helpers — no migrations, no seed data, no business rules.

The data-access layer for the monorepo. It owns the typed Supabase client, the
generated database types, and read-side query helpers. Apps and other packages must
go through this package rather than instantiating their own clients.

## Structure

```
src/
  generated/   # Supabase-generated types (regenerated, never hand-edited)
  models/      # Row/entity type mappings per table
  queries/     # Typed read helpers (finders) — no writes
  index.ts     # Public surface
```

## Exports

- `setDatabaseClient` / `getDatabaseClient` / `hasDatabaseClient` — injection points
  so tests and apps can supply a configured client (no hard-coded credentials).
- Generated `Database` type and mapped entity types.
- Typed read helpers per domain.

## Usage

```ts
import { getDatabaseClient } from "@tepisawah/database";
const db = getDatabaseClient();
```

## Conventions

- **No raw writes from apps.** Commands that mutate data must call a Supabase
  function; this package exposes finders only (see REPOSITORY_STRUCTURE §35).
- No credentials in code or README — the client is injected, keys come from env.
- Migration SQL lives in `supabase/migrations/`, not here.

## Build

```bash
pnpm --filter @tepisawah/database typecheck
```
