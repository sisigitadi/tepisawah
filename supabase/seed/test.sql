-- =============================================================================
-- Tepi Sawah — TEST seed.
--
-- Boundary file for integration/security fixtures, applied to throwaway test
-- databases only. Deterministic and idempotent; never applied to development,
-- preview or production.
--
-- Carries the same RBAC baseline as the development seed
-- (AUTH_RBAC_RLS.md §6, §7, §8, §9) so Layer 4 security tests can exercise the
-- per-actor matrix against a real authorization graph:
--
--   anonymous / customer / waiter / cashier / kitchen / supervisor / admin
--   / owner  (TESTING_STRATEGY.md Layer 4)
--
-- The grant pairs are the authority mirrored by `packages/permissions`
-- ROLE_PERMISSIONS. Per-actor auth.users + user_roles fixtures arrive with the
-- integration phase, once a local Supabase stack is available; no fake
-- transactions, payments or audit events are seeded here (seed README).
-- =============================================================================

insert into public.roles (code, name, description, is_system)
values
  ('waiter',    'Waiter',    'Table service and manual orders', true),
  ('cashier',   'Cashier',   'Order confirmation and payment', true),
  ('kitchen',   'Kitchen',   'Kitchen display operations', true),
  ('supervisor','Supervisor','Operational authority', true),
  ('admin',     'Admin',     'System administration', true),
  ('owner',     'Owner',     'Business-level access and oversight', true)
on conflict (code) do update set
  name        = excluded.name,
  description = excluded.description,
  is_system   = excluded.is_system;

insert into public.permissions (code, module, action, description)
values
  ('catalog.read',                'catalog',         'read',          'Read the catalog'),
  ('catalog.create',              'catalog',         'create',        'Create products'),
  ('catalog.update',              'catalog',         'update',        'Update products'),
  ('catalog.archive',             'catalog',         'archive',       'Archive products'),
  ('categories.manage',           'catalog',         'manage',        'Manage categories'),
  ('modifiers.manage',            'catalog',         'manage',        'Manage modifiers'),
  ('tables.read',                 'tables',          'read',          'Read tables'),
  ('tables.create',               'tables',          'create',        'Create tables'),
  ('tables.update',               'tables',          'update',        'Update tables'),
  ('tables.archive',              'tables',          'archive',       'Archive tables'),
  ('tables.qr_manage',            'tables',          'qr_manage',     'Manage table QR codes'),
  ('table_sessions.read',         'table_sessions',  'read',          'Read table sessions'),
  ('table_sessions.manage',       'table_sessions',  'manage',        'Manage table sessions'),
  ('orders.read',                 'orders',          'read',          'Read orders'),
  ('orders.create_manual',        'orders',          'create_manual', 'Create a manual order'),
  ('orders.confirm',              'orders',          'confirm',       'Confirm an order'),
  ('orders.reject',               'orders',          'reject',        'Reject an order'),  ('orders.transition',           'orders',          'transition',    'Transition an order state'),
  ('orders.cancel',                'orders',          'cancel',        'Cancel an order'),
  ('orders.recall',                'orders',          'recall',        'Recall an order'),
  ('orders.serve',                 'orders',          'serve',         'Mark an order served'),
  ('kitchen.read',                'kitchen',         'read',          'Read the kitchen queue'),
  ('kitchen.start',               'kitchen',         'start',         'Start preparing'),
  ('kitchen.ready',               'kitchen',         'ready',         'Mark an order ready'),
  ('kitchen.recall',              'kitchen',         'recall',        'Recall a kitchen ticket'),
  ('service_requests.read',       'service_requests','read',          'Read service requests'),
  ('service_requests.create',     'service_requests','create',        'Create a service request'),
  ('service_requests.acknowledge','service_requests','acknowledge',   'Acknowledge a service request'),
  ('service_requests.resolve',    'service_requests','resolve',       'Resolve a service request'),
  ('payments.read',               'payments',        'read',          'Read payments'),
  ('payments.create',             'payments',        'create',        'Create a payment'),
  ('payments.refund',             'payments',        'refund',        'Refund a payment'),
  ('payments.void',               'payments',        'void',          'Void a payment'),
  ('users.read',                  'users',           'read',          'Read user profiles'),
  ('users.create',                'users',           'create',        'Create a user'),
  ('users.update',                'users',           'update',        'Update a user profile'),
  ('users.disable',               'users',           'disable',       'Disable a user account'),
  ('users.roles_manage',          'users',           'roles_manage',  'Assign or remove roles'),
  ('roles.read',                  'roles',           'read',          'Read the role catalog'),
  ('roles.manage',                'roles',           'manage',        'Manage roles'),
  ('permissions.read',            'permissions',     'read',          'Read the permission catalog'),
  ('audit.read',                  'audit',           'read',          'Read audit logs'),
  ('settings.read',               'settings',        'read',          'Read settings'),
  ('settings.manage',             'settings',        'manage',        'Manage settings'),
  ('dashboard.read',              'dashboard',       'read',          'Read the dashboard')
