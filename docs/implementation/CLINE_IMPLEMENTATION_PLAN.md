# TEPI SAWAH RESTO & CAFE
## CLINE IMPLEMENTATION PLAN v1.0

**Status:** Implementation Blueprint  
**Version:** 1.0  
**Date:** 2026-09-27  
**Primary Tool:** Cline + VS Code  
**Architecture:** React + TypeScript + Vite + Supabase + PostgreSQL + RLS + Realtime  
**Repository:** `tepisawah`

---

# 1. Purpose

Dokumen ini menerjemahkan seluruh specification Tepi Sawah menjadi urutan kerja yang dapat dieksekusi Cline secara bertahap.

Cline tidak boleh:

- membuat seluruh aplikasi sekaligus
- mengarang business rule
- mengubah architecture tanpa approval
- membuat mock backend sebagai production substitute
- menaruh secret di frontend
- mengubah order state machine
- membuat role/permission hanya di frontend
- mengabaikan RLS
- mencampurkan prototype lama dengan production code

Tujuan utama:

```text
Small Task
   ↓
Implement
   ↓
Typecheck
   ↓
Test
   ↓
Build
   ↓
Review
   ↓
Commit
   ↓
Next Task
```

---

# 2. Source of Truth

Urutan authority:

```text
1. Explicit business decision
2. Design Freeze
3. Technical Architecture
4. Database Schema
5. API Contract
6. Auth + RBAC + RLS
7. Realtime Specification
8. Repository Structure
9. Cline Implementation Plan
10. Existing prototype/code
```

Jika terdapat konflik:

- jangan diam-diam memilih
- jangan mengarang
- hentikan task yang terkena konflik
- dokumentasikan conflict
- minta keputusan

Prototype HTML hanya menjadi:

- visual reference
- content reference
- interaction reference

Prototype bukan production architecture.

---

# 3. Global Cline Operating Rules

Sebelum melakukan perubahan:

1. baca file specification yang relevan
2. inspect repository
3. cari existing implementation
4. tentukan scope task
5. buat implementation plan singkat
6. implement minimal change
7. run validation
8. report hasil
9. commit bila task selesai

Jangan melakukan refactor besar hanya karena menemukan code yang kurang rapi.

---

# 4. Cline Prompt Header

Setiap sesi Cline yang mengubah code production sebaiknya dimulai dengan context berikut:

```text
You are implementing the Tepi Sawah Resto & Cafe production system.

Read and obey these documents before changing code:

- docs/project/PROJECT_RULES.md
- docs/design/DESIGN_FREEZE.md
- docs/architecture/TECHNICAL_ARCHITECTURE.md
- docs/database/DATABASE_SCHEMA.md
- docs/api/API_CONTRACT.md
- docs/security/AUTH_RBAC_RLS.md
- docs/architecture/REALTIME_SPEC.md
- docs/architecture/REPOSITORY_STRUCTURE.md
- docs/implementation/CLINE_IMPLEMENTATION_PLAN.md

Rules:
- Do not invent business rules.
- Do not change architecture without approval.
- Do not expose secrets.
- Do not bypass RLS.
- Do not trust client price, total, role, permission, or order status.
- Keep changes scoped to the requested phase.
- Run typecheck/test/build after implementation.
- Stop when an unresolved decision blocks safe implementation.
```

---

# 5. Implementation Phases

Total recommended phases:

```text
PHASE 0  Repository Bootstrap
PHASE 1  Supabase Foundation
PHASE 2  Auth + Profiles
PHASE 3  RBAC + RLS
PHASE 4  Restaurant Configuration
PHASE 5  Catalog
PHASE 6  Tables + QR
PHASE 7  Table Sessions
PHASE 8  Order Domain
PHASE 9  Customer Ordering
PHASE 10 Cashier
PHASE 11 Kitchen KDS
PHASE 12 Waiter
PHASE 13 Payments
PHASE 14 Service Requests
PHASE 15 Realtime Integration
PHASE 16 Admin
PHASE 17 Audit + Dashboard
PHASE 18 Hardening
PHASE 19 Production Release
```

Do not skip foundational phases to build UI faster.

---

# 6. PHASE 0 — Repository Bootstrap

## Goal

Create monorepo structure.

Create:

