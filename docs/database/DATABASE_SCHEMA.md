# TEPI SAWAH

# DATABASE SCHEMA v1.0

**Status:** Proposed MVP Schema\
**Database:** PostgreSQL\
**Basis:** Technical Architecture v1.0 + Design Freeze v1.0 +
PROJECT_RULES.md\
**Purpose:** Menjadi blueprint database sebelum API Contract dan
implementation.

------------------------------------------------------------------------

# 1. DATABASE PRINCIPLES

Database harus menjadi source of truth untuk:

-   users/identity reference
-   roles/permissions
-   restaurant configuration
-   categories/products/modifiers
-   tables/table sessions
-   orders/order items
-   order state
-   payments
-   service requests
-   notifications
-   audit events

Frontend tidak boleh menjadi source of truth.

------------------------------------------------------------------------

# 2. ENTITY OVERVIEW

``` text
auth.users
    │
    ▼
profiles
    │
    ├──────── user_roles ─────── roles
    │                              │
    │                         role_permissions
    │                              │
    │                         permissions
    │
    └──────── audit_logs

restaurant_settings
operating_hours

categories
    │
    ▼
products
    │
    └──── product_modifiers ─── modifiers

tables
    │
    ├──── table_qr
    │
    └──── table_sessions
               │
               ▼
             orders
               │
          ┌────┴─────────┐
          ▼              ▼
     order_items       payments
          │
          ▼
 order_item_modifiers

orders
   │
   ├── order_status_history
   │
   └── notifications

tables
   │
   └── service_requests

all sensitive domains
   │
   └── audit_logs
```

------------------------------------------------------------------------

# 3. NAMING CONVENTION

Use:

``` text
snake_case
plural table names
uuid primary keys
timestamptz timestamps
boolean is_/has_ prefix
```

Examples:

``` text
products
order_items
created_at
updated_at
is_active
```

Do not mix naming conventions.

------------------------------------------------------------------------

# 4. PRIMARY KEY

Default primary key:

``` sql
id uuid primary key
```

Generate IDs server-side/database-side.

Business-facing identifiers such as:

``` text
order_number
table_code
```

are separate from internal UUIDs.

------------------------------------------------------------------------

# 5. COMMON TIMESTAMP RULE

Operational tables should use:

``` text
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

State/history tables should record event time explicitly.

------------------------------------------------------------------------

# 6. IDENTITY

## 6.1 auth.users

Managed by Supabase Auth.

Do not duplicate authentication credentials in application tables.

------------------------------------------------------------------------

## 6.2 profiles

``` text
profiles
---------
id uuid PK
display_name text
phone text nullable
is_active boolean
created_at timestamptz
updated_at timestamptz
```

Relationship:

``` text
profiles.id → auth.users.id
```

Profile stores application-level user information.

------------------------------------------------------------------------

# 7. ROLES

## roles

``` text
roles
-----
id uuid PK
code text UNIQUE
name text
description text nullable
is_system boolean
created_at timestamptz
updated_at timestamptz
```

Baseline role codes:

``` text
OWNER
ADMIN
SUPERVISOR
CASHIER
KITCHEN
WAITER
```

Customer does not require an internal staff role for MVP.

------------------------------------------------------------------------

# 8. PERMISSIONS

## permissions

``` text
permissions
-----------
id uuid PK
code text UNIQUE
module text
action text
description text nullable
created_at timestamptz
```

Example permission codes:

``` text
orders.view
orders.confirm
orders.reject
orders.prepare
orders.ready
orders.serve
orders.pay
orders.void
orders.refund

products.view
products.create
products.edit
products.delete

tables.view
tables.manage

users.view
users.manage

roles.view
roles.manage

settings.view
settings.manage

audit.view
```

Exact permission list is finalized during API/RBAC specification.

------------------------------------------------------------------------

# 9. USER ROLES

## user_roles

``` text
user_roles
----------
user_id uuid FK profiles.id
role_id uuid FK roles.id
created_at timestamptz

PRIMARY KEY (user_id, role_id)
```

A user may have multiple roles if explicitly supported by the
authorization model.

------------------------------------------------------------------------

# 10. ROLE PERMISSIONS

## role_permissions

``` text
role_permissions
----------------
role_id uuid FK roles.id
permission_id uuid FK permissions.id
created_at timestamptz

