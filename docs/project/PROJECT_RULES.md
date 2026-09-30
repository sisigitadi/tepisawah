# TEPI SAWAH

# PROJECT_RULES.md

## Cline Development Rules v1.0

**Project:** Tepi Sawah Resto & Cafe\
**Purpose:** Aturan utama untuk Cline/AI coding agent selama
implementasi aplikasi Tepi Sawah.\
**Status:** Draft untuk Design Freeze → Implementation\
**Source of Truth:** Product Definition Pack + Master Design System +
keputusan produk yang telah disepakati.

------------------------------------------------------------------------

# 1. ROLE OF CLINE

Cline bertindak sebagai:

-   Senior Frontend Engineer
-   Senior Fullstack Engineer
-   UI Engineer
-   Integration Engineer
-   QA-minded implementation agent

Cline wajib mengutamakan:

1.  correctness
2.  security
3.  consistency
4.  maintainability
5.  usability
6.  performance
7.  scope control

Jangan mengubah product scope hanya karena sebuah fitur terlihat mudah
untuk ditambahkan.

------------------------------------------------------------------------

# 2. SOURCE OF TRUTH HIERARCHY

Jika terjadi konflik informasi, gunakan urutan berikut:

``` text
1. Approved Product Requirements
2. Approved Order/Permission Rules
3. Master Design System
4. Approved Stitch Visuals
5. Technical Architecture
6. Existing implementation
7. Developer assumption
```

Jika informasi tidak tersedia:

> DO NOT INVENT.

Tandai kebutuhan tersebut sebagai unresolved requirement dan minta
keputusan jika keputusan tersebut memengaruhi data, security, workflow,
atau business rule.

------------------------------------------------------------------------

# 3. PROJECT SCOPE

Core system:

``` text
Public Homepage
Customer QR Ordering
Cashier POS
Kitchen Display System
Waiter Service
Admin Management
Authentication
RBAC
Audit Log
Table Management
QR Table Management
Real-time operational updates where required
```

Core order flow:

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

Exception states:

``` text
CANCELLED
REJECTED
VOID
REFUNDED
```

Do not introduce full inventory, accounting, CRM, loyalty, reservation
complexity, multi-branch, or AI features unless explicitly approved as a
later phase.

------------------------------------------------------------------------

# 4. DESIGN SYSTEM COMPLIANCE

The file:

``` text
/docs/TepiSawah_Master_Design_System_v1.0.md
```

is the primary visual reference.

Cline MUST:

-   reuse design tokens
-   reuse shared components
-   maintain brand colors
-   maintain typography hierarchy
-   maintain spacing system
-   maintain radius system
-   maintain status semantics
-   maintain responsive behavior
-   implement loading, empty, error, and permission states

Cline MUST NOT:

-   introduce arbitrary colors
-   introduce arbitrary font families
-   create inconsistent button styles
-   create different status colors for the same semantic state
-   duplicate components unnecessarily
-   redesign a module without an approved requirement

------------------------------------------------------------------------

# 5. BRAND TOKENS

Baseline brand colors:

``` text
forest       #2E6B34
deepmoss     #183A1D
golden       #DDA15E
amberwarm    #F3C644
warmcream    #FEFAE0
ricepaper    #F8F4DB
roastedearth #3D1F10
coffeebrown  #6F3F24
```

Typography baseline:

``` text
Display / editorial: Playfair Display
UI / body: Inter
```

Use semantic tokens in code instead of hardcoding the same values
repeatedly.

Example conceptual structure:

``` text
--color-forest
--color-deepmoss
--color-golden
--color-warmcream
--color-ricepaper
...
```

------------------------------------------------------------------------

# 6. COMPONENT-FIRST DEVELOPMENT

Before creating a new UI element:

1.  Check whether a shared component already exists.
2.  Reuse it if possible.
3.  Extend it only when the new behavior is genuinely shared.
4.  Create a new component only when there is a clear reusable or
    module-specific reason.

Shared components should include, where applicable:

``` text
Button
Input
Textarea
Select
Combobox
Search
Filter
Tabs
Card
Table
Badge
Modal
Drawer
Dropdown
Toast
Alert
Pagination
Skeleton
EmptyState
ErrorState
PermissionState
```

Operational components:

``` text
OrderCard
OrderStatusBadge
TableStatusBadge
PaymentStatusBadge
KitchenTicket
ServiceRequest
PermissionMatrix
AuditEvent
```

------------------------------------------------------------------------

# 7. ORDER STATE MACHINE

Allowed normal transitions:

``` text
DRAFT → SUBMITTED
SUBMITTED → PENDING_CONFIRMATION
PENDING_CONFIRMATION → CONFIRMED
CONFIRMED → PREPARING
PREPARING → READY
READY → SERVED
SERVED → PAID
PAID → COMPLETED
```

Exceptions:

``` text
PENDING_CONFIRMATION → REJECTED
CONFIRMED → CANCELLED*
PREPARING → CANCELLED*
PAID → REFUNDED*
```

`*` requires authorized permission, reason, and audit.

Rules:

-   no arbitrary backward transition
-   backend validates current state
-   backend validates requested state
-   backend validates actor role/permission
-   transition must be atomic
-   transition must be idempotent
-   frontend cannot force an unauthorized transition

Recall is an explicit exception action, not an implicit backward
transition.

------------------------------------------------------------------------

# 8. ACTOR RESPONSIBILITIES

Baseline responsibilities:

``` text
Customer / Waiter
DRAFT → SUBMITTED

System
SUBMITTED → PENDING_CONFIRMATION

Cashier / Authorized Staff
PENDING_CONFIRMATION → CONFIRMED
PENDING_CONFIRMATION → REJECTED

Kitchen
CONFIRMED → PREPARING
PREPARING → READY

Waiter
READY → SERVED

Cashier
SERVED → PAID

System / Cashier
PAID → COMPLETED
```

Sensitive exceptions require authorized roles.

------------------------------------------------------------------------

# 9. BACKEND IS THE AUTHORITY

Never trust client-provided:

-   price
-   subtotal
-   total
-   discount amount
-   tax amount
-   payment status
-   table identity
-   role
-   permission
-   order status
-   user identity
-   inventory quantity

The server must derive or validate authoritative values.

The frontend is a presentation and interaction layer, not the
business-rule authority.

------------------------------------------------------------------------

# 10. PRODUCT PRICE INTEGRITY

When an order is created:

-   validate product ID
-   retrieve authoritative current product data
-   validate availability
-   calculate authoritative price
-   calculate modifiers
-   calculate discount according to configured rules
-   calculate total server-side

Historical order items must store snapshots of relevant product
information.

Later menu changes must not rewrite historical transactions.

------------------------------------------------------------------------

# 11. TABLE & QR RULES

QR table identity may be encoded in the customer ordering URL.

Example:

``` text
order.tepisawah.id/?table=A12
```

If a valid QR contains the table identity:

-   do not unnecessarily ask the customer to enter the table manually
-   validate table identity server-side
-   validate table availability/status according to business rules

Do not trust a client-modified table ID.

------------------------------------------------------------------------

# 12. TABLE STATUS VS ORDER STATUS

These are different domains.

Do not implement:

``` text
table.status = order.status
```

A table may have its own operational state.

The UI must not infer one status directly from another unless the
approved business rule explicitly requires it.

------------------------------------------------------------------------

# 13. PAYMENT RULES

Payment is a separate domain.

Baseline payment states:

``` text
PENDING
PAID
FAILED
EXPIRED
CANCELLED
```

Supported methods may include:

``` text
Tunai
QRIS
Debit
Credit Card
E-Wallet
Transfer when configured
```

Do not mark an order as paid solely because the frontend clicked a
payment button.

Payment confirmation must be authoritative.

KDS should not expose unnecessary financial information.

------------------------------------------------------------------------

# 14. RBAC

Permission model:

``` text
ROLE
 ↓
MODULE
 ↓
ACTION
 ↓
PERMISSION
```

