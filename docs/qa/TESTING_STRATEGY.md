# TEPI SAWAH RESTO & CAFE
## TESTING STRATEGY v1.0

**Status:** Pre-Implementation Quality Blueprint  
**Version:** 1.0  
**Date:** 2026-09-27  
**Primary Tool:** Cline + VS Code  
**Architecture:** React + TypeScript + Vite + Supabase + PostgreSQL + RLS + Realtime

---

# 1. Purpose

Dokumen ini menetapkan strategi pengujian untuk memastikan sistem Tepi Sawah aman, konsisten, dapat digunakan, dan siap diproduksikan.

Testing dilakukan bertahap mengikuti implementation phase.

Prinsip utama:

```text
Implement
   ↓
Typecheck
   ↓
Lint
   ↓
Unit Test
   ↓
Integration Test
   ↓
Security / RLS Test
   ↓
Build
   ↓
E2E
   ↓
Phase Review
   ↓
Git Checkpoint
```

Jangan melanjutkan phase berikutnya apabila quality gate phase aktif belum PASS.

---

# 2. Testing Principles

## 2.1 Backend Is Authority

Test harus memastikan frontend tidak dapat menjadi sumber kebenaran untuk:

- harga
- subtotal
- total
- status order
- status pembayaran
- role
- permission
- table ownership
- audit actor

Frontend hanya mengirim command/input yang diperbolehkan.

---

## 2.2 Database Is Source of Truth

PostgreSQL menjadi authority untuk:

- catalog
- tables
- table sessions
- orders
- order items
- payments
- service requests
- roles
- permissions
- audit
- status history

Realtime hanya menyampaikan perubahan dan bukan source of truth.

---

## 2.3 Every Critical Mutation Must Be Testable

Minimal test untuk mutation:

```text
valid input
invalid input
unauthorized actor
wrong role
wrong permission
invalid current state
duplicate request
concurrent request
missing entity
database failure
```

---

# 3. Testing Layers

## Layer 1 — Static Validation

Wajib:

```bash
pnpm typecheck
pnpm lint
```

Tujuan:

- TypeScript error
- import error
- unused/broken code
- lint violations
- dependency problems

---

## Layer 2 — Unit Tests

Unit test digunakan untuk fungsi yang memiliki business logic terisolasi.

Target:

- status transition validation
- permission checks
- money calculation
- quantity validation
- pagination
- input normalization
- idempotency helpers
- UI state helpers
- formatter/parser
- order payload validation

Unit test tidak boleh bergantung pada production database.

---

## Layer 3 — Integration Tests

Integration test memverifikasi interaksi antar bagian sistem.

Target:

```text
Frontend
   ↓
Application Command
   ↓
Supabase
   ↓
PostgreSQL
   ↓
RLS / Function / Trigger
```

Contoh:

- create order
- confirm order
- start preparation
- mark ready
- serve order
- record payment
- create service request
- assign role
- update catalog

---

## Layer 4 — RLS / Security Tests

RLS wajib diuji sebagai security boundary.

Test minimal:

```text
anonymous user
customer context
waiter
cashier
kitchen
supervisor
admin
owner
```

Untuk setiap actor:

- data yang boleh dibaca
- data yang boleh dibuat
- data yang boleh diubah
- data yang tidak boleh diakses
- command yang ditolak

Frontend hiding bukan security test.

---

## Layer 5 — API / Command Tests

Setiap domain command harus memiliki test:

```text
happy path
validation failure
authorization failure
state conflict
duplicate request
not found
database failure
```

Critical command:

```text
submitOrder
confirmOrder
rejectOrder
startPreparing
markReady
serveOrder
createPayment
completePayment
cancelOrder
refundPayment
createServiceRequest
resolveServiceRequest
```

---

## Layer 6 — Realtime Tests

Realtime test harus memverifikasi:

- event diterima
- event hanya dikirim ke actor yang berhak
- duplicate event tidak merusak UI
- out-of-order event tidak merusak state
- reconnect melakukan refetch
- stale data direkonsiliasi
- mutation tetap berjalan tanpa bergantung pada event delivery

Scenario:

```text
Cashier confirms order
        ↓
KDS receives update
        ↓
Kitchen starts preparation
        ↓
Waiter receives READY
        ↓
Customer receives status update
```