PRIMARY KEY (role_id, permission_id)
```

------------------------------------------------------------------------

# 11. RESTAURANT SETTINGS

## restaurant_settings

For MVP, assume one restaurant configuration.

``` text
restaurant_settings
-------------------
id uuid PK
restaurant_name text
address text
phone text nullable
email text nullable
timezone text
currency text
logo_url text nullable
primary_color text nullable
created_at timestamptz
updated_at timestamptz
```

Important:

Do not invent operational values in production.

Actual address, phone, hours, tax settings, and payment configuration
must come from approved configuration.

------------------------------------------------------------------------

# 12. OPERATING HOURS

## operating_hours

``` text
operating_hours
---------------
id uuid PK
day_of_week smallint
is_closed boolean
open_time time nullable
close_time time nullable
created_at timestamptz
updated_at timestamptz
```

Constraint:

``` text
day_of_week ∈ 0..6
```

Multiple schedules per day should not be assumed unless explicitly
required.

------------------------------------------------------------------------

# 13. CATEGORIES

## categories

``` text
categories
----------
id uuid PK
name text
description text nullable
sort_order integer
is_active boolean
created_at timestamptz
updated_at timestamptz
```

Unique naming behavior should be finalized at API/business-rule level.

------------------------------------------------------------------------

# 14. PRODUCTS

## products

``` text
products
--------
id uuid PK
category_id uuid FK categories.id
name text
description text nullable
image_url text nullable
price numeric(12,2)
is_active boolean
is_available boolean
sort_order integer
created_at timestamptz
updated_at timestamptz
```

Rules:

-   price must be non-negative
-   category must exist
-   inactive products cannot be ordered
-   unavailable products cannot be ordered
-   frontend price is never authoritative

------------------------------------------------------------------------

# 15. MODIFIERS

## modifiers

``` text
modifiers
---------
id uuid PK
name text
description text nullable
price_delta numeric(12,2)
is_active boolean
created_at timestamptz
updated_at timestamptz
```

------------------------------------------------------------------------

# 16. PRODUCT MODIFIERS

## product_modifiers

``` text
product_modifiers
-----------------
product_id uuid FK products.id
modifier_id uuid FK modifiers.id
is_required boolean
min_select integer
max_select integer
sort_order integer
created_at timestamptz

PRIMARY KEY (product_id, modifier_id)
```

Selection behavior must be validated server-side.

------------------------------------------------------------------------

# 17. TABLES

## tables

``` text
tables
------
id uuid PK
table_code text UNIQUE
name text
capacity integer nullable
status text
is_active boolean
created_at timestamptz
updated_at timestamptz
```

Baseline status vocabulary must be finalized consistently with the
approved UX.

Do not equate table status with order status.

------------------------------------------------------------------------

# 18. TABLE QR

## table_qr

``` text
table_qr
--------
id uuid PK
table_id uuid FK tables.id
token text UNIQUE
is_active boolean
created_at timestamptz
expires_at timestamptz nullable
```

The token is not the same as the internal table UUID.

QR validation must occur server-side.

------------------------------------------------------------------------

# 19. TABLE SESSIONS

## table_sessions

``` text
table_sessions
--------------
id uuid PK
table_id uuid FK tables.id
status text
opened_at timestamptz
closed_at timestamptz nullable
opened_by uuid FK profiles.id nullable
closed_by uuid FK profiles.id nullable
created_at timestamptz
updated_at timestamptz
```

Purpose:

A dining table may have multiple orders within one active session.

Example:

``` text
Table A12
  Session S1
    ├── Order 001
    ├── Order 002
    └── Order 003
```

------------------------------------------------------------------------

# 20. ORDERS

## orders

``` text
orders
------
id uuid PK
order_number text UNIQUE
table_id uuid FK tables.id
table_session_id uuid FK table_sessions.id
source text
status text
notes text nullable

subtotal numeric(12,2)
discount numeric(12,2)
tax numeric(12,2)
total numeric(12,2)

created_by uuid FK profiles.id nullable
created_at timestamptz
updated_at timestamptz
```

Source baseline:

``` text
CUSTOMER_QR
WAITER
POS
```

Order totals must be calculated/validated server-side.

------------------------------------------------------------------------

# 21. ORDER ITEMS

## order_items

``` text
order_items
-----------
id uuid PK
order_id uuid FK orders.id
product_id uuid FK products.id nullable

product_name_snapshot text
unit_price_snapshot numeric(12,2)

quantity numeric(12,3)
notes text nullable
line_total numeric(12,2)

created_at timestamptz
updated_at timestamptz
```

Important:

`product_id` may remain for traceability, but historical snapshot fields
are authoritative for historical transaction display.

Changing the product later must not alter historical order data.

------------------------------------------------------------------------

# 22. ORDER ITEM MODIFIERS

## order_item_modifiers

``` text
order_item_modifiers
--------------------
id uuid PK
order_item_id uuid FK order_items.id
modifier_id uuid FK modifiers.id nullable