on conflict (code) do update set
  module      = excluded.module,
  action      = excluded.action,
  description = excluded.description;

with grants(role_code, permission_code) as (
  values
    -- waiter — `table_sessions.read` is in the Tables group (§8) and the
    -- baseline grants Waiter Tables Read (§9); a manual order must join the
    -- table's OPEN session (API_CONTRACT §11.1).
    ('waiter', 'catalog.read'),
    ('waiter', 'tables.read'),
    ('waiter', 'table_sessions.read'),
    ('waiter', 'orders.create_manual'),
    ('waiter', 'orders.read'),
    ('waiter', 'orders.serve'),
    ('waiter', 'service_requests.read'),
    ('waiter', 'service_requests.create'),
    ('waiter', 'service_requests.acknowledge'),
    ('waiter', 'service_requests.resolve'),
    ('waiter', 'dashboard.read'),

    ('cashier', 'catalog.read'),
    ('cashier', 'tables.read'),
    ('cashier', 'orders.create_manual'),
    ('cashier', 'orders.read'),
    ('cashier', 'orders.confirm'),
    ('cashier', 'orders.reject'),
    ('cashier', 'service_requests.read'),
    ('cashier', 'payments.read'),
    ('cashier', 'payments.create'),
    ('cashier', 'audit.read'),
    ('cashier', 'dashboard.read'),

    ('kitchen', 'catalog.read'),
    ('kitchen', 'tables.read'),
    ('kitchen', 'orders.read'),
    ('kitchen', 'kitchen.read'),
    ('kitchen', 'kitchen.start'),
    ('kitchen', 'kitchen.ready'),
    ('kitchen', 'dashboard.read'),

    ('supervisor', 'catalog.read'),
    ('supervisor', 'tables.read'),
    ('supervisor', 'tables.create'),
    ('supervisor', 'tables.update'),
    ('supervisor', 'tables.archive'),
    ('supervisor', 'table_sessions.read'),
    ('supervisor', 'table_sessions.manage'),
    ('supervisor', 'orders.create_manual'),
    ('supervisor', 'orders.read'),
    ('supervisor', 'orders.confirm'),
    ('supervisor', 'orders.reject'),
    ('supervisor', 'orders.transition'),
    ('supervisor', 'orders.cancel'),
    ('supervisor', 'orders.recall'),
    ('supervisor', 'orders.serve'),
    ('supervisor', 'kitchen.read'),
    ('supervisor', 'kitchen.start'),
    ('supervisor', 'kitchen.ready'),
    ('supervisor', 'kitchen.recall'),
    ('supervisor', 'service_requests.read'),
    ('supervisor', 'service_requests.create'),
    ('supervisor', 'service_requests.acknowledge'),
    ('supervisor', 'service_requests.resolve'),
    ('supervisor', 'payments.read'),
    ('supervisor', 'payments.create'),
    ('supervisor', 'payments.refund'),
    ('supervisor', 'payments.void'),
    ('supervisor', 'audit.read'),
    ('supervisor', 'dashboard.read'),

    ('admin', 'catalog.read'),
    ('admin', 'catalog.create'),
    ('admin', 'catalog.update'),
    ('admin', 'catalog.archive'),
    ('admin', 'categories.manage'),
    ('admin', 'modifiers.manage'),
    ('admin', 'tables.read'),
    ('admin', 'tables.create'),
    ('admin', 'tables.update'),
    ('admin', 'tables.archive'),
    ('admin', 'tables.qr_manage'),
    ('admin', 'table_sessions.read'),
    ('admin', 'table_sessions.manage'),
    ('admin', 'orders.create_manual'),
    ('admin', 'orders.read'),
    ('admin', 'orders.confirm'),
    ('admin', 'orders.reject'),
    ('admin', 'orders.transition'),
    ('admin', 'orders.cancel'),
    ('admin', 'orders.recall'),
    ('admin', 'orders.serve'),
    ('admin', 'kitchen.read'),
    ('admin', 'kitchen.start'),
    ('admin', 'kitchen.ready'),
    ('admin', 'kitchen.recall'),
    ('admin', 'service_requests.read'),
    ('admin', 'service_requests.create'),
    ('admin', 'service_requests.acknowledge'),
    ('admin', 'service_requests.resolve'),
    ('admin', 'payments.read'),
    ('admin', 'payments.create'),
    ('admin', 'payments.refund'),
    ('admin', 'payments.void'),
    ('admin', 'users.read'),
    ('admin', 'users.create'),
    ('admin', 'users.update'),
    ('admin', 'users.disable'),
    ('admin', 'users.roles_manage'),
    ('admin', 'roles.read'),
    ('admin', 'roles.manage'),
    ('admin', 'permissions.read'),
    ('admin', 'audit.read'),
    ('admin', 'settings.read'),
    ('admin', 'settings.manage'),
    ('admin', 'dashboard.read'),

    ('owner', 'catalog.read'),
    ('owner', 'catalog.create'),
    ('owner', 'catalog.update'),
    ('owner', 'catalog.archive'),
    ('owner', 'categories.manage'),
    ('owner', 'modifiers.manage'),
    ('owner', 'tables.read'),
    ('owner', 'tables.create'),
    ('owner', 'tables.update'),
    ('owner', 'tables.archive'),
    ('owner', 'tables.qr_manage'),
    ('owner', 'table_sessions.read'),
    ('owner', 'table_sessions.manage'),
    ('owner', 'orders.create_manual'),
    ('owner', 'orders.read'),
    ('owner', 'orders.confirm'),
    ('owner', 'orders.reject'),
    ('owner', 'orders.transition'),
    ('owner', 'orders.cancel'),
    ('owner', 'orders.recall'),
    ('owner', 'orders.serve'),
    ('owner', 'kitchen.read'),
    ('owner', 'kitchen.start'),
    ('owner', 'kitchen.ready'),
    ('owner', 'kitchen.recall'),
    ('owner', 'service_requests.read'),
    ('owner', 'service_requests.create'),
    ('owner', 'service_requests.acknowledge'),
    ('owner', 'service_requests.resolve'),
    ('owner', 'payments.read'),
    ('owner', 'payments.create'),
    ('owner', 'payments.refund'),
    ('owner', 'payments.void'),
    ('owner', 'users.read'),
    ('owner', 'users.create'),
    ('owner', 'users.update'),
    ('owner', 'users.disable'),
    ('owner', 'users.roles_manage'),
    ('owner', 'roles.read'),
    ('owner', 'roles.manage'),
    ('owner', 'permissions.read'),
    ('owner', 'audit.read'),
    ('owner', 'settings.read'),
    ('owner', 'settings.manage'),
    ('owner', 'dashboard.read')
)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from grants g
join public.roles r on r.code = g.role_code
join public.permissions p on p.code = g.permission_code
on conflict (role_id, permission_id) do nothing;

