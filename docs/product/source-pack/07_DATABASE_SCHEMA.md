# Database Schema — Logical Model v1

## Users
- id
- name
- email/username
- role_id
- status
- created_at
- updated_at

## Roles
- id
- name

## Tables
- id
- table_code
- table_name
- capacity
- qr_token
- status
- active

## Categories
- id
- name
- description
- display_order
- active

## Products
- id
- category_id
- name
- description
- price
- image_url
- available
- display_order
- active

## Orders
- id
- order_number
- table_id
- source
- status
- subtotal
- discount
- total
- created_by
- created_at
- updated_at

## OrderItems
- id
- order_id
- product_id
- product_name_snapshot
- unit_price_snapshot
- quantity
- note
- subtotal

Snapshot fields are intentional so historical orders remain correct if menu data changes later.

## Payments
- id
- order_id
- method
- amount
- status
- reference
- paid_at
- recorded_by

## KitchenTickets
- id
- order_id
- status
- started_at
- ready_at
- handled_by

## ServiceRequests
- id
- table_id
- type
- status
- created_at
- resolved_at
- handled_by

## Promos
- id
- name
- description
- start_at
- end_at
- active
- rule_type
- rule_config

## Design principle
Database technology is intentionally not fixed in this document. Select the implementation after evaluating concurrency, budget, deployment, and maintenance requirements.
