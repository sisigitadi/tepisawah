# TEPI SAWAH RESTO & CAFE
## REPOSITORY STRUCTURE v1.0

**Status:** Draft for Implementation  
**Version:** 1.0  
**Date:** 2026-09-27  
**Architecture:** React + TypeScript + Vite + Supabase  
**Repository:** `tepisawah`

---

# 1. Purpose

Dokumen ini menetapkan struktur repository production untuk seluruh platform Tepi Sawah.

Target:

- satu source code repository
- pemisahan aplikasi berdasarkan domain/UI
- shared packages untuk code yang benar-benar reusable
- Supabase sebagai backend platform
- dokumentasi arsitektur tetap berada dalam repository
- Cline memiliki struktur yang eksplisit dan tidak perlu menebak lokasi file

---

# 2. Repository Strategy

Gunakan **monorepo**.

```text
tepisawah/
├── apps/
├── packages/
├── supabase/
├── docs/
├── scripts/
├── .github/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
├── vite.config.ts
├── .env.example
├── .gitignore
└── README.md
```

Monorepo dipilih agar:

- type contract dapat dibagikan
- design system konsisten
- auth utility tidak diduplikasi
- permission constants terpusat
- database types terpusat
- business contract konsisten
- deployment aplikasi tetap dapat dipisahkan

---

# 3. Application Architecture

MVP applications:

```text
apps/
├── web/
├── order/
├── pos/
├── kitchen/
├── waiter/
└── admin/
```

## `web`

Public website:

```text
tepisawah.id
```

Fokus:

- homepage
- brand
- menu preview
- promo
- location
- reservation entry point jika tersedia
- QR ordering entry point

Tidak boleh berisi:

- POS
- KDS
- waiter dashboard
- admin dashboard
- internal operational demo

---

# 4. Customer Ordering App

```text
apps/order/
```

Domain:

```text
order.tepisawah.id
```

Fokus:

- QR table resolution
- public catalog
- menu
- product detail
- modifiers
- cart
- order submission
- order status
- call waiter
- request bill

Tidak berisi:

- admin
- POS
- kitchen controls
- user management

---

# 5. POS Application

```text
apps/pos/
```

Domain:

```text
pos.tepisawah.id
```

Fokus:

- login
- cashier dashboard
- pending confirmation
- order queue
- order detail
- table view
- payment queue
- payment
- receipt
- shift operations
- transaction history
- daily operational summary

---

# 6. Kitchen Application

```text
apps/kitchen/
```

Domain:

```text
kitchen.tepisawah.id
```

Fokus:

- login
- KDS
- confirmed queue
- preparing queue
- ready queue
- timers
- notes/modifiers
- recall
- connection status

Kitchen tidak menerima business UI payment.

---

# 7. Waiter Application

```text
apps/waiter/
```

Domain:

```text
waiter.tepisawah.id
```

Fokus:

- login
- table board
- ready orders
- serve order
- service requests
- call waiter
- request bill
- manual order
- notification center

---

# 8. Admin Application

```text
apps/admin/
```

Domain:

```text
admin.tepisawah.id
```

Fokus:

- dashboard
- catalog
- categories
- modifiers
- tables
- QR
- users
- roles
- permissions
- settings
- operating hours
- audit log

Admin bukan POS.

---

# 9. Application Internal Structure

Setiap app mengikuti pola:

```text
apps/<app>/
├── src/
│   ├── app/
│   ├── components/
│   ├── features/
│   ├── layouts/
│   ├── pages/
│   ├── routes/
│   ├── hooks/
│   ├── lib/
│   ├── styles/
│   ├── types/
│   └── main.tsx
├── public/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

# 10. `app/`

Berisi application composition:

```text
app/
├── App.tsx
├── providers/
├── router/
└── bootstrap/
```

Tanggung jawab:

- provider initialization
- auth initialization
- global configuration
- router composition

Jangan menaruh business logic besar di `App.tsx`.

---

# 11. `components/`

Berisi component lokal yang tidak cukup generik untuk masuk shared package.

Contoh:

```text
components/
├── AppHeader.tsx
├── Sidebar.tsx
├── ConnectionStatus.tsx
├── LoadingState.tsx
├── EmptyState.tsx
└── ErrorState.tsx
```

Component reusable lintas aplikasi masuk:

```text
packages/ui
```

---

# 12. `features/`

Feature-first organization.

Contoh POS:

```text
features/
├── orders/
├── payments/
├── tables/
├── shifts/
├── notifications/
└── dashboard/
```

Setiap feature dapat memiliki:

```text
feature/
├── components/
├── hooks/
├── services/
├── schemas/
├── types/
└── index.ts
```

Business logic harus berada dekat dengan domain feature, bukan tersebar dalam page.

---

# 13. `pages/`

Page-level composition.

Contoh POS:

```text
pages/
├── LoginPage.tsx
├── DashboardPage.tsx
├── OrdersPage.tsx
├── OrderDetailPage.tsx
├── PaymentPage.tsx
├── TransactionsPage.tsx
└── ShiftPage.tsx
```

Page mengorkestrasi feature.

Page tidak boleh menjadi tempat utama untuk:

- SQL
- authorization logic
- price calculation
- order transition rules

---

# 14. `routes/`

Route definitions dan route guards.

Contoh:

```text
routes/
├── index.tsx
├── ProtectedRoute.tsx
└── PermissionRoute.tsx
```

Route guard hanya untuk UX/navigation.

Security tetap:

```text
Backend + RLS
```

---

# 15. `hooks/`

Application-specific hooks.

Contoh:

```text
useAuth()
usePermissions()
useRealtimeConnection()
useNotifications()
```

Shared hooks lintas app dapat masuk package jika memang reusable.

---

# 16. `lib/`

Infrastructure adapter lokal.

Contoh:

```text
lib/
├── supabase.ts
├── logger.ts
├── env.ts
└── formatters.ts
```

Jangan membuat instance Supabase berbeda-beda tanpa alasan.

---

# 17. Shared Packages

```text
packages/
├── ui/
├── auth/
├── database/
├── permissions/
├── catalog/
├── orders/
├── payments/
├── realtime/
├── config/
└── types/
```

Shared package hanya dibuat jika benar-benar dibutuhkan lintas aplikasi.

Jangan membuat package untuk setiap file.

---

# 18. `packages/ui`

Shared design system.

Berisi:

```text
ui/
├── src/
│   ├── components/
│   ├── primitives/
│   ├── tokens/
│   ├── icons/
│   └── index.ts
├── package.json
└── README.md
```

Mencakup:

- Button
- Input
- Select
- Modal
- Dialog
- Badge
- Card
- Table
- Tabs
- Toast
- Tooltip
- Skeleton
- Status Badge

Mengikuti:

`TepiSawah_Master_Design_System_v1.0`

---

# 19. `packages/auth`

Berisi shared authentication client/helper:

```text
auth/
├── src/
│   ├── client.ts
│   ├── session.ts
│   ├── auth-context.tsx
│   ├── guards.ts
│   └── index.ts
```

Tidak berisi business role definitions yang seharusnya berada di permissions package/database.

---

# 20. `packages/database`

Database types dan generated contract.

```text
database/
├── src/
│   ├── generated/
│   ├── models/
│   ├── queries/
│   └── index.ts
```

Supabase generated types harus menjadi salah satu sumber utama type database.

Jangan membuat manual type yang bertentangan dengan generated schema.

---

# 21. `packages/permissions`

Central permission identifiers:

```text
permissions/
├── src/
│   ├── permissions.ts
│   ├── roles.ts
│   ├── guards.ts
│   └── index.ts
```

Contoh:

```ts
export const PERMISSIONS = {
  ORDERS_READ: "orders.read",
  ORDERS_CONFIRM: "orders.confirm",
  PAYMENTS_CREATE: "payments.create",
} as const;
```

Frontend menggunakan constants.

Database tetap authority.

---

# 22. `packages/catalog`

Shared catalog domain contract:

```text
catalog/
├── src/
│   ├── types.ts
│   ├── schemas.ts
│   ├── api.ts
│   └── index.ts
```

Berisi:

- product types
- category types
- modifier types
- validation schema
- catalog API contract

Tidak berisi UI khusus POS/customer.

---

# 23. `packages/orders`

Shared order domain contract:

```text
orders/
├── src/
│   ├── types.ts
│   ├── states.ts
│   ├── transitions.ts
│   ├── schemas.ts
│   ├── api.ts
│   └── index.ts
```

Centralize:

- OrderStatus
- OrderSource
- transition metadata
- request/response types
- validation schemas

Frontend tidak boleh mendefinisikan state machine sendiri-sendiri.

---

# 24. `packages/payments`

Shared payment contract:

```text
payments/
├── src/
│   ├── types.ts
│   ├── methods.ts
│   ├── statuses.ts
│   ├── api.ts
│   └── index.ts
```

Provider-specific secret/integration code tidak boleh berada di browser package.

---

# 25. `packages/realtime`

Shared realtime utilities:

```text
realtime/
├── src/
│   ├── channels.ts
│   ├── events.ts
│   ├── client.ts
│   ├── dedupe.ts
│   ├── versioning.ts
│   └── index.ts
```

Tanggung jawab:

- channel naming
- event types
- event envelope
- subscription helpers
- deduplication
- stale event detection
- reconnect utilities

---

# 26. `packages/config`

Shared configuration:

```text
config/
├── src/
│   ├── environments.ts
│   ├── domains.ts
│   ├── feature-flags.ts
│   └── index.ts
```

Tidak menyimpan secrets.

---

# 27. `packages/types`

Generic cross-domain types.

Contoh:

```text
types/
├── src/
│   ├── common.ts
│   ├── pagination.ts
│   ├── api.ts
│   ├── money.ts
│   └── index.ts
```

Jangan memindahkan domain-specific type ke sini hanya agar struktur terlihat rapi.

---

# 28. Supabase Structure

```text
supabase/
├── config.toml
├── migrations/
├── functions/
├── seed/
└── README.md
```

---

# 29. Migrations

Migration diberi sequence.

Contoh:

```text
migrations/
├── 001_extensions.sql
├── 002_profiles.sql
├── 003_roles_permissions.sql
├── 004_restaurant_settings.sql
├── 005_catalog.sql
├── 006_tables.sql
├── 007_table_sessions.sql
├── 008_orders.sql
├── 009_order_items.sql
├── 010_order_status_history.sql
├── 011_payments.sql
├── 012_service_requests.sql
├── 013_notifications.sql
├── 014_audit_logs.sql
├── 015_rls.sql
├── 016_functions.sql
└── 017_indexes.sql
```

Actual migration sequence boleh berkembang sesuai implementation dependency.

Jangan mengubah migration yang sudah diterapkan di production. Buat migration baru.

---

# 30. Edge Functions

```text
supabase/functions/
├── orders-transition/
├── orders-submit/
├── payments-create/
├── payments-qris-webhook/
├── service-request/
├── admin-role-assignment/
└── _shared/
```

Gunakan Edge Function untuk business commands yang memerlukan:

- transaction orchestration
- external provider
- privileged server-side processing
- controlled command validation

Jangan membuat satu Edge Function raksasa untuk seluruh aplikasi.

---

# 31. `_shared`

Shared server-side utilities:

```text
_shared/
├── auth.ts
├── permissions.ts
├── errors.ts
├── idempotency.ts
├── audit.ts
├── response.ts
└── validation.ts
```

Tidak boleh berisi browser-specific code.

---

# 32. Database Dependency Direction

Rules:

```text
apps
  ↓
