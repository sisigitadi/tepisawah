# TEPI SAWAH RESTO & CAFE
## DATABASE MIGRATION PLAN v1.0

**Status:** Database Implementation Blueprint  
**Version:** 1.0  
**Date:** 2026-09-27  
**Architecture:** PostgreSQL + Supabase + RLS  
**Primary Tool:** Cline + VS Code

---

# 1. Purpose

Dokumen ini menerjemahkan logical database schema Tepi Sawah menjadi urutan migration PostgreSQL yang deterministik.

Tujuan:

- database dapat dibuat dari kondisi kosong
- migration versioned dan repeatable
- dependency antar-table jelas
- constraint dibuat secara bertahap
- index dibuat sesuai query
- RLS diterapkan setelah struktur siap
- function/trigger dibuat setelah tabel yang dibutuhkan tersedia
- seed dipisahkan dari schema
- production tidak dibuat secara manual dan improvisasional

Database adalah source of truth.

---

# 2. Migration Principles

Cline wajib mengikuti:

```text
Migration
   ↓
Review
   ↓
Apply to Development
   ↓
Test
   ↓
Apply to Preview/Staging
   ↓
RLS/Security Test
   ↓
UAT
   ↓
Production
```

Dilarang:

- membuat schema production secara manual tanpa migration
- menghapus data production untuk memperbaiki migration
- menggunakan `DROP TABLE` tanpa explicit approval
- membuat policy terlalu permisif untuk "sementara"
- membuat service-role logic sebagai pengganti RLS
- memasukkan business rule yang belum didefinisikan

---

# 3. Source of Truth

Migration harus mengikuti:

1. explicit business decision
2. Design Freeze
3. Technical Architecture
4. Database Schema
5. API Contract
6. Auth/RBAC/RLS
7. Realtime Specification
8. Cline Implementation Plan

Jika terdapat konflik:

```text
STOP
↓
Document conflict
↓
Do not guess
↓
Request decision
```

---

# 4. Migration Directory

Production repository:

```text
supabase/
├── migrations/
├── functions/
└── seed/
```

Migration file menggunakan format timestamp/version yang dihasilkan oleh Supabase CLI.

Contoh:

```text
supabase/migrations/
├── 20260927000100_extensions.sql
├── 20260927000200_profiles.sql
├── ...
```

Nomor di dokumen ini adalah logical order. Timestamp aktual harus mengikuti migration tooling yang digunakan.

---

# 5. Migration Dependency Graph

```text
extensions
    ↓
profiles
    ↓
roles
    ↓
permissions
    ↓
user_roles
    ↓
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

indexes
functions / triggers
RLS policies
seed
```

Beberapa branch dapat dibuat paralel setelah dependency parent tersedia, tetapi untuk implementasi awal gunakan urutan linear agar mudah diaudit.

---

# 6. Migration 001 — Extensions

## Goal

Enable PostgreSQL extensions yang benar-benar diperlukan.

Candidate:

```sql
create extension if not exists "pgcrypto";
```

Gunakan hanya extension yang benar-benar diperlukan oleh schema/application.

Jangan menambahkan extension tanpa kebutuhan.

## Validation

- migration succeeds
- extension exists
- no unnecessary extension

---

# 7. Migration 002 — Profiles

Logical table:

```text
profiles
```

Purpose:

Menyimpan application profile yang berhubungan dengan authenticated user.

Minimum conceptual fields:

```text
id
full_name
email/display identifier as required
phone as required
is_active
created_at
updated_at
```

`id` harus berhubungan dengan Supabase Auth user identity.

## Rules

- jangan membuat password column
- jangan membuat custom authentication system
- jangan menyimpan access token
- jangan menyimpan refresh token

## Validation

- profile references auth identity
- duplicate identity prevented
- inactive profile supported

---

# 8. Migration 003 — Roles

Logical table:

```text
roles
```

Baseline roles:

```text
waiter
cashier
kitchen
supervisor
admin
owner
```

