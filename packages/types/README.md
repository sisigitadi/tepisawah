# @tepisawah/types

> **Status: Phase 0 scaffold.** Shared type definitions only — no runtime logic, no business rules.

Zero-dependency package containing the domain, API-contract, and common types shared
across the Tepi Sawah monorepo. Every other package and app may depend on this one;
it depends on nothing.

## Exports

| Module      | Contents                                                       |
| ----------- | -------------------------------------------------------------- |
| `common.ts` | Shared primitives (`Result`, `ErrorLike`, …)                   |
| `money.ts`  | `Money` type and currency helpers for IDR amounts              |
| `pagination.ts` | `Pagination`, `Cursor` types for list endpoints            |
| `api.ts`    | API contract shapes — request/response envelopes and commands  |

## Usage

```ts
import type { Money, Result } from "@tepisawah/types";
```

## Conventions

- Types are declared with `type`/`interface` only. No runtime values are exported.
- Import this package with `import type` so bundlers can erase it.
- This package must never import another `@tepisawah/*` package (dependency root).

## Build

```bash
pnpm --filter @tepisawah/types typecheck
```