Example actions:

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
manage
configure
audit
```

Rules:

-   frontend may hide unavailable actions
-   backend MUST enforce authorization
-   never rely on hidden buttons for security
-   sensitive actions require explicit permission
-   permission changes must be auditable

------------------------------------------------------------------------

# 15. AUDIT LOG

Audit sensitive actions.

Minimum conceptual record:

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

Sensitive events include:

-   order state exception
-   void
-   refund
-   permission changes
-   user role changes
-   critical configuration changes
-   administrative changes

Audit records should be append-oriented and protected from ordinary
modification.

------------------------------------------------------------------------

# 16. IDEMPOTENCY & DUPLICATE PROTECTION

Sensitive operations must tolerate retries.

Examples:

-   submit order
-   confirm order
-   payment
-   refund
-   status transition
-   service request

Do not create duplicate records because a user double-clicked or a
network request was retried.

Use an idempotency key or equivalent server-side strategy where
appropriate.

------------------------------------------------------------------------

# 17. CONCURRENCY

Assume multiple staff may operate on the same order/table.

Example:

``` text
Cashier sees PENDING_CONFIRMATION
Kitchen cannot independently change it to PREPARING
unless CONFIRMED has been persisted.
```

The backend must reject stale transitions.

Frontend should refresh/reconcile when a conflict occurs.

Do not silently overwrite another user's update.

------------------------------------------------------------------------

# 18. REAL-TIME BEHAVIOR

Real-time updates are important for:

``` text
Customer Order Status
Cashier Order Queue
KDS
Waiter Ready Queue
Service Requests
Table Status
```

If real-time infrastructure is unavailable:

-   show connection state
-   provide safe refresh/retry behavior
-   do not pretend data is real-time

Never display stale information as if it were confirmed current state.

------------------------------------------------------------------------

# 19. KDS RULES

KDS primary workflow:

``` text
CONFIRMED → PREPARING → READY
```

KDS should prioritize:

-   order ID
-   table
-   elapsed time
-   item
-   quantity
-   notes
-   action

KDS should not become a payment interface.

Timer source:

``` text
backend timestamp
```

Do not invent SLA thresholds.

Warning/critical thresholds must be configurable if introduced.

------------------------------------------------------------------------

# 20. WAITER RULES

Waiter prioritizes:

-   table status
-   ready food
-   service requests
-   call waiter
-   request bill
-   serving
-   manual order creation

Waiter does not perform kitchen or payment transitions unless the
approved permission model explicitly allows it.

------------------------------------------------------------------------

# 21. CUSTOMER QR RULES

Customer flow:

``` text
SCAN QR
→ WELCOME
→ MENU
→ PRODUCT
→ CUSTOMIZE
→ CART
→ CONFIRM
→ ORDER STATUS
```

MVP should not require customer account registration unless explicitly
approved.

Provide appropriate states:

``` text
loading
empty
invalid QR
closed
error
success
connection issue
duplicate submission
```

------------------------------------------------------------------------

# 22. ADMIN RULES

Admin manages configuration and governance.

Baseline areas:

``` text
Menu/Product Catalog
Categories
Modifiers
Tables
QR
Users
Roles
Permissions
Restaurant Settings
Operating Hours
Ordering Settings
Payment Settings
Kitchen Settings
Waiter/Service Settings
Notifications
Audit Log
```

Admin is not automatically:

``` text
POS
KDS
Waiter
Accounting
Inventory
CRM
```

unless the scope explicitly changes.

------------------------------------------------------------------------

# 23. MENU SOURCE OF TRUTH

Menu/product data must be centralized.

The same authoritative product source should feed:

``` text
Customer
POS
Waiter
KDS
Admin
```

Do not create independent hard-coded product catalogs in each frontend.

------------------------------------------------------------------------

# 24. UI STATE REQUIREMENTS

Every important asynchronous interaction should support:

``` text
Idle
Loading
Success
Error
Empty
Disabled
Permission denied
Connection lost
Conflict
```

For destructive actions:

``` text
Intent
→ Confirmation
→ Processing
→ Result
```

Do not leave the user uncertain whether an action succeeded.

------------------------------------------------------------------------

# 25. RESPONSIVE REQUIREMENTS

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
Fullscreen operational layout
```

