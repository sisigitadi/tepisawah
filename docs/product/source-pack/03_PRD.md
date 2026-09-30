# PRD — Tepi Sawah Platform v1

## Product modules

### Module A — Website
Routes:
- /
- /menu
- /promo
- /about
- /location
- /contact

### Module B — Customer Ordering
Routes:
- /order
- /order/menu
- /order/cart
- /order/confirmation
- /order/status

Required context:
- table_id
- session_id
- order_id

### Module C — POS
Routes:
- /pos
- /pos/cashier
- /pos/kitchen
- /pos/waiter
- /pos/admin

## Functional requirements

### FR-01 Table QR
Each table has a unique QR identifier.
Example:
https://order.tepisawah.id/?table=A01

### FR-02 Menu
Menu must support:
- id
- name
- category
- description
- price
- image
- availability
- display_order

### FR-03 Cart
Customer can:
- add item
- change quantity
- add note
- remove item
- review subtotal

### FR-04 Order
Order contains:
- order_id
- table_id
- source
- customer/session context
- items
- subtotal
- discount
- total
- status
- timestamps

### FR-05 Kitchen
Kitchen sees only operationally relevant tickets and can update preparation status.

### FR-06 Cashier
Cashier can review incoming order and record payment.

### FR-07 Waiter
Waiter can see table status, ready orders, and service requests.

### FR-08 Admin
Admin can manage menu, category, table and basic user access.

## Non-functional requirements
- Mobile-first customer interface.
- Responsive internal interface.
- Role-based access control.
- API keys/secrets never stored in frontend source.
- All important order transitions logged.
- No destructive action without confirmation.
- UI must remain usable on common Android phones and desktop POS screens.