-- -----------------------------------------------------------------------------
-- Restaurant configuration (Phase 4 — DATABASE_SCHEMA.md §11-§12).
--
-- Deterministic fixtures so security tests assert against a known
-- configuration: one settings row and one schedule per day. Production is
-- seeded server-side from approved configuration (DATABASE_SCHEMA.md §11;
-- API_CONTRACT.md §38); these example values never reach production.
-- -----------------------------------------------------------------------------
insert into public.restaurant_settings (
  id, restaurant_name, address, phone, email, timezone, currency, logo_url, primary_color
) values (
  '11111111-1111-4111-8111-111111111111',
  'Tepi Sawah Resto & Cafe',
  'Jl. Raya Sawah Indah, Ubud, Bali',
  '+62 361 000 000',
  'halo@tepisawah.id',
  'Asia/Jakarta',
  'IDR',
  null,
  null
)
on conflict (id) do update set
  restaurant_name = excluded.restaurant_name,
  address         = excluded.address,
  phone           = excluded.phone,
  email           = excluded.email,
  timezone        = excluded.timezone,
  currency        = excluded.currency;

insert into public.operating_hours (day_of_week, is_closed, open_time, close_time) values
  (0, true,  null,    null),
  (1, false, '08:00', '21:00'),
  (2, false, '08:00', '21:00'),
  (3, false, '08:00', '21:00'),
  (4, false, '08:00', '21:00'),
  (5, false, '08:00', '22:00'),
  (6, false, '08:00', '22:00')
