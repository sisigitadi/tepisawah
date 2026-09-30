# TEPI SAWAH

# DESIGN FREEZE v1.0

**Status:** FROZEN FOR ARCHITECTURE\
**Purpose:** Mengunci keputusan produk, UX, workflow, dan batas MVP
sebelum technical architecture.

------------------------------------------------------------------------

## 1. FREEZE RULE

Mulai dokumen ini:

-   tidak ada penambahan fitur MVP tanpa change request
-   perubahan state/order/payment/RBAC harus melalui review
-   perubahan visual harus tetap mengikuti Master Design System
-   perubahan database/API yang berdampak pada workflow harus
    didokumentasikan
-   fitur fase berikutnya tidak boleh masuk MVP secara diam-diam

Design Freeze berarti **scope dan behavior MVP dikunci**, bukan berarti
semua implementasi teknis sudah selesai.

------------------------------------------------------------------------

# 2. PRODUCT MODULES

MVP terdiri dari:

1.  Public Homepage
2.  Customer QR Ordering
3.  Cashier POS
4.  Kitchen Display System
5.  Waiter Service
6.  Admin Management
7.  Authentication
8.  RBAC
9.  Audit Log
10. Table Management + QR
11. Realtime operational updates where required

------------------------------------------------------------------------

# 3. USER ROLES

Baseline roles:

``` text
Customer
Waiter
Cashier
Kitchen
Supervisor
Admin
Owner
```

Permission diberikan melalui RBAC.

Role tidak boleh digunakan sebagai satu-satunya authorization mechanism
jika permission granular diperlukan.

------------------------------------------------------------------------

# 4. CORE CUSTOMER FLOW

``` text
SCAN QR
 ↓
WELCOME
 ↓
MENU
 ↓
PRODUCT
 ↓
CUSTOMIZE
 ↓
CART
 ↓
CONFIRM
 ↓
SUBMITTED
 ↓
PENDING_CONFIRMATION
 ↓
ORDER STATUS
```

Customer tidak membutuhkan login/account pada MVP kecuali keputusan
produk berubah secara eksplisit.

------------------------------------------------------------------------

# 5. CORE OPERATIONAL FLOW

``` text
Customer / Waiter
        ↓
      ORDER
        ↓
PENDING_CONFIRMATION
        ↓
     CASHIER
        ↓
   CONFIRMED
        ↓
      KITCHEN
        ↓
    PREPARING
        ↓
      READY
        ↓
     WAITER
        ↓
     SERVED
        ↓
     CASHIER
        ↓
       PAID
        ↓
    COMPLETED
```

------------------------------------------------------------------------

# 6. ORDER STATE MACHINE

Normal transitions:

``` text
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

Exceptions:

``` text
CANCELLED
REJECTED
VOID
REFUNDED
```

Rules:

-   no arbitrary backward transitions
-   transition must be authorized
-   transition must be atomic
-   transition must be idempotent
-   exception requires permission where applicable
-   sensitive exception requires reason
-   sensitive transition must be auditable

------------------------------------------------------------------------

# 7. ACTOR TRANSITIONS

  Transition                         Actor
  ---------------------------------- ----------------------------
  DRAFT → SUBMITTED                  Customer / Waiter
  SUBMITTED → PENDING_CONFIRMATION   System
  PENDING_CONFIRMATION → CONFIRMED   Cashier / Authorized Staff
  PENDING_CONFIRMATION → REJECTED    Cashier / Supervisor
  CONFIRMED → PREPARING              Kitchen
  PREPARING → READY                  Kitchen
  READY → SERVED                     Waiter
  SERVED → PAID                      Cashier
  PAID → COMPLETED                   System / Cashier

Exception transitions require appropriate authorization.

------------------------------------------------------------------------

# 8. TABLE MODEL

Table state is independent from order state.

A table may have multiple orders within a table/session.

The system must not assume:

``` text
one table = one order
```

QR identifies a table/session context but must be validated server-side.

------------------------------------------------------------------------

# 9. QR ORDERING

Canonical customer ordering concept:

``` text
order.tepisawah.id/?table=A12
```

Rules:

-   table identity from QR must be validated
-   customer should not manually re-enter table when QR provides it
-   manipulated table identifiers must be rejected
-   invalid/expired/unavailable QR needs an explicit UX state

------------------------------------------------------------------------

# 10. CASHIER SCOPE

MVP cashier handles:

-   order queue
-   order confirmation
-   order rejection
-   order detail
-   table context
-   payment queue
-   payment processing
-   receipt
-   transaction history
-   shift opening/closing where implemented
-   authorized exception workflows

Cashier does not directly bypass kitchen workflow.

------------------------------------------------------------------------

# 11. KDS SCOPE

KDS handles:

``` text
CONFIRMED → PREPARING → READY
```

KDS focuses on:

-   order ID
-   table
-   elapsed time
-   items
-   quantities
-   notes
-   action

KDS does not handle payment.

KDS timer uses backend timestamp.

------------------------------------------------------------------------

# 12. WAITER SCOPE

Waiter handles:

-   table overview
-   ready orders
-   serving
-   call waiter
-   service requests
-   request bill
-   manual order creation

Waiter does not perform kitchen or payment transitions unless explicitly
authorized.

------------------------------------------------------------------------

# 13. ADMIN SCOPE

Admin handles configuration/governance:

-   dashboard
-   menu/product catalog
-   categories
-   modifiers
-   tables
-   QR
-   users
-   roles
-   permissions
-   restaurant settings
-   operating hours
-   ordering settings
-   payment settings
-   kitchen settings
-   waiter/service settings
-   notifications
-   audit log

Admin is not automatically a substitute for POS, KDS, or Waiter.

------------------------------------------------------------------------

# 14. CENTRALIZED MENU

Menu/product catalog is a centralized source of truth.

Used by:

``` text
Customer
POS
Waiter
KDS
Admin
```

Historical orders must preserve product/item snapshots.

Changing the current menu must not rewrite historical transaction data.

------------------------------------------------------------------------

# 15. PAYMENT

Payment states:

``` text
PENDING
PAID
FAILED
EXPIRED
CANCELLED
```

Payment methods may include:

``` text
Tunai
QRIS
Debit
Credit Card
E-Wallet
Transfer when configured
```

Payment confirmation must be authoritative.

The frontend cannot independently mark a transaction as paid.

------------------------------------------------------------------------

# 16. RBAC

Permission hierarchy:

``` text
ROLE
 ↓