```text
apps/
apps/web/
apps/order/
apps/pos/
apps/kitchen/
apps/waiter/
apps/admin/

packages/
packages/ui/
packages/auth/
packages/database/
packages/permissions/
packages/catalog/
packages/orders/
packages/payments/
packages/realtime/
packages/config/
packages/types/

supabase/
supabase/migrations/
supabase/functions/
supabase/seed/

docs/
scripts/
tests/
.github/
```

Also:

```text
package.json
pnpm-workspace.yaml
tsconfig.json
.env.example
.gitignore
README.md
```

## Validation

- workspace resolves
- all apps can run/build
- package imports resolve
- no circular dependencies

## Commit

```text
chore(repo): bootstrap monorepo structure
```

---

# 7. PHASE 1 — Supabase Foundation

## Goal

Connect development environment to Supabase.

Implement:

- Supabase config
- local/dev environment
- database connection
- generated database types
- migration workflow
- seed workflow

Create:

```text
packages/database/src/generated/
supabase/config.toml
supabase/migrations/
supabase/seed/
```

## Validation

- migration command works
- database types generate
- connection works
- no secret committed

## Stop Condition

Stop if Supabase project/environment is not available.

Do not create fake production credentials.

---

# 8. PHASE 2 — Auth + Profiles

## Goal

Implement staff authentication.

Implement:

```text
packages/auth
apps/pos login
apps/kitchen login
apps/waiter login
apps/admin login
```

Create:

- login
- logout
- session restoration
- auth provider
- `/me`
- profiles
- active/inactive user handling

## Validation

Test:

- valid login
- invalid login
- logout
- refresh
- expired session
- inactive account

## Commit

```text
feat(auth): implement Supabase staff authentication
```

---

# 9. PHASE 3 — RBAC + RLS

## Goal

Security before operational features.

Implement:

```text
roles
permissions
user_roles
role_permissions
authorization helpers
RLS
```

Create shared permission constants:

```text
packages/permissions/
```

Implement route guards.

But remember:

```text
Frontend guard = UX
RLS/backend = security
```

## Validation

Attempt:

- waiter → payment
- kitchen → payment
- cashier → role management
- unauthorized catalog mutation
- customer → internal API
- user A → user B private data

## Stop Condition

Do not continue if critical RLS tests fail.

## Commit

```text
security(rbac): implement roles permissions and RLS
```

---

# 10. PHASE 4 — Restaurant Configuration

## Goal

Implement basic restaurant settings.

Entities:

- restaurant settings
- operating hours

Use only confirmed values.

Do not invent:

- tax
- service charge
- operating hours
- payment provider
- promotions

unless configured.

## Validation

- admin can read/update authorized settings
- public can read only public settings
- audit generated for sensitive configuration changes

---

# 11. PHASE 5 — Catalog

## Goal

Centralized menu source of truth.

Implement:

```text
categories
products
modifiers
product_modifiers
```

Admin:

- list
- create
- edit
- archive
- availability

Customer:

- public active catalog

POS/KDS/Waiter:

- authorized catalog access

## Critical Rule

Client sends:

```text
productId
quantity
modifierIds
```

Backend determines:

```text
product name
price
modifier price
availability
subtotal
```

## Validation

- inactive product cannot be ordered
- price cannot be trusted from client
- archive preserves historical order data

## Commit

```text
feat(catalog): implement centralized menu catalog
```

---

# 12. PHASE 6 — Tables + QR

## Goal

Implement table management.

Entities:

```text
tables
table_qr
```

Admin:

- create
- edit
- deactivate
- QR management

Customer:

```text
QR
 ↓
resolve table
```

## Validation

- valid QR
- invalid QR
- inactive table
- QR does not expose internal access
- unauthorized QR regeneration

---

# 13. PHASE 7 — Table Sessions

## Goal

Support multiple orders during a table visit.

Implement:

```text
table_sessions
```

Rules:

- one active session per table unless explicitly configured otherwise
- multiple orders may belong to one session
- closing session must follow business rules

## Validation

- open session
- reuse active session
- prevent conflicting active sessions
- close session

---

# 14. PHASE 8 — Order Domain

This is the most important backend phase.

Implement:

```text
orders
order_items
order_item_modifiers
order_status_history
```

Centralize state:

```text
DRAFT
SUBMITTED
PENDING_CONFIRMATION
CONFIRMED
PREPARING
READY
SERVED
PAID
COMPLETED

REJECTED
CANCELLED
VOID
REFUNDED
```

Implement centralized transition command.

## Critical

Never implement independent transition logic in:

