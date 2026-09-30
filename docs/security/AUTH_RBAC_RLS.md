# TEPI SAWAH RESTO & CAFE
## AUTH + RBAC + RLS v1.0

**Status:** Draft for Implementation  
**Version:** 1.0  
**Date:** 2026-09-27  
**Architecture:** React + TypeScript + Vite + Supabase Auth + PostgreSQL + RLS

---

# 1. Purpose

Dokumen ini mendefinisikan:

- authentication
- user profile
- role
- permission
- role assignment
- authorization
- PostgreSQL Row Level Security (RLS)
- akses customer public ordering
- akses internal staff
- owner/admin/supervisor
- session lifecycle
- security boundaries
- audit requirements

Dokumen ini menjadi acuan implementasi keamanan aplikasi Tepi Sawah sebelum modul operasional diintegrasikan.

---

# 2. Security Principles

## 2.1 Authentication ≠ Authorization

Authentication menjawab:

> Siapa pengguna ini?

Authorization menjawab:

> Apa yang boleh dilakukan pengguna ini?

Keduanya tidak boleh digabung menjadi satu mekanisme.

## 2.2 Backend Authority

Frontend hanya menggunakan permission untuk:

- menampilkan/menyembunyikan menu
- mengaktifkan/menonaktifkan action
- membantu UX

Frontend permission **bukan security boundary**.

Security harus tetap ditegakkan melalui:

- Supabase Auth
- PostgreSQL RLS
- server-side command validation
- permission checks
- database constraints
- audit

## 2.3 Least Privilege

User hanya memperoleh permission yang diperlukan untuk tugasnya.

Default:

```text
No role → No internal access
```

---

# 3. Identity Architecture

Supabase Auth menjadi identity provider.

Arsitektur:

```text
User
  ↓
Supabase Auth
  ↓
auth.users
  ↓
profiles
  ↓
user_roles
  ↓
roles
  ↓
role_permissions
  ↓
permissions
```

Jangan menyimpan password sendiri di tabel `profiles`.

---

# 4. User Types

## 4.1 Customer

Customer MVP:

- tidak wajib login
- masuk melalui QR meja
- hanya mengakses public ordering context
- tidak memiliki internal role
- tidak dapat mengakses POS/KDS/Waiter/Admin

## 4.2 Internal Staff

Internal users menggunakan authentication.

Role:

- waiter
- cashier
- kitchen
- supervisor
- admin
- owner

---

# 5. Profile Model

Logical table:

`profiles`

Recommended fields:

```text
id
display_name
phone
avatar_url
is_active
created_at
updated_at
```

`profiles.id` harus mereferensikan `auth.users.id`.

Jangan menyimpan:

- password
- access token
- refresh token
- service-role key
- raw authentication secret

di `profiles`.

---

# 6. Roles

MVP roles:

| Role | Purpose |
|---|---|
| `waiter` | Pelayanan meja dan order manual |
| `cashier` | Konfirmasi order dan pembayaran |
| `kitchen` | Operasional dapur/KDS |
| `supervisor` | Supervisi operasional |
| `admin` | Administrasi sistem |
| `owner` | Akses owner dan pengaturan tingkat tinggi |

Customer tidak perlu dibuat sebagai internal role.

---

# 7. Permission Model

Permission menggunakan format:

```text
<domain>.<action>
```

Contoh:

```text
catalog.read
catalog.create
catalog.update
catalog.archive

tables.read
tables.create
tables.update
tables.qr_manage

orders.read
orders.create_manual
orders.confirm
orders.reject
orders.transition
orders.cancel

kitchen.read
kitchen.start
kitchen.ready
kitchen.recall

service_requests.read
service_requests.acknowledge
service_requests.resolve

payments.read
payments.create
payments.refund

users.read
users.manage

roles.read
roles.manage

audit.read

settings.read
settings.manage
```

Permission adalah stable identifier.

UI label boleh berubah tanpa mengubah permission ID.

---

# 8. Initial Permission Set

## Catalog

```text
catalog.read
catalog.create
catalog.update
catalog.archive
categories.manage
modifiers.manage
```

## Tables

```text
tables.read
tables.create
tables.update
tables.archive
tables.qr_manage
table_sessions.read
table_sessions.manage
```

## Orders

```text
orders.read
orders.create_manual
orders.confirm
orders.reject
orders.transition
orders.cancel
orders.recall
```

## Kitchen

```text
kitchen.read
kitchen.start
kitchen.ready
kitchen.recall
```

