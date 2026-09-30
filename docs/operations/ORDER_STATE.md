# Order State Machine

## Main states

DRAFT
→ SUBMITTED
→ PENDING_CONFIRMATION
→ CONFIRMED
→ PREPARING
→ READY
→ SERVED
→ PAID
→ COMPLETED

## Exception states

CANCELLED
REJECTED
VOID
REFUNDED

## Allowed transition examples

DRAFT → SUBMITTED
SUBMITTED → PENDING_CONFIRMATION
PENDING_CONFIRMATION → CONFIRMED
PENDING_CONFIRMATION → REJECTED
CONFIRMED → PREPARING
PREPARING → READY
READY → SERVED
SERVED → PAID
PAID → COMPLETED

## Rules
- Only authorized roles may transition states.
- Every transition stores timestamp and actor.
- A cancelled/rejected order cannot continue to kitchen.
- Payment state should be separated logically from kitchen state.
- Future versions may split OrderStatus and PaymentStatus into independent state machines.
