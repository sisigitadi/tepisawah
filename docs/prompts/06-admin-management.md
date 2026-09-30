# Google Stitch Prompt 06 — Admin & Management

Design the administration and management application for `admin.tepisawah.id`.

Users:
- Admin
- Owner
- Supervisor

This application is a configuration and governance center, not the cashier POS, KDS, customer ordering UI, waiter board, inventory system, accounting system, CRM, or reservation system.

Modules:
- Menu/product catalog.
- Categories.
- Modifiers.
- Tables.
- QR management.
- Users.
- Roles.
- Permissions.
- Restaurant settings.
- Operating hours.
- Ordering configuration.
- Payment configuration.
- Service configuration.
- Kitchen configuration.
- Notification configuration.
- Audit log.

Critical rules:
- Centralized menu source of truth.
- Product edits must preserve historical order snapshots.
- QR management must be auditable.
- RBAC must be enforced by backend/RLS; UI guards are only UX.
- Sensitive actions require confirmation and audit.
- Bulk actions must provide clear scope and result feedback.
- Handle concurrent edits without silently overwriting changes.

Required states:
- Loading.
- Empty.
- Validation error.
- Permission denied.
- Conflict/concurrency.
- Success.
- Destructive-action confirmation.

Responsive:
Desktop-first admin experience with usable tablet/mobile fallback.
