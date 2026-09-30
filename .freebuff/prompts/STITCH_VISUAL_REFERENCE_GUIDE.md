# FREEBUFF — STITCH VISUAL REFERENCE GUIDE

Google Stitch output should be supplied to Freebuff as screenshots/reference
images, not as source code.

Recommended location:

docs/design/references/

Example:
- homepage-desktop.png
- homepage-mobile.png
- customer-order.png
- cashier-pos.png
- kitchen-kds.png
- waiter.png
- admin-dashboard.png
- admin-menu.png
- admin-tables.png
- admin-users.png
- admin-settings.png

For each UI task, tell Freebuff:
1. which screenshot(s) are relevant;
2. which application is being implemented;
3. which PRD/feature requirement applies;
4. which design-system document applies.

Freebuff must translate the visual reference into reusable React components.

Do not copy:
- Stitch HTML
- Stitch CSS
- Stitch JavaScript
- Stitch mock API
- Stitch mock persistence

Visual reference hierarchy:
Stitch screenshot
→ Master Design System
→ Design Freeze
→ PRD/BRD
→ actual production implementation.

If visual reference and requirements conflict, requirements/design system win.
