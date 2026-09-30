# @tepisawah/catalog

> **Status: Phase 0 scaffold.** Menu catalog types and schemas only — no business logic.

The menu catalog domain: products, categories, variants, and availability. Defines
the shapes shared between the public website (read-only menu preview), the POS
(catalog browsing), and admin (catalog management).

## Exports

| Module       | Contents                                                       |
| ------------ | -------------------------------------------------------------- |
| `types.ts`   | `Product`, `Category`, `ProductVariant`, …                     |
| `schemas.ts` | Validation schemas for catalog command payloads                |
| `api.ts`     | Catalog command/query contract types                           |

## Usage

```ts
import type { Product } from "@tepisawah/catalog";
```

## Conventions

- Depends only on `@tepisawah/types` and `@tepisawah/database` (read side).
- Mutations are declared as command contracts here but executed in Supabase
  functions — this package holds no mutation implementation.

## Build

```bash
pnpm --filter @tepisawah/catalog typecheck
```