modifier_name_snapshot text
price_delta_snapshot numeric(12,2)

quantity numeric(12,3)
created_at timestamptz
```

Historical modifier snapshots preserve transaction integrity.

------------------------------------------------------------------------

# 23. ORDER STATUS HISTORY

## order_status_history

``` text
order_status_history
--------------------
id uuid PK
order_id uuid FK orders.id
from_status text nullable
to_status text
actor_id uuid FK profiles.id nullable
actor_role text nullable
reason text nullable
created_at timestamptz
```

The current order status remains on `orders.status`.

History is append-oriented.

------------------------------------------------------------------------

# 24. PAYMENTS

## payments

``` text
payments
--------
id uuid PK
order_id uuid FK orders.id
method text
status text
amount numeric(12,2)
reference text nullable
paid_at timestamptz nullable
created_by uuid FK profiles.id nullable
created_at timestamptz
updated_at timestamptz
```

Payment status baseline:

``` text
PENDING
PAID
FAILED
EXPIRED
CANCELLED
```

Do not assume one payment per order.

The data model should permit multiple payment records where later
workflows require it.

------------------------------------------------------------------------

# 25. SERVICE REQUESTS

## service_requests

``` text
service_requests
----------------
id uuid PK
table_id uuid FK tables.id
table_session_id uuid FK table_sessions.id nullable
type text
status text
message text nullable
created_by uuid FK profiles.id nullable
resolved_by uuid FK profiles.id nullable
created_at timestamptz
resolved_at timestamptz nullable
```

Examples:

``` text
CALL_WAITER
REQUEST_BILL
OTHER_SERVICE
```

Status baseline:

``` text
REQUESTED
ACKNOWLEDGED
RESOLVED
```

------------------------------------------------------------------------

# 26. NOTIFICATIONS

## notifications

``` text
notifications
-------------
id uuid PK
recipient_user_id uuid FK profiles.id nullable
type text
title text
message text
entity_type text nullable
entity_id uuid nullable
is_read boolean
created_at timestamptz
read_at timestamptz nullable
```

Realtime delivery is separate from persistence.

The database record remains useful for history and recovery.

------------------------------------------------------------------------

# 27. AUDIT LOGS

## audit_logs

``` text
audit_logs
----------
id uuid PK
actor_id uuid FK profiles.id nullable
actor_role text nullable

entity_type text
entity_id uuid nullable

action text
from_state text nullable
to_state text nullable
reason text nullable

metadata jsonb nullable

created_at timestamptz
```

Audit records must be generated server-side.

Do not trust browser-submitted actor identity or previous state.

------------------------------------------------------------------------

# 28. ORDER STATE ENUM / CHECK

The implementation may use PostgreSQL enum types or controlled text +
check constraints.

Baseline:

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
CANCELLED
REJECTED
VOID
REFUNDED
```

No arbitrary state should be accepted.

------------------------------------------------------------------------

# 29. PAYMENT STATE

Baseline:

``` text
PENDING
PAID
FAILED
EXPIRED
CANCELLED
```

------------------------------------------------------------------------

# 30. SERVICE REQUEST STATE

``` text
REQUESTED
ACKNOWLEDGED
RESOLVED
```

------------------------------------------------------------------------

# 31. SOURCE ENUM

``` text
CUSTOMER_QR
WAITER
POS
```

------------------------------------------------------------------------

# 32. INDEX STRATEGY

Minimum indexes should support operational queues.

Recommended:

``` text
orders(status)
orders(table_id)
orders(table_session_id)
orders(created_at)
orders(source)

order_items(order_id)

order_status_history(order_id, created_at)

payments(order_id)
payments(status)
payments(created_at)

service_requests(status, created_at)
service_requests(table_id)

notifications(recipient_user_id, is_read)

audit_logs(entity_type, entity_id)
audit_logs(actor_id, created_at)

products(category_id, is_active, is_available)

tables(status, is_active)

table_sessions(table_id, status)
```

Additional indexes should be added based on actual query patterns.

Do not create indexes without a query/use-case reason.

------------------------------------------------------------------------

# 33. FOREIGN KEY BEHAVIOR

Default principle:

-   preserve historical transaction data
-   avoid destructive cascades on business records
-   prefer soft deactivation for catalog/configuration entities
-   use cascade only where the child record has no independent business
    meaning

Examples:

Product should generally not be hard-deleted if referenced by historical
orders.

Historical order items remain intact.

------------------------------------------------------------------------

# 34. MONEY

Use:

``` text
numeric(12,2)
```

Do not use floating-point types for financial amounts.

All monetary calculations must follow a consistent rounding policy.

Exact tax/discount calculation rules must be finalized before payment
implementation.