## Service

```text
service_requests.read
service_requests.create
service_requests.acknowledge
service_requests.resolve
```

## Payments

```text
payments.read
payments.create
payments.refund
payments.void
```

## Users

```text
users.read
users.create
users.update
users.disable
users.roles_manage
```

## Roles

```text
roles.read
roles.manage
permissions.read
```

## Audit

```text
audit.read
```

## Settings

```text
settings.read
settings.manage
```

## Dashboard

```text
dashboard.read
```

---

# 9. Role → Permission Baseline

Initial matrix:

| Permission Group | Waiter | Cashier | Kitchen | Supervisor | Admin | Owner |
|---|---:|---:|---:|---:|---:|---:|
| Catalog Read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Catalog Manage | - | - | - | - | ✓ | ✓ |
| Tables Read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tables Manage | - | - | - | ✓ | ✓ | ✓ |
| Manual Order | ✓ | ✓ | - | ✓ | ✓ | ✓ |
| Order Read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Confirm/Reject | - | ✓ | - | ✓ | ✓ | ✓ |
| Kitchen Start/Ready | - | - | ✓ | ✓ | ✓ | ✓ |
| Kitchen Recall | - | - | - | ✓ | ✓ | ✓ |
| Mark Served | ✓ | - | - | ✓ | ✓ | ✓ |
| Payment Create | - | ✓ | - | ✓ | ✓ | ✓ |
| Refund/Void | - | - | - | ✓ | ✓ | ✓ |
| Service Request | ✓ | ✓ | - | ✓ | ✓ | ✓ |
| User Management | - | - | - | - | ✓ | ✓ |
| Role Management | - | - | - | - | ✓ | ✓ |
| Audit Read | - | limited | - | ✓ | ✓ | ✓ |
| Settings Manage | - | - | - | - | ✓ | ✓ |
| Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

This is the baseline only. Exact permission seed must be reviewed before production.

---

# 10. Owner vs Admin

Owner and Admin must not automatically be identical.

## Owner

Intended for:

- business-level visibility
- configuration oversight
- high-risk operations
- financial/sensitive operational visibility

## Admin

Intended for:

- system configuration
- catalog
- users
- roles
- tables
- operational settings

Do not assume owner has every permission unless explicitly seeded.

High-risk actions should require explicit permission, not merely a UI role name.

---

# 11. Supervisor

Supervisor is operational authority.

Potential permissions:

- order override
- cancellation
- refund
- void
- kitchen recall
- operational dashboard
- audit visibility

Supervisor should not automatically gain system administration permissions.

---

# 12. Role Assignment

Logical relationship:

```text
user_roles
    user_id
    role_id
```

A user may have multiple roles.

Example:

```text
user A
 ├── cashier
 └── supervisor
```

Effective permissions are the union of permissions granted by active roles.

Do not implement role precedence by frontend string comparison.

---

# 13. Role Assignment Rules

Only authorized users may assign roles.

Recommended permission:

```text
users.roles_manage
```

Role assignment must:

1. validate target user
2. validate role
3. validate actor permission
4. write assignment
5. create audit event
6. invalidate/reconcile affected session permissions if necessary

---

# 14. User Activation

Profile contains:

```text
is_active
```

Inactive internal users must not be able to perform protected operations.

When a user is disabled:

- block internal authorization
- preserve historical records
- do not delete orders created by that user
- preserve audit history

---

# 15. Authentication Flow

## Staff

```text
Login
  ↓
Supabase Auth
  ↓
Session
  ↓
Load /me
  ↓
Load profile
  ↓
Load roles
  ↓
Resolve permissions
  ↓
Enter authorized application
```

If authentication succeeds but no active internal role exists:

```text
Authenticated
      ↓
No authorized role
      ↓
Access Denied
```

Do not allow automatic access to internal applications.

---

# 16. Session Lifecycle

Frontend should use the Supabase Auth session mechanism.

Handle:

- initial session
- sign in
- token refresh
- sign out
- expired session
- revoked/disabled account
- network recovery

On session change:

1. clear sensitive local application state
2. refresh identity context
3. re-evaluate permissions
4. redirect if authorization is lost

---

# 17. Customer Public Access

Customer QR ordering is a separate trust boundary.

Flow:

```text
QR
 ↓
table code
 ↓
public table resolver
 ↓
validated table/session
 ↓
public catalog
 ↓
order creation
```

Customer must not receive:

- internal roles
- internal permissions
- staff information
- audit data
- payment credentials
- unrestricted table data
- arbitrary order access

---

# 18. Public QR Security

A QR URL may contain:

```text
?table=A12
```

The table code is **not a secret**.

Therefore:

- table code alone must not authorize internal actions
- server validates table status
- server validates session
- public API returns minimal information
- sensitive operations require controlled server-side validation
- rate limiting should be applied

---

# 19. Public Order Authorization

Because customer MVP has no login, customer order lookup needs a controlled public context.

Recommended options:

### Option A

Short-lived public order access token generated by backend.

### Option B

Table-session scoped public token.

### Option C

One-time order access credential.

Final mechanism must be selected before production.

Do not expose arbitrary order data by predictable order ID.

---

# 20. RLS Architecture

RLS must be enabled on all protected business tables.

At minimum:

```text
profiles
roles
permissions
user_roles
role_permissions
restaurant_settings
operating_hours
categories
products
modifiers
product_modifiers
tables
table_qr
table_sessions
orders
order_items
order_item_modifiers
order_status_history
payments
service_requests
notifications
audit_logs
```

---

# 21. RLS Strategy

RLS should answer:

1. Is the requester authenticated?
2. Is the account active?
3. What roles does the user have?
4. What permissions do those roles provide?
5. Is the requested row within the user's allowed domain?
6. Is this a public operation explicitly allowed by policy?

Do not create broad policies such as:

```sql
using (true)
```

for internal business tables.

---

# 22. Helper Functions

Recommended PostgreSQL helper functions:

```text
auth_user_id()
current_user_is_active()
has_role(role_name)
has_permission(permission_name)
is_admin()
is_owner()
is_supervisor()
```

Functions must be designed carefully to avoid RLS recursion.

Prefer `SECURITY DEFINER` helper functions only where justified, with:

- fixed search_path
- controlled ownership
- minimal privileges
- no dynamic unsafe SQL

---

# 23. RLS Pattern: Profiles

User should normally read/update only their own profile.

Conceptually:

```sql
id = auth.uid()
```

Admin may read/manage profiles according to explicit permission.

Users must not modify their own roles through profile updates.

---

# 24. RLS Pattern: User Roles

Normal user:

```text
READ: own role assignments if needed
WRITE: none
```

Authorized admin:

```text
READ: authorized
WRITE: authorized
```

Role assignment should preferably use controlled server-side command logic rather than exposing unrestricted table updates.

---

# 25. RLS Pattern: Catalog

Public:

- read active public categories/products/modifiers

Internal:

- read active catalog

Admin:

- create/update/archive

Public users must not:

- change prices
- create products
- archive products
- change availability through direct table writes

---

# 26. RLS Pattern: Tables

Public:

- resolve explicitly permitted table information

Staff:

- read operational tables

Admin:

- manage tables and QR configuration

Public users cannot:

- create tables
- rename tables
- disable tables
- regenerate QR

---

# 27. RLS Pattern: Orders

Orders require special care.

## Customer

Can create/read only through controlled public ordering paths.

## Waiter

Can read operational orders required for service.

Can create manual orders.

## Cashier

Can read orders required for confirmation/payment.

Can execute authorized order commands.

## Kitchen

Can read only kitchen-relevant order data.

Should not receive unnecessary payment information.

## Supervisor/Admin/Owner

Access according to explicit permissions.

---

# 28. RLS Pattern: Order Items

Order items inherit access from their parent order.

Do not duplicate independent authorization logic unnecessarily.

Concept:

```text
order_items.order_id
        ↓
orders
        ↓
authorization
```

---

# 29. RLS Pattern: Order Status History

Status history is append-oriented.

Users should not directly edit historical transitions.

Recommended:

```text
SELECT: authorized
INSERT: controlled backend transition
UPDATE: denied
DELETE: denied
```

---

# 30. RLS Pattern: Payments

Payment records are highly restricted.

Customer:

```text
No direct payment mutation
```

Cashier:

```text
Create/read according to permission
```

Supervisor/Admin/Owner:

```text
Additional access according to explicit permissions
```

Kitchen should not have access to unnecessary payment information.

Payment provider credentials must never be stored in a client-readable table.

---

# 31. RLS Pattern: Audit Logs

Audit logs:

```text
SELECT: authorized
INSERT: server/backend
UPDATE: denied
DELETE: denied
```

Client must never be able to fabricate:

```text
actor_id
actor_role
created_at
```

These must be server/database controlled.

---

