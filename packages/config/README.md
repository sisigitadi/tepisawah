# @tepisawah/config

> **Status: Phase 0 scaffold.** Configuration shapes and feature-flag definitions only — no business rules.

Central place for configuration that must stay identical across apps: environment
names, per-app domain identifiers, and the feature-flag registry. Values are read
from the environment inside apps (`lib/env.ts`); this package only defines the
shapes and the allowed keys.

## Exports

| Module           | Contents                                                       |
| ---------------- | -------------------------------------------------------------- |
| `environments.ts`| `Environment` union and environment helpers                     |
| `domains.ts`     | Per-app domain identifiers (`web`, `pos`, `kds`, …)             |
| `feature-flags.ts` | `FeatureFlag` registry and flag-resolution types              |

## Usage

```ts
import { ENVIRONMENTS, type FeatureFlag } from "@tepisawah/config";
```

## Conventions

- No secrets live here or in any README — see the root `.env.example`.
- Flags default off; apps opt in through environment variables (UPPER_SNAKE_CASE).

## Build

```bash
pnpm --filter @tepisawah/config typecheck
```
