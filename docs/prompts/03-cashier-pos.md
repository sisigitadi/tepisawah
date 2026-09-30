# Google Stitch Prompt 03 — Cashier POS

Design the cashier POS for `pos.tepisawah.id` as the transaction-control center for customer QR orders and waiter-created orders.

Target:
- Desktop-first 1440x900.
- Responsive for smaller operational displays.
- Fast, keyboard-friendly, high information density without visual clutter.

Layout:
Header / Sidebar / Order & Table Area / Detail & Payment Panel

Core areas:
- Dashboard metrics: sales, transactions, active orders, waiting payment.
- Order queue with filters/tabs.
- Order detail, customer/internal notes.
- Confirm/reject with reason where permitted.
- Table map and table detail.
- Payment queue.
- Payment methods: Tunai, QRIS, Debit, Credit Card, E-Wallet, Transfer when configured.
- Cash payment, QRIS payment, card payment.
- Payment statuses: PENDING, PAID, FAILED, EXPIRED, CANCELLED.
- Payment success and receipt.
- Transaction history.
- Daily summary.
- Shift opening/closing.
- Notifications.
- Error/offline/permission states.

Future-ready but not necessarily MVP implementation:
- Split bill.
- Discount/void/refund workflows.

Security:
- Frontend is not authoritative for total, payment status, role, or order transition.
- Server-side validation and authorization required.
- Sensitive actions require permission and audit trail.
- Use the central order state machine and do not invent alternate statuses.
