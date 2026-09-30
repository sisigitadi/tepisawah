# TEPI SAWAH RESTO & CAFE
## REALTIME SPECIFICATION v1.0

**Status:** Draft for Implementation  
**Version:** 1.0  
**Date:** 2026-09-27  
**Platform:** Supabase Realtime + PostgreSQL  
**Consumers:** Customer, Cashier, Kitchen, Waiter, Admin/Supervisor

---

# 1. Purpose

Dokumen ini mendefinisikan mekanisme realtime Tepi Sawah untuk memastikan perubahan operasional dapat diterima oleh client tanpa menjadikan realtime sebagai source of truth.

Realtime digunakan untuk:

- order updates
- order status changes
- payment status changes
- service requests
- notifications
- table/session changes
- operational dashboard refresh

Database tetap menjadi source of truth.

---

# 2. Core Principle

```text
PostgreSQL
    ↓
Committed State
    ↓
Realtime Event
    ↓
Client
    ↓
UI Update
```

Realtime bukan database kedua.

Jika event hilang, client harus mampu melakukan:

```text
Reconnect
   ↓
Refetch authoritative state
   ↓
Reconcile
   ↓
Resume subscription
```

---

# 3. Realtime Goals

Realtime harus menyediakan:

- low-latency operational updates
- consistent state display
- duplicate-event tolerance
- reconnect recovery
- permission-aware subscriptions
- minimal payload exposure
- scalable subscription boundaries
- predictable event naming

Realtime tidak boleh:

- menentukan authorization
- menentukan valid status transition
- menghitung payment
- menjadi source of truth
- menggantikan transaction
- dipercaya sebagai bukti bahwa database sudah berubah

---

# 4. Realtime Consumers

| Consumer | Primary Events |
|---|---|
| Customer | own/current table order |
| Cashier | new orders, order changes, payment |
| Kitchen | confirmed/preparing/ready |
| Waiter | ready orders, service requests |
| Supervisor | operational changes |
| Admin | configuration/security events where required |
| Owner | dashboard/operational events where required |

---

# 5. Logical Channels

Gunakan channel berbasis domain.

```text
orders
tables
payments
service_requests
notifications
dashboard
```

Jangan membuat satu channel global yang mengirim seluruh database kepada seluruh client.

---

# 6. Channel Security

Subscription harus mengikuti authorization.

Contoh:

```text
cashier → order operational events
kitchen → kitchen-relevant order events
waiter → ready/service events
customer → own/table-scoped events
```

Jangan memberikan:

```text
kitchen → payments
waiter → user_roles
customer → audit_logs
```

kecuali ada kebutuhan eksplisit dan policy yang sesuai.

---

# 7. Event Naming

Gunakan format:

```text
DOMAIN_ACTION
```

Contoh:

```text
ORDER_CREATED
ORDER_SUBMITTED
ORDER_CONFIRMED
ORDER_REJECTED
ORDER_PREPARING
ORDER_READY
ORDER_SERVED
ORDER_PAID
ORDER_COMPLETED
ORDER_CANCELLED
ORDER_REFUNDED
```

Payment:

```text
PAYMENT_CREATED
PAYMENT_PAID
PAYMENT_FAILED
PAYMENT_EXPIRED
PAYMENT_CANCELLED
```

Service:

```text
SERVICE_REQUEST_CREATED
SERVICE_REQUEST_ACKNOWLEDGED
SERVICE_REQUEST_RESOLVED
```

Table:

```text
TABLE_SESSION_OPENED
TABLE_SESSION_UPDATED
TABLE_SESSION_CLOSED
```

Notification:

```text
NOTIFICATION_CREATED
```

---

# 8. Event Envelope

Semua application-level event sebaiknya mengikuti struktur:

```json
{
  "eventId": "uuid",
  "eventType": "ORDER_READY",
  "entityType": "ORDER",
  "entityId": "uuid",
  "occurredAt": "2026-09-27T04:00:00Z",
  "version": 12,
  "data": {}
}
```

Fields:

| Field | Purpose |
|---|---|
| `eventId` | unique event identifier |
| `eventType` | event name |
| `entityType` | affected domain entity |
| `entityId` | entity identifier |
| `occurredAt` | event time |
| `version` | entity/version ordering |
| `data` | minimum required payload |

---

# 9. Event ID

`eventId` harus unik.

Client boleh menggunakan event ID untuk deduplication.

Contoh:

```text
receivedEvents[eventId]
```

Jangan menganggap event datang tepat satu kali.

Realtime delivery harus diperlakukan sebagai:

```text
at-least-once / duplicate-tolerant
```