on conflict (day_of_week) do update set
  is_closed  = excluded.is_closed,
  open_time  = excluded.open_time,
  close_time = excluded.close_time;

-- =============================================================================
-- Catalog seed (Phase 5 — CLINE_IMPLEMENTATION_PLAN.md §11).
--
-- Deterministic fixtures for the test database: two categories, four products
-- and two modifiers. Rows carry fixed UUIDs so every statement is idempotent by
-- primary key — the partial unique indexes from migration 005 only cover active
-- rows, so name-based upserts could not make an inactive fixture re-runnable,
-- but primary-key upserts can. Two products are deliberately seeded in edge
-- states so tests can assert on them without mutating data first:
--   * "Produk Nonaktif"  is_active = false     — excluded from public read
--   * "Produk Habis"     is_available = false  — visible but marked unavailable
-- =============================================================================

insert into public.categories (id, name, description, sort_order, is_active)
values
  ('00000000-0000-4000-8000-400000000001', 'Kategori A', 'Kategori aktif',    10, true),
  ('00000000-0000-4000-8000-400000000002', 'Kategori B', 'Kategori nonaktif', 20, false)
on conflict (id) do update set
  name        = excluded.name,
  description = excluded.description,
  sort_order  = excluded.sort_order,
  is_active   = excluded.is_active;

insert into public.products (id, category_id, name, description, image_url, price, is_active, is_available, sort_order)
values
  ('00000000-0000-4000-8000-500000000001', '00000000-0000-4000-8000-400000000001', 'Produk Satu',     'Deskripsi satu', null, 10000, true,  true,  10),
  ('00000000-0000-4000-8000-500000000002', '00000000-0000-4000-8000-400000000001', 'Produk Dua',      'Deskripsi dua',  null, 20000, true,  true,  20),
  ('00000000-0000-4000-8000-500000000003', '00000000-0000-4000-8000-400000000001', 'Produk Habis',    'Sedang habis',   null, 30000, true,  false, 30),
  ('00000000-0000-4000-8000-500000000004', '00000000-0000-4000-8000-400000000001', 'Produk Nonaktif', 'Ditarik',        null, 40000, false, true,  40)
on conflict (id) do update set
  category_id   = excluded.category_id,
  name          = excluded.name,
  description   = excluded.description,
  image_url     = excluded.image_url,
  price         = excluded.price,
  is_active     = excluded.is_active,
  is_available  = excluded.is_available,
  sort_order    = excluded.sort_order;

insert into public.modifiers (id, name, description, price_delta, is_active)
values
  ('00000000-0000-4000-8000-600000000001', 'Modifikasi A', 'Tanpa biaya',   0,    true),
  ('00000000-0000-4000-8000-600000000002', 'Modifikasi B', 'Biaya tambahan', 5000, true)
on conflict (id) do update set
  name         = excluded.name,
  description  = excluded.description,
  price_delta  = excluded.price_delta,
  is_active    = excluded.is_active;

insert into public.product_modifiers (product_id, modifier_id, is_required, min_select, max_select, sort_order)
values
  ('00000000-0000-4000-8000-500000000001', '00000000-0000-4000-8000-600000000001', true,  1, 1, 10),
  ('00000000-0000-4000-8000-500000000001', '00000000-0000-4000-8000-600000000002', false, 0, 2, 20),
  ('00000000-0000-4000-8000-500000000002', '00000000-0000-4000-8000-600000000001', false, 0, 1, 10)
