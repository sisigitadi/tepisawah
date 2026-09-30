# Google Stitch Prompt 02 — Customer QR Ordering

Design the mobile-first customer ordering application for `order.tepisawah.id`.

Primary flow:
SCAN QR MEJA → WELCOME → MENU → PRODUCT → CUSTOMIZE → CART → KONFIRMASI → ORDER STATUS

QR behavior:
- Example: `order.tepisawah.id/?table=A12`.
- Table identity is carried by the QR and should not require manual entry.
- Invalid or expired QR must have a clear error state.

Screens:
- Welcome/table context
- Category menu
- Search
- Product detail
- Modifiers/customization
- Cart
- Order confirmation
- Order success
- Live order status
- Call waiter
- Request bill
- Empty, loading, error, invalid QR, unavailable product, and duplicate-order states

Order status display:
PENDING_CONFIRMATION → CONFIRMED → PREPARING → READY → SERVED → CANCELLED

Constraints:
- No customer login required for MVP.
- Do not expose POS/KDS/admin controls.
- Mobile-first at 390x844, responsive from 320px upward.
- Use only verified product data from the project source documents.
- Sticky cart bar on menu/product browsing.
- Customer can add notes where supported.
- Protect against accidental duplicate submissions.
- Backend remains authoritative for price, availability, table identity, order state, and totals.