bukan exactly-once.

---

# 10. Entity Version

Untuk entity yang membutuhkan ordering, gunakan version/updated sequence.

Contoh:

```text
order.version = 12
```

Client menerima:

```text
ORDER_READY version 12
```

Jika client sudah berada di version 12 dan menerima event version 11:

```text
ignore stale event
```

Jika menerima gap:

```text
client version 10
event version 13
```

lakukan reconciliation/refetch.

---

# 11. Order Realtime

Order merupakan realtime domain utama.

Lifecycle:

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

Exceptional:

```text
REJECTED
CANCELLED
VOID
REFUNDED
```

---

# 12. Order Events

Minimum:

```text
ORDER_CREATED
ORDER_SUBMITTED
ORDER_CONFIRMED
ORDER_REJECTED
ORDER_PREPARING
ORDER_READY
ORDER_SERVED
ORDER_PAID
ORDER_COMPLETED
ORDER_CANCELLED
ORDER_REFUNDED
```

Payload minimum:

```json
{
  "eventId": "uuid",
  "eventType": "ORDER_READY",
  "entityType": "ORDER",
  "entityId": "uuid",
  "version": 8,
  "data": {
    "orderId": "uuid",
    "orderNumber": "TS-20260927-0001",
    "tableId": "uuid",
    "status": "READY"
  }
}
```

Do not send unnecessary customer/payment/private information.

---

# 13. Customer Subscription

Customer only needs:

- own order status
- relevant table/session changes
- own service request state

Example:

```text
customer-order:<orderId>
```

The server must verify that the public client is authorized for that context.

Customer must not subscribe to:

```text
all-orders
```

---

# 14. Cashier Subscription

Cashier requires:

```text
orders
payments
service_requests
```

Relevant events:

- new order submitted
- confirmation changes
- rejection
- served
- payment created
- payment success/failure
- request bill

Cashier UI should refresh the authoritative order/payment record after receiving important events.

---

# 15. Kitchen Subscription

Kitchen requires only operational kitchen events.

Relevant:

```text
ORDER_CONFIRMED
ORDER_PREPARING
ORDER_CANCELLED
ORDER_RECALLED
```

Kitchen should not receive unnecessary:

```text
payment amount
payment reference
user role information
audit details
```

unless explicitly required.

---

# 16. Waiter Subscription

Waiter requires:

```text
ORDER_READY
SERVICE_REQUEST_CREATED
SERVICE_REQUEST_ACKNOWLEDGED
SERVICE_REQUEST_RESOLVED
```

Example:

```text
ready-orders
service-requests
```

Waiter can then open the relevant table/order and fetch authoritative data.

---

# 17. Payment Realtime

Payment events:

```text
PAYMENT_CREATED
PAYMENT_PAID
PAYMENT_FAILED
PAYMENT_EXPIRED
PAYMENT_CANCELLED
```

Payment status must be confirmed from the backend/database.

A realtime event is a signal:

```text
Payment changed
```

not proof that a payment provider settlement is valid.

For external payment:

```text
Provider
   ↓
Server verification/webhook
   ↓
Database update
   ↓
Realtime event
```

Never:

```text
Browser
   ↓
"Payment success"
```

as the authoritative path.

---

# 18. Service Request Realtime

Customer creates:

```text
CALL_WAITER
REQUEST_BILL
```

Flow:

```text
REQUESTED
 ↓
ACKNOWLEDGED
 ↓
RESOLVED
```

Realtime events:

```text
SERVICE_REQUEST_CREATED
SERVICE_REQUEST_ACKNOWLEDGED
SERVICE_REQUEST_RESOLVED
```

Waiter receives operational alert.

Customer receives relevant state update.

---

# 19. Table Session Realtime

Events:

```text
TABLE_SESSION_OPENED
TABLE_SESSION_UPDATED
TABLE_SESSION_CLOSED
```

Use cases:

- table availability
- active session
- operational table board
- waiter view

Table session state must remain in PostgreSQL.

---

# 20. Notification Realtime

Notification record should be persisted before or as part of the business transaction where appropriate.

Then:

```text
notification row
     ↓
Realtime event
     ↓
user notification center
```

If realtime delivery fails, notification remains available through:

```text
GET /notifications
```

This provides recovery.

---

# 21. Dashboard Realtime

Dashboard should not depend entirely on event counters.

Preferred:

```text
Initial load
    ↓
authoritative summary query
    ↓
subscribe to relevant events
    ↓
invalidate affected metrics
    ↓
refetch summary
```

Avoid:

```text
salesCount++
```

as the only source of truth.

