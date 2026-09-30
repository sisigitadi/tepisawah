# Google Stitch Prompt 05 — Waiter & Service Station

Design the waiter service board for `waiter.tepisawah.id`.

Purpose:
Help waiters monitor tables, serve ready food, respond to service requests, and create manual orders.

Targets:
- Tablet/mobile friendly.
- Desktop compatible.
- Fast scanning and large touch targets.

Core views:
- Table/service board.
- Table detail.
- Ready-to-serve queue.
- Service request queue.
- Manual order creation.
- Notifications.
- Empty/loading/error/connection/permission states.

Waiter permissions:
- READY → SERVED.
- Acknowledge and resolve service requests.
- Create manual orders.
- View relevant table/session/order context.

Waiter cannot:
- Perform kitchen transitions.
- Complete payment.
- Change authoritative prices.
- Bypass backend authorization.

Important concepts:
- Table status and order status are separate.
- A table session can contain multiple orders.
- Service events should be auditable.
- Centralized catalog is the menu source of truth.
- Duplicate actions must be protected.
