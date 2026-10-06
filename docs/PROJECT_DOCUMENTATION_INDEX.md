# TEPI SAWAH RESTO & CAFE
## PROJECT DOCUMENTATION INDEX v1.0

**Status:** Documentation Navigation / Cline Reference  
**Version:** 1.0  
**Date:** 2026-09-27  
**Purpose:** Menjadi peta utama seluruh specification, architecture, security, QA, dan implementation documentation.

---

# 1. Purpose

Dokumen ini menjawab tiga hal:

1. Dokumen apa yang harus dibaca?
2. Kapan dokumen tersebut menjadi authority?
3. Phase implementasi mana yang menggunakan dokumen tersebut?

Cline harus menggunakan dokumen ini sebagai navigation layer.

Dokumen ini TIDAK menggantikan isi specification.

Jika terdapat konflik, gunakan hierarchy pada:

`docs/implementation/MASTER_CLINE_PROMPT.md`

---

# 2. Documentation Authority

Urutan authority:

```text
01 Explicit Business Decision
        ↓
02 DESIGN_FREEZE
        ↓
03 PROJECT_RULES
        ↓
04 TECHNICAL_ARCHITECTURE
        ↓
05 DATABASE_SCHEMA
        ↓
06 DATABASE_MIGRATION_PLAN
        ↓
07 API_CONTRACT
        ↓
08 AUTH_RBAC_RLS
        ↓
09 REALTIME_SPEC
        ↓
10 REPOSITORY_STRUCTURE
        ↓
11 TESTING_STRATEGY
        ↓
12 ENVIRONMENT_CONFIG
        ↓
13 CLINE_IMPLEMENTATION_PLAN
        ↓
14 MASTER_CLINE_PROMPT
        ↓
15 Existing Prototype / Existing Code
```

Catatan:

`MASTER_CLINE_PROMPT.md` adalah operational instruction untuk agent. Business/technical specification tetap menjadi sumber requirement yang harus dipatuhi.

Jika dokumen tidak mendukung sebuah keputusan:

```text
DO NOT INVENT
DO NOT ASSUME
STOP AND REPORT
```

---

# 3. Quick Start Reading Order

Sebelum coding:

```text
1. MASTER_CLINE_PROMPT.md
2. PROJECT_RULES.md
3. DESIGN_FREEZE.md
4. TECHNICAL_ARCHITECTURE.md
5. REPOSITORY_STRUCTURE.md
6. DATABASE_SCHEMA.md
7. DATABASE_MIGRATION_PLAN.md
8. API_CONTRACT.md
9. AUTH_RBAC_RLS.md
10. REALTIME_SPEC.md
11. TESTING_STRATEGY.md
12. ENVIRONMENT_CONFIG.md
13. CLINE_IMPLEMENTATION_PLAN.md
```

Kemudian baca specification domain sesuai phase aktif.

---

# 4. Project Documentation Map

## 4.1 Project

Location:

```text
docs/project/
```

Files:

```text
PROJECT_RULES.md
BRD.md
PRD.md
USER_ROLES.md
USER_FLOW.md
FEATURE_MATRIX.md
DESIGN_FREEZE.md
```

### PROJECT_RULES.md

Purpose:

Global project engineering rules.

Read:

```text
EVERY PHASE
```

Authority:

```text
HIGH
```

---

### BRD.md

Purpose:

Business requirements.

Read:

```text
Business-related implementation
Scope decisions
Stakeholder requirements
```

Used by:

```text
Phase 0+
```

---

### PRD.md

Purpose:

Product requirements and feature behavior.

Read when implementing:

```text
customer
cashier
kitchen
waiter
admin
```

---

### USER_ROLES.md

Purpose:

Role definitions and responsibilities.

Read before:

```text
Auth
RBAC
RLS
POS
KDS
Waiter
Admin
```

---

### USER_FLOW.md

Purpose:

Operational user journeys.

Read before:

```text
Customer Ordering
Cashier
Kitchen
Waiter
Admin
```

---

### FEATURE_MATRIX.md

Purpose:

Feature scope and boundaries.

Use to prevent:

```text
scope creep
future feature implementation
```

---

### DESIGN_FREEZE.md

Purpose:

Locked MVP scope and behavior.

Read:

```text
EVERY FEATURE IMPLEMENTATION
```

Do not change without explicit approval.

---

# 5. Brand Documentation

Location:

```text
docs/brand/
```

## BRAND_DIRECTION.md

Purpose:

Visual and brand direction.

Read before:

```text
Web
Customer
Marketing-facing UI
Shared UI components
```

Authority:

```text
Visual / Brand
```

Do not invent:

```text
claims
ratings
promotions
contact details
operational facts
```

---

# 6. Design Documentation

Location:

```text
docs/design/
```

Files:

```text
DESIGN_SYSTEM.md
MASTER_DESIGN_SYSTEM.md
```

## DESIGN_SYSTEM.md

Base visual system.

## MASTER_DESIGN_SYSTEM.md

Consolidated production design baseline.

Read before:

```text
UI implementation
component implementation
responsive work
visual refinement
```

Priority:

```text
MASTER_DESIGN_SYSTEM
        ↓
DESIGN_SYSTEM
```

If a conflict is found:

```text
STOP
REPORT
```

---

# 7. Architecture Documentation

Location:

```text
docs/architecture/
```

Files:

```text
TECHNICAL_ARCHITECTURE.md
REPOSITORY_STRUCTURE.md
REALTIME_SPEC.md
DEPLOYMENT_ARCHITECTURE.md
```

## TECHNICAL_ARCHITECTURE.md

Defines:

```text
React
TypeScript
Vite
Supabase
PostgreSQL
Auth
RLS
Realtime
Vercel
GitHub
```

Read before:

```text
repository
backend
frontend
deployment
database
```

---

## REPOSITORY_STRUCTURE.md

Defines:

```text
apps/
packages/
supabase/
docs/
tests/
scripts/
```

Read before creating files.

---

## REALTIME_SPEC.md

Read before implementing:

```text
customer order updates
cashier queue
KDS
waiter board
notifications
dashboard
```

Principle:

```text
Realtime = signal
PostgreSQL = authority
```

---

## DEPLOYMENT_ARCHITECTURE.md

Read before:

```text
Vercel
domains
deployment
CI/CD
production
```

---

# 8. Database Documentation

Location:

```text
docs/database/
```

Files:

```text
DATABASE_SCHEMA.md
DATABASE_MIGRATION_PLAN.md
```

## DATABASE_SCHEMA.md

Defines:

```text
tables
relationships
fields
data model
constraints
RLS principles
```

Read before creating database objects.

---

## DATABASE_MIGRATION_PLAN.md

Defines:

```text
migration sequence
dependencies
constraints
indexes
functions
RLS
seed
```

Read before creating migration files.

Never create database schema based only on UI requirements.

---

# 9. API Documentation

Location:

```text
docs/api/
```

## API_CONTRACT.md

Defines:

```text
commands
queries
payloads
responses
authorization
validation
idempotency
concurrency
```

Read before implementing application/backend interaction.

Frontend must follow API contract.

Do not create arbitrary endpoint behavior.

---

# 10. Security Documentation

Location:

```text
docs/security/
```

## AUTH_RBAC_RLS.md

Defines:

```text
authentication
roles
permissions
RLS
public QR security
server authorization
sensitive actions
security tests
```

Mandatory before:

```text
Auth
RBAC
RLS
API commands
Admin
Payment
Public customer access
```

Security is not optional refinement.

---

# 11. Environment Documentation

Location:

```text
docs/environment/
```

## ENVIRONMENT_CONFIG.md

Defines:

```text
development
preview/staging
production
Supabase
Vercel
environment variables
secrets
domains
Auth redirect
```

Read before:

```text
environment setup
Supabase setup
Vercel deployment
CI/CD
```

Never invent credentials.

---

# 12. QA Documentation

Location:

```text
docs/qa/
```

## TESTING_STRATEGY.md

Defines:

```text
unit
integration
RLS/security
API
Realtime
E2E
responsive
accessibility
performance
regression
production smoke test
```

Read before writing tests.

Use the document to determine the required validation for each phase.

---

# 13. Implementation Documentation

Location:

```text
docs/implementation/
```

Files:

```text
CLINE_IMPLEMENTATION_PLAN.md
MASTER_CLINE_PROMPT.md
GIT_WORKFLOW.md
```

## CLINE_IMPLEMENTATION_PLAN.md

Defines:

```text
phase sequence
task boundaries
validation
checkpoint
definition of done
```

---

## MASTER_CLINE_PROMPT.md

Defines:

```text
how Cline must operate
how Cline must reason about scope
security rules
stop conditions
testing behavior
Git behavior
reporting format
```

Read at the beginning of every Cline session.

---

## GIT_WORKFLOW.md

Defines:

```text
branching
commit
review
checkpoint
```