Role naming harus konsisten.

Role bukan security boundary jika tidak diverifikasi oleh backend/RLS.

---

# 9. Migration 004 — Permissions

Logical table:

```text
permissions
```

Format:

```text
<domain>.<action>
```

Contoh:

```text
catalog.read
catalog.manage
orders.read
orders.confirm
orders.reject
orders.prepare
orders.ready
orders.serve
payments.read
payments.create
payments.refund
users.manage
audit.read
```

Daftar final harus mengikuti Auth/RBAC specification.

Jangan menambahkan permission hanya karena terlihat berguna.

---

# 10. Migration 005 — User Roles

Logical table:

```text
user_roles
```

Purpose:

many-to-many:

```text
user
  ↕
roles
```

Rules:

- duplicate role assignment tidak boleh
- inactive user tidak otomatis menjadi authorized
- role removal harus dapat diaudit
- role assignment sensitive

Constraint:

```text
unique(user_id, role_id)
```

---

# 11. Migration 006 — Role Permissions

Logical table:

```text
role_permissions
```

Relationship:

```text
roles
  ↓
role_permissions
  ↑
permissions
```

Constraint:

```text
unique(role_id, permission_id)
```

---

# 12. Migration 007 — Restaurant Settings

Logical table:

```text
restaurant_settings
```

Purpose:

configuration yang berlaku untuk restaurant.

Potential configuration categories:

```text
restaurant name
address
timezone
currency
ordering configuration
payment configuration
service configuration
kitchen configuration
```

Jangan memasukkan secret provider ke table ini.

Sensitive credentials tetap berada di environment/secret manager.

---

# 13. Migration 008 — Operating Hours

Logical table:

```text
operating_hours
```

Purpose:

menyimpan jam operasional.

Model harus dapat mendukung:

```text
day of week
open time
close time
closed flag
```

Jangan hard-code jam operasional di frontend.

---

# 14. Migration 009 — Categories

Logical table:

```text
categories
```

Minimum conceptual:

```text
id
name
description
sort_order
is_active
created_at
updated_at
```

Rules:

- category inactive tidak otomatis menghapus historical order
- product history tetap valid

---

# 15. Migration 010 — Products

Logical table:

```text
products
```

Purpose:

centralized menu source of truth.

Minimum conceptual:

```text
id
category_id
name
description
price
image_url
is_active
is_available
sort_order
created_at
updated_at
```

Important:

```text
price
```

adalah current catalog price.

Historical orders harus menggunakan snapshot pada `order_items`.

Jangan membaca current product price untuk menghitung ulang historical order.

---

# 16. Migration 011 — Modifiers

Logical table:

```text
modifiers
```

Contoh:

```text
level
option
addon
customization
```

Exact modifier model harus mengikuti product requirement yang telah disepakati.

---

# 17. Migration 012 — Product Modifiers

Logical table:

```text
product_modifiers
```

Relationship:

```text
products
   ↕
product_modifiers
   ↕
modifiers
```

Purpose:

menentukan modifier yang tersedia untuk product.

---

# 18. Migration 013 — Tables

Logical table:

```text
tables
```

Important distinction:

```text
TABLE
≠
ORDER
≠
TABLE SESSION
```

Minimum conceptual:

```text
id
table_code
display_name
capacity
status
is_active
created_at
updated_at
```

Table status dan order status tidak boleh dicampur.

---

# 19. Migration 014 — Table QR

Logical table:

```text
table_qr
```

Purpose:

mengelola QR identity untuk customer ordering.

Minimum conceptual:

```text
id
table_id
qr_identifier
is_active
created_at
updated_at
```

QR identifier harus unique sesuai design.

QR identifier bukan pengganti authorization untuk sensitive data.

---

# 20. Migration 015 — Table Sessions

Logical table:

```text
table_sessions
```

Purpose:

represent operational dining session.

Model:

```text
table
   ↓
table_session
   ↓
multiple orders
```