POS:

``` text
Desktop-first
```

Admin:

``` text
Desktop-first
Responsive tablet support
```

Public website:

``` text
Mobile
Tablet
Desktop
```

Do not solve responsiveness by simply shrinking desktop layouts.

------------------------------------------------------------------------

# 26. ACCESSIBILITY

Minimum requirements:

-   keyboard navigation where relevant
-   visible focus
-   sufficient contrast
-   semantic labels
-   touch-friendly controls
-   status not communicated by color alone
-   accessible form validation
-   meaningful button labels
-   icons accompanied by text when the action is critical

------------------------------------------------------------------------

# 27. SECURITY

Never commit:

-   API keys
-   passwords
-   tokens
-   service account credentials
-   private keys
-   database secrets

Use environment variables or secure server-side configuration.

Do not expose privileged API credentials in public frontend code.

Validate and sanitize server-side inputs.

Apply least privilege.

------------------------------------------------------------------------

# 28. DATA VALIDATION

Validate at the boundary.

Examples:

``` text
API request
Form submission
Order creation
Payment
Permission change
User creation
Product update
Table assignment
```

Client-side validation improves UX.

Server-side validation provides authority.

Both are required where appropriate.

------------------------------------------------------------------------

# 29. ERROR HANDLING

Errors must be:

-   understandable
-   actionable
-   non-destructive
-   logged appropriately
-   safe to expose to the user

Do not expose:

-   stack traces
-   secrets
-   internal infrastructure details
-   database credentials
-   sensitive implementation details

------------------------------------------------------------------------

# 30. PERFORMANCE

Prioritize:

-   fast initial render
-   optimized images
-   lazy loading where appropriate
-   minimal unnecessary requests
-   efficient list rendering
-   pagination for large datasets
-   debounced search
-   sensible caching
-   avoiding unnecessary re-renders

Do not optimize prematurely at the cost of correctness.

------------------------------------------------------------------------

# 31. CODE ORGANIZATION

Prefer modular architecture.

Conceptual structure:

``` text
src/
├── app/
├── components/
│   ├── ui/
│   ├── forms/
│   ├── operational/
│   └── domain/
├── features/
│   ├── customer/
│   ├── pos/
│   ├── kitchen/
│   ├── waiter/
│   └── admin/
├── services/
├── hooks/
├── utils/
├── types/
├── config/
└── styles/
```

Actual framework structure may differ according to the approved
technical architecture.

Do not create the architecture before the technical stack is approved.

------------------------------------------------------------------------

# 32. NO DUPLICATED BUSINESS LOGIC

Business logic must not be independently reimplemented in:

``` text
Customer frontend
POS frontend
Waiter frontend
KDS frontend
Admin frontend
```

Shared business rules belong in the appropriate backend/service/domain
layer.

Frontend may provide presentation-specific behavior.

------------------------------------------------------------------------

# 33. NO MOCK DATA IN PRODUCTION

Mock/demo data is acceptable only when explicitly working on a
prototype.

Before production:

-   remove fake transactions
-   remove simulated payment success
-   remove fake order progression
-   remove fake dashboard metrics
-   remove localStorage-based production state
-   remove hard-coded demo credentials
-   remove fake notifications

Production UI must consume actual backend data.

------------------------------------------------------------------------

# 34. PUBLIC HOMEPAGE

The production homepage must not expose internal operational workflows.

Remove from production public UI:

-   POS demo
-   KDS demo
-   Waiter demo
-   simulated payment
-   internal workflow simulation
-   localStorage operational demo

Public homepage should focus on:

``` text
Brand
Restaurant Experience
Menu
Promo
QR Ordering
Reservation
Gallery
Location
Opening Status
```

------------------------------------------------------------------------

# 35. DEVELOPMENT SCOPE CONTROL

Before adding a feature, ask:

1.  Is it in approved scope?
2.  Is it required for the current phase?
3.  Does it affect database schema?
4.  Does it affect permissions?
5.  Does it affect order/payment state?
6.  Does it affect existing UX?
7.  Does it require new infrastructure?

If yes to material architectural impact, stop and request approval
before implementation.

------------------------------------------------------------------------

# 36. GIT RULES

Use small, understandable commits.

Recommended examples:

``` text
feat: add customer menu screen
feat: add order confirmation flow
feat: add cashier order queue
feat: add KDS ticket component
feat: add waiter service board
feat: add admin menu management

fix: prevent duplicate order submission
fix: validate order transition
fix: correct table QR parsing

refactor: centralize status badges
refactor: extract shared button component
```

Avoid commits such as:

``` text
update
fix stuff
changes
final
final2
new version
```

Do not mix unrelated features in one commit.

------------------------------------------------------------------------

# 37. TESTING REQUIREMENTS

Before considering a feature complete:

### Functional

-   happy path
-   invalid input
-   empty state
-   error state
-   permission denied
-   duplicate action
-   refresh
-   network failure where relevant

### Security

-   unauthorized API request
-   role mismatch
-   manipulated ID
-   manipulated price
-   manipulated status
-   replayed request

### Responsive

-   mobile
-   tablet
-   desktop

### Regression

-   existing core flow still works

------------------------------------------------------------------------

# 38. DEFINITION OF DONE

A feature is not done merely because the UI renders.

It is done when:

``` text
UI implemented
+
Responsive
+
Loading state
+
Empty state
+
Error state
+
Permission behavior
+
Validation
+
Backend authority
+
Duplicate protection
+
Audit where required
+
Tests
+
No console errors
+
No secrets
+
Git commit
```

------------------------------------------------------------------------

# 39. CLINE WORKING METHOD

For every task:

``` text
1. Read relevant rules
2. Inspect existing code
3. Identify reusable components
4. Identify affected domain/state
5. Plan minimal changes
6. Implement
7. Run validation/tests
8. Review security
9. Review responsive behavior
10. Review design-system compliance
11. Report changes
```

Do not blindly rewrite existing working code.

Do not modify unrelated modules.

------------------------------------------------------------------------

# 40. STOP CONDITIONS

Cline must stop and ask for clarification when:

-   requirement conflicts with approved business rule
-   order state transition is ambiguous
-   payment behavior is ambiguous
-   permission model is ambiguous
-   data ownership is ambiguous
-   security boundary is unclear
-   destructive behavior is unspecified
-   a new feature materially expands scope
-   implementation requires an unapproved external service
-   a design conflict cannot be resolved from the source of truth

Do not guess on high-impact decisions.

------------------------------------------------------------------------

# 41. FINAL PRINCIPLE

The implementation must preserve this chain:

``` text
PRODUCT REQUIREMENT
        ↓
DESIGN SYSTEM
        ↓
USER FLOW
        ↓
STATE MACHINE
        ↓
BACKEND AUTHORITY
        ↓
UI IMPLEMENTATION
        ↓
TESTING
        ↓
DEPLOYMENT
```

The UI is not the business rule.

The frontend is not the source of truth.

The client is not trusted.

The design is not the database.

The database is not permission enforcement.

Each layer must have a clear responsibility.

------------------------------------------------------------------------

# 42. CURRENT IMPLEMENTATION GATE

Current status:

``` text
Stitch Visual Exploration       ✓
Core Module Designs             ✓
Admin Visual Review             ✓
Master Design System            ✓
PROJECT_RULES.md                ✓
Design Freeze                   → NEXT
Technical Architecture          → AFTER DESIGN FREEZE
Database/API Contract           → AFTER ARCHITECTURE
GitHub Implementation           → AFTER ARCHITECTURE
Cline Coding                    → AFTER APPROVED ARCHITECTURE
Production QA                   → AFTER IMPLEMENTATION
Deployment                      → FINAL
```

**Do not begin production coding until Design Freeze and Technical
Architecture are approved.**
