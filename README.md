# Tepi Sawah — MASTER PROJECT PACK v1.0

## Purpose

This package is the consolidated project baseline for the Tepi Sawah Resto & Cafe digital platform. It combines product requirements, brand/design rules, architecture, database, API, security, realtime, environment, QA, implementation, Google Stitch prompts, and the existing pre-opening prototype.

## Current technical baseline

- Frontend: React + TypeScript + Vite
- Backend platform: Supabase
- Database: PostgreSQL
- Authentication: Supabase Auth
- Authorization: RBAC + PostgreSQL RLS
- Realtime: Supabase Realtime
- Storage: Supabase Storage where required
- Deployment: Vercel
- Source control: GitHub
- Coding workflow: VS Code + Cline
- Repository: monorepo

## Production surfaces

- `tepisawah.id` — public website
- `order.tepisawah.id` — customer QR ordering
- `pos.tepisawah.id` — cashier POS
- `kitchen.tepisawah.id` — kitchen display
- `waiter.tepisawah.id` — waiter/service
- `admin.tepisawah.id` — administration

## Authority order

1. Explicit business decisions
2. DESIGN_FREEZE
3. PROJECT_RULES
4. TECHNICAL_ARCHITECTURE
5. DATABASE_SCHEMA
6. DATABASE_MIGRATION_PLAN
7. API_CONTRACT
8. AUTH_RBAC_RLS
9. REALTIME_SPEC
10. REPOSITORY_STRUCTURE
11. TESTING_STRATEGY
12. ENVIRONMENT_CONFIG
13. CLINE_IMPLEMENTATION_PLAN
14. Existing prototype/code

If documents conflict, follow the higher-level source of truth and record the decision before implementation.

## Recommended execution order

1. Read `docs/PROJECT_DOCUMENTATION_INDEX.md`.
2. Read `docs/implementation/MASTER_CLINE_PROMPT.md`.
3. Create/clone the GitHub repository.
4. Bootstrap the monorepo.
5. Create Supabase project(s) for the correct environment.
6. Configure environment variables without committing secrets.
7. Run database migrations in the documented order.
8. Implement Auth → RBAC/RLS → Catalog → Tables/QR → Table Sessions → Orders.
9. Implement customer ordering → cashier → kitchen → waiter → payments → service requests.
10. Add realtime, admin, audit, dashboard, production hardening.
11. Run QA/security/E2E gates.
12. Deploy each production surface to its mapped domain/subdomain.

## Important boundary

The existing `docs/prototype/pre-opening/index.html` is a visual/interaction reference and prototype. It is not the production backend, source of truth, authentication layer, payment system, or database implementation.

## Package contents

See `MANIFEST.txt` for the complete inventory.