MODULE
 ↓
ACTION
 ↓
PERMISSION
```

Examples of actions:

``` text
view
create
edit
delete
confirm
reject
prepare
ready
serve
pay
void
refund
configure
audit
```

Backend authorization is mandatory.

------------------------------------------------------------------------

# 17. AUDIT

Audit required for sensitive actions such as:

-   state exceptions
-   void
-   refund
-   permission changes
-   role changes
-   critical settings changes
-   administrative changes

Conceptual record:

``` text
entityId
action
fromState
toState
actorId
actorRole
reason
createdAt
```

------------------------------------------------------------------------

# 18. SECURITY

Frontend is not authoritative for:

-   price
-   total
-   discount
-   tax
-   table identity
-   role
-   permission
-   payment state
-   order state

Secrets must not be exposed in public frontend code or committed to Git.

------------------------------------------------------------------------

# 19. REALTIME

Realtime is required where operational freshness materially affects
workflow:

-   Cashier order queue
-   KDS
-   Waiter ready queue
-   Service requests
-   Customer order status
-   relevant table status

Connection failure must be visible.

Do not present stale data as confirmed realtime state.

------------------------------------------------------------------------

# 20. UI STATES

Core states are frozen as required patterns:

``` text
Loading
Success
Error
Empty
Disabled
Permission Denied
Connection Lost
Conflict
```

Every important asynchronous action must provide appropriate feedback.

------------------------------------------------------------------------

# 21. RESPONSIVE TARGETS

Customer:

``` text
Mobile-first
320px+
```

Waiter:

``` text
Mobile / Tablet
```

KDS:

``` text
Tablet / Desktop
Fullscreen operational
```

POS:

``` text
Desktop-first
```

Admin:

``` text
Desktop-first
Tablet support
```

Homepage:

``` text
Mobile
Tablet
Desktop
```

------------------------------------------------------------------------

# 22. PUBLIC HOMEPAGE BOUNDARY

Public production homepage is customer-facing.

It must not expose internal demos or simulated operational workflows.

Remove from production:

-   POS demo
-   KDS demo
-   Waiter demo
-   simulated payment
-   simulated workflow
-   localStorage operational state

------------------------------------------------------------------------

# 23. EXPLICITLY OUT OF MVP

The following remain later phases unless separately approved:

-   full inventory
-   recipe/BOM
-   COGS/costing
-   supplier purchasing
-   full accounting
-   CRM
-   loyalty
-   complex reservation
-   multi-branch
-   AI operational features

------------------------------------------------------------------------

# 24. DESIGN BASELINE

The following remains authoritative:

``` text
/docs/TepiSawah_Master_Design_System_v1.0.md
```

The visual language applies across modules, while layout may differ by
operational context.

Homepage may remain editorial/photographic.

Internal applications remain operational/information-dense.

------------------------------------------------------------------------

# 25. ARCHITECTURE GATE

Design Freeze is complete for the purposes of architecture planning.

Next required artifacts:

``` text
Technical Architecture
Database Schema
API Contract
Authentication Architecture
RBAC Architecture
Realtime Architecture
QR/Table Architecture
Payment Integration Boundary
Environment & Secrets Strategy
Deployment Architecture
Repository Structure
```

------------------------------------------------------------------------

# 26. CHANGE CONTROL

Any requested change should be classified:

### A. Visual-only

May update design without changing business logic.

### B. UX behavior

Requires workflow review.

### C. Business rule

Requires product approval.

### D. State transition

Requires state-machine review.

### E. Data model

Requires schema/API review.

### F. Security/RBAC

Requires security review.

### G. Scope expansion

Requires phase/scope approval.

------------------------------------------------------------------------

# 27. FINAL FREEZE STATEMENT

The Tepi Sawah MVP is now frozen at the **product/UX level** for the
purpose of creating the technical architecture.

The next task is not another Stitch exploration.

The next task is:

> **TECHNICAL ARCHITECTURE v1.0**

Architecture must implement the frozen product behavior without silently
changing it.
