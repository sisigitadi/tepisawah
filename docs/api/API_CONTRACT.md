# TEPI SAWAH RESTO & CAFE
## API Contract v1.0

**Status:** Draft for Implementation  
**Version:** 1.0  
**Date:** 2026-09-27  
**Architecture:** React + TypeScript + Vite + Supabase + PostgreSQL + Supabase Auth + Realtime  
**Primary domains:** `tepisawah.id`, `order.tepisawah.id`, `pos.tepisawah.id`, `kitchen.tepisawah.id`, `waiter.tepisawah.id`

---

# 1. Purpose

Dokumen ini mendefinisikan kontrak komunikasi antara frontend dan backend Tepi Sawah.

API harus menjadi boundary resmi untuk:

- authentication dan session
- RBAC dan authorization
- menu/catalog
- table dan QR
- table session
- customer order
- waiter order
- cashier confirmation
- kitchen workflow
- waiter service workflow
- payment
- service request
- notification
- audit trail
- dashboard/operational read model

Frontend tidak boleh menjadi source of truth untuk status order, harga, total transaksi, permission, payment status, atau audit.

---

# 2. API Principles

## 2.1 Backend Authority

Backend/database menentukan:

- harga final
- product availability
- table validity
- table session
- order status
- payment status
- actor permission
- valid status transition
- tax/discount calculation bila dikonfigurasi
- audit record
- idempotency

Client hanya mengirim intent.

## 2.2 Security

Tidak boleh:

- menyimpan service-role key di frontend
- mempercayai `role` dari browser
- mempercayai `price` dari client
- mempercayai `total` dari client
- mengizinkan client mengubah status secara bebas
- menghapus audit log dari client

Authorization harus diperiksa server-side dan dilindungi RLS.

## 2.3 Idempotency

Command yang dapat menghasilkan transaksi harus mendukung idempotency.

Minimal:

- create order
- submit order
- confirm order
- reject order
- payment
- service request
- status transition

Client mengirim:

`Idempotency-Key: <unique-key>`

Backend harus mengembalikan hasil yang sama untuk request yang sudah berhasil diproses dengan key yang sama.

---

# 3. Base API Convention

Untuk production, gunakan domain-oriented command functions melalui Supabase Edge Functions/RPC sesuai kebutuhan.

Contoh logical base:

`https://<project-ref>.supabase.co/functions/v1`

Header umum:

```http
Authorization: Bearer <access_token>
Content-Type: application/json
Idempotency-Key: <unique-key>
X-Client-Version: <app-version>
```

Public customer ordering tidak membutuhkan account login pada MVP, tetapi tetap harus menggunakan server-side validation dan controlled anonymous access.

---

# 4. Standard Response

## 4.1 Success

```json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "uuid",
    "timestamp": "2026-09-27T04:00:00Z"
  }
}
```

## 4.2 Error

```json
{
  "success": false,
  "error": {
    "code": "ORDER_INVALID_STATUS",
    "message": "Order tidak dapat diproses dari status saat ini.",
    "details": {}
  },
  "meta": {
    "requestId": "uuid",
    "timestamp": "2026-09-27T04:00:00Z"
  }
}
```

Frontend harus menggunakan `error.code`, bukan melakukan parsing terhadap string `message`.

---

# 5. Error Code Convention

| Code | Meaning |
|---|---|
| `AUTH_REQUIRED` | Authentication diperlukan |
| `AUTH_INVALID` | Session/token tidak valid |
| `FORBIDDEN` | User tidak memiliki permission |
| `NOT_FOUND` | Resource tidak ditemukan |
| `VALIDATION_ERROR` | Input tidak valid |
| `CONFLICT` | Conflict/concurrency |
| `IDEMPOTENCY_CONFLICT` | Idempotency key digunakan dengan payload berbeda |
| `TABLE_INVALID` | Table tidak valid/nonaktif |
| `TABLE_SESSION_INVALID` | Table session tidak valid |
| `PRODUCT_UNAVAILABLE` | Product tidak tersedia |
| `ORDER_INVALID_STATUS` | Invalid order state transition |
| `ORDER_EMPTY` | Order tidak memiliki item |
| `ORDER_ALREADY_SUBMITTED` | Order sudah submitted |
| `PAYMENT_INVALID` | Payment tidak valid |
| `PAYMENT_ALREADY_PAID` | Order sudah dibayar |
| `PAYMENT_FAILED` | Payment gagal |
| `SERVICE_REQUEST_INVALID` | Service request tidak valid |
| `RATE_LIMITED` | Request terlalu sering |
| `SERVER_ERROR` | Internal server error |

