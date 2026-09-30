# TEPI SAWAH

# TECHNICAL ARCHITECTURE v1.0

**Status:** Proposed Architecture for MVP\
**Basis:** Design Freeze v1.0, Master Design System v1.0,
PROJECT_RULES.md\
**Objective:** Menentukan arsitektur teknis yang cukup sederhana untuk
MVP, tetapi aman dan extensible untuk fase berikutnya.

------------------------------------------------------------------------

# 1. ARCHITECTURE DECISION

## Recommended MVP Architecture

Use a centralized web application platform with:

``` text
Frontend
    ↓
Application / API Layer
    ↓
PostgreSQL Database
    ↓
Realtime Layer
```

Recommended implementation baseline:

``` text
Frontend:
React + TypeScript + Vite

Backend / Platform:
Supabase

Database:
PostgreSQL

Authentication:
Supabase Auth

Authorization:
Application RBAC + PostgreSQL Row Level Security where appropriate

Realtime:
Supabase Realtime

Storage:
Supabase Storage for menu/product/media assets where appropriate

Public Hosting:
Vercel

DNS:
tepisawah.id / subdomains

Source Control:
GitHub

Development:
VS Code + Cline
```

This architecture is intentionally chosen to reduce MVP infrastructure
overhead while retaining a relational database, authentication, realtime
capability, server-side logic, and a path to later scaling.

------------------------------------------------------------------------

# 2. WHY THIS ARCHITECTURE

The MVP requires:

-   relational order data
-   users and roles
-   table/session relationships
-   product catalog
-   order state transitions
-   payment records
-   audit logs
-   realtime operational updates
-   server-side validation
-   centralized menu source
-   multiple internal applications

A simple static frontend + Google Sheets/localStorage architecture is
not appropriate as the production source of truth for this MVP because
concurrent POS/KDS/Waiter operations require transactional consistency.

The production system should therefore use a proper relational backend.

------------------------------------------------------------------------

# 3. HIGH-LEVEL ARCHITECTURE

``` text
                         INTERNET
                            │
                 ┌──────────┴──────────┐
                 │                     │
             Public Web           Customer QR
          tepisawah.id        order.tepisawah.id
                 │                     │
                 └──────────┬──────────┘
                            │
                         HTTPS
                            │
                 ┌──────────▼──────────┐
                 │ React + TypeScript  │
                 │ Shared UI System    │
                 └──────────┬──────────┘
                            │
                    Authenticated API
                            │
                 ┌──────────▼──────────┐
                 │ Application Layer   │
                 │ Server Functions /  │
                 │ Secure API          │
                 └───────┬───────┬─────┘
                         │       │
               ┌─────────▼─┐   ┌─▼──────────┐
               │PostgreSQL │   │ Realtime   │
               │Database   │   │ Events     │
               └───────────┘   └────────────┘
                         │
                  ┌──────▼──────┐
                  │ Audit Logs  │
                  │ Storage     │
                  └─────────────┘

Internal applications:

pos.tepisawah.id
kitchen.tepisawah.id
waiter.tepisawah.id
admin.tepisawah.id
```

The exact deployment topology may use one frontend application with
route/domain separation or multiple frontend applications sharing one
backend. The preferred MVP approach is to keep shared code centralized
while separating operational entry points logically.

------------------------------------------------------------------------

# 4. APPLICATION STRATEGY

Recommended repository strategy:

``` text
one monorepo
    │
    ├── public web
    ├── customer ordering
    ├── POS
    ├── KDS
    ├── Waiter
    ├── Admin
    └── shared packages
```

Conceptual structure:

``` text
tepisawah/
├── apps/
│   ├── web/
│   └── operations/
│
├── packages/
│   ├── ui/
│   ├── design-tokens/
│   ├── domain/
│   ├── types/
│   └── config/
│
├── supabase/
│   ├── migrations/
│   ├── functions/
│   └── seed/
│
├── docs/
│   ├── TepiSawah_Master_Design_System_v1.0.md
│   └── TepiSawah_DESIGN_FREEZE_v1.0.md
│
├── PROJECT_RULES.md
├── package.json
└── README.md
```