packages
  ↓
Supabase/API contract
```

Application tidak boleh mengimpor internal implementation file dari aplikasi lain.

Contoh dilarang:

```text
apps/pos → apps/kitchen/components/*
apps/order → apps/pos/*
```

Gunakan shared packages jika benar-benar diperlukan.

---

# 33. Package Dependency Rules

Allowed:

```text
ui ← generic
auth ← database/config where needed
catalog ← types/database contract
orders ← types/database contract
payments ← types
realtime ← types
apps → shared packages
```

Avoid circular dependency:

```text
orders → payments → orders
```

Jika terjadi, pindahkan shared contract ke:

```text
packages/types
```

atau domain-neutral package.

---

# 34. Business Logic Boundary

Business logic harus memiliki single owner.

Contoh:

### Order state transition

Authority:

```text
Backend command
```

Shared frontend package hanya menyimpan:

```text
types
labels
allowed UI metadata
```

Bukan security enforcement.

### Price calculation

Authority:

```text
Backend/database
```

Frontend hanya preview.

---

# 35. API Client Boundary

Apps tidak boleh melakukan raw database mutation untuk critical business commands jika command contract sudah tersedia.

Preferred:

```text
apps/pos
   ↓
packages/orders API
   ↓
Edge Function / RPC
   ↓
Database
```

bukan:

```text
React component
   ↓
direct unrestricted update orders
```

---

# 36. Environment Files

Root:

```text
.env.example
```

Per app boleh memiliki environment mapping jika diperlukan:

```text
apps/web/.env.example
apps/order/.env.example
apps/pos/.env.example
```

Jangan commit:

```text
.env
.env.local
.env.production
```

---

# 37. Environment Variable Convention

Public frontend:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Server/Edge Function:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

Payment provider secrets:

```text
PAYMENT_PROVIDER_SECRET
PAYMENT_WEBHOOK_SECRET
```

Actual names may be adjusted to provider requirements.

---

# 38. Scripts

Root:

```text
scripts/
├── check-env.mjs
├── validate-schema.mjs
├── generate-types.mjs
├── seed-dev.mjs
└── verify-build.mjs
```

Scripts harus aman dijalankan dari clean checkout.

---

# 39. GitHub Structure

```text
.github/
├── workflows/
│   ├── ci.yml
│   ├── typecheck.yml
│   ├── test.yml
│   └── build.yml
├── pull_request_template.md
└── ISSUE_TEMPLATE/
```

CI minimal:

```text
install
 ↓
lint
 ↓
typecheck
 ↓
test
 ↓
build
```

---

# 40. Documentation

```text
docs/
├── architecture/
├── product/
├── design/
├── api/
├── database/
├── security/
├── deployment/
├── operations/
└── decisions/
```

Dokumen sebelumnya dipindahkan/disalin ke struktur ini ketika repository dibuat.

---

# 41. Architecture Decision Records

Gunakan:

```text
docs/decisions/
```

Contoh:

```text
ADR-001-monorepo.md
ADR-002-supabase.md
ADR-003-order-state-machine.md
ADR-004-public-customer-ordering.md
ADR-005-payment-provider.md
```

ADR dibuat hanya untuk keputusan yang benar-benar penting dan durable.

---

# 42. Naming Convention

## Files

React:

```text
PascalCase.tsx
```

Utilities:

```text
camelCase.ts
```

Database:

```text
snake_case
```

Packages:

```text
kebab-case
```

Environment:

```text
UPPER_SNAKE_CASE
```

---

# 43. Import Rules

Prefer package imports:

```ts
import { Button } from "@tepisawah/ui";
import { useAuth } from "@tepisawah/auth";
import { OrderStatus } from "@tepisawah/orders";
```

Avoid deep internal imports:

```ts
@tepisawah/orders/src/internal/foo
```

Expose public API through `index.ts`.

---

# 44. Feature Folder Example

POS:

```text
features/orders/
├── components/
│   ├── OrderCard.tsx
│   ├── OrderQueue.tsx
│   └── OrderDetail.tsx
├── hooks/
│   ├── useOrders.ts
│   └── useOrderTransition.ts
├── services/
│   └── orders.service.ts
├── schemas/
│   └── order.schemas.ts
├── types/
│   └── order-ui.types.ts
└── index.ts
```

---

# 45. Customer Feature Example

```text
apps/order/src/features/
├── qr/
├── catalog/
├── cart/
├── checkout/
├── order-status/
├── service-request/
└── session/
```

---

# 46. Kitchen Feature Example

```text
apps/kitchen/src/features/
├── kitchen-queue/
├── order-card/
├── timers/
├── recall/
├── notifications/
└── connection/
```

---

# 47. Waiter Feature Example

```text
apps/waiter/src/features/
├── tables/
├── ready-orders/
├── service-requests/
├── manual-order/
├── notifications/
└── connection/
```

---

# 48. Admin Feature Example

```text
apps/admin/src/features/
├── dashboard/
├── catalog/
├── categories/
├── modifiers/
├── tables/
├── qr/
├── users/
├── roles/
├── settings/
└── audit/
```

---

# 49. Public Website Boundary

`apps/web` harus benar-benar public.

Source prototype sebelumnya memiliki internal workflow demo. Dalam production:

```text
REMOVE:
- internal workflow demo
- simulated POS
- simulated KDS
- localStorage order database
- fake operational data
```

Production homepage hanya menjadi public website.

---

# 50. Prototype vs Production

Prototype/legacy code tidak boleh dicampur dengan production architecture.

Legacy prototype:

```text
index.html
localStorage
mock orders
simulated KDS
simulated POS
```

Production:

```text
React
Supabase
PostgreSQL
Auth
RLS
Realtime
API commands
```

Prototype dapat menjadi visual/content reference, bukan backend source of truth.

---

# 51. Testing Location

Testing dapat berada:

```text
apps/<app>/src/**/*.test.ts
packages/<package>/src/**/*.test.ts
```

Integration/e2e:

```text
tests/
├── integration/
├── e2e/
└── security/
```

---

# 52. Production Build

Setiap app harus dapat build independently:

```text
pnpm --filter @tepisawah/web build
pnpm --filter @tepisawah/order build
pnpm --filter @tepisawah/pos build
pnpm --filter @tepisawah/kitchen build
pnpm --filter @tepisawah/waiter build
pnpm --filter @tepisawah/admin build
```

Exact package-manager commands dapat disesuaikan dengan final toolchain.

---

# 53. Deployment Mapping

Recommended:

```text
tepisawah.id
      ↓
