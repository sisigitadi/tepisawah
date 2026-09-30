# Google Stitch Prompt 04 — Kitchen Display System

Design the Kitchen Display System for `kitchen.tepisawah.id`.

Purpose:
KDS focuses on CONFIRMED → PREPARING → READY.

Kitchen staff:
- View incoming confirmed orders.
- Start preparing.
- Mark ready.
- Read item notes/modifiers.

Kitchen supervisor:
- Recall when explicitly authorized.
- Reject when explicitly authorized and record reason.
- Review history.

Do not show:
- Payment amounts.
- Financial data unrelated to kitchen execution.
- Admin configuration.

Target screens:
- Fullscreen landscape 1366x768 and 1920x1080.
- Usable at 1024x768.
- NEW/CONFIRMED, PREPARING, READY queues.
- Order cards with order ID, table, elapsed timer, quantities, items, notes, actions.
- Backend timestamp drives elapsed time.
- New-order alert.
- Connection status.
- Empty/error states.
- Optional station filter as future-ready capability, not invented current configuration.

Rules:
- Warning/critical timer thresholds must be configurable; do not invent an SLA.
- Frontend is not the source of truth.
- Mutations are backend commands and must be idempotent.
- Role-based actions and audit for restricted operations.
- Realtime updates must reconcile against backend state.
