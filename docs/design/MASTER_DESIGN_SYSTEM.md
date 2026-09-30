# TEPI SAWAH

## MASTER DESIGN SYSTEM v1.0

### Design Consolidation Specification

**Status:** Design Consolidation\
**Basis:** Google Stitch visual outputs provided by the project owner +
existing Tepi Sawah homepage visual baseline\
**Purpose:** Menjadi satu sumber aturan visual dan UX untuk implementasi
Cline/frontend.

------------------------------------------------------------------------

## 1. Design Status

Desain visual utama yang telah direpresentasikan di Stitch mencakup:

1.  Public Homepage
2.  Customer / QR Ordering
3.  POS Terminal
4.  Operational Dashboard
5.  Table Management
6.  Order Pipeline
7.  Kitchen Display System
8.  Waiter Service
9.  Admin Management

Tahap berikutnya adalah konsolidasi, bukan membuat ulang seluruh desain.

**Design Freeze belum dinyatakan final** sampai detail component states,
responsive behavior, accessibility, dan implementasi teknis divalidasi.

------------------------------------------------------------------------

# 2. Brand & Visual Direction

## 2.1 Brand Character

Visual Tepi Sawah harus mempertahankan karakter:

-   natural
-   warm
-   Indonesian/Sundanese restaurant
-   approachable
-   operationally clear
-   modern tetapi tidak terasa seperti SaaS generik
-   editorial pada public website
-   functional pada internal applications

## 2.2 Visual Principle

> Natural hospitality outside. Operational clarity inside.

Homepage boleh lebih photographic/editorial. POS, KDS, Waiter, dan Admin
harus lebih operational.

Keduanya tetap menggunakan brand DNA dan design tokens yang sama.

------------------------------------------------------------------------

# 3. Color System

Warna berikut merupakan baseline yang sudah digunakan pada homepage Tepi
Sawah:

  Token            Value       Usage
  ---------------- ----------- -------------------------------------
  `forest`         `#2E6B34`   Primary action, navigation emphasis
  `deepmoss`       `#183A1D`   Dark brand surface, strong text
  `golden`         `#DDA15E`   Accent, highlight
  `amberwarm`      `#F3C644`   Warm accent / attention
  `warmcream`      `#FEFAE0`   Primary light background
  `ricepaper`      `#F8F4DB`   Secondary surface
  `roastedearth`   `#3D1F10`   Dark earth/brown accent
  `coffeebrown`    `#6F3F24`   Coffee/earth accent

### Important

Do not introduce arbitrary new brand colors.

Additional semantic colors may be used only where required for system
states such as success, warning, error, and informational states. Their
exact production token values must be standardized during implementation
rather than independently chosen per module.

------------------------------------------------------------------------

# 4. Typography

Homepage baseline:

-   Display / editorial heading: **Playfair Display**
-   UI/body: **Inter**

Rules:

-   Public-facing large headings may use Playfair Display.
-   Internal operational interfaces should prioritize Inter for
    readability and information density.
-   Do not introduce additional font families without explicit
    design-system approval.
-   Numeric operational data must prioritize legibility.

Hierarchy:

``` text
Display
H1
H2
H3
H4
Body Large
Body
Body Small
Caption
Label
Numeric KPI
```

Exact production font sizes should be implemented as shared tokens, not
individually invented per screen.

------------------------------------------------------------------------

# 5. Spacing System

Use a consistent spacing scale.

Recommended base:

``` text
4
8
12
16
20
24
32
40
48
64
80
```

Rules:

-   4/8: micro spacing
-   12/16: component internal spacing
-   20/24: card and section spacing
-   32+: major layout separation
-   48/64+: page-level sections

Do not manually introduce arbitrary spacing values unless required by a
specific visual constraint.

------------------------------------------------------------------------

# 6. Radius

Use a restrained rounded system.

``` text
sm   = small controls
md   = inputs/buttons
lg   = cards/panels
xl   = major surfaces / hero cards
```

Avoid excessive pill-shaped UI.

Pills should primarily be used for:

-   status
-   tags
-   filters
-   compact metadata

------------------------------------------------------------------------

# 7. Elevation

Use subtle elevation.

Priority:

1.  surface separation
2.  border
3.  light shadow

Avoid heavy floating-card shadows throughout internal applications.

Operational screens should remain visually calm and information-dense.

------------------------------------------------------------------------

# 8. Layout System

## Public Website

-   full-width sections
-   large visual areas
-   editorial composition
-   responsive mobile-first behavior
-   photography as major visual element

## Internal Applications

Standard structure:

``` text
┌─────────────────────────────────────┐
│ Header / Top Bar                    │
├────────────┬────────────────────────┤
│ Sidebar    │ Main Content            │
│            │                         │
│ Navigation │ Page Header             │
│            │ Filters / Actions       │
│            │ Content                 │
│            │                         │
└────────────┴────────────────────────┘
```

KDS may intentionally use a fullscreen operational layout without a
conventional sidebar.

Customer QR ordering should prioritize mobile navigation and task
completion.

------------------------------------------------------------------------

# 9. Navigation

Internal navigation must remain consistent across:

-   POS
-   Operational Dashboard
-   Table Management
-   Order Pipeline
-   Waiter
-   Admin

Navigation rules:

-   active module clearly visible
-   current page clearly identified
-   destructive actions never hidden ambiguously
-   role-based navigation must hide inaccessible modules
-   frontend visibility is not a security boundary; backend
    authorization remains mandatory

------------------------------------------------------------------------

# 10. Buttons

Primary:

-   forest green
-   high contrast
-   clear action verb

Secondary:

-   neutral/light surface
-   border or subtle background

Destructive:

-   semantic danger treatment
-   requires confirmation where data/state can be lost

Examples:

``` text
Tambah Produk
Simpan
Konfirmasi
Bayar
Mulai Masak
Sajikan
Panggil Waiter
Tolak Pesanan
Void
Refund
```

Avoid vague actions such as:

``` text
OK
Process
Action
Submit
```

when a more specific verb is available.

------------------------------------------------------------------------

# 11. Form Components

Shared components:

-   Input
-   Textarea
-   Select
-   Combobox
-   Date picker
-   Time picker
-   Checkbox
-   Radio
-   Toggle
-   File/image upload
-   Search
-   Filter

Rules:

-   label always visible for critical operational fields
-   validation message near the affected field
-   preserve user input when validation fails
-   distinguish disabled from read-only
-   loading state must be visible during asynchronous operations

------------------------------------------------------------------------

# 12. Tables & Data Grids

Used heavily by:

-   Admin
-   User Management
-   Menu
-   Audit Log
-   Transaction History
-   Order Pipeline

Required behavior:

-   readable columns
-   horizontal scrolling where required
-   search/filter
-   pagination when dataset grows
-   row actions
-   status badge
-   empty state
-   loading state
-   error state

Do not overload a table with every possible field.

Prioritize the fields required for the current task.

------------------------------------------------------------------------

# 13. Status System

Order status is shared across the ecosystem.

``` text
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

Exception statuses:

``` text
CANCELLED
REJECTED
VOID
REFUNDED
```

The visual representation of the same status must remain consistent
across POS, KDS, Waiter, Customer, and Admin.

Example:

``` text
CONFIRMED
  POS       → same semantic treatment
  KDS       → same semantic treatment
  WAITER    → same semantic treatment
  CUSTOMER  → same semantic treatment