Read before commit/release operations.

---

# 14. Operations Documentation

Location:

```text
docs/operations/
```

## ORDER_STATE.md

Defines:

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
```

Exceptions:

```text
CANCELLED
REJECTED
VOID
REFUNDED
```

Read before implementing order mutations.

---

# 15. Prompt Documentation

Location:

```text
docs/prompts/
```

Recommended:

```text
01-homepage.md
02-customer-order.md
03-cashier-pos.md
04-kitchen-kds.md
05-waiter.md
06-admin.md
```

Purpose:

Google Stitch design-generation instructions.

These are NOT backend specifications.

Use them for:

```text
visual exploration
screen hierarchy
component hierarchy
responsive design
UX state
```

Engineering implementation must follow the engineering specifications.

---

# 16. Prototype Documentation

Location:

```text
docs/prototype/pre-opening/
```

File:

```text
index.html
```

Purpose:

```text
visual reference
content reference
interaction reference
```

It is not production architecture.

Do not copy:

```text
localStorage
fake workflow
prototype payment
demo backend
```

into production.

---

# 17. Phase → Documentation Matrix

| Phase | Primary Documents |
|---|---|
| 0 Repository | PROJECT_RULES, TECHNICAL_ARCHITECTURE, REPOSITORY_STRUCTURE, ENVIRONMENT |
| 1 Supabase | TECHNICAL_ARCHITECTURE, DATABASE_SCHEMA, MIGRATION_PLAN, ENVIRONMENT |
| 2 Auth | USER_ROLES, AUTH_RBAC_RLS, API_CONTRACT |
| 3 RBAC/RLS | USER_ROLES, AUTH_RBAC_RLS, DATABASE_SCHEMA |
| 4 Restaurant Config | PRD, DATABASE_SCHEMA, API_CONTRACT |
| 5 Catalog | PRD, FEATURE_MATRIX, DATABASE_SCHEMA, API_CONTRACT, DESIGN |
| 6 Tables/QR | USER_FLOW, DATABASE_SCHEMA, API_CONTRACT, AUTH_RBAC_RLS |
| 7 Table Sessions | USER_FLOW, ORDER_STATE, DATABASE_SCHEMA |
| 8 Orders | PRD, USER_FLOW, ORDER_STATE, API_CONTRACT, DATABASE_SCHEMA |
| 9 Customer | USER_FLOW, PRD, DESIGN, API, REALTIME |
| 10 Cashier | USER_ROLES, USER_FLOW, API, RBAC, REALTIME |
| 11 Kitchen | USER_ROLES, ORDER_STATE, API, REALTIME, DESIGN |
| 12 Waiter | USER_ROLES, USER_FLOW, API, REALTIME, DESIGN |
| 13 Payments | API, AUTH_RBAC_RLS, DATABASE_SCHEMA, TESTING |
| 14 Service | USER_FLOW, API, REALTIME, RBAC |
| 15 Realtime | REALTIME_SPEC, API, TESTING |
| 16 Admin | USER_ROLES, PRD, RBAC, API, DESIGN |
| 17 Audit/Dashboard | AUTH_RBAC_RLS, DATABASE_SCHEMA, API, REALTIME |
| 18 Hardening | TESTING, SECURITY, ENVIRONMENT, ARCHITECTURE |
| 19 Release | ENVIRONMENT, DEPLOYMENT, TESTING, GIT |

---

# 18. Document Dependency Map

```text
PROJECT_RULES
      ↓
DESIGN_FREEZE
      ↓
TECHNICAL_ARCHITECTURE
      ↓
REPOSITORY_STRUCTURE
      ↓
DATABASE_SCHEMA
      ↓
DATABASE_MIGRATION_PLAN
      ↓
API_CONTRACT
      ↓
AUTH_RBAC_RLS
      ↓
REALTIME_SPEC
      ↓
TESTING_STRATEGY
      ↓
ENVIRONMENT_CONFIG
      ↓
CLINE_IMPLEMENTATION_PLAN
      ↓
MASTER_CLINE_PROMPT
```

This is a navigation dependency, not a claim that each document technically imports another.

---

# 19. Cline Session Procedure

Every session:

```text
MASTER_CLINE_PROMPT
        ↓
DOCUMENTATION INDEX
        ↓
ACTIVE PHASE
        ↓
RELEVANT DOCUMENTS
        ↓
REPOSITORY INSPECTION
        ↓
IMPLEMENT
        ↓
VALIDATE
        ↓