- POS
- KDS
- Waiter
- Customer

All must use the same backend authority.

---

# 15. PHASE 8A — Order Creation

Implement:

```text
create order
add items
calculate totals
snapshot product data
```

Backend transaction:

```text
validate table/session
↓
validate products
↓
validate modifiers
↓
calculate prices
↓
create order
↓
create order items
↓
persist snapshots
```

## Validation

Test:

- empty order
- unavailable product
- invalid modifier
- manipulated price
- quantity validation
- duplicate request

---

# 16. PHASE 8B — Order Submission

Implement:

```text
DRAFT → SUBMITTED → PENDING_CONFIRMATION
```

Use idempotency.

Double-click must not create two submissions.

## Validation

- duplicate submit
- invalid status
- missing table session
- unauthorized actor

---

# 17. PHASE 8C — Order Transition

Implement one command:

```text
POST /orders/:id/transition
```

Backend validates:

```text
current status
requested status
actor
permission
business rule
concurrency
idempotency
```

## Validation

Test every allowed transition and every important invalid transition.

---

# 18. PHASE 9 — Customer Ordering

Implement `apps/order`.

Screens:

```text
QR Welcome
Menu
Product Detail
Cart
Confirmation
Order Success
Order Status
Call Waiter
Request Bill
```

Use:

```text
mobile-first
390x844
320px+
```

No customer account required in MVP.

## Important

Customer cannot:

- confirm order
- mark preparing
- mark ready
- mark served
- create payment
- access admin

---

# 19. PHASE 10 — Cashier

Implement `apps/pos`.

Sequence:

```text
Login
 ↓
Dashboard
 ↓
Pending Confirmation
 ↓
Order Detail
 ↓
Confirm/Reject
 ↓
Payment Queue
 ↓
Payment
 ↓
Receipt
```

Also:

- table view
- transaction history
- daily summary
- shift operations

## Validation

- confirm
- reject with reason
- payment
- duplicate payment
- already paid
- unauthorized refund/void

---

# 20. PHASE 11 — Kitchen KDS

Implement `apps/kitchen`.

Primary states:

```text
CONFIRMED
PREPARING
READY
```

Screens:

- KDS queue
- order card
- timer
- recall
- connection status

Kitchen must not receive unnecessary financial information.

## Validation

- confirmed appears
- start preparing
- mark ready
- duplicate click
- reconnect
- stale data

---

# 21. PHASE 12 — Waiter

Implement `apps/waiter`.

Features:

- table board
- ready orders
- mark served
- call waiter
- request bill
- service request handling
- manual order
- notifications

Waiter cannot perform payment.

---

# 22. PHASE 13 — Payments

Payment is implemented after order workflow is stable.

Implement:

```text
payments
```

Methods configured:

```text
CASH
QRIS
DEBIT
CREDIT_CARD
E_WALLET
TRANSFER
```

Only methods explicitly enabled in settings should appear.

Do not select a real QRIS provider until business decision is made.

## Cash

Backend calculates:

```text
change = amountTendered - amountDue
```

## QRIS

Provider integration must use:

```text
Provider
 ↓
Server/Webhook
 ↓
Verified payment
 ↓
Database
 ↓
Realtime
```

Never trust browser payment success.

---

# 23. PHASE 14 — Service Requests

Implement:

```text
CALL_WAITER
REQUEST_BILL
```

Lifecycle:

```text
REQUESTED
 ↓
ACKNOWLEDGED
 ↓
RESOLVED
```

Customer creates request.

Waiter resolves.

Cashier may see request bill according to permission.

---

# 24. PHASE 15 — Realtime Integration

Only after core commands work.

Implement:

```text
packages/realtime
```

Channels:

```text
orders
tables
payments
service_requests
notifications
dashboard
```

Consumers:

```text
Customer
Cashier
Kitchen
Waiter
Admin/Supervisor
```

## Realtime Rule

```text
Event = signal
Database = authority
```

Implement:

- deduplication
- entity version
- reconnect
- refetch
- reconciliation
- stale-state handling
- connection indicator

---

# 25. PHASE 16 — Admin

Implement `apps/admin`.

Modules:

```text
Dashboard
Catalog
Categories
Modifiers
Tables
QR
Users
Roles
Permissions
Settings
Operating Hours
Audit
```

Admin UI must use centralized data.

No duplicate catalog database.

---

# 26. PHASE 17 — Audit + Dashboard