------------------------------------------------------------------------

# 35. QUANTITY

Food/product quantities may use:

``` text
numeric(12,3)
```

if fractional quantities are needed later.

If MVP strictly uses integer item quantities, application validation may
enforce integer values.

Do not assume fractional ordering unless required.

------------------------------------------------------------------------

# 36. SOFT DELETE / DEACTIVATION

For catalog/configuration:

Prefer:

``` text
is_active = false
```

instead of destructive deletion when historical references may exist.

For transactions:

Do not delete completed financial/order records as a normal user action.

Use:

``` text
VOID
REFUNDED
```

or appropriate audited exception workflows.

------------------------------------------------------------------------

# 37. RLS PRINCIPLES

If using Supabase Row Level Security:

### Customer

May access only data required for the active QR ordering context.

### Waiter

May access authorized operational tables/orders/service requests.

### Kitchen

May access authorized kitchen order data without unnecessary financial
information.

### Cashier

May access orders/payment data required for cashier duties.

### Admin/Supervisor/Owner

Access according to explicit permissions.

RLS policies must be designed after exact RBAC permissions are
finalized.

Do not deploy permissive policies such as:

``` sql
using (true)
```

for sensitive production tables.

------------------------------------------------------------------------

# 38. TRANSACTIONAL OPERATIONS

The following should be atomic server-side operations:

``` text
Create Order
Confirm Order
Reject Order
Start Preparing
Mark Ready
Serve Order
Create Payment
Complete Payment
Void Order
Refund Payment
Create Service Request
Resolve Service Request
Change Permission
```

Where an operation changes state and writes history/audit, those writes
should occur within the same transaction boundary where technically
appropriate.

------------------------------------------------------------------------

# 39. ORDER CREATION INTEGRITY

Server-side sequence:

``` text
validate authenticated/anonymous context
↓
validate table/session
↓
validate product IDs
↓
validate product availability
↓
retrieve authoritative prices
↓
validate modifiers
↓
calculate subtotal
↓
apply approved discount rules
↓
calculate tax according to configured rule
↓
calculate total
↓
create order
↓
create order items/snapshots
↓
create initial state/history
↓
publish realtime event
```

Do not accept a browser-calculated total as authoritative.

------------------------------------------------------------------------

# 40. PAYMENT INTEGRITY

Server-side sequence:

``` text
validate order
↓
validate current payment/order state
↓
validate permission/provider event
↓
validate amount
↓
create/update payment
↓
update order state when appropriate
↓
write history
↓
write audit
↓
publish realtime event
```

Exact payment-provider webhook behavior belongs in the API/Payment
specification.

------------------------------------------------------------------------

# 41. AUDIT INTEGRITY

Audit logging should happen in the same server-side business operation
for sensitive state changes where possible.

Example:

``` text
Order
  status: CONFIRMED
      ↓
  PREPARING

writes:
1. orders.status
2. order_status_history
3. audit_logs
4. realtime event
```

The first three must not be allowed to silently diverge.

------------------------------------------------------------------------

# 42. FUTURE EXTENSION POINTS

Do not create MVP tables for future modules unless needed for current
relationships.

Future domains can add:

``` text
branches
ingredients
recipes
stock_movements
suppliers
purchases
expenses
customers
loyalty_accounts
reservations
```

The current schema should avoid design decisions that block these
extensions.

------------------------------------------------------------------------

# 43. MIGRATION ORDER

Recommended initial migration sequence:

``` text
001_extensions_and_helpers
002_profiles
003_roles_permissions
004_restaurant_settings
005_catalog
006_tables_and_qr
007_table_sessions
008_orders
009_order_items
010_order_status_history
011_payments
012_service_requests
013_notifications
014_audit_logs
015_indexes
016_rls_policies
017_seed_system_roles_permissions
```

Exact migration contents should be validated during implementation.

------------------------------------------------------------------------

# 44. SCHEMA GATE

Database Schema v1.0 defines the MVP logical data model.

Before production migration:

-   exact SQL must be reviewed
-   RLS policies must be reviewed
-   constraints must be tested
-   indexes must be tested against actual queries
-   transaction boundaries must be tested
-   seed data must be reviewed
-   migration rollback/recovery strategy must be documented

------------------------------------------------------------------------

# 45. NEXT ARTIFACT

After approval of this schema:

``` text
API_CONTRACT_v1.0.md
```

must define:

-   endpoints/commands
-   request payloads
-   response shapes
-   error codes
-   authentication requirements
-   permissions
-   order transition commands
-   payment commands
-   realtime events
-   idempotency behavior
-   validation rules

Do not implement production API before the contract is defined.
