/**
 * @tepisawah/web — application
 *
 * Phase 0 scaffold: structure and tooling only. Business logic arrives in later
 * phases per docs/architecture/REPOSITORY_STRUCTURE.md.
 */

# @tepisawah/web

Public marketing and information site for Tepi Sawah Resto & Cafe.

## Structure

See `docs/architecture/REPOSITORY_STRUCTURE.md` (§9-§16) for the canonical app
layout. This scaffold establishes the package boundaries and build tooling only;
features are implemented in later phases.

## Scripts

| Script       | Command          | Purpose                                  |
| ------------ | ---------------- | ---------------------------------------- |
| `build`     | `vite build`    | Production build to `dist/`              |
| `typecheck` | `tsc --noEmit`  | Type-check the app                       |
| `lint`      | `tsc --noEmit`  | Lint gate (dedicated linter arrives later) |

## Features (planned)

- `content`

## Dependencies

- `@tepisawah/config` (workspace package)
- `@tepisawah/types` (workspace package)
- `@tepisawah/ui` (workspace package)