The exact framework structure can be adjusted after repository
initialization, but shared UI/domain logic must not be duplicated across
applications.

------------------------------------------------------------------------

# 5. DOMAIN BOUNDARIES

Primary domains:

``` text
Identity
Users
Roles
Permissions

Restaurant
Branches (future)
Settings
Operating Hours

Catalog
Categories
Products
Modifiers

Tables
Table Sessions
QR

Orders
Order Items
Order Status

Kitchen
Kitchen Queue
Preparation Events

Service
Waiter
Service Requests

Payments
Payment
Payment Methods
Receipts

Audit
Audit Events

Notifications
Operational Notifications
```

Future domains remain outside MVP:

``` text
Inventory
Recipes/BOM
Purchasing
Accounting
CRM
Loyalty
Reservations
Multi-branch
AI
```

------------------------------------------------------------------------

# 6. FRONTEND ARCHITECTURE

Use:

``` text
React
TypeScript
Vite
Shared component library
Shared design tokens
Feature-based modules
```

Frontend responsibilities:

-   render UI
-   collect user input
-   client-side validation
-   optimistic interaction only where safe
-   subscribe to permitted realtime events
-   display authoritative backend state
-   manage local UI state
-   manage navigation

Frontend must NOT be authoritative for:

-   order state
-   price
-   payment state
-   permissions
-   table identity
-   totals
-   security

------------------------------------------------------------------------

# 7. SHARED UI ARCHITECTURE

Shared UI package:

``` text
packages/ui/
```

Should contain:

``` text
Button
Input
Select
Search
Tabs
Modal
Drawer
Card
Table
Badge
Toast
Alert
Skeleton
EmptyState
ErrorState
PermissionState
```

Domain components may include:

``` text
OrderCard
OrderStatusBadge
PaymentStatusBadge
TableStatusBadge
KitchenTicket
ServiceRequestCard
PermissionMatrix
AuditEventRow
```

Domain components must consume shared tokens rather than defining
independent styles.

------------------------------------------------------------------------

# 8. DESIGN TOKEN ARCHITECTURE

Create a centralized token layer.

Conceptual:

``` text
packages/design-tokens/
├── colors
├── typography
├── spacing
├── radius
├── shadows
├── breakpoints
└── semantic-status
```

Application CSS should consume semantic tokens.

Do not scatter raw hexadecimal values across components.

------------------------------------------------------------------------

# 9. BACKEND ARCHITECTURE

Backend responsibilities:

-   authentication
-   authorization
-   business rules
-   state transitions
-   price calculation
-   order creation
-   payment state
-   table validation
-   audit logging
-   realtime event publication
-   server-side validation

Recommended server-side mechanisms:

``` text
Database functions / RPC
Server-side functions
Secure API endpoints
Database constraints
Row Level Security
```

Sensitive operations must execute through controlled server-side paths.

------------------------------------------------------------------------

# 10. DATABASE

Primary database:

``` text
PostgreSQL
```

Reason:

-   relational order structure
-   transactions
-   constraints
-   foreign keys
-   indexing
-   auditability
-   concurrent operations
-   future reporting
-   extensibility

Do not use browser localStorage as production data storage.

------------------------------------------------------------------------

# 11. LOGICAL DATABASE MODEL

Core entities:

``` text
profiles
roles
permissions
role_permissions
user_roles

restaurant_settings
operating_hours

categories
products
product_modifiers
modifiers

tables
table_qr
table_sessions

orders
order_items
order_item_modifiers
order_status_history

payments
payment_transactions

service_requests

notifications

audit_logs
```

Future entities:

``` text
branches
ingredients
recipes
stock_movements
suppliers
expenses
customers
loyalty_accounts
reservations
```

------------------------------------------------------------------------

# 12. PRODUCT MODEL

Minimum product concept:

``` text
products
├── id
├── category_id
├── name
├── description
├── image_url
├── price
├── is_active
├── availability
├── created_at
└── updated_at
```

Do not store product data independently in each frontend.

------------------------------------------------------------------------

# 13. ORDER MODEL

Conceptual:

``` text
orders
├── id
├── order_number
├── table_id
├── table_session_id
├── source
├── status
├── subtotal
├── discount
├── tax
├── total
├── notes
├── created_by
├── created_at
└── updated_at
```

Order items:

``` text
order_items
├── id
├── order_id
├── product_id
├── product_name_snapshot
├── unit_price_snapshot
├── quantity
├── notes
└── line_total
```

Modifier snapshots should also be preserved where applicable.

------------------------------------------------------------------------

# 14. ORDER SOURCE

Orders should identify source:

``` text
CUSTOMER_QR
WAITER
POS
```

This allows operational reporting without creating separate order
systems.

------------------------------------------------------------------------

# 15. ORDER STATUS HISTORY

Every state transition should be recorded.

Conceptual:

``` text
order_status_history
├── id
├── order_id
├── from_status
├── to_status
├── actor_id
├── actor_role
├── reason
└── created_at
```

This supports:

-   audit
-   troubleshooting
-   operational reporting
-   accountability
-   future analytics

------------------------------------------------------------------------

# 16. TABLE MODEL

Conceptual:

``` text
tables
├── id
├── table_code
├── name
├── capacity
├── status
├── is_active
└── created_at
```

QR:

``` text
table_qr
├── id
├── table_id
├── token
├── is_active
├── created_at
└── expires_at
```

The exact QR security model should be finalized before production
deployment.

------------------------------------------------------------------------

# 17. TABLE SESSION

A table session represents an active dining context.

Conceptually:

``` text
table_sessions
├── id
├── table_id
├── status
├── opened_at
├── closed_at
└── opened_by
```

Multiple orders may belong to one table session.

This supports:

``` text
Table A12
  ├── Order 001
  ├── Order 002
  └── Order 003
```

without incorrectly treating each order as a new table occupancy.

------------------------------------------------------------------------

# 18. PAYMENT MODEL

Conceptual:

``` text
payments
├── id
├── order_id
├── method
├── status
├── amount
├── reference
├── paid_at
├── created_by
└── created_at
```

Payment provider integration should be isolated behind a payment service
boundary.

Do not couple the order domain directly to one payment vendor.

------------------------------------------------------------------------

# 19. AUTHENTICATION

Recommended:

``` text
Supabase Auth
```

Internal users:

``` text
Cashier
Kitchen
Waiter
Supervisor
Admin
Owner
```

Customer:

``` text
No account required for MVP
```

Internal authentication must be separated conceptually from anonymous QR
ordering.

------------------------------------------------------------------------

# 20. AUTHORIZATION

Use two layers:

``` text
Application RBAC
+
Database Row Level Security where applicable
```

Example:

``` text
Cashier
    ↓
orders: confirm
payments: process
    ↓
backend validates
    ↓
database/API executes
```

Never trust a role value supplied by the browser.

------------------------------------------------------------------------

# 21. REALTIME ARCHITECTURE

Realtime events should be derived from authoritative database changes.

Examples:

``` text
order.created
order.confirmed
order.preparing
order.ready
order.served
order.paid

service_request.created
service_request.resolved

table.updated
```

Consumers:

``` text
Cashier
KDS
Waiter
Customer
```

The event is a notification of state change.

The database remains authoritative.

------------------------------------------------------------------------

# 22. REALTIME CLIENT RULE

Clients should:

1.  receive event
2.  validate/reconcile local state
3.  refresh authoritative record when necessary
4.  update UI

Do not build an independent client-side state machine that can diverge
from the server.

------------------------------------------------------------------------

# 23. API STRATEGY

Use domain-oriented API/service boundaries.

Examples:

``` text
/auth
/menu
/categories
/modifiers
/tables
/table-sessions
/orders
/order-transitions
/payments
/service-requests
/users
/roles
/permissions
/settings
/audit
```

Sensitive operations should use explicit commands rather than generic
unrestricted updates.

Example:

``` text
POST /orders/{id}/confirm
POST /orders/{id}/reject
POST /orders/{id}/prepare
POST /orders/{id}/ready
POST /orders/{id}/serve
POST /orders/{id}/pay
POST /orders/{id}/void
POST /orders/{id}/refund
```

Do not expose a generic:

``` text
PATCH /orders/{id}
```

for arbitrary status manipulation.

------------------------------------------------------------------------

# 24. IDEMPOTENCY

Commands that create or change business state should support duplicate
protection.

Examples:

``` text
submit order
confirm
prepare
ready
serve
payment
refund
service request
```

A repeated request must not produce duplicate side effects.

------------------------------------------------------------------------

# 25. TRANSACTION BOUNDARIES

Operations such as:

``` text
confirm order
create payment
refund
state transition
```

should use appropriate database transactions or atomic server-side
operations.

Example:

``` text
CONFIRM ORDER

validate current state
+
validate permission
+
write state change
+
write history
+
create required event
```

These actions should not leave partially completed state.

------------------------------------------------------------------------

# 26. AUDIT ARCHITECTURE

Audit logs should be generated server-side for sensitive operations.

Do not allow the frontend to submit arbitrary:

``` text
actor_id
actor_role
from_state
```

and trust those values.

The backend should derive actor identity from authenticated context and
current database state.

------------------------------------------------------------------------

# 27. NOTIFICATION ARCHITECTURE

Operational notification categories:

``` text
New Order
Order Confirmed
Order Ready
Service Request
Payment Event
System Alert
```

Notification delivery can evolve later.

MVP should prioritize in-app operational notifications.

------------------------------------------------------------------------

# 28. FILE / IMAGE STORAGE

Use object storage for:

-   product images
-   restaurant gallery
-   branding assets where appropriate

Do not store large binary assets directly in PostgreSQL.

Public assets should use controlled URLs/CDN behavior.

------------------------------------------------------------------------

# 29. ENVIRONMENT STRATEGY

Minimum environments:

``` text
Development
Staging
Production
```

Environment variables:

``` text
Development:
local secrets

Staging:
staging secrets

Production:
production secrets
```

Never commit `.env` files containing secrets.

Use:

``` text
.env.example
```

for documented variable names without secret values.

------------------------------------------------------------------------

# 30. DOMAIN STRATEGY

Current public domain:

``` text
tepisawah.id
```

Recommended logical domains:

``` text
tepisawah.id
order.tepisawah.id
pos.tepisawah.id
kitchen.tepisawah.id
waiter.tepisawah.id
admin.tepisawah.id
```

These may be implemented as:

-   separate deployments, or
-   route/domain mappings to a shared application

The MVP should prefer the simpler implementation where operational
separation is achieved through routes and authorization rather than
unnecessary duplicated deployments.

------------------------------------------------------------------------

# 31. DEPLOYMENT

Recommended baseline:

``` text
GitHub
   ↓
Vercel
   ↓
React application

Supabase
   ├── PostgreSQL
   ├── Auth
   ├── Realtime
   ├── Storage
   └── server-side functions
```

DNS points public/subdomains to the appropriate application endpoints.

------------------------------------------------------------------------

# 32. OBSERVABILITY

Minimum production visibility:

``` text
Application errors
API errors
Authentication failures
Database errors
Realtime connection errors
Payment failures
Critical order transition failures
```

Avoid logging sensitive credentials or payment secrets.

------------------------------------------------------------------------

# 33. BACKUP & RECOVERY

Production database requires:

-   automated backups according to selected platform capability
-   documented recovery procedure
-   periodic recovery verification

A backup that has never been restored should not be treated as verified
recovery.

------------------------------------------------------------------------

# 34. SECURITY BASELINE

Required:

-   HTTPS
-   secure authentication
-   server-side authorization
-   database policies where applicable
-   input validation
-   output safety
-   rate limiting where appropriate
-   secure secrets
-   audit logging
-   least privilege
-   no exposed service keys

Customer QR endpoints should not expose internal administrative data.

------------------------------------------------------------------------

# 35. PAYMENT INTEGRATION BOUNDARY

MVP should isolate payment provider integration.

Conceptual:

``` text
Order
  ↓
Payment Service
  ↓
Provider Adapter
  ↓
QRIS / Card / E-wallet / etc.
```

This allows changing payment providers without rewriting the order
domain.

Actual provider selection and credentials remain an implementation
decision to be finalized before payment integration.