Satu table session dapat memiliki lebih dari satu order.

Historical order tidak boleh hilang ketika session ditutup.

---

# 21. Migration 016 — Orders

Logical table:

```text
orders
```

Purpose:

core transactional entity.

Minimum conceptual:

```text
id
order_number
table_session_id
source
status
notes
created_by
created_at
updated_at
```

Source:

```text
customer
waiter
```

Status mengikuti order state machine.

Jangan mengizinkan arbitrary status string tanpa validation.

---

# 22. Migration 017 — Order Items

Logical table:

```text
order_items
```

Minimum conceptual:

```text
id
order_id
product_id
product_name_snapshot
unit_price_snapshot
quantity
subtotal
notes
created_at
```

Critical rule:

```text
order_items = historical snapshot
```

Jika product berubah:

```text
product.current_price
```

tidak mengubah:

```text
order_items.unit_price_snapshot
```

Backend menghitung authoritative amount.

---

# 23. Migration 018 — Order Item Modifiers

Logical table:

```text
order_item_modifiers
```

Purpose:

menyimpan modifier yang benar-benar dipilih pada transaksi.

Modifier historical data harus tetap tersedia meskipun catalog modifier berubah.

Jika diperlukan, simpan snapshot name/price untuk historical integrity.

---

# 24. Migration 019 — Order Status History

Logical table:

```text
order_status_history
```

Minimum:

```text
id
order_id
from_status
to_status
actor_id
actor_role
reason
created_at
```

Purpose:

immutable-oriented audit trail untuk lifecycle order.

Jangan menghapus history hanya karena order selesai.

---

# 25. Migration 020 — Payments

Logical table:

```text
payments
```

Minimum conceptual:

```text
id
order_id
payment_method
status
amount
provider_reference
paid_at
created_at
updated_at
```

Payment state:

```text
PENDING
PAID
FAILED
EXPIRED
CANCELLED
REFUNDED
```

Payment provider tetap configurable.

Jangan mengunci schema ke satu provider sebelum provider diputuskan.

---

# 26. Migration 021 — Service Requests

Logical table:

```text
service_requests
```

Purpose:

customer service request.

Contoh:

```text
CALL_WAITER
REQUEST_BILL
OTHER_SERVICE
```

Lifecycle:

```text
REQUESTED
   ↓
ACKNOWLEDGED
   ↓
RESOLVED
```

Sensitive request mutation harus dapat diaudit.

---

# 27. Migration 022 — Notifications

Logical table:

```text
notifications
```

Purpose:

persistent operational notification jika diperlukan.

Contoh:

```text
new order
ready order
service request
payment event
admin notification
```

Realtime event bukan pengganti persistent notification jika notification harus tetap tersedia setelah reconnect.

---

# 28. Migration 023 — Audit Logs

Logical table:

```text
audit_logs
```

Minimum:

```text
id
actor_id
actor_role
action
entity_type
entity_id
before
after
reason
created_at
```

Audit untuk sensitive actions.

Contoh:

```text
role assignment
price change
order rejection
order cancellation
void
refund
permission changes
user activation/deactivation
```

Audit log tidak boleh dapat dimanipulasi oleh ordinary users.

---

# 29. Migration 024 — Indexes

Index harus mengikuti actual query patterns.

Minimum candidates:

```text
orders.status
orders.table_session_id
orders.created_at
orders.order_number

order_items.order_id

order_status_history.order_id
order_status_history.created_at

payments.order_id
payments.status
payments.created_at

service_requests.status
service_requests.created_at

notifications.actor_id
notifications.created_at

audit_logs.actor_id
audit_logs.entity_type
audit_logs.entity_id
audit_logs.created_at
```

Jangan membuat index pada semua column tanpa query justification.

---

# 30. Migration 025 — Constraints

Review dan enforce:

```text
NOT NULL
UNIQUE
FOREIGN KEY
CHECK
```

Examples:

```text
quantity > 0
price >= 0
amount >= 0
```

Status values harus dibatasi.

Foreign key behavior harus dipilih dengan mempertimbangkan historical data.

Jangan menggunakan cascading delete pada transactional records tanpa explicit approval.

---

# 31. Migration 026 — Database Functions

Database functions hanya untuk logic yang memang membutuhkan database-side enforcement.

Candidate functions:

```text
current_user_is_active()
has_role()
has_permission()
auth_user_id()
```

Function security harus mengikuti Auth/RBAC/RLS specification.

SECURITY DEFINER hanya jika benar-benar diperlukan.

Jika menggunakan SECURITY DEFINER:

- search_path harus aman
- privilege exposure harus minimum
- function ownership harus dipahami
- arbitrary user input tidak boleh dieksekusi sebagai trusted SQL

---

# 32. Migration 027 — Order Transition Enforcement

Order transition harus atomic.

Conceptual command:

```text
current_status
+
requested_status
+
actor
+
permission
+
reason
```

Database/backend harus memastikan transition masih valid pada saat mutation.

Tidak boleh:

```text
client:
status = READY
```

langsung diterima sebagai arbitrary update.

---

# 33. Migration 028 — Audit / Transition Trigger Strategy

Gunakan trigger hanya bila membantu integrity yang jelas.

Jangan memasukkan seluruh business logic ke trigger.

Business workflow kompleks tetap berada pada application/server command layer.

Database trigger dapat digunakan untuk:

- timestamps
- narrow integrity enforcement
- append-only history support jika design sudah ditetapkan

---

# 34. Migration 029 — RLS Foundation

Enable RLS pada protected tables.

Conceptual:

```sql
alter table profiles enable row level security;
alter table orders enable row level security;
...
```

RLS harus diuji sebelum production.

Jangan menggunakan:

```text
USING (true)
```

untuk protected operational data kecuali akses tersebut memang sengaja public dan sudah direview.

---

# 35. Migration 030 — RLS Policies

Policies mengikuti:

```text
anonymous
customer
waiter
cashier
kitchen
supervisor
admin
owner
```

Setiap table harus memiliki policy yang eksplisit.

Test:

```text
allowed
denied
cross-user
cross-role
inactive-user
anonymous
```

Frontend permission tidak menggantikan RLS.

---

# 36. Public Customer Boundary

Customer MVP tidak menggunakan employee account.

Public access harus dibatasi hanya pada data yang diperlukan:

```text
active catalog
active categories
table context
customer's own operational order context
allowed service requests
allowed order status
```

Jangan expose:

```text
profiles
roles
permissions
payments of other orders
audit_logs
all orders
employee data
```

Public order access tidak boleh hanya mengandalkan:

```text
order_id
```

sebagai secret.

---

# 37. Seed Strategy

Seed dipisahkan dari migrations.

Structure:

```text
supabase/seed/
├── development.sql
└── test.sql
```

Seed harus deterministic.

Development seed dapat menyediakan:

```text
roles
permissions
role permissions
test users
sample categories
sample products
sample tables
```

Jangan membuat transaction history palsu di production.

---

# 38. Migration Testing

Untuk setiap migration:

```text
Fresh DB
   ↓
Run migration
   ↓
Schema inspection
   ↓
Constraint test
   ↓
RLS test
   ↓
Application integration test
```

Migration harus dapat dijalankan dari database kosong.

---

# 39. Migration Rollback Strategy

Tidak semua migration aman untuk automatic rollback.

Untuk destructive migration:

```text
backup
+
review
+
forward migration
```

lebih disukai daripada blind rollback.

Sebelum destructive change:

```text
STOP
→ backup/recovery plan
→ review
→ approval
```

---

# 40. Production Migration Rules

Production migration hanya setelah:

```text
Development PASS
        ↓
Preview/Staging PASS
        ↓
Security/RLS PASS
        ↓
UAT PASS
        ↓
Backup verified
        ↓
Production migration
```