Database tetap menjadi authority pada setiap tahap.

---

# 4. Domain Test Matrix

| Domain | Unit | Integration | RLS | E2E |
|---|---:|---:|---:|---:|
| Auth | ✓ | ✓ | ✓ | ✓ |
| Profiles | ✓ | ✓ | ✓ | |
| RBAC | ✓ | ✓ | ✓ | ✓ |
| Catalog | ✓ | ✓ | ✓ | ✓ |
| Tables | ✓ | ✓ | ✓ | ✓ |
| QR | ✓ | ✓ | ✓ | ✓ |
| Table Sessions | ✓ | ✓ | ✓ | ✓ |
| Orders | ✓ | ✓ | ✓ | ✓ |
| Payments | ✓ | ✓ | ✓ | ✓ |
| Kitchen | ✓ | ✓ | ✓ | ✓ |
| Waiter | ✓ | ✓ | ✓ | ✓ |
| Service Requests | ✓ | ✓ | ✓ | ✓ |
| Realtime | ✓ | ✓ | ✓ | ✓ |
| Admin | ✓ | ✓ | ✓ | ✓ |
| Audit | ✓ | ✓ | ✓ | |
| Dashboard | ✓ | ✓ | ✓ | ✓ |

---

# 5. Order State Machine Tests

Normal flow:

```text
DRAFT
 ↓
SUBMITTED
 ↓
PENDING_CONFIRMATION
 ↓
CONFIRMED
 ↓
PREPARING
 ↓
READY
 ↓
SERVED
 ↓
PAID
 ↓
COMPLETED
```

Exception states:

```text
CANCELLED
REJECTED
VOID
REFUNDED
```

## Valid transition tests

Test setiap transition yang diizinkan.

Contoh:

```text
PENDING_CONFIRMATION → CONFIRMED
CONFIRMED → PREPARING
PREPARING → READY
READY → SERVED
SERVED → PAID
PAID → COMPLETED
```

## Invalid transition tests

Contoh:

```text
DRAFT → READY
SUBMITTED → PAID
READY → PREPARING
COMPLETED → PREPARING
COMPLETED → CANCELLED
```

Harus ditolak oleh backend.

---

# 6. Role-Based Transition Tests

| Transition | Customer | Waiter | Cashier | Kitchen | Supervisor | Admin | Owner |
|---|---:|---:|---:|---:|---:|---:|---:|
| Submit order | ✓ | ✓ | | | | | |
| Confirm order | | | ✓ | | authorized | | |
| Reject order | | | ✓ | | authorized | | |
| Start preparing | | | | ✓ | authorized | | |
| Mark ready | | | | ✓ | authorized | | |
| Serve | | ✓ | | | authorized | | |
| Pay | | | ✓ | | authorized | | |
| Refund | | | | | ✓ | authorized | authorized |
| Void | | | | | ✓ | authorized | authorized |

Test harus menggunakan backend authorization, bukan hanya UI permission.

---

# 7. Price Integrity Tests

Client tidak boleh menentukan authoritative:

```text
unit_price
subtotal
discount_amount
tax_amount
service_charge
total
```

Test:

1. client mengirim harga yang salah
2. backend mengambil harga catalog
3. backend menghitung ulang
4. order item menyimpan snapshot
5. total backend menjadi authority

Expected:

```text
client price ≠ database price
        ↓
backend ignores client authority
        ↓
server-calculated amount
```

Historical order harus tetap menggunakan snapshot walaupun catalog berubah.

---

# 8. Duplicate / Idempotency Tests

Critical commands harus aman terhadap duplicate request.

Test:

```text
same idempotency key
same request
different network retry
double-click
browser refresh
reconnect
```

Expected:

```text
1 logical command
=
1 business result
```

Tidak boleh menghasilkan:

- duplicate order
- duplicate payment
- duplicate status transition
- duplicate audit entry jika command yang sama memang idempotent

---

# 9. Concurrency Tests

Simulasikan dua actor melakukan mutation hampir bersamaan.

Contoh:

```text
Cashier A → CONFIRMED
Cashier B → REJECTED
```

Expected:

- hanya transition valid pertama yang berhasil
- request berikutnya mendapatkan conflict
- database tetap konsisten
- audit tetap benar
- UI melakukan reconciliation

Test lain:

```text
Kitchen A → READY
Kitchen B → READY
```

Harus menghasilkan satu successful transition.

---

# 10. Table / QR Tests

Test:

- valid table QR
- invalid table QR
- inactive table
- QR tanpa table
- table tidak tersedia
- table session aktif
- multiple orders dalam satu session
- session closing
- duplicate scan
- stale QR context

QR tidak boleh menjadi authorization secret.

Public order access harus tetap dibatasi sesuai security design.

---

# 11. Customer E2E Test

Scenario utama:

```text
Open QR URL
   ↓
Resolve table
   ↓
Open menu
   ↓
Select product
   ↓
Add modifier
   ↓
Add note
   ↓
Open cart
   ↓
Submit order
   ↓
Order created
   ↓
Wait for confirmation
   ↓
Order confirmed
   ↓
Preparing
   ↓
Ready
   ↓
Served
   ↓
Request bill
   ↓
Payment
   ↓
Completed
```

Test tambahan:

- empty cart
- invalid QR
- product unavailable
- network failure
- duplicate submit
- realtime reconnect
- session expiration
- browser refresh

---

# 12. Cashier E2E Test

Scenario:

```text
Login
   ↓
Dashboard
   ↓
Open pending order
   ↓
Review order
   ↓
Confirm
   ↓
Order enters kitchen
   ↓
Open payment queue
   ↓
Select payment method
   ↓
Record payment
   ↓
Receipt
   ↓
Transaction completed
```

Test tambahan:

- reject order with reason
- invalid payment
- duplicate payment
- wrong amount
- permission denied
- shift not open
- payment retry
- receipt failure

---

# 13. Kitchen E2E Test

Scenario:

```text
Login
   ↓
Open KDS
   ↓
Receive confirmed order
   ↓
Start preparing
   ↓
Mark ready
   ↓
Waiter receives READY
```

Test:

- new order notification
- timer
- notes/modifiers
- duplicate click
- unauthorized transition
- reconnect
- fullscreen/responsive
- empty queue
- stale order

Kitchen must not see unnecessary payment/financial data.

---

# 14. Waiter E2E Test

Scenario:

```text
Login
   ↓
Open service board
   ↓
See READY order
   ↓
Open table
   ↓
Serve order
   ↓
Resolve customer service request
   ↓
Request bill
```

Test:

- READY → SERVED
- service request acknowledgement
- service request resolution
- manual order
- unauthorized kitchen action
- unauthorized payment action
- multiple orders in one table session

---

# 15. Admin E2E Test

Scenario:

```text
Login
   ↓
Catalog
   ↓
Create category
   ↓
Create product
   ↓
Set availability
   ↓
Assign modifier
   ↓
Manage table
   ↓
Generate QR
   ↓
Manage user
   ↓
Assign role
   ↓
Review audit log
```

Test:

- duplicate product
- invalid price
- inactive product
- role assignment restrictions
- audit entry created
- unauthorized admin action
- concurrent catalog edit

---

# 16. Payment Tests

Payment provider integration is intentionally isolated.

MVP must support a payment abstraction rather than coupling core order logic to one provider.

Minimum states:

```text
PENDING
PAID
FAILED
EXPIRED
CANCELLED
REFUNDED
```

Test:

- successful payment
- failed payment
- expired payment
- duplicate callback
- invalid callback
- mismatched amount
- mismatched order
- already paid order
- refund authorization
- payment retry

Payment callback must be verified server-side.

---

# 17. Audit Tests

Sensitive actions must generate audit information.

Minimum fields:

```text
actorId
actorRole
action
entityType
entityId
before
after
reason
createdAt
```

Test audit creation for:

- role assignment
- product price change
- order rejection
- order cancellation
- void
- refund
- payment mutation
- permission-sensitive admin action

Audit records should not be editable by ordinary users.

---

# 18. Realtime Failure Tests

Simulate:

```text
connection lost
connection restored
duplicate event
event arrives late
event arrives before local query
subscription error
token/session refresh
browser tab hidden
browser tab resumed
```

Required behavior:

```text
Disconnect
   ↓
UI indicates degraded connection
   ↓
Mutation handling remains safe
   ↓
Reconnect
   ↓
Refetch authoritative state
   ↓
Reconcile UI
```

Do not rely on client event history as permanent state.

---

# 19. UI State Tests

Every production screen should test:

```text
Loading
Empty
Success
Error
Permission denied
Offline/degraded connection
Submitting
Disabled action
Conflict
Not found
```

Critical action buttons must prevent accidental duplicate submission.

---

# 20. Responsive Tests

Minimum targets:

### Customer

```text
320px
375px
390px
430px
768px
```

### Operational apps

```text
1024x768
1280x800
1366x768
1440x900
1920x1080
```

Check:

- overflow
- clipped dialogs
- table readability
- sticky controls
- keyboard navigation
- touch target
- fullscreen KDS
- mobile waiter usability

---

# 21. Accessibility Tests

Minimum:

- keyboard navigation
- visible focus
- semantic buttons
- form labels
- accessible dialog
- sufficient contrast
- meaningful status text
- no color-only status indication
- touch targets usable
- screen reader-friendly labels where applicable

---

# 22. Security Test Checklist

Before production:

- [ ] no service-role key in frontend
- [ ] no secrets in Git
- [ ] `.env` ignored
- [ ] `.env.example` contains placeholders only
- [ ] RLS enabled on protected tables
- [ ] anonymous access intentionally scoped
- [ ] role checks enforced server-side
- [ ] permission checks enforced server-side
- [ ] client cannot set role
- [ ] client cannot bypass order transition
- [ ] client cannot set authoritative price
- [ ] client cannot set payment status
- [ ] audit cannot be tampered with
- [ ] public QR does not expose sensitive records
- [ ] admin routes protected
- [ ] service-role credentials never shipped to browser
- [ ] input validation exists at command boundary

---

# 23. Performance Tests

Initial MVP targets should be treated as engineering targets, not business promises.

Test:

- homepage load
- menu loading
- order submission
- cashier queue refresh
- KDS event delivery
- waiter board refresh
- catalog search
- dashboard query
- large order history pagination

Avoid loading unlimited records.

Use:

```text
pagination
server-side filtering
server-side sorting
indexed queries
selective columns
```

---

# 24. Database Tests

Validate:

- primary keys
- foreign keys
- unique constraints
- check constraints
- not-null constraints
- indexes
- timestamps
- status constraints
- cascade behavior
- transaction boundaries
- RLS policies
- migration repeatability

Migration test:

```text
fresh database
   ↓
run all migrations
   ↓
seed controlled data
   ↓
run tests
```

---

# 25. Test Data Policy

Production must never depend on random fake data.

Use deterministic fixtures.

Example actors:

```text
test-owner
test-admin
test-supervisor
test-cashier
test-kitchen
test-waiter
test-customer
```

Use clearly marked test records.

Never copy real customer/payment data into automated test fixtures.

---

# 26. Test Environment

Recommended:

```text
Development
    ↓
Test / Preview
    ↓
Production
```

Each environment must have separate credentials and configuration.

Do not use production database for automated destructive tests.

---

# 27. CI Quality Gate

Pull request should run at minimum:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

For relevant changes:

```text
database tests
RLS tests
integration tests
E2E tests
```

PR cannot merge if critical quality gates fail.

---

# 28. Phase Quality Gate

Setiap phase harus menghasilkan:

```text
PASS
atau
FAIL
```

Review:

1. requirement
2. architecture
3. database
4. authorization
5. business workflow
6. validation
7. audit
8. tests
9. UX
10. security
11. regression
12. build

Jika FAIL:

```text
Fix
 ↓
Retest
 ↓
Review
```

Jangan mulai phase berikutnya.

---

# 29. Definition of Done

Feature dianggap DONE hanya jika:

- [ ] requirement implemented
- [ ] design system followed
- [ ] TypeScript clean
- [ ] lint clean
- [ ] unit tests pass
- [ ] integration tests pass where applicable
- [ ] RLS/security tests pass where applicable
- [ ] E2E test pass where applicable
- [ ] production build pass
- [ ] loading state implemented
- [ ] empty state implemented
- [ ] error state implemented
- [ ] permission state implemented
- [ ] audit implemented for sensitive actions
- [ ] no secret exposed
- [ ] no client-authority violation
- [ ] documentation updated
- [ ] git diff reviewed
- [ ] commit created