------------------------------------------------------------------------

# 36. MONOREPO RULE

Use one repository as the default.

Benefits:

-   shared UI
-   shared types
-   shared design tokens
-   shared domain contracts
-   coordinated versioning
-   simpler Cline context
-   fewer duplicated components

Do not create six independent repositories unless a concrete operational
requirement appears.

------------------------------------------------------------------------

# 37. CI/CD

Minimum pipeline:

``` text
Pull Request
 ↓
Type Check
 ↓
Lint
 ↓
Unit Tests
 ↓
Build
 ↓
Preview
 ↓
Review
 ↓
Production
```

Production deployment should require a clean build.

------------------------------------------------------------------------

# 38. DATABASE MIGRATIONS

All schema changes must be migration-based.

Never make undocumented manual production schema changes.

Migration naming should be chronological and descriptive.

Example:

``` text
001_initial_schema
002_add_table_sessions
003_add_order_status_history
004_add_service_requests
```

------------------------------------------------------------------------

# 39. SEED DATA

Development/staging may contain seed data.

Production must not contain:

-   fake transactions
-   fake payments
-   demo users with weak credentials
-   fake operational metrics

Production seed data should be limited to explicitly required
configuration.

------------------------------------------------------------------------

# 40. PHASE BOUNDARY

Architecture must support later domains without implementing them now.

Future expansion:

``` text
MVP
 ↓
Inventory
 ↓
Finance/BI
 ↓
CRM/Loyalty
 ↓
Reservation
 ↓
AI
 ↓
Multi-branch
```

Do not build future modules merely because the database could support
them.

------------------------------------------------------------------------

# 41. TECHNICAL DECISION RECORD

## Decision: Relational Database

**Decision:** PostgreSQL\
**Reason:** transactional restaurant operations, relational data,
auditability, concurrency.

## Decision: Authentication

**Decision:** Managed authentication platform\
**Baseline:** Supabase Auth\
**Reason:** reduce custom authentication code.

## Decision: Realtime

**Decision:** managed realtime layer\
**Baseline:** Supabase Realtime\
**Reason:** operational queues require timely updates.

## Decision: Frontend

**Decision:** React + TypeScript + Vite\
**Reason:** shared component architecture and compatibility with Cline
workflow.

## Decision: Repository

**Decision:** Monorepo\
**Reason:** shared UI/types/domain contracts and simpler maintenance.

## Decision: Public/Internal Separation

**Decision:** logical domain/subdomain separation with shared backend.\
**Reason:** different user contexts without duplicating backend systems.

------------------------------------------------------------------------

# 42. WHAT IS NOT YET FINAL

The following require implementation-level decisions after this
architecture baseline:

1.  Exact Supabase project configuration
2.  Exact RLS policies
3.  Exact SQL schema
4.  Exact API/function signatures
5.  Payment provider
6.  QR token security model
7.  Realtime channel/event naming
8.  Logging/monitoring provider
9.  Backup retention policy
10. Production environment values
11. Exact Vercel project/domain mapping

These should not be invented prematurely.

------------------------------------------------------------------------

# 43. NEXT ENGINEERING ARTIFACTS

After approval of this architecture:

``` text
01. DATABASE_SCHEMA_v1.0.md
02. API_CONTRACT_v1.0.md
03. AUTH_RBAC_SPEC_v1.0.md
04. REALTIME_SPEC_v1.0.md
05. REPOSITORY_STRUCTURE.md
06. CLINE_IMPLEMENTATION_PLAN.md
```

Then implementation begins.

------------------------------------------------------------------------

# 44. ARCHITECTURE GATE

Current status:

``` text
Product/UX Design Freeze       ✓
Technical Architecture         ✓ BASELINE
Database Schema                → NEXT
API Contract                   → AFTER DATABASE
Auth/RBAC Detail               → PARALLEL WITH API
Realtime Detail                → PARALLEL WITH API
Repository Structure           → AFTER ARCHITECTURE APPROVAL
Cline Implementation           → FINAL
```

**Architecture must not silently change the frozen product behavior.**

Any technical constraint that requires a product/workflow change must be
raised as a change request.