# 32. RLS Pattern: Service Requests

Customer:

- create allowed public request
- read only its own controlled request context

Waiter:

- read/acknowledge/resolve

Cashier:

- read as operationally required

Supervisor/Admin/Owner:

- according to permission

Kitchen:

- no access unless explicitly needed.

---

# 33. RLS Pattern: Notifications

Users can read their own notifications.

Concept:

```text
recipient_user_id = auth.uid()
```

Staff cannot read another user's private notifications unless an explicit administrative function requires it.

---

# 34. Security Definer Rules

If helper functions use `SECURITY DEFINER`:

- owner must be controlled
- `search_path` must be explicitly fixed
- function must expose minimum capability
- parameters must be validated
- no unrestricted dynamic SQL
- function should not become a privilege escalation path

---

# 35. Service Role

Supabase service-role credentials are backend-only.

Never:

- put service-role key in React
- put service-role key in Vite environment exposed to browser
- commit it to GitHub
- put it in HTML
- send it to customer browser

Use service role only in trusted server-side contexts where necessary.

---

# 36. Environment Variables

Frontend-safe variables may include:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Never expose:

```text
SUPABASE_SERVICE_ROLE_KEY
```

or payment-provider secret keys.

`.env` files containing secrets must be excluded from Git.

---

# 37. Route Protection

Application routes:

```text
/                    public
/menu                public
/order               public QR ordering

/pos                 protected
/kitchen             protected
/waiter              protected
/admin               protected
```

Route guard is UX protection.

Backend/RLS remains the actual security control.

---

# 38. Permission Guard

Frontend should use:

```text
can("orders.confirm")
can("payments.create")
can("catalog.update")
```

Example:

```ts
if (can("orders.confirm")) {
  // show confirmation action
}
```

But the backend must independently validate the same permission.

---

# 39. Sensitive Actions

Require explicit permission and preferably confirmation for:

- refund
- void
- cancellation after preparation
- role assignment
- role removal
- product archival
- table archival
- settings changes
- QR regeneration
- high-risk operational override

High-risk actions should generate audit events.

---

# 40. Audit Requirements

Minimum audit fields:

```text
id
actor_id
actor_role
action
entity_type
entity_id
metadata
created_at
```

Audit examples:

```text
USER_ROLE_ASSIGNED
USER_ROLE_REMOVED
PRODUCT_UPDATED
PRODUCT_ARCHIVED
TABLE_UPDATED
QR_REGENERATED
ORDER_CONFIRMED
ORDER_REJECTED
ORDER_CANCELLED
ORDER_RECALLED
PAYMENT_CREATED
PAYMENT_VOIDED
PAYMENT_REFUNDED
SETTINGS_UPDATED
```

---

# 41. Authorization Failure Behavior

Do not reveal unnecessary information.

For protected resource:

```text
401 → not authenticated
403 → authenticated but not authorized
404 → resource not exposed/not found
```

Do not return sensitive internal details such as:

- database errors
- SQL statements
- service keys
- internal stack traces
- permission internals unnecessary to the client

---

# 42. Account Disable Flow

Recommended:

```text
Admin disables account
        ↓
profile.is_active = false
        ↓
future authorization fails
        ↓
existing session is rejected/reconciled
        ↓
audit generated
```

Historical records remain intact.

---

# 43. Password & Credential Policy

Password handling is delegated to Supabase Auth.

Application database must not implement custom password storage.

Do not log:

- passwords
- access tokens
- refresh tokens
- payment secrets
- service-role keys

---

# 44. Rate Limiting

Rate limiting should be applied especially to public endpoints:

```text
/public/table/*
/public/catalog/*
/public/orders/*
/service-requests
```

Also consider limits for:

- login attempts
- payment creation
- repeated order submission

Exact limits are an implementation decision and must not be invented as business rules.

---

# 45. Security Event Logging

Security-relevant events should be auditable:

- failed privileged operation
- role changes
- disabled account
- repeated authorization failures where supported
- sensitive settings changes
- payment override
- refund
- void

Do not store excessive personal data in logs.

---

# 46. Data Exposure Rules by Module

| Data | Customer | Waiter | Cashier | Kitchen | Admin/Owner |
|---|---:|---:|---:|---:|---:|
| Public Menu | ✓ | ✓ | ✓ | ✓ | ✓ |
| Table | scoped | ✓ | ✓ | limited | ✓ |
| Order Items | own/context | ✓ | ✓ | ✓ | ✓ |
| Customer Note | own/context | ✓ | ✓ | relevant | ✓ |
| Payment Detail | limited | - | ✓ | - | ✓ |
| Audit | - | - | limited | - | ✓ |
| User Data | - | limited | limited | - | ✓ |
| Role Data | - | - | - | - | ✓ |