apps/web

order.tepisawah.id
      ↓
apps/order

pos.tepisawah.id
      ↓
apps/pos

kitchen.tepisawah.id
      ↓
apps/kitchen

waiter.tepisawah.id
      ↓
apps/waiter

admin.tepisawah.id
      ↓
apps/admin
```

All applications connect to the same controlled Supabase backend.

---

# 54. Git Branching

Recommended:

```text
main
develop
feature/*
fix/*
hotfix/*
```

Production:

```text
main
```

Feature work:

```text
feature/auth-rbac
feature/catalog
feature/order-flow
feature/kds
```

---

# 55. Commit Convention

Recommended:

```text
feat:
fix:
refactor:
docs:
test:
chore:
security:
```

Examples:

```text
feat(auth): add Supabase login flow
feat(rbac): add permission resolver
feat(catalog): add product management
feat(order): add submit order command
feat(kds): add ready transition
security(rls): restrict payment access
test(order): cover invalid transitions
```

---

# 56. Cline Working Boundary

Cline must work within repository boundaries.

Before coding:

```text
read:
Project Rules
Design Freeze
Technical Architecture
Database Schema
API Contract
Auth/RBAC/RLS
Realtime Specification
Repository Structure
```

Then:

```text
inspect existing repo
↓
identify target module
↓
create minimal files
↓
implement
↓
typecheck
↓
test
↓
build
↓
commit
```

Do not allow Cline to restructure the repository arbitrarily.

---

# 57. Cline Stop Conditions

Cline must stop and request a decision if:

- required business rule is undefined
- payment provider is unknown
- RLS policy creates ambiguity
- state transition is not defined
- database schema conflicts with API contract
- design contradicts Design Freeze
- secret would be required in frontend
- two modules become circular dependencies
- existing production code would be broken by architecture change
- migration cannot safely preserve existing production data

---

# 58. Repository Root Example

Final expected shape:

```text
tepisawah/
├── apps/
│   ├── web/
│   ├── order/
│   ├── pos/
│   ├── kitchen/
│   ├── waiter/
│   └── admin/
│
├── packages/
│   ├── ui/
│   ├── auth/
│   ├── database/
│   ├── permissions/
│   ├── catalog/
│   ├── orders/
│   ├── payments/
│   ├── realtime/
│   ├── config/
│   └── types/
│
├── supabase/
│   ├── migrations/
│   ├── functions/
│   └── seed/
│
├── docs/
│   ├── architecture/
│   ├── product/
│   ├── design/
│   ├── api/
│   ├── database/
│   ├── security/
│   ├── deployment/
│   ├── operations/
│   └── decisions/
│
├── scripts/
├── tests/
├── .github/
├── .env.example
├── .gitignore
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
└── README.md
```

---

# 59. Dependency Diagram

```text
                    packages/ui
                         ↑
                         │
apps ───────→ shared domain packages
 │                    ↑
 │                    │
 ├── web              │
 ├── order ─────→ catalog/orders/realtime
 ├── pos ───────→ orders/payments/tables/realtime
 ├── kitchen ───→ orders/realtime
 ├── waiter ────→ orders/catalog/realtime
 └── admin ─────→ catalog/tables/auth/permissions
                         │
                         ↓
                    Supabase API
                         │
                         ↓
                     PostgreSQL
```

---

# 60. Definition of Done

Repository structure dianggap siap ketika:

- monorepo dibuat
- semua app memiliki boundary jelas
- shared package boundary jelas
- dependency direction jelas
- database/backend berada di Supabase layer
- business commands tidak berada di UI
- permission identifiers terpusat
- order states terpusat
- realtime contract terpusat
- environment strategy tersedia
- migration structure tersedia
- CI structure tersedia
- testing structure tersedia
- documentation structure tersedia
- prototype tidak dicampur dengan production
- Cline memiliki aturan kerja yang jelas

---

# 61. Next Artifact

Setelah repository structure:

```text
09 REPOSITORY_STRUCTURE_v1.0.md ← SELESAI

10 CLINE_IMPLEMENTATION_PLAN_v1.0.md
11 TESTING_STRATEGY_v1.0.md
12 ENVIRONMENT_CONFIG_v1.0.md
13 MIGRATION_PLAN_v1.0.md
14 IMPLEMENTATION
```

Artifact berikutnya harus menerjemahkan seluruh dokumen sebelumnya menjadi urutan kerja Cline yang executable, kecil, terukur, dan memiliki checkpoint setelah setiap fase.