on conflict (product_id, modifier_id) do update set
  is_required = excluded.is_required,
  min_select  = excluded.min_select,
  max_select  = excluded.max_select,
  sort_order  = excluded.sort_order;

-- =============================================================================
-- Tables + QR (Phase 6 — DATABASE_SCHEMA.md §17-§18).
--
-- Boundary fixtures for the QR security tests (AUTH_RBAC_RLS.md §18,
-- CLINE_IMPLEMENTATION_PLAN.md §12):
--   T1      active table + active QR          -> resolves
--   T2      active table + retired QR         -> does not resolve
--   T3      active table + expired QR         -> does not resolve
--   T4      archived table + active QR        -> does not resolve
--   T5      active table with no QR row       -> does not resolve
--   RETIRED a second token for T1             -> the pre-roll token is dead
-- =============================================================================

insert into public.tables (id, table_code, name, capacity, status, is_active)
values
  ('00000000-0000-4000-8000-700000000001', 'T1', 'Meja T1', 4, 'AVAILABLE', true),
  ('00000000-0000-4000-8000-700000000002', 'T2', 'Meja T2', 4, 'AVAILABLE', true),
  ('00000000-0000-4000-8000-700000000003', 'T3', 'Meja T3', 4, 'AVAILABLE', true),
  ('00000000-0000-4000-8000-700000000004', 'T4', 'Meja T4', 4, 'AVAILABLE', false),
  ('00000000-0000-4000-8000-700000000005', 'T5', 'Meja T5', 4, 'AVAILABLE', true)
on conflict (id) do update set
  table_code = excluded.table_code,
  name       = excluded.name,
  capacity   = excluded.capacity,
  status     = excluded.status,
  is_active  = excluded.is_active;

insert into public.table_qr (id, table_id, token, is_active, expires_at)
values
  ('00000000-0000-4000-8000-800000000001', '00000000-0000-4000-8000-700000000001', 'test-qr-t1-active-00000000000000001', true,  null),
  ('00000000-0000-4000-8000-800000000002', '00000000-0000-4000-8000-700000000001', 'test-qr-t1-retired-00000000000000000', false, null),
  ('00000000-0000-4000-8000-800000000003', '00000000-0000-4000-8000-700000000002', 'test-qr-t2-retired-00000000000000000', false, null),
  ('00000000-0000-4000-8000-800000000004', '00000000-0000-4000-8000-700000000003', 'test-qr-t3-expired-00000000000000000', true,  now() - interval '1 hour'),
  ('00000000-0000-4000-8000-800000000005', '00000000-0000-4000-8000-700000000004', 'test-qr-t4-archived-table-0000000000', true,  null)
on conflict (id) do update set
  table_id   = excluded.table_id,
  token      = excluded.token,
  is_active  = excluded.is_active,
  expires_at = excluded.expires_at;

-- =============================================================================
-- Table sessions (Phase 7 — DATABASE_SCHEMA.md §19, API_CONTRACT.md §9).
--
-- Fixtures for the session boundary tests (AUTH_RBAC_RLS.md §20, §46
-- idempotency, CLINE_IMPLEMENTATION_PLAN.md §13):
--   T1  OPEN session, two orders attached  -> attach/close happy path
--   T2  CLOSED session                     -> stale session: attach refused,
                                            double close refused
--   T3  no session at all                  -> get-active returns nothing
--
-- The closed session keeps its order links so the history-preservation test has
-- something to read back.
-- =============================================================================

insert into public.table_sessions (id, table_id, status, opened_at, closed_at, opened_by, closed_by)
values
  ('00000000-0000-4000-8000-900000000001', '00000000-0000-4000-8000-700000000001', 'OPEN',   now() - interval '30 minutes', null, null, null),
  ('00000000-0000-4000-8000-900000000002', '00000000-0000-4000-8000-700000000002', 'CLOSED', now() - interval '2 hours', now() - interval '1 hour', null, null),
  ('00000000-0000-4000-8000-900000000003', '00000000-0000-4000-8000-700000000003', 'CLOSED', now() - interval '3 hours', now() - interval '2 hours', null, null)