---

# 30. Production Smoke Test

Setelah deployment:

## Public

- [ ] homepage loads
- [ ] HTTPS works
- [ ] navigation works
- [ ] menu loads
- [ ] QR ordering URL resolves

## Customer

- [ ] QR identifies correct table
- [ ] product can be added
- [ ] order can be submitted
- [ ] status updates

## Cashier

- [ ] login
- [ ] pending order visible
- [ ] confirm works
- [ ] payment works

## Kitchen

- [ ] confirmed order appears
- [ ] preparing works
- [ ] ready works

## Waiter

- [ ] ready order visible
- [ ] serve works
- [ ] service request works

## Admin

- [ ] login
- [ ] catalog access
- [ ] table/QR access
- [ ] role management
- [ ] audit access

## Infrastructure

- [ ] no console-critical errors
- [ ] realtime connection works
- [ ] environment variables correct
- [ ] database connectivity works
- [ ] deployment logs clean

---

# 31. Critical Regression Scenarios

Before each production release, rerun at least:

```text
1. Customer QR → order
2. Cashier confirm
3. Kitchen prepare
4. Kitchen ready
5. Waiter serve
6. Cashier payment
7. Order completed
8. Customer status update
9. Call waiter
10. Admin product update
11. Role permission enforcement
12. Duplicate order prevention
13. Duplicate payment prevention
14. RLS denial test
15. Realtime reconnect
```

---

# 32. Cline Testing Prompt

Use this prompt after implementing a phase:

```text
You are the QA and Security Engineer for the Tepi Sawah Resto & Cafe production system.

Read the relevant project specifications before testing.

Your task is to test ONLY the implementation completed in the current phase.

Do not implement unrelated features.

Run:

1. typecheck
2. lint
3. unit tests
4. integration tests where applicable
5. RLS/security tests where applicable
6. build
7. relevant E2E tests
8. inspect browser console
9. inspect network failures
10. review changed files
11. check regression against previous phases

Verify:

- business rules
- authorization
- RLS
- order state machine
- price integrity
- idempotency
- concurrency handling
- audit
- realtime behavior
- loading/empty/error states
- responsive behavior
- accessibility
- security
- production build

Do not silently fix unrelated issues.

Return:

A. PASS / FAIL
B. Tests executed
C. Passed tests
D. Failed tests
E. Findings by severity:
   - Critical
   - High
   - Medium
   - Low
F. Exact affected files
G. Reproduction steps for failures
H. Recommended fix
I. Regression risks
J. Release recommendation

If a critical requirement is undefined, STOP and report the blocking decision.

Do not start the next implementation phase.
```

---

# 33. Severity Definition

## Critical

Blocks release.

Examples:

- authentication bypass
- RLS bypass
- payment integrity failure
- client-controlled total accepted
- unauthorized status transition
- secret exposure
- duplicate payment
- destructive data corruption

## High

Must be fixed before production unless explicitly accepted by owner.

Examples:

- core workflow broken
- order disappears
- realtime causes incorrect state
- audit missing on sensitive action
- major role permission error

## Medium

Should be fixed before broad rollout.

Examples:

- non-critical UX failure
- isolated responsive issue
- recoverable notification issue

## Low

Minor issue with limited operational impact.

---

# 34. Testing Execution Order

Recommended sequence:

```text
Phase implementation
      ↓
Static validation
      ↓
Unit
      ↓
Integration
      ↓
RLS / Security
      ↓
Realtime
      ↓
E2E
      ↓
Regression
      ↓
Build
      ↓
Phase Review
      ↓
PASS
      ↓
Git checkpoint
```

---

# 35. Final Rule

Testing is part of implementation, not a final activity.

No feature is considered production-ready merely because:

```text
UI looks correct
```

Production readiness requires:

```text
UI
+
Business Logic
+
Database Integrity
+
Authorization
+
RLS
+
Audit
+
Realtime
+
Error Handling
+
Tests
+
Build
```

**Status:** READY FOR USE AS THE QUALITY GATE BEFORE IMPLEMENTATION.