Exact field-level exposure should be implemented through views/functions/API DTOs where needed rather than relying only on UI hiding.

---

# 47. API + RLS Relationship

Critical commands should follow:

```text
Frontend
   ↓
Authenticated request
   ↓
API / Edge Function / RPC
   ↓
Permission validation
   ↓
Database transaction
   ↓
RLS
   ↓
Data mutation
   ↓
Audit
   ↓
Response
```

RLS is not a replacement for business workflow validation.

Business workflow validation is not a replacement for RLS.

Both are required.

---

# 48. Realtime Security

Realtime subscriptions must respect authorization.

Do not subscribe a kitchen client to unrestricted:

```text
payments
users
audit_logs
```

unless explicitly required and authorized.

Operational channels should expose only the fields necessary for the subscriber.

---

# 49. Security Testing

Before production test:

## Authentication

- invalid credentials
- expired session
- disabled account
- sign out
- refresh

## Authorization

- waiter attempts payment
- kitchen attempts payment
- customer attempts internal route
- cashier attempts role assignment
- unauthorized refund
- unauthorized catalog update

## RLS

- user A cannot read user B private data
- user cannot modify another user's role
- customer cannot read arbitrary orders
- kitchen cannot read restricted payment data
- audit cannot be updated/deleted by client

## Public QR

- invalid table
- disabled table
- expired/invalid public context
- order lookup tampering
- repeated submission

## Privilege Escalation

Test that a user cannot gain permission by modifying:

```text
role
user_id
permission
actor_id
```

in browser requests.

---

# 50. Implementation Order

Implement security in this order:

```text
01 Supabase Auth
02 profiles
03 roles
04 permissions
05 user_roles
06 role_permissions
07 helper authorization functions
08 RLS base policies
09 protected routes
10 /me
11 public QR boundary
12 order authorization
13 payment authorization
14 admin authorization
15 audit
16 security tests
```

Do not begin with UI-only role guards.

---

# 51. Cline Rules

Cline must:

1. never create a custom password table
2. never expose service-role key
3. never trust frontend role values
4. never trust frontend permission values
5. never bypass RLS
6. never use `using (true)` for protected internal tables without explicit architecture approval
7. never allow client-side role assignment
8. never allow client-side audit fabrication
9. never expose payment secrets
10. never expose unnecessary staff/payment data to KDS
11. never use order ID alone as public authorization
12. use typed permission constants
13. use backend commands for privileged mutations
14. test RLS policies
15. test privilege escalation
16. preserve historical records
17. stop if an RLS policy creates recursion or privilege ambiguity
18. document every intentional SECURITY DEFINER function

---

# 52. Definition of Done

Auth/RBAC/RLS is considered ready only when:

- staff login works
- session refresh works
- sign out works
- inactive users are blocked
- roles are database-backed
- permissions are database-backed
- role assignment is protected
- `/me` returns effective permissions
- public customer access is isolated
- RLS is enabled on protected tables
- unauthorized reads fail
- unauthorized writes fail
- order access is scoped
- payment access is restricted
- audit is immutable from client
- privileged commands validate permission
- service role is never exposed
- secrets are excluded from Git
- route guards are implemented as UX protection
- backend/RLS remains security authority
- security tests pass

---

# 53. Next Artifact

Setelah dokumen ini:

```text
01 Product Definition
02 Design System
03 Design Freeze
04 Technical Architecture
05 Database Schema
06 API Contract
07 Auth + RBAC + RLS ← SELESAI

08 REALTIME_SPEC_v1.0.md
09 REPOSITORY_STRUCTURE_v1.0.md
10 CLINE_IMPLEMENTATION_PLAN_v1.0.md
11 TESTING_STRATEGY_v1.0.md
12 ENVIRONMENT_CONFIG_v1.0.md
13 MIGRATION_PLAN_v1.0.md
14 IMPLEMENTATION
```

Tahap implementasi pertama tetap:

```text
Auth
  ↓
Profiles
  ↓
Roles/Permissions
  ↓
RLS
  ↓
Catalog
  ↓
Tables/QR
  ↓
Orders
```

Jangan menghubungkan production POS/KDS/Waiter sebelum authorization dan RLS dasar selesai.