Audit must cover:

- role assignment
- product changes
- table changes
- order exceptions
- refund
- void
- settings changes
- sensitive operations

Dashboard should be derived from backend data.

Do not maintain fake counters in localStorage.

---

# 27. PHASE 18 — Production Hardening

Review:

## Security

- RLS
- secrets
- authorization
- rate limiting
- input validation
- public endpoint exposure

## Reliability

- idempotency
- concurrency
- reconnect
- retry
- error handling

## Performance

- query indexes
- pagination
- realtime scope
- image optimization
- bundle size

## UX

- loading
- empty
- error
- stale
- disconnected
- permission denied

---

# 28. PHASE 19 — Production Release

Final sequence:

```text
Typecheck
 ↓
Unit Tests
 ↓
Integration Tests
 ↓
RLS Tests
 ↓
E2E Tests
 ↓
Production Build
 ↓
Environment Validation
 ↓
Database Migration
 ↓
Deploy
 ↓
Smoke Test
 ↓
Monitor
```

Do not deploy before migration and environment validation.

---

# 29. Task Size Rule

One Cline task should normally modify one coherent concern.

Good:

```text
Implement Supabase login and session restoration.
```

Bad:

```text
Build the entire POS.
```

Good:

```text
Implement order transition command and tests.
```

Bad:

```text
Finish all backend functionality.
```

---

# 30. Cline Task Template

Use this template:

```text
TASK:
[exact task]

CONTEXT:
[relevant specification]

SCOPE:
[list files/modules allowed]

DO NOT:
[list prohibited changes]

ACCEPTANCE CRITERIA:
[list measurable outcomes]

VALIDATION:
[typecheck/test/build]

STOP IF:
[ambiguity/conflict]

COMMIT:
[commit message]
```

---

# 31. Example Cline Task — Auth

```text
TASK:
Implement staff authentication using Supabase Auth.

CONTEXT:
Read:
- AUTH_RBAC_RLS.md
- REPOSITORY_STRUCTURE.md
- TECHNICAL_ARCHITECTURE.md

SCOPE:
- packages/auth
- apps/pos login
- apps/kitchen login
- apps/waiter login
- apps/admin login

DO NOT:
- create custom password storage
- expose service-role key
- implement RBAC yet
- modify order logic

ACCEPTANCE CRITERIA:
- login works
- logout works
- session survives refresh
- expired session is handled
- inactive user is rejected

VALIDATION:
- typecheck
- tests
- build

STOP IF:
Supabase environment is unavailable.

COMMIT:
feat(auth): implement staff authentication
```

---

# 32. Example Cline Task — RLS

```text
TASK:
Implement roles, permissions, role assignments, and initial RLS policies.

SCOPE:
- supabase/migrations
- packages/permissions
- auth authorization helpers

DO NOT:
- bypass RLS
- use broad internal USING(true)
- implement UI-only authorization

ACCEPTANCE CRITERIA:
- roles exist
- permissions exist
- assignments exist
- helper functions work
- unauthorized reads/writes fail

VALIDATION:
- migration
- RLS security tests
- typecheck

STOP IF:
RLS recursion or authorization ambiguity appears.

COMMIT:
security(rbac): implement roles permissions and RLS
```

---

# 33. Example Cline Task — Order Transition

```text
TASK:
Implement centralized order status transition.

READ:
- DATABASE_SCHEMA.md
- API_CONTRACT.md
- AUTH_RBAC_RLS.md

SCOPE:
- order transition function
- order status history
- audit
- tests

ACCEPTANCE:
- valid transitions succeed
- invalid transitions fail
- actor permission enforced
- reason required for exceptions
- concurrent mutation handled
- idempotency works

DO NOT:
- implement UI
- duplicate transition logic
- modify payment workflow

COMMIT:
feat(order): implement centralized status transition
```

---

# 34. Checkpoint System

After each phase:

```text
CHECKPOINT
```

Cline must report:

```text
Implemented:
- ...

Files changed:
- ...

Tests:
- ...

Typecheck:
- ...

Build:
- ...

Known issues:
- ...

Architecture deviations:
- none / details
```

Only continue after checkpoint is accepted.

---

# 35. Git Checkpoint Strategy

Recommended commits:

```text
chore(repo): bootstrap monorepo
feat(auth): implement authentication
security(rbac): implement roles permissions and RLS
feat(config): implement restaurant settings
feat(catalog): implement catalog
feat(tables): implement tables and QR
feat(session): implement table sessions
feat(order): implement order domain
feat(order): implement order submission
feat(order): implement state transitions
feat(customer): implement QR ordering
feat(pos): implement cashier workflow
feat(kitchen): implement KDS
feat(waiter): implement waiter workflow
feat(payment): implement payment domain
feat(service): implement service requests
feat(realtime): integrate realtime
feat(admin): implement admin management
feat(audit): implement audit and dashboard
test(system): add production integration tests
chore(release): prepare production deployment
```

---

# 36. Do Not Use One Giant Commit

Avoid:

```text
feat: build Tepi Sawah system
```

A giant commit makes:

- debugging difficult
- rollback difficult
- code review difficult
- Cline mistakes difficult to isolate

---

# 37. Testing Gate

A phase cannot be considered complete if:

```text
typecheck fails
OR
critical tests fail
OR
build fails
OR
security test fails
```

UI may proceed only when its backend dependency is stable enough for the defined scope.

---

# 38. Mock Data Policy

Mocks are allowed for:

- early visual exploration
- component development
- isolated UI testing

Mocks are not allowed as production data source.

Remove before production:

```text
localStorage order database
DEFAULT_ORDERS
fake payment success
simulated kitchen transition
fake role authorization
hard-coded production totals
```

---

# 39. Existing Prototype Migration

The current Stitch-generated `index.html` should be handled as follows:

```text
Current index.html
       ↓
Extract verified content/design
       ↓
Map to apps/web
       ↓
Rebuild production components
       ↓
Remove internal demo
       ↓
Connect catalog API
       ↓
Connect reservation/order entry points
```

Do not convert the 1800+ line prototype directly into the production application.

---

# 40. Production Data Migration Rule

Before migration:

```text
inspect existing production data
 ↓
backup
 ↓
map fields
 ↓
test migration
 ↓
validate counts/integrity
 ↓
production migration
```

Never let Cline overwrite an existing production database without explicit approval.

---

# 41. Security Stop Conditions

Immediately stop if Cline proposes:

```text
service-role key in browser
password in database
RLS disabled
public unrestricted orders table
client-controlled order status
client-controlled payment status
client-controlled total
client-controlled role
hard-coded secret
payment provider secret in Vite
```

---

# 42. Business Rule Stop Conditions

Stop if undefined:

```text
tax
service charge
discount
promotion
QRIS provider
refund policy
receipt numbering
operating hours
table session closing rule
payment settlement rule
```

Do not invent values.

---

# 43. Design Stop Conditions

Stop if implementation requires:

- new navigation model
- new primary workflow
- new role
- new order status
- major color system change
- major component architecture change
- replacing selected technology

These require architecture/design review.

---

# 44. Definition of Done — Implementation

System implementation is complete when:

- all MVP apps build
- authentication works
- RBAC works
- RLS passes
- catalog works
- QR works
- table session works
- customer ordering works
- cashier works
- KDS works
- waiter works
- payment workflow works
- service requests work
- realtime works
- admin works
- audit works
- dashboard works
- critical tests pass
- no production mock state remains
- secrets are protected
- production deployment passes smoke test

---

# 45. Final Execution Sequence

Cline should execute exactly in this broad order:

```text
REPOSITORY
   ↓
SUPABASE
   ↓
AUTH
   ↓
RBAC/RLS
   ↓
CONFIG
   ↓
CATALOG
   ↓
TABLES/QR
   ↓
TABLE SESSIONS
   ↓
ORDER DOMAIN
   ↓
CUSTOMER
   ↓
CASHIER
   ↓
KITCHEN
   ↓
WAITER
   ↓
PAYMENTS
   ↓
SERVICE REQUESTS
   ↓
REALTIME
   ↓
ADMIN
   ↓
AUDIT/DASHBOARD
   ↓
HARDENING
   ↓
TESTING
   ↓
PRODUCTION
```

---

# 46. Next Artifacts

After this document:

```text
10 CLINE_IMPLEMENTATION_PLAN_v1.0.md ← SELESAI

11 TESTING_STRATEGY_v1.0.md
12 ENVIRONMENT_CONFIG_v1.0.md
13 MIGRATION_PLAN_v1.0.md
14 MASTER_CLINE_PROMPT.md
15 IMPLEMENTATION
```

The next document must define the complete testing strategy before production coding starts.