Migration production harus dapat diidentifikasi dengan jelas dari Git commit.

---

# 41. Migration Validation Checklist

Untuk setiap migration:

- [ ] filename/version correct
- [ ] dependency available
- [ ] SQL syntax valid
- [ ] fresh database works
- [ ] constraints correct
- [ ] foreign keys correct
- [ ] indexes justified
- [ ] RLS reviewed
- [ ] permissions reviewed
- [ ] no secret
- [ ] no destructive operation without approval
- [ ] application tests pass
- [ ] documentation updated

---

# 42. Cline Prompt — Database Migration

Gunakan prompt berikut ketika mulai implementasi database:

```text
You are implementing the Tepi Sawah Resto & Cafe PostgreSQL database.

Read these documents first:

- docs/project/PROJECT_RULES.md
- docs/project/DESIGN_FREEZE.md
- docs/architecture/TECHNICAL_ARCHITECTURE.md
- docs/database/DATABASE_SCHEMA.md
- docs/database/DATABASE_MIGRATION_PLAN.md
- docs/api/API_CONTRACT.md
- docs/security/AUTH_RBAC_RLS.md
- docs/architecture/REALTIME_SPEC.md
- docs/qa/TESTING_STRATEGY.md
- docs/environment/ENVIRONMENT_CONFIG.md
- docs/implementation/CLINE_IMPLEMENTATION_PLAN.md

Task:

1. Inspect the existing Supabase repository.
2. Inspect existing migrations before creating new ones.
3. Implement ONLY the current migration task.
4. Follow migration dependency order.
5. Do not invent tables or business rules.
6. Do not modify unrelated tables.
7. Do not bypass RLS.
8. Do not create custom authentication.
9. Do not store passwords.
10. Do not store secrets in the database schema.
11. Do not use service-role logic as a replacement for RLS.
12. Do not add destructive migrations without explicit approval.
13. Keep migrations deterministic.
14. Keep transactional historical data immutable where specified.

After implementation:

- validate migration syntax
- apply to development database
- inspect resulting schema
- run relevant tests
- run RLS/security tests
- run typecheck
- run lint
- run build where relevant
- inspect Git diff

Return:

A. Migration files created
B. Tables/constraints/indexes/functions/policies created
C. Tests executed
D. Results
E. Security findings
F. Migration risks
G. Missing decisions
H. Files changed

Do not start the next migration phase until the current migration passes validation.

If any business rule is undefined, STOP and report it.
Do not guess.
```

---

# 43. Final Migration Sequence

Logical implementation order:

```text
001 Extensions
002 Profiles
003 Roles
004 Permissions
005 User Roles
006 Role Permissions

007 Restaurant Settings
008 Operating Hours

009 Categories
010 Products
011 Modifiers
012 Product Modifiers

013 Tables
014 Table QR
015 Table Sessions

016 Orders
017 Order Items
018 Order Item Modifiers
019 Order Status History

020 Payments
021 Service Requests
022 Notifications
023 Audit Logs

024 Indexes
025 Constraints
026 Database Functions
027 Order Transition Enforcement
028 Audit/Transition Support

029 RLS Foundation
030 RLS Policies

031 Development/Test Seed
```

Actual migration filenames should use the timestamp format generated by Supabase CLI.

---

# 44. Definition of Done

Database foundation is DONE only when:

- [ ] all required tables exist
- [ ] relationships are correct
- [ ] constraints are correct
- [ ] indexes are justified
- [ ] functions reviewed
- [ ] RLS enabled
- [ ] RLS policies tested
- [ ] order transition enforcement tested
- [ ] audit behavior tested
- [ ] fresh database migration succeeds
- [ ] development integration succeeds
- [ ] security tests pass
- [ ] no secrets committed
- [ ] documentation matches implementation
- [ ] Git diff reviewed
- [ ] checkpoint committed

**Status:** READY FOR DATABASE IMPLEMENTATION.