REPORT
```

Do not ask Cline to read every prototype or every file if irrelevant.

Use targeted reading.

---

# 20. When a Document Changes

If a specification changes:

```text
Identify affected docs
        ↓
Review dependencies
        ↓
Update relevant docs
        ↓
Review architecture impact
        ↓
Update implementation plan
        ↓
Update tests
        ↓
Only then update code
```

Do not modify code first and documentation later for architectural changes.

---

# 21. Change Control

Changes requiring explicit review:

```text
database schema
order state
payment workflow
RBAC
RLS
public QR security
architecture
environment strategy
production domain
```

Changes that are generally local implementation:

```text
component extraction
CSS cleanup
internal naming
non-functional refactor
```

provided they do not alter documented behavior.

---

# 22. Missing / Future Documents

The following may be created later when needed:

```text
DATABASE_MIGRATION_PLAN.md          ✓
MASTER_CLINE_PROMPT.md              ✓
PROJECT_DOCUMENTATION_INDEX.md      ✓

PAYMENT_PROVIDER_SPEC.md            future
OBSERVABILITY_SPEC.md               future
BACKUP_RECOVERY_PLAN.md             future
PRODUCTION_RUNBOOK.md               future
INCIDENT_RESPONSE.md                future
UAT_CHECKLIST.md                    future
RELEASE_CHECKLIST.md                future
```

Do not create these merely for documentation volume.

Create them when the corresponding implementation/release concern becomes active.

---

# 23. Final Navigation Rule

When Cline receives a task:

```text
QUESTION:
"What am I implementing?"

        ↓

PHASE:
"Where does it belong?"

        ↓

DOCUMENT:
"Which specification defines it?"

        ↓

SECURITY:
"Who is allowed to do it?"

        ↓

DATABASE:
"What is authoritative?"

        ↓

API:
"How is it mutated/read?"

        ↓

REALTIME:
"Who needs the update?"

        ↓

TEST:
"How do we prove it works?"

        ↓

GIT:
"How do we checkpoint it?"
```

If any critical answer is undefined:

```text
STOP
REPORT
DO NOT GUESS
```

---

# 24. Final Project Documentation Structure

```text
docs/
│
├── README.md
│
├── project/
│   ├── PROJECT_RULES.md
│   ├── BRD.md
│   ├── PRD.md
│   ├── USER_ROLES.md
│   ├── USER_FLOW.md
│   ├── FEATURE_MATRIX.md
│   └── DESIGN_FREEZE.md
│
├── brand/
│   └── BRAND_DIRECTION.md
│
├── design/
│   ├── DESIGN_SYSTEM.md
│   └── MASTER_DESIGN_SYSTEM.md
│
├── architecture/
│   ├── TECHNICAL_ARCHITECTURE.md
│   ├── REPOSITORY_STRUCTURE.md
│   ├── REALTIME_SPEC.md
│   └── DEPLOYMENT_ARCHITECTURE.md
│
├── database/
│   ├── DATABASE_SCHEMA.md
│   └── DATABASE_MIGRATION_PLAN.md
│
├── api/
│   └── API_CONTRACT.md
│
├── security/
│   └── AUTH_RBAC_RLS.md
│
├── environment/
│   └── ENVIRONMENT_CONFIG.md
│
├── qa/
│   └── TESTING_STRATEGY.md
│
├── implementation/
│   ├── CLINE_IMPLEMENTATION_PLAN.md
│   ├── MASTER_CLINE_PROMPT.md
│   └── GIT_WORKFLOW.md
│
├── decisions/
│   ├── ADR-001-monorepo.md
│   ├── ADR-002-supabase.md
│   ├── ADR-003-order-state-machine.md
│   ├── ADR-004-public-customer-ordering.md
│   ├── ADR-005-payment-provider.md
│   ├── ADR-006-role-consolidation.md
│   └── ADR-007-audit-branding-og-dan-lokalisasi.md
│
├── deployment/
│   └── PRE_DEPLOYMENT_CHECKLIST.md
│
├── operations/
│   ├── ORDER_STATE.md
│   └── PRE_PRODUCTION_CONTROLS.md
│
├── prompts/
│   ├── 01-homepage.md
│   ├── 02-customer-order.md
│   ├── 03-cashier-pos.md
│   ├── 04-kitchen-kds.md
│   ├── 05-waiter.md
│   └── 06-admin.md
│
└── prototype/
    └── pre-opening/
        └── index.html
```

**Status: READY AS DOCUMENTATION NAVIGATION INDEX.**