on conflict (id) do update set
  table_id   = excluded.table_id,
  status     = excluded.status,
  opened_at  = excluded.opened_at,
  closed_at  = excluded.closed_at,
  opened_by  = excluded.opened_by,
  closed_by  = excluded.closed_by;

insert into public.table_session_order_links (id, session_id, order_id, order_code)
values
  ('00000000-0000-4000-8000-a00000000001', '00000000-0000-4000-8000-900000000001', '00000000-0000-4000-8000-c00000000001', 'TST-0001'),
  ('00000000-0000-4000-8000-a00000000002', '00000000-0000-4000-8000-900000000001', '00000000-0000-4000-8000-c00000000002', 'TST-0002'),
  ('00000000-0000-4000-8000-a00000000003', '00000000-0000-4000-8000-900000000002', '00000000-0000-4000-8000-c00000000003', 'TST-0003')
on conflict (order_id) do update set
  session_id  = excluded.session_id,
  order_code  = excluded.order_code;

-- =============================================================================
-- Orders (Phase 8A).
--
-- `c00000000001` is the live DRAFT on the OPEN session; `c00000000003` is the
-- completed historical order on a CLOSED session. Totals already reconcile
-- the way `create_draft_order()` computes them, and the sequence is advanced
-- past the seeded numbers so a test that creates an order cannot collide.
-- =============================================================================
insert into public.orders (
  id, order_number, table_id, table_session_id, source, status, notes,
  subtotal, discount, tax, total, idempotency_key, created_by
)
values
  ('00000000-0000-4000-8000-c00000000001', 'TS-20260929-0001', '00000000-0000-4000-8000-700000000001', '00000000-0000-4000-8000-900000000001', 'CUSTOMER_QR', 'DRAFT',     null, 100000, 0, 0, 100000, 'seed-test-0001', null),
  ('00000000-0000-4000-8000-c00000000003', 'TS-20260927-0001', '00000000-0000-4000-8000-700000000002', '00000000-0000-4000-8000-900000000002', 'CUSTOMER_QR', 'COMPLETED', null,  44000, 0, 0,  44000, 'seed-test-0003', null)
on conflict (id) do update set
  order_number     = excluded.order_number,
  table_id         = excluded.table_id,
  table_session_id = excluded.table_session_id,
  source           = excluded.source,
  status           = excluded.status,
  notes            = excluded.notes,
  subtotal         = excluded.subtotal,
  discount         = excluded.discount,
  tax              = excluded.tax,
  total            = excluded.total,
  idempotency_key  = excluded.idempotency_key;

select setval('public.order_number_seq', 100, true);

insert into public.order_items (id, order_id, product_id, product_name_snapshot, unit_price_snapshot, quantity, notes, line_total)
values
  ('00000000-0000-4000-8000-d00000000001', '00000000-0000-4000-8000-c00000000001', '00000000-0000-4000-8000-200000000001', 'Nasi Liwet Sawah', 45000, 2, 'Tidak terlalu pedas', 100000),
  ('00000000-0000-4000-8000-d00000000003', '00000000-0000-4000-8000-c00000000003', '00000000-0000-4000-8000-200000000002', 'Ayam Bakar Tepi',  38000, 1, null,                 44000)
on conflict (id) do update set
  product_name_snapshot = excluded.product_name_snapshot,
  unit_price_snapshot   = excluded.unit_price_snapshot,
  quantity              = excluded.quantity,
  notes                 = excluded.notes,
  line_total            = excluded.line_total;

insert into public.order_item_modifiers (id, order_item_id, modifier_id, modifier_name_snapshot, price_delta_snapshot, quantity)
values
  ('00000000-0000-4000-8000-e00000000001', '00000000-0000-4000-8000-d00000000001', '00000000-0000-4000-8000-300000000001', 'Level Pedas',  0,    2),
  ('00000000-0000-4000-8000-e00000000002', '00000000-0000-4000-8000-d00000000001', '00000000-0000-4000-8000-300000000002', 'Tambah Nasi', 5000,  2),
  ('00000000-0000-4000-8000-e00000000003', '00000000-0000-4000-8000-d00000000003', '00000000-0000-4000-8000-300000000001', 'Level Pedas',  0,    1),
  ('00000000-0000-4000-8000-e00000000004', '00000000-0000-4000-8000-d00000000003', '00000000-0000-4000-8000-300000000004', 'Extra Telur', 6000,  1)