HTTP status mengikuti semantics umum:

- `200` successful read/update
- `201` created
- `400` validation
- `401` authentication
- `403` authorization
- `404` not found
- `409` conflict
- `422` business rule violation
- `429` rate limited
- `500` server error

---

# 6. Authentication API

## 6.1 Login

Supabase Auth menjadi provider authentication.

Logical operation:

`POST /auth/login`

Request:

```json
{
  "email": "user@example.com",
  "password": "********"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com"
    },
    "session": {
      "accessToken": "token",
      "refreshToken": "token",
      "expiresAt": 0
    }
  }
}
```

Role tidak boleh diterima sebagai input login.

Role harus berasal dari backend/RBAC.

## 6.2 Current User

`GET /me`

Response:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com"
    },
    "profile": {
      "displayName": "Nama User"
    },
    "roles": ["cashier"],
    "permissions": [
      "orders.read",
      "orders.confirm",
      "payments.create"
    ]
  }
}
```

---

# 7. Catalog API

## 7.1 Get Categories

`GET /catalog/categories`

Query:

```text
?active=true
```

## 7.2 Get Products

`GET /catalog/products`

Query:

```text
?categoryId=<uuid>&active=true&search=<term>
```

Response product minimal:

```json
{
  "id": "uuid",
  "categoryId": "uuid",
  "name": "Nasi Liwet Sawah",
  "description": "...",
  "price": 45000,
  "currency": "IDR",
  "imageUrl": "...",
  "isAvailable": true,
  "modifiers": []
}
```

Harga di response adalah current catalog price.

Saat order dibuat, backend harus membuat snapshot harga ke `order_items`.

## 7.3 Product Detail

`GET /catalog/products/:id`

Tidak boleh mengandalkan client untuk menentukan harga order.

---

# 8. Table & QR API

## 8.1 Get Active Tables

`GET /tables`

Query:

```text
?active=true
```

Response:

```json
{
  "id": "uuid",
  "code": "A12",
  "name": "Meja A12",
  "capacity": 4,
  "status": "AVAILABLE"
}
```

## 8.2 Resolve QR

`GET /public/table/:code`

Tujuan:

- validasi QR
- mendapatkan table
- mendapatkan restaurant settings yang public
- mendapatkan operating status
- mendapatkan active table session bila ada

Response:

```json
{
  "success": true,
  "data": {
    "table": {
      "id": "uuid",
      "code": "A12",
      "name": "Meja A12"
    },
    "restaurant": {
      "name": "Tepi Sawah Resto & Cafe",
      "isOpen": true
    },
    "session": {
      "id": "uuid",
      "status": "OPEN"
    }
  }
}
```

QR tidak boleh memberikan akses ke internal dashboard.

---

# 9. Table Session API

## 9.1 Open Table Session

Authorized staff:

`POST /table-sessions`

Request:

```json
{
  "tableId": "uuid"
}
```

Backend:

- validasi table
- cek session aktif
- cegah duplicate active session
- membuat session bila diperlukan

## 9.2 Get Table Session

`GET /table-sessions/:id`

## 9.3 Close Table Session

`POST /table-sessions/:id/close`

Backend hanya boleh close jika business rules terpenuhi.

---

# 10. Customer Order API

## 10.1 Create Draft Order

`POST /orders`

Request:

```json
{
  "source": "CUSTOMER_QR",
  "tableId": "uuid",
  "tableSessionId": "uuid",
  "items": [
    {
      "productId": "uuid",
      "quantity": 2,
      "modifierIds": ["uuid"],
      "notes": "Tidak terlalu pedas"
    }
  ],
  "customerNote": ""
}
```

Client tidak mengirim authoritative:

- unit price
- subtotal
- tax
- total

Backend mengambil data catalog dan menghitung ulang.

Response:

```json
{
  "success": true,
  "data": {
    "order": {
      "id": "uuid",
      "orderNumber": "TS-20260927-0001",
      "status": "DRAFT",
      "subtotal": 90000,
      "discount": 0,
      "tax": 0,
      "total": 90000,
      "items": []
    }
  }
}
```

## 10.2 Submit Order

`POST /orders/:id/submit`

Request:

```json
{
  "idempotencyKey": "uuid"
}
```

Expected:

`DRAFT → SUBMITTED → PENDING_CONFIRMATION`

Transition harus atomic.

Response:

```json
{
  "success": true,
  "data": {
    "orderId": "uuid",
    "status": "PENDING_CONFIRMATION"
  }
}
```

## 10.3 Get Customer Order

`GET /public/orders/:id`

Customer hanya boleh melihat order yang terkait dengan valid table/session/customer context.

Response tidak boleh memuat:

- internal permission
- audit details
- supplier/internal data
- payment credentials
- sensitive staff information

---

# 11. Waiter Manual Order API

## 11.1 Create Waiter Order

`POST /orders`

Request:

```json
{
  "source": "WAITER",
  "tableId": "uuid",
  "tableSessionId": "uuid",
  "items": [],
  "customerNote": "",
  "internalNote": ""
}
```

Permission:

`orders.create_manual`

## 11.2 Submit Waiter Order

`POST /orders/:id/submit`

Actor:

- waiter
- cashier
- authorized supervisor

---

# 12. Order Query API

## 12.1 Order Queue

`GET /orders`

Query examples:

```text
?status=PENDING_CONFIRMATION
?status=CONFIRMED
?status=PREPARING
?status=READY
?tableId=<uuid>
?source=CUSTOMER_QR
?limit=50
&cursor=<cursor>
```

Pagination harus cursor-based untuk operational queues.

## 12.2 Order Detail

`GET /orders/:id`

Response:

```json
{
  "id": "uuid",
  "orderNumber": "TS-20260927-0001",
  "source": "CUSTOMER_QR",
  "table": {},
  "tableSessionId": "uuid",
  "status": "CONFIRMED",
  "items": [],
  "subtotal": 90000,
  "discount": 0,
  "tax": 0,
  "total": 90000,
  "paymentStatus": "UNPAID",
  "createdAt": "...",
  "updatedAt": "..."
}
```

---

# 13. Order State Transition API

Gunakan satu command terpusat.

`POST /orders/:id/transition`

Request:

```json
{
  "toStatus": "CONFIRMED",
  "reason": null
}
```

Backend harus menentukan actor berdasarkan authenticated session.

Backend mengecek:

1. current status
2. requested status
3. actor role
4. permission
5. business rule
6. concurrency/version
7. idempotency

## Allowed transitions

| From | To | Actor |
|---|---|---|
| `DRAFT` | `SUBMITTED` | Customer / Waiter |
| `SUBMITTED` | `PENDING_CONFIRMATION` | System |
| `PENDING_CONFIRMATION` | `CONFIRMED` | Cashier / Authorized |
| `PENDING_CONFIRMATION` | `REJECTED` | Cashier / Supervisor |
| `CONFIRMED` | `PREPARING` | Kitchen |
| `PREPARING` | `READY` | Kitchen |
| `READY` | `SERVED` | Waiter |
| `SERVED` | `PAID` | Cashier |
| `PAID` | `COMPLETED` | System / Cashier |

Exceptional:

- `CONFIRMED → CANCELLED`
- `PREPARING → CANCELLED` only if authorized
- `PAID → REFUNDED` only if authorized

Every exceptional transition requires reason and audit.

---

# 14. Cashier API

## 14.1 Pending Confirmation

`GET /cashier/orders/pending-confirmation`

## 14.2 Confirm

`POST /orders/:id/transition`

```json
{
  "toStatus": "CONFIRMED"
}
```

## 14.3 Reject

```json
{
  "toStatus": "REJECTED",
  "reason": "Item tidak tersedia"
}
```

Reason wajib untuk rejection.

## 14.4 Payment Queue

`GET /cashier/payment-queue`

Filter:

```text
?status=UNPAID
?tableId=<uuid>
```

---

# 15. Payment API

Payment is a separate domain.

## 15.1 Create Payment

`POST /payments`

Request:

```json
{
  "orderId": "uuid",
  "method": "CASH",
  "amount": 90000,
  "reference": null
}
```

Backend validates:

- order exists
- order status eligible
- amount
- payment method
- existing payment
- actor permission

Client amount is not trusted blindly.

## 15.2 Cash Payment

```json
{
  "orderId": "uuid",
  "method": "CASH",
  "amountTendered": 100000
}
```

Backend calculates:

```text
change = amountTendered - amountDue
```

Client may display calculation but backend remains authoritative.

## 15.3 QRIS

For actual QRIS provider integration:

`POST /payments/qris`

Request:

```json
{
  "orderId": "uuid"
}
```

Response:

```json
{
  "paymentId": "uuid",
  "status": "PENDING",
  "provider": "<configured-provider>",
  "reference": "...",
  "expiresAt": "..."
}
```

Actual provider is intentionally unresolved until selected and configured.

Do not hard-code a provider in MVP architecture.

## 15.4 Payment Status

`GET /payments/:id`

Statuses:

- `PENDING`
- `PAID`
- `FAILED`
- `EXPIRED`
- `CANCELLED`

Payment confirmation from an external provider must be verified server-side.

---

# 16. Receipt API

## 16.1 Get Receipt

`GET /orders/:id/receipt`

Response:

```json
{
  "orderNumber": "TS-20260927-0001",
  "table": "A12",
  "items": [],
  "subtotal": 90000,
  "discount": 0,
  "tax": 0,
  "total": 90000,
  "payment": {
    "method": "CASH",
    "status": "PAID"
  },
  "paidAt": "..."
}
```

Receipt must use persisted transaction values, not recalculate from current product catalog.

---

# 17. Kitchen API

## 17.1 Kitchen Queue

`GET /kitchen/orders`

Default operational states:

- `CONFIRMED`
- `PREPARING`
- `READY`

## 17.2 Start Preparing

`POST /orders/:id/transition`

```json
{
  "toStatus": "PREPARING"
}
```

## 17.3 Mark Ready

```json
{
  "toStatus": "READY"
}
```

## 17.4 Recall

Recall is an exceptional action.

`POST /kitchen/orders/:id/recall`

Request:

```json
{
  "reason": "Perlu koreksi item"
}
```

Permission required.

Every recall must create audit history.

---

# 18. Waiter Service API

## 18.1 Ready Orders

`GET /waiter/orders/ready`

## 18.2 Mark Served

`POST /orders/:id/transition`

```json
{
  "toStatus": "SERVED"
}
```

Waiter cannot mark order as paid.

---

# 19. Service Request API

Customer actions:

- call waiter
- request bill

## 19.1 Create

`POST /service-requests`

Request:

```json
{
  "tableId": "uuid",
  "tableSessionId": "uuid",
  "type": "CALL_WAITER"
}
```

Types:

- `CALL_WAITER`
- `REQUEST_BILL`

Initial status:

`REQUESTED`

## 19.2 Acknowledge

`POST /service-requests/:id/acknowledge`

## 19.3 Resolve

`POST /service-requests/:id/resolve`

Response:

```json
{
  "status": "RESOLVED"
}
```

---

# 20. Notification API

## 20.1 User Notifications

`GET /notifications`

Query:

```text
?unread=true
```

## 20.2 Mark Read

`POST /notifications/:id/read`

Notifications should normally be delivered through Supabase Realtime.

REST/API remains useful for initial hydration and recovery.

---

# 21. Realtime Contract

Supabase Realtime is used for operational changes.

Recommended channels:

```text
orders
tables
payments
service_requests
notifications
```

Example conceptual events:

```json
{
  "event": "ORDER_STATUS_CHANGED",
  "orderId": "uuid",
  "from": "PREPARING",
  "to": "READY",
  "occurredAt": "..."
}
```

Frontend must treat realtime as an event/update signal, not as the authoritative security boundary.

After reconnect:

1. detect connection recovery
2. refetch current operational data
3. reconcile local UI
4. resume realtime subscription

Do not assume that every event was received.

---

# 22. Admin API

Admin scope:

- categories
- products
- modifiers
- tables
- QR
- users
- roles
- permissions
- restaurant settings
- operating hours
- ordering configuration
- payment configuration
- audit log

## Product

`POST /admin/products`

`PATCH /admin/products/:id`

`POST /admin/products/:id/archive`

Archive is preferred over hard delete where historical references exist.

## Table

`POST /admin/tables`

`PATCH /admin/tables/:id`

`POST /admin/tables/:id/qr/regenerate`

## User

`GET /admin/users`

`PATCH /admin/users/:id`

## Role Assignment

`POST /admin/users/:id/roles`

Request:

```json
{
  "roleId": "uuid"
}
```

RBAC changes must generate audit entries.

---

# 23. Audit API

Audit logs are primarily generated server-side.

## Query

`GET /admin/audit-logs`

Filters:

```text
?actorId=<uuid>
?action=ORDER_STATUS_CHANGED
?entityType=ORDER
?entityId=<uuid>
?from=<timestamp>
&to=<timestamp>
```

Audit fields:

```json
{
  "id": "uuid",
  "actorId": "uuid",
  "actorRole": "cashier",
  "action": "ORDER_STATUS_CHANGED",
  "entityType": "ORDER",
  "entityId": "uuid",
  "metadata": {},
  "createdAt": "..."
}
```

Normal users cannot modify audit records.

---

# 24. Dashboard API

Dashboard is read-oriented.

## Operational Summary

`GET /dashboard/operational-summary`

Possible response:

```json
{
  "activeOrders": 5,
  "pendingConfirmation": 2,
  "preparing": 2,
  "ready": 1,
  "waitingPayment": 3,
  "openTables": 8
}
```

These values must be calculated from backend data.

Do not persist derived dashboard numbers unless there is a documented reason.

---

# 25. Pagination

List APIs should support:

```text
limit
cursor
```

Example:

`GET /orders?status=READY&limit=50&cursor=<cursor>`

Response:

```json
{
  "data": [],
  "meta": {
    "nextCursor": "...",
    "hasMore": true
  }
}
```

Avoid page-number pagination for high-frequency operational queues unless a specific use case requires it.

---

# 26. Concurrency Control

Critical mutations should use one or more:

- database transaction
- row-level lock
- optimistic version
- atomic conditional update
- idempotency key

Example:

An order currently `PREPARING` cannot be changed to `READY` by two kitchen clients simultaneously in a way that creates duplicate transition records.

Expected behavior:

- first valid request succeeds
- duplicate request returns idempotent result where applicable
- conflicting request receives `409 CONFLICT`

---

# 27. Price Integrity

At order creation:

1. receive `productId`
2. load active product
3. load current price
4. load valid modifiers
5. calculate item subtotal
6. calculate discount if applicable
7. calculate tax if configured
8. calculate final total
9. persist snapshot into order item

Order item should preserve:

```json
{
  "productId": "uuid",
  "productNameSnapshot": "Nasi Liwet Sawah",
  "unitPriceSnapshot": 45000,
  "quantity": 2,
  "subtotal": 90000
}
```

Future product price changes must not change historical orders.

---

# 28. Discount & Tax Boundary

The architecture supports:

- discount
- promotion
- package/menu bundle
- tax

However, actual business rules must be configured before implementation.

Do not invent:

- tax percentage
- discount percentage
- promotion eligibility
- minimum purchase
- service charge
- rounding policy

If configuration does not exist, return zero/disabled according to the configured business rule.

The existing prototype's PB1 value must not automatically become production business logic.

---

# 29. Authorization Matrix

| Operation | Customer | Waiter | Cashier | Kitchen | Supervisor | Admin | Owner |
|---|---:|---:|---:|---:|---:|---:|---:|
| Read public catalog | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create customer order | ✓ | - | - | - | - | - | - |
| Create manual order | - | ✓ | ✓ | - | ✓ | ✓ | ✓ |
| Confirm order | - | - | ✓ | - | ✓ | ✓ | ✓ |
| Reject order | - | - | ✓ | - | ✓ | ✓ | ✓ |
| Start preparing | - | - | - | ✓ | ✓ | ✓ | ✓ |
| Mark ready | - | - | - | ✓ | ✓ | ✓ | ✓ |
| Mark served | - | ✓ | - | - | ✓ | ✓ | ✓ |
| Create payment | - | - | ✓ | - | ✓ | ✓ | ✓ |
| Refund | - | - | - | - | ✓ | ✓ | ✓ |
| Manage catalog | - | - | - | - | - | ✓ | ✓ |
| Manage users | - | - | - | - | - | ✓ | ✓ |
| View audit | - | - | limited | - | ✓ | ✓ | ✓ |

Exact permission IDs must be defined in the RBAC seed/migration.

---

# 30. Public Customer Security

Because MVP customer ordering does not require login:

- QR/table context must be validated server-side
- public endpoints must expose only necessary fields
- rate limiting should be applied
- abusive order creation must be controlled
- order lookup must not expose arbitrary orders
- customer must not be able to change another table's order
- customer cannot invoke internal transitions
- customer cannot create payment records
- customer cannot access audit logs

A public order identifier should not be treated as a sufficient authorization credential.

---

# 31. Frontend Data Rules

Frontend may cache:

- catalog
- public restaurant settings
- current order display
- operational list for UI responsiveness

Frontend must refetch/reconcile after:

- reconnect
- mutation success
- stale-data detection
- permission changes
- session refresh

Frontend must never permanently persist authoritative:

- payment result
- order status
- total
- role
- permission
- audit state

---

# 32. API Command Naming

Use business intent, not generic database CRUD, for critical operations.

Preferred:

```text
submitOrder
confirmOrder
rejectOrder
startPreparing
markReady
markServed
createPayment
refundPayment
callWaiter
requestBill
acknowledgeServiceRequest
resolveServiceRequest
```

Avoid exposing generic unrestricted:

```text
updateOrderStatus
updatePaymentStatus
setOrderTotal
setUserRole
```

unless protected internally and not directly available to untrusted clients.

---

# 33. Transaction Boundaries

## Submit Order

One atomic transaction should cover:

- validate table/session
- validate products
- calculate prices
- create/update order
- create order items
- create status history
- create audit event if applicable

## Confirm Order

Atomic:

- validate current status
- update order status
- insert status history
- create operational notification/event

## Payment

Atomic:

- validate order
- validate amount
- create payment
- update payment status
- transition order if rules permit
- write audit event

---

# 34. API Testing Requirements

Before production, test at minimum:

### Authentication

- valid login
- invalid login
- expired session
- unauthorized route

### Customer

- valid QR
- invalid QR
- empty cart
- unavailable product
- duplicate submit
- unauthorized order lookup

### Order

- valid transition
- invalid transition
- wrong role
- concurrent transition
- rejection without reason
- cancellation without permission

### Payment

- correct amount
- incorrect amount
- duplicate payment
- already paid
- failed payment
- expired QRIS
- unauthorized refund

### Kitchen

- confirmed → preparing
- preparing → ready
- unauthorized transition
- duplicate click

### Waiter

- ready → served
- service request lifecycle

### Admin

- role assignment
- product modification
- table/QR change
- audit generation

---

# 35. MVP API Scope

## Must implement

- Auth
- `/me`
- public catalog
- table QR resolution
- table sessions
- create order
- submit order
- order queue
- order detail
- centralized order transition
- cashier confirmation
- kitchen transition
- waiter transition
- payment
- service request
- notifications/realtime
- admin catalog
- admin tables/QR
- users/RBAC
- audit log

## Not required for first production MVP

- inventory
- recipe costing
- supplier management
- accounting
- CRM
- loyalty
- reservations engine
- multi-branch
- AI features
- advanced analytics
- automated promotion engine
- external payment provider lock-in

---

# 36. Implementation Order

Recommended implementation sequence:

```text
01 Auth + Profiles
02 Roles + Permissions + RLS
03 Restaurant Settings
04 Categories + Products + Modifiers
05 Tables + QR
06 Table Sessions
07 Orders + Order Items
08 Order Status History
09 Centralized Transition Command
10 Customer QR Ordering
11 Cashier Queue
12 Kitchen Queue
13 Waiter Service
14 Payments
15 Service Requests
16 Notifications + Realtime
17 Admin Management
18 Audit
19 Dashboard
20 Integration Testing
21 Production Hardening
```

Do not start UI integration against uncontrolled mock APIs after backend contracts are finalized.

---

# 37. Cline Implementation Rules

Cline must:

1. read this API contract before implementing integration
2. read database schema
3. read project rules
4. read design freeze
5. implement one domain at a time
6. avoid duplicating business rules in multiple frontend modules
7. use typed request/response contracts
8. validate server responses
9. handle loading/error/empty states
10. never expose secrets
11. never bypass RLS
12. never hard-code production role permissions in UI as the security mechanism
13. never trust client price/total/status
14. use idempotency for critical commands
15. write tests for critical transitions
16. create small commits
17. stop when an unresolved architecture decision blocks implementation

---

# 38. Unresolved Decisions Before Production

The following must be explicitly configured before final production release:

- Supabase project/environment
- exact RLS policies
- exact permission seed
- restaurant timezone
- operating hours
- currency configuration
- tax/service charge policy
- discount/promotion rules
- payment provider for QRIS
- payment settlement behavior
- receipt numbering format
- printer integration strategy
- notification provider if external notifications are required
- backup/recovery policy
- production monitoring
- domain DNS configuration
- production secrets

No unresolved decision should be silently invented by Cline.

---

# 39. Definition of Done for API Layer

API layer is considered ready only when:

- authentication works
- RLS is active and tested
- RBAC is enforced server-side
- catalog is centralized
- table/QR validation works
- order creation is transactional
- price snapshot works
- order transitions are centralized
- invalid transitions are rejected
- payment integrity is enforced
- service requests work
- realtime reconnect/reconciliation works
- audit logs are generated
- idempotency is tested
- concurrency is tested
- API errors use stable error codes
- frontend is not the authority for business rules
- production secrets are not exposed
- integration tests pass

---

# 40. Next Artifact

Setelah API Contract v1.0, urutan dokumen implementasi berikutnya:

1. `AUTH_RBAC_RLS_v1.0.md`
2. `REALTIME_SPEC_v1.0.md`
3. `REPOSITORY_STRUCTURE_v1.0.md`
4. `CLINE_IMPLEMENTATION_PLAN_v1.0.md`
5. `TESTING_STRATEGY_v1.0.md`
6. `ENVIRONMENT_CONFIG_v1.0.md`
7. `MIGRATION_PLAN_v1.0.md`

Setelah dokumen tersebut selesai, implementasi dapat dimulai dari **Auth + Profiles + RBAC + RLS**, kemudian Catalog dan Tables sebelum Order Workflow.