Derived dashboard values should be reconciled from backend data.

---

# 22. Client Subscription Lifecycle

Every realtime consumer should implement:

```text
INIT
 ↓
AUTHENTICATE
 ↓
LOAD INITIAL DATA
 ↓
SUBSCRIBE
 ↓
CONNECTED
 ↓
PROCESS EVENTS
 ↓
RECONNECT / ERROR
 ↓
REFETCH
 ↓
RECONCILE
 ↓
RESUBSCRIBE
```

Do not subscribe before required authorization/context is available.

---

# 23. Initial Hydration

Before listening for updates:

1. authenticate
2. resolve permissions
3. fetch current data
4. establish subscription
5. reconcile any changes occurring during hydration

The implementation must avoid a race where:

```text
fetch starts
event occurs
subscription starts too late
event is missed
```

A practical strategy is:

```text
subscribe
  ↓
fetch authoritative state
  ↓
reconcile
```

or another equivalent strategy approved during implementation.

---

# 24. Reconnection

Connection states:

```text
CONNECTING
CONNECTED
DISCONNECTED
RECONNECTING
ERROR
```

UI should communicate connection state for operational applications.

KDS/POS/Waiter should not silently display stale data as if it were current.

---

# 25. Reconciliation

After reconnect:

```text
1. refresh authentication/session
2. refresh permissions
3. refetch active operational data
4. discard stale client assumptions
5. reconcile entity versions
6. resume normal event processing
```

For example:

```text
KDS disconnected for 30 seconds
        ↓
Reconnect
        ↓
GET /kitchen/orders
        ↓
replace/reconcile local queue
        ↓
resume realtime
```

---

# 26. Duplicate Event Handling

Client must tolerate:

```text
ORDER_READY event
ORDER_READY event
```

without:

- duplicate toast
- duplicate order card
- duplicate payment
- duplicate transition

UI state updates should be idempotent.

Critical commands must also use backend idempotency.

---

# 27. Event Ordering

Events may arrive:

- late
- duplicated
- out of order

Client must use:

- entity version
- timestamp where appropriate
- authoritative refetch

Do not rely exclusively on arrival order.

---

# 28. Stale Event Handling

Example:

```text
Current order version: 10

Event A: version 11
Event B: version 10
```

Process:

```text
11 → accept
10 → ignore
```

If:

```text
Current: 10
Event: 13
```

and version 11/12 are unknown:

```text
mark entity stale
refetch authoritative record
```

---

# 29. Optimistic UI

Optimistic UI may be used for non-critical visual interactions.

Do not use uncontrolled optimistic state for:

- payment success
- order state authority
- refund
- cancellation
- role changes
- permissions
- audit

For critical mutations:

```text
Command
 ↓
Backend transaction
 ↓
Authoritative result
 ↓
UI update
```

---

# 30. Command vs Event

Important distinction:

### Command

Client says:

```text
"Mark this order READY."
```

### Event

Backend says:

```text
"Order is now READY."
```

Never confuse the two.

The client should not publish an event pretending that a business action has already occurred.

---

# 31. Realtime and Order Transition

Correct flow:

```text
Kitchen
   ↓
POST /orders/:id/transition
   ↓
Backend validates
   ↓
DB transaction
   ↓
order status updated
   ↓
status history inserted
   ↓
notification/event generated
   ↓
Realtime
   ↓
Cashier / Waiter / Customer UI
```

---

# 32. Realtime and Audit

Important state changes should produce both:

```text
business state
+
audit history
```

Example:

```text
ORDER_PREPARING
```

should correspond to:

```text
orders.status = PREPARING
order_status_history record
audit record where applicable
realtime notification
```

The exact audit scope follows the API contract and project rules.

---

# 33. Security Boundary

Realtime does not bypass RLS.

Never solve authorization with:

```text
if (frontendRole === "cashier")
```

alone.

Correct:

```text
Auth
 ↓
RLS / backend authorization
 ↓
Realtime authorization
 ↓
minimal payload
```

---

# 34. Sensitive Payload Rules

Do not include unnecessary:

- password data
- tokens
- secrets
- payment provider credentials
- service-role information
- full audit metadata
- private user data
- internal notes when consumer does not need them

Use purpose-specific payloads.

---

# 35. Event Payload Design

Prefer:

```json
{
  "orderId": "uuid",
  "status": "READY",
  "version": 8
}
```

over sending the complete order object on every event.

Consumer can then:

```text
receive event
 ↓
fetch/order cache update
```

This reduces unnecessary data exposure and keeps authoritative reads centralized.

---

# 36. Realtime Error Handling

If subscription fails:

```text
CONNECTED
   ↓
ERROR
   ↓
show degraded state
   ↓
retry
```

Operational apps must not silently assume realtime is active.

Example KDS banner:

```text
Connection Lost
Data may be stale
Reconnecting...
```

After reconnect:

```text
Syncing...
```

then:

```text
Live
```

---

# 37. Offline Behavior

MVP should prioritize safe recovery over full offline transaction capability.

Recommended:

### Customer

If disconnected:

- show connection error
- do not falsely confirm order
- allow retry where safe

### Cashier

- show connection status
- prevent critical mutations while authoritative backend unavailable
- allow safe UI navigation

### Kitchen

- display last-known data with stale indicator
- prevent pretending a transition succeeded offline

### Waiter

- show stale state
- critical transitions require backend confirmation

Do not implement offline financial transactions unless explicitly scoped later.

---

# 38. Browser Refresh

After refresh:

```text
restore auth session
 ↓
restore route
 ↓
refetch authoritative state
 ↓
resubscribe
```

Do not rely on localStorage as authoritative operational state.

---

# 39. Tab Duplication

If the same user opens:

```text
POS Tab A
POS Tab B
```

both may receive the same event.

Both clients must be safe.

Critical commands use:

- current-state validation
- atomic transaction
- idempotency
- conflict handling

---

# 40. KDS Realtime Requirements

KDS should immediately reflect:

```text
CONFIRMED → queue
PREPARING → active
READY → ready queue
CANCELLED → remove/mark cancelled
```

Timer should be based on persisted timestamps, not:

```text
setInterval(startAtLocal)
```

alone.

Client timer is presentation.

Backend timestamp is authority.

---

# 41. Cashier Realtime Requirements

Cashier should receive:

```text
new order
order confirmation state
payment state
service request
```

Payment queue should reconcile after:

- payment event
- reconnect
- tab focus recovery
- mutation result

---

# 42. Waiter Realtime Requirements

Waiter should receive:

```text
READY order
CALL_WAITER
REQUEST_BILL
```

When event arrives:

```text
notification
 ↓
open/reveal relevant table/order
 ↓
fetch current state
```

Do not assume event payload is complete.

---

# 43. Customer Realtime Requirements

Customer sees:

```text
PENDING_CONFIRMATION
CONFIRMED
PREPARING
READY
SERVED
PAID
COMPLETED
```

Customer UI must gracefully handle:

- disconnect
- stale state
- reload
- duplicate event
- order completed
- order cancelled

---

# 44. Observability

Operational logs should capture:

- subscription failures
- reconnect attempts
- authorization failures
- command latency
- event processing errors
- reconciliation frequency
- critical mutation conflicts

Do not log sensitive credentials.

---

# 45. Performance

Avoid:

```text
every client subscribes to every order
```

Use scoped subscriptions.

Example:

```text
Kitchen → kitchen-relevant orders
Cashier → operational orders/payment queue
Waiter → service/ready queue
Customer → own context
```

For high-volume environments, consider aggregation/read models later.

---

# 46. Testing

## Event Delivery

- event received
- duplicate event
- out-of-order event
- stale event
- missed event

## Reconnect

- network loss
- reconnect
- session refresh
- state reconciliation

## Authorization

- unauthorized subscription
- cross-user data exposure
- customer accessing internal channel

## Concurrency

- two cashiers confirm same order
- two kitchen clients mark ready
- duplicate payment command
- duplicate waiter service action

## UI

- loading
- connected
- disconnected
- reconnecting
- stale
- syncing
- empty
- error

---

# 47. Definition of Done

Realtime layer is ready when:

- channels are defined
- authorization is defined
- event names are stable
- event envelope is stable
- entity version strategy exists
- duplicate events are handled
- reconnect is handled
- missed events are reconciled
- critical actions remain backend commands
- payment events are backend authoritative
- customer subscriptions are scoped
- KDS receives required events
- cashier receives required events
- waiter receives required events
- sensitive data is excluded
- RLS remains active
- operational apps display connection state
- tests cover duplicate/out-of-order/reconnect cases

---

# 48. Next Artifact

Next:

```text
08 REALTIME_SPEC_v1.0.md ← SELESAI

09 REPOSITORY_STRUCTURE_v1.0.md
10 CLINE_IMPLEMENTATION_PLAN_v1.0.md
11 TESTING_STRATEGY_v1.0.md
12 ENVIRONMENT_CONFIG_v1.0.md
13 MIGRATION_PLAN_v1.0.md
14 IMPLEMENTATION
```

Repository structure must be finalized before Cline starts generating production code.