```

Do not assign different meanings to the same color in different modules.

------------------------------------------------------------------------

# 14. Operational Status

Table status is separate from order status.

Do not infer:

``` text
TABLE STATUS = ORDER STATUS
```

A table may have:

``` text
AVAILABLE
OCCUPIED
WAITING_SERVICE
WAITING_PAYMENT
CLEANING
```

The final production vocabulary must follow the approved product model.

------------------------------------------------------------------------

# 15. Payment Status

Payment status is separate from order status.

Baseline:

``` text
PENDING
PAID
FAILED
EXPIRED
CANCELLED
```

Payment method examples from the product requirements:

-   Tunai
-   QRIS
-   Debit
-   Credit Card
-   E-Wallet
-   Transfer when configured

Payment data must not be exposed to KDS unless explicitly required for
an operational reason.

------------------------------------------------------------------------

# 16. Kitchen UI Rules

KDS is optimized for speed and visibility.

Priority:

``` text
Order ID
Table
Elapsed Time
Items
Quantity
Notes
Action
```

Kitchen UI should not display unnecessary financial information.

Primary kitchen transitions:

``` text
CONFIRMED → PREPARING → READY
```

Timers must use backend timestamps.

Do not hard-code SLA thresholds unless configured by the system.

------------------------------------------------------------------------

# 17. Waiter UI Rules

Waiter interface prioritizes:

-   table status
-   ready orders
-   service requests
-   call waiter
-   request bill
-   serve action
-   manual order

Waiter must not perform kitchen or payment transitions unless explicitly
authorized by the product permission model.

------------------------------------------------------------------------

# 18. Customer QR Ordering Rules

Customer flow:

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
ORDER STATUS
```

QR may carry the table identity.

Example:

``` text
order.tepisawah.id/?table=A12
```

The customer should not be required to manually enter a table number
when the QR already provides it.

------------------------------------------------------------------------

# 19. Admin Design Rules

Admin is the configuration and governance center.

Primary areas represented in the Stitch design:

-   Menu/Product Catalog
-   Table Management
-   Digital QR
-   Dashboard/Operational Overview
-   User Management
-   Role & Permission
-   System Settings
-   Security Audit Trail

Admin must not become a replacement for:

-   POS
-   KDS
-   Waiter Service
-   full accounting
-   full inventory

unless explicitly added to the product scope later.

------------------------------------------------------------------------

# 20. RBAC UX

Permission structure should conceptually follow:

``` text
ROLE
  ↓
MODULE
  ↓
ACTION
  ↓
PERMISSION
```

Example:

``` text
Cashier
 ├─ Orders
 │   ├─ View
 │   ├─ Confirm
 │   └─ Reject
 │
 ├─ Payment
 │   ├─ View
 │   └─ Process
 │
 └─ Settings
     └─ No access
```

The UI may hide unavailable actions, but backend authorization remains
authoritative.

------------------------------------------------------------------------

# 21. Audit Trail

Administrative and sensitive operational actions should be auditable.

Minimum conceptual event:

``` text
orderId / entityId
fromState
toState
actorId
actorRole
action
reason
createdAt
```

Audit UI should prioritize:

-   who
-   what
-   when
-   target
-   previous state
-   new state
-   reason when applicable

------------------------------------------------------------------------

# 22. Modal & Confirmation Rules

Use confirmation dialogs for:

-   reject
-   void
-   refund
-   delete
-   deactivate
-   permission changes
-   destructive configuration changes

Do not use confirmation dialogs for routine actions that are easily
reversible.

Where a reason is required, collect it explicitly.

------------------------------------------------------------------------

# 23. Toast / Notification

Use toast for:

-   successful save
-   successful status transition
-   successful configuration update
-   non-blocking informational feedback

Use alert/banner for:

-   system-wide warning
-   connection problem
-   permission issue
-   critical operational state

Do not rely only on color.

------------------------------------------------------------------------

# 24. Loading / Empty / Error States

Every major module must define:

### Loading

Skeleton or explicit loading state.

### Empty

Explain:

-   what is empty
-   why
-   what the user can do next

### Error

Explain:

-   what failed
-   whether retry is possible
-   what action the user can take

### Permission

Explain that the user does not have permission without exposing
unnecessary security details.

------------------------------------------------------------------------

# 25. Responsive Rules

## Mobile

Primary users:

-   customer
-   waiter

Priorities:

-   touch targets
-   sticky actions
-   minimal navigation
-   readable cards
-   bottom-sheet/modal where appropriate

## Tablet

Primary users:

-   waiter
-   kitchen
-   some POS workflows

## Desktop

Primary users:

-   cashier
-   admin
-   supervisor
-   owner

Target design references from Stitch should remain responsive rather
than being treated as fixed screenshots.

------------------------------------------------------------------------

# 26. Accessibility

Minimum rules:

-   sufficient contrast
-   visible focus state
-   keyboard navigation for desktop systems
-   touch targets suitable for tablets/mobile
-   semantic labels
-   status cannot be communicated by color alone
-   form errors associated with fields
-   icons should not be the only explanation for critical actions

------------------------------------------------------------------------

# 27. Image Rules

Public website:

-   restaurant photography is a major brand element
-   preserve authentic visual character
-   avoid generic stock imagery when real project imagery is available

Internal systems:

-   use imagery sparingly
-   prioritize operational information

Product images should come from the centralized menu/product source.

------------------------------------------------------------------------

# 28. Cross-Module Consistency Matrix

  Component          Homepage   Customer   POS   KDS   Waiter    Admin
  ---------------- ---------- ---------- ----- ----- -------- --------
  Brand Colors              ✓          ✓     ✓     ✓        ✓        ✓
  Typography                ✓          ✓     ✓     ✓        ✓        ✓
  Button System             ✓          ✓     ✓     ✓        ✓        ✓
  Status System           ---          ✓     ✓     ✓        ✓        ✓
  Product Data              ✓          ✓     ✓     ✓        ✓        ✓
  Table Identity          ---          ✓     ✓     ✓        ✓        ✓
  Order State             ---          ✓     ✓     ✓        ✓        ✓
  Payment                 ---    limited     ✓   ---      ---   config
  RBAC                    ---        ---     ✓     ✓        ✓        ✓
  Audit                   ---        ---     ✓     ✓        ✓        ✓

------------------------------------------------------------------------

# 29. Source of Truth Rules

Frontend must not become the authoritative source for:

-   price
-   order total
-   table identity
-   permissions
-   payment state
-   order state
-   user role
-   inventory quantity

These must be validated/enforced by the backend.

Menu/product data must have one centralized source of truth.

Historical orders must preserve product snapshots so later menu changes
do not rewrite historical transactions.

------------------------------------------------------------------------

# 30. Cline Implementation Rules

Cline must:

1.  Treat this document as the visual baseline.
2.  Reuse shared components.
3.  Avoid creating one-off components when an existing component fits.
4.  Avoid arbitrary colors.
5.  Avoid arbitrary typography.
6.  Avoid arbitrary spacing.
7.  Keep semantic status treatment centralized.
8.  Keep RBAC enforcement server-side.
9.  Validate all state transitions server-side.
10. Never trust client-side prices or totals.
11. Make sensitive transitions idempotent.
12. Preserve auditability.
13. Keep responsive behavior explicit.
14. Implement loading, empty, error, and permission states.
15. Do not add product scope without an approved requirement.

------------------------------------------------------------------------

# 31. Definition of Design Freeze

Design Freeze dapat dinyatakan setelah:

-   all six core modules reviewed
-   shared tokens finalized
-   shared components identified
-   status semantics finalized
-   responsive rules finalized
-   permission UX validated
-   error/loading/empty states defined
-   no unresolved visual conflicts remain
-   implementation architecture agrees with the design

------------------------------------------------------------------------

# 32. Current Project State

``` text
VISUAL EXPLORATION       ✓
STITCH MODULE DESIGNS    ✓
ADMIN VISUAL REVIEW      ✓
CROSS-MODULE REVIEW      → CURRENT
MASTER DESIGN SYSTEM     → THIS DOCUMENT
DESIGN FREEZE            → NEXT
TECHNICAL ARCHITECTURE   → AFTER FREEZE
CLINE IMPLEMENTATION     → AFTER ARCHITECTURE
```

------------------------------------------------------------------------

## Important Implementation Note

This document consolidates observed visual direction and previously
established product rules.

Where the Stitch screenshots do not expose an exact numeric token or
component state, the value is intentionally not fabricated. Such values
should be finalized from the actual Stitch component specifications or
during implementation validation.
