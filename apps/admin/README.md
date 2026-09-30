/**
 * @tepisawah/admin — application
 *
 * Phase 0 scaffold: structure and tooling only. Business logic arrives in later
 * phases per docs/architecture/REPOSITORY_STRUCTURE.md.
 */

# @tepisawah/admin

Admin console: dashboard, catalog, tables, QR codes, users, roles, settings, audit.

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

- `dashboard`
- `catalog`
- `categories`
- `modifiers`
- `tables`
- `qr`
- `users`
- `roles`
- `settings`
- `audit`

## Dependencies

- `@tepisawah/auth` (workspace package)
- `@tepisawah/config` (workspace package)
- `@tepisawah/permissions` (workspace package)
- `@tepisawah/types` (workspace package)
- `@tepisawah/ui` (workspace package)