on conflict (id) do update set
  modifier_name_snapshot = excluded.modifier_name_snapshot,
  price_delta_snapshot   = excluded.price_delta_snapshot,
  quantity               = excluded.quantity;

insert into public.order_status_history (id, order_id, from_status, to_status, actor_id, actor_role, reason)
values
  ('00000000-0000-4000-8000-f00000000001', '00000000-0000-4000-8000-c00000000001', null,        'DRAFT',     null, null, null),
  ('00000000-0000-4000-8000-f00000000002', '00000000-0000-4000-8000-c00000000003', null,        'DRAFT',     null, null, null),
  ('00000000-0000-4000-8000-f00000000003', '00000000-0000-4000-8000-c00000000003', 'DRAFT',     'COMPLETED', null, 'cashier', null)
on conflict (id) do nothing;

-- =============================================================================
-- Submitted order (Phase 8B).
--
-- `c00000000004` sits on the same OPEN session as the live draft above, already
-- submitted so the cashier queue view has a `PENDING_CONFIRMATION` row. Its
-- history carries both hops of the atomic transition and the submit key is set
-- so a replay collapses to this row.
-- =============================================================================
insert into public.orders (
  id, order_number, table_id, table_session_id, source, status, notes,
  subtotal, discount, tax, total, idempotency_key, submit_idempotency_key, created_by
)
values
  ('00000000-0000-4000-8000-c00000000004', 'TS-20260929-0002', '00000000-0000-4000-8000-700000000001', '00000000-0000-4000-8000-900000000001', 'CUSTOMER_QR', 'PENDING_CONFIRMATION', null, 44000, 0, 0, 44000, 'seed-test-0004', 'seed-test-submit-0004', null)
on conflict (id) do update set
  order_number          = excluded.order_number,
  table_id              = excluded.table_id,
  table_session_id      = excluded.table_session_id,
  source                = excluded.source,
  status                = excluded.status,
  notes                 = excluded.notes,
  subtotal              = excluded.subtotal,
  discount              = excluded.discount,
  tax                   = excluded.tax,
  total                 = excluded.total,
  idempotency_key       = excluded.idempotency_key,
  submit_idempotency_key = excluded.submit_idempotency_key;

insert into public.order_items (id, order_id, product_id, product_name_snapshot, unit_price_snapshot, quantity, notes, line_total)
values
  ('00000000-0000-4000-8000-d00000000006', '00000000-0000-4000-8000-c00000000004', '00000000-0000-4000-8000-200000000002', 'Ayam Bakar Tepi', 38000, 1, null, 44000)
on conflict (id) do update set
  product_name_snapshot = excluded.product_name_snapshot,
  unit_price_snapshot   = excluded.unit_price_snapshot,
  quantity              = excluded.quantity,
  notes                 = excluded.notes,
  line_total            = excluded.line_total;

-- 38000 (Ayam Bakar Tepi) + 6000 (Extra Telur) = 44000 line total.
insert into public.order_item_modifiers (id, order_item_id, modifier_id, modifier_name_snapshot, price_delta_snapshot, quantity)
values
  ('00000000-0000-4000-8000-e00000000006', '00000000-0000-4000-8000-d00000000006', '00000000-0000-4000-8000-300000000004', 'Extra Telur', 6000, 1)
on conflict (id) do update set
  modifier_name_snapshot = excluded.modifier_name_snapshot,
  price_delta_snapshot   = excluded.price_delta_snapshot,
  quantity               = excluded.quantity;

insert into public.order_status_history (id, order_id, from_status, to_status, actor_id, actor_role, reason)
values
  ('00000000-0000-4000-8000-f00000000007', '00000000-0000-4000-8000-c00000000004', null,        'DRAFT',               null, null, null),
  ('00000000-0000-4000-8000-f00000000008', '00000000-0000-4000-8000-c00000000004', 'DRAFT',     'SUBMITTED',           null, null, null),
  ('00000000-0000-4000-8000-f00000000009', '00000000-0000-4000-8000-c00000000004', 'SUBMITTED', 'PENDING_CONFIRMATION', null, null, null)
on conflict (id) do nothing;
