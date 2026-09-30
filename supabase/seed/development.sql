-- =============================================================================
-- Tepi Sawah — DEVELOPMENT seed.
--
-- Boundary file. Applied ONLY by `scripts/seed-dev.mjs`, which refuses any
-- target that is not localhost or a preview host, so this file can never run
-- against production (ENVIRONMENT_CONFIG.md §22; DATABASE_MIGRATION_PLAN.md
-- §37).
--
-- Seed is separated from migrations: schema lives in `supabase/migrations/`.
-- Seed is deterministic and idempotent: re-running must not duplicate or drift.
--
-- Contents (DATABASE_MIGRATION_PLAN.md §37):
--   - the six baseline staff roles        (AUTH_RBAC_RLS.md §6)
--   - the initial permission catalog       (AUTH_RBAC_RLS.md §7, §8)
--   - the role to permission baseline       (AUTH_RBAC_RLS.md §9)
--
-- The grant pairs below are the authority for `packages/permissions`
-- ROLE_PERMISSIONS, which mirrors them for frontend guards. They must stay in
-- sync; a change here is a security change and requires review
-- (DATABASE_SCHEMA.md §44 — seed data must be reviewed).
--
-- No test users, catalog, tables or transaction history: those arrive with
-- their phases. No fake audit events or payments, ever (seed README).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Baseline roles. is_system marks seeded reference data that the client may
-- neither delete nor rename (migration 003 revokes those writes).
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- Permission catalog. module/action are derived from the `<domain>.<action>`
-- code; they are grouping metadata for the admin UI, never an authorization
-- input.
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- Role to permission baseline (AUTH_RBAC_RLS.md §9).
--
-- Owner and admin are deliberately granted the same baseline here but are NOT
-- an implicit superuser: the grant list is explicit and reviewed (§10). A
-- future change may diverge them without touching code. Supervisor holds
-- operational authority only — no catalog, user or settings administration
-- (§11).
--
-- Effective permissions for a user are the union over their roles (§12).
-- -----------------------------------------------------------------------------
with grants(role_code, permission_code) as (
  values
    -- waiter — table service and manual orders. `table_sessions.read` sits in
    -- the Tables group (§8) and the baseline grants Waiter Tables Read (§9);
    -- a manual order must join the table's OPEN session (API_CONTRACT §11.1),
    -- so the waiter needs to resolve it. Session *management* stays withheld.
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

    -- cashier — confirmation and payment
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

    -- kitchen — KDS operations, no payment or service-request data
    ('kitchen', 'catalog.read'),
    ('kitchen', 'tables.read'),
    ('kitchen', 'orders.read'),
    ('kitchen', 'kitchen.read'),
    ('kitchen', 'kitchen.start'),
    ('kitchen', 'kitchen.ready'),
    ('kitchen', 'dashboard.read'),

    -- supervisor — operational authority, no system administration
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

    -- admin — system configuration, catalog, users, roles
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

    -- owner — business-level visibility and high-risk operations (§10)
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
-- EXAMPLE DATA ONLY. A development stand-in so the admin console and the
-- public ordering flow have something to render. The real address, phone,
-- timezone, currency and operating hours are unresolved decisions and must be
-- applied to production server-side from approved configuration
-- (DATABASE_SCHEMA.md §11; API_CONTRACT.md §38). The client may never insert
-- the settings row (migration 004 part 1); the singleton id is fixed by schema.
-- -----------------------------------------------------------------------------
insert into public.restaurant_settings (
  id, restaurant_name, address, phone, email, timezone, currency, logo_url, primary_color
) values (
  '11111111-1111-4111-8111-111111111111',
  'Tepi Sawah Resto & Cafe',
  'Jl. Raya Sawah Indah, Ubud, Bali',
  '+62 361 000 000',
  'halo@tepisawah.id',
  'Asia/Makassar',
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

-- One schedule per day, Sunday first. Sunday is closed; weekdays and the
-- weekend keep an example cafe window. A closed day with null times is also
-- the fail-closed shape an unconfigured day renders as.
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
-- Reference menu: three categories, six products and four global modifiers
-- attached through product_modifiers. Rows carry fixed UUIDs so every statement
-- is idempotent by primary key — the partial unique indexes from migration 005
-- only cover active rows, so name-based upserts could not make an inactive row
-- re-runnable, but primary-key upserts can. One product is deliberately seeded
-- unavailable (is_available = false) so the admin "out of stock" state and the
-- public projection's filter are both observable in development.
--
-- These are sample values only (DATABASE_SCHEMA.md §44); production catalog data
-- arrives from approved configuration, never from this file.
-- =============================================================================

insert into public.categories (id, name, description, sort_order, is_active)
values
  ('00000000-0000-4000-8000-100000000001', 'Menu Utama', 'Nasi dan hidangan utama', 10, true),
  ('00000000-0000-4000-8000-100000000002', 'Minuman',    'Es, teh, dan kopi',        20, true),
  ('00000000-0000-4000-8000-100000000003', 'Cemilan',    'Cemilan untuk berbagi',    30, true)
on conflict (id) do update set
  name        = excluded.name,
  description = excluded.description,
  sort_order  = excluded.sort_order,
  is_active   = excluded.is_active;

insert into public.products (id, category_id, name, description, image_url, price, is_active, is_available, sort_order)
values
  ('00000000-0000-4000-8000-200000000001', '00000000-0000-4000-8000-100000000001', 'Nasi Liwet Sawah', 'Nasi liwet dengan lauk khas sawah', 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=800&q=80', 45000, true, true,  10),
  ('00000000-0000-4000-8000-200000000002', '00000000-0000-4000-8000-100000000001', 'Ayam Bakar Tepi',  'Ayam bakar bumbu rumahan',          'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80', 38000, true, true,  20),
  ('00000000-0000-4000-8000-200000000003', '00000000-0000-4000-8000-100000000001', 'Pepes Ikan',       'Pepes ikan air tawar',              'https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?auto=format&fit=crop&w=800&q=80', 32000, true, false, 30),
  ('00000000-0000-4000-8000-200000000004', '00000000-0000-4000-8000-100000000002', 'Es Kelapa Muda',   'Kelapa muda segar',                 'https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=800&q=80', 15000, true, true,  10),
  ('00000000-0000-4000-8000-200000000005', '00000000-0000-4000-8000-100000000002', 'Teh Talas',        'Teh daun talas khas',               'https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=800&q=80', 12000, true, true,  20),
  ('00000000-0000-4000-8000-200000000006', '00000000-0000-4000-8000-100000000003', 'Kerupuk Sawah',    'Kerupuk renyah',                    'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80',  8000, true, true,  10)
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
  ('00000000-0000-4000-8000-300000000001', 'Level Pedas',  'Tingkat kepedasan',     0,    true),
  ('00000000-0000-4000-8000-300000000002', 'Tambah Nasi',  'Porsi nasi tambahan',   5000, true),
  ('00000000-0000-4000-8000-300000000003', 'Tanpa Es',     'Minuman tanpa es',      0,    true),
  ('00000000-0000-4000-8000-300000000004', 'Extra Telur',  'Telur tambahan',        6000, true)
on conflict (id) do update set
  name         = excluded.name,
  description  = excluded.description,
  price_delta  = excluded.price_delta,
  is_active    = excluded.is_active;

-- Modifier groups per product. "Level Pedas" is a required single select
-- (min 1, max 1) on the main dishes, "Tambah Nasi" is optional (max 1),
-- "Tanpa Es" applies to drinks, and "Extra Telur" is a multi-select (max 3).
insert into public.product_modifiers (product_id, modifier_id, is_required, min_select, max_select, sort_order)
values
  ('00000000-0000-4000-8000-200000000001', '00000000-0000-4000-8000-300000000001', true,  1, 1, 10),
  ('00000000-0000-4000-8000-200000000001', '00000000-0000-4000-8000-300000000002', false, 0, 1, 20),
  ('00000000-0000-4000-8000-200000000001', '00000000-0000-4000-8000-300000000004', false, 0, 3, 30),
  ('00000000-0000-4000-8000-200000000002', '00000000-0000-4000-8000-300000000001', true,  1, 1, 10),
  ('00000000-0000-4000-8000-200000000002', '00000000-0000-4000-8000-300000000004', false, 0, 3, 20),
  ('00000000-0000-4000-8000-200000000003', '00000000-0000-4000-8000-300000000001', true,  1, 1, 10),
  ('00000000-0000-4000-8000-200000000004', '00000000-0000-4000-8000-300000000003', false, 0, 1, 10),
  ('00000000-0000-4000-8000-200000000005', '00000000-0000-4000-8000-300000000003', false, 0, 1, 10)
on conflict (product_id, modifier_id) do update set
  is_required = excluded.is_required,
  min_select  = excluded.min_select,
  max_select  = excluded.max_select,
  sort_order  = excluded.sort_order;

-- =============================================================================
-- Tables + QR (Phase 6 — DATABASE_SCHEMA.md §17-§18).
--
-- Four active dining tables, each with one active QR. The seed writes the QR
-- rows directly (seed runs as the service role, so it bypasses the client grant
-- restrictions from migration 006 part 2) with fixed tokens so a developer can
-- exercise the customer resolver without minting a QR in the admin UI first.
-- =============================================================================

insert into public.tables (id, table_code, name, capacity, status, is_active)
values
  ('00000000-0000-4000-8000-700000000001', 'A1', 'Meja A1', 4, 'AVAILABLE',      true),
  ('00000000-0000-4000-8000-700000000002', 'A2', 'Meja A2', 4, 'AVAILABLE',      true),
  ('00000000-0000-4000-8000-700000000003', 'A3', 'Meja A3', 6, 'WAITING_SERVICE', true),
  ('00000000-0000-4000-8000-700000000004', 'B1', 'Meja B1', 2, 'OCCUPIED',        true)
on conflict (id) do update set
  table_code = excluded.table_code,
  name       = excluded.name,
  capacity   = excluded.capacity,
  status     = excluded.status,
  is_active  = excluded.is_active;

-- One active QR per table (migration 006 part 2 enforces the invariant). The
-- retired A2 row demonstrates roll-over: its token no longer resolves.
insert into public.table_qr (id, table_id, token, is_active, expires_at)
values
  ('00000000-0000-4000-8000-800000000001', '00000000-0000-4000-8000-700000000001', 'dev-qr-a1-000000000000000000000001', true,  null),
  ('00000000-0000-4000-8000-800000000002', '00000000-0000-4000-8000-700000000002', 'dev-qr-a2-retired-00000000000000000', false, null),
  ('00000000-0000-4000-8000-800000000003', '00000000-0000-4000-8000-700000000002', 'dev-qr-a2-000000000000000000000002', true,  null),
  ('00000000-0000-4000-8000-800000000004', '00000000-0000-4000-8000-700000000003', 'dev-qr-a3-000000000000000000000003', true,  null),
  ('00000000-0000-4000-8000-800000000005', '00000000-0000-4000-8000-700000000004', 'dev-qr-b1-000000000000000000000004', true,  null)
on conflict (id) do update set
  table_id   = excluded.table_id,
  token      = excluded.token,
  is_active  = excluded.is_active,
  expires_at = excluded.expires_at;

-- =============================================================================
-- Table sessions (Phase 7 — DATABASE_SCHEMA.md §19).
--
--   A1  one CLOSED session, three orders attached — history survives closure
--       exactly as DATABASE_SCHEMA.md §19 sketches (S1 / Order 001-003).
--   B1  one OPEN session, two orders attached — the live visit.
--
-- Order codes are placeholders: the real `orders` table lands in Phase 8
-- (migration 008) and will carry its own `table_session_id` foreign key. These
-- links exist so the multi-order attach/read path can be exercised now.
-- =============================================================================

insert into public.table_sessions (id, table_id, status, opened_at, closed_at, opened_by, closed_by)
values
  ('00000000-0000-4000-8000-900000000001', '00000000-0000-4000-8000-700000000001', 'CLOSED', now() - interval '4 hours', now() - interval '3 hours', null, null),
  ('00000000-0000-4000-8000-900000000002', '00000000-0000-4000-8000-700000000004', 'OPEN',   now() - interval '40 minutes', null, null, null)
on conflict (id) do update set
  table_id   = excluded.table_id,
  status     = excluded.status,
  opened_at  = excluded.opened_at,
  closed_at  = excluded.closed_at,
  opened_by  = excluded.opened_by,
  closed_by  = excluded.closed_by;

-- Closed A1 + attached orders demonstrate history preservation; seeded in one
-- statement so a duplicate seed run is a pure upsert, never a second session.
insert into public.table_session_order_links (id, session_id, order_id, order_code)
values
  ('00000000-0000-4000-8000-a00000000001', '00000000-0000-4000-8000-900000000001', '00000000-0000-4000-8000-c00000000001', 'ORD-240101-001'),
  ('00000000-0000-4000-8000-a00000000002', '00000000-0000-4000-8000-900000000001', '00000000-0000-4000-8000-c00000000002', 'ORD-240101-002'),
  ('00000000-0000-4000-8000-a00000000003', '00000000-0000-4000-8000-900000000001', '00000000-0000-4000-8000-c00000000003', 'ORD-240101-003'),
  ('00000000-0000-4000-8000-a00000000004', '00000000-0000-4000-8000-900000000002', '00000000-0000-4000-8000-c00000000004', 'ORD-240701-001'),
  ('00000000-0000-4000-8000-a00000000005', '00000000-0000-4000-8000-900000000002', '00000000-0000-4000-8000-c00000000005', 'ORD-240701-002')
on conflict (order_id) do update set
  session_id  = excluded.session_id,
  order_code  = excluded.order_code;

-- =============================================================================
-- Orders (Phase 8A).
--
-- The three order ids below are the same ones the session links above already
-- pointed at; the placeholder codes (`ORD-...`) become real rows.
--
-- `order_number` follows the API_CONTRACT.md §10.1 format (TS-YYYYMMDD-NNNN)
-- and is unique. Totals are seeded already-reconciled (total = subtotal, tax
-- and discount both 0 for now) to match what `create_draft_order()` computes.
-- The sequence is advanced past the seeded numbers so the first real order
-- does not collide with a seed.
-- =============================================================================
insert into public.orders (
  id, order_number, table_id, table_session_id, source, status, notes,
  subtotal, discount, tax, total, idempotency_key, created_by
)
values
  -- Historical visit on A1 (session is CLOSED): two orders, both completed.
  -- History survives closure (DATABASE_MIGRATION_PLAN.md §20).
  ('00000000-0000-4000-8000-c00000000001', 'TS-20260927-0001', '00000000-0000-4000-8000-700000000001', '00000000-0000-4000-8000-900000000001', 'CUSTOMER_QR', 'COMPLETED', 'Meja untuk keluarga', 100000, 0, 0, 100000, 'seed-order-0001', null),
  ('00000000-0000-4000-8000-c00000000002', 'TS-20260927-0002', '00000000-0000-4000-8000-700000000001', '00000000-0000-4000-8000-900000000001', 'CUSTOMER_QR', 'COMPLETED', null,                    44000, 0, 0,  44000, 'seed-order-0002', null),
  -- Open session on A4 carries one live DRAFT the customer is still building.
  ('00000000-0000-4000-8000-c00000000004', 'TS-20260929-0001', '00000000-0000-4000-8000-700000000004', '00000000-0000-4000-8000-900000000002', 'CUSTOMER_QR', 'DRAFT',     null,                    30000, 0, 0,  30000, 'seed-order-0004', null)
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

-- Snapshotted lines (DATABASE_SCHEMA.md §21-§22): names and prices are frozen
-- from the catalog above, so later catalog edits never rewrite a receipt.
insert into public.order_items (id, order_id, product_id, product_name_snapshot, unit_price_snapshot, quantity, notes, line_total)
values
  ('00000000-0000-4000-8000-d00000000001', '00000000-0000-4000-8000-c00000000001', '00000000-0000-4000-8000-200000000001', 'Nasi Liwet Sawah', 45000, 2, 'Tidak terlalu pedas', 100000),
  ('00000000-0000-4000-8000-d00000000002', '00000000-0000-4000-8000-c00000000002', '00000000-0000-4000-8000-200000000002', 'Ayam Bakar Tepi',  38000, 1, null,                 44000),
  ('00000000-0000-4000-8000-d00000000003', '00000000-0000-4000-8000-c00000000004', '00000000-0000-4000-8000-200000000004', 'Es Kelapa Muda',   15000, 2, null,                 30000)
on conflict (id) do update set
  product_name_snapshot = excluded.product_name_snapshot,
  unit_price_snapshot   = excluded.unit_price_snapshot,
  quantity              = excluded.quantity,
  notes                 = excluded.notes,
  line_total            = excluded.line_total;

-- Modifier selections, snapshotted at their catalog deltas. Level Pedas is
-- 0 but is still recorded: the customer's actual choice is part of the receipt.
insert into public.order_item_modifiers (id, order_item_id, modifier_id, modifier_name_snapshot, price_delta_snapshot, quantity)
values
  ('00000000-0000-4000-8000-e00000000001', '00000000-0000-4000-8000-d00000000001', '00000000-0000-4000-8000-300000000001', 'Level Pedas',  0,    2),
  ('00000000-0000-4000-8000-e00000000002', '00000000-0000-4000-8000-d00000000001', '00000000-0000-4000-8000-300000000002', 'Tambah Nasi', 5000,  2),
  ('00000000-0000-4000-8000-e00000000003', '00000000-0000-4000-8000-d00000000002', '00000000-0000-4000-8000-300000000001', 'Level Pedas',  0,    1),
  ('00000000-0000-4000-8000-e00000000004', '00000000-0000-4000-8000-d00000000002', '00000000-0000-4000-8000-300000000004', 'Extra Telur', 6000,  1),
  ('00000000-0000-4000-8000-e00000000005', '00000000-0000-4000-8000-d00000000003', '00000000-0000-4000-8000-300000000003', 'Tanpa Es',    0,    2)
on conflict (id) do update set
  modifier_name_snapshot = excluded.modifier_name_snapshot,
  price_delta_snapshot   = excluded.price_delta_snapshot,
  quantity               = excluded.quantity;

-- The audit trail for the seeded orders (DATABASE_SCHEMA.md §23). A completed
-- order shows its full path; the live draft shows only its birth event.
insert into public.order_status_history (id, order_id, from_status, to_status, actor_id, actor_role, reason)
values
  ('00000000-0000-4000-8000-f00000000001', '00000000-0000-4000-8000-c00000000001', null,            'DRAFT',     null, null, null),
  ('00000000-0000-4000-8000-f00000000002', '00000000-0000-4000-8000-c00000000001', 'DRAFT',         'SUBMITTED', null, null, null),
  ('00000000-0000-4000-8000-f00000000003', '00000000-0000-4000-8000-c00000000001', 'SUBMITTED',     'COMPLETED', null, 'cashier', null),
  ('00000000-0000-4000-8000-f00000000004', '00000000-0000-4000-8000-c00000000002', null,            'DRAFT',     null, null, null),
  ('00000000-0000-4000-8000-f00000000005', '00000000-0000-4000-8000-c00000000002', 'DRAFT',         'COMPLETED', null, 'cashier', null)
on conflict (id) do update set
  order_id    = excluded.order_id,
  from_status = excluded.from_status,
  to_status   = excluded.to_status,
  actor_id    = excluded.actor_id,
  actor_role  = excluded.actor_role,
  reason      = excluded.reason;

-- =============================================================================
-- Submitted order (Phase 8B).
--
-- A second order on the still-open A4 session, already sent to the kitchen so
-- the cashier queue has a `PENDING_CONFIRMATION` row to display
-- (API_CONTRACT.md §12.1). Its two transition rows show the atomic
-- DRAFT -> SUBMITTED -> PENDING_CONFIRMATION step the submit command writes
-- (API_CONTRACT.md §10.2, §13), and `submit_idempotency_key` is populated so a
-- retry of that submit collapses to this order instead of creating a second
-- one (API_CONTRACT.md §2.3, §14).
-- =============================================================================
insert into public.orders (
  id, order_number, table_id, table_session_id, source, status, notes,
  subtotal, discount, tax, total, idempotency_key, submit_idempotency_key, created_by
)
values
  ('00000000-0000-4000-8000-c00000000005', 'TS-20260929-0002', '00000000-0000-4000-8000-700000000004', '00000000-0000-4000-8000-900000000002', 'CUSTOMER_QR', 'PENDING_CONFIRMATION', null, 38000, 0, 0, 38000, 'seed-order-0005', 'seed-submit-0005', null)
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
  ('00000000-0000-4000-8000-d00000000006', '00000000-0000-4000-8000-c00000000005', '00000000-0000-4000-8000-200000000002', 'Ayam Bakar Tepi', 38000, 1, null, 38000)
on conflict (id) do update set
  product_name_snapshot = excluded.product_name_snapshot,
  unit_price_snapshot   = excluded.unit_price_snapshot,
  quantity              = excluded.quantity,
  notes                 = excluded.notes,
  line_total            = excluded.line_total;

insert into public.order_status_history (id, order_id, from_status, to_status, actor_id, actor_role, reason)
values
  ('00000000-0000-4000-8000-f00000000007', '00000000-0000-4000-8000-c00000000005', null,        'DRAFT',               null, null, null),
  ('00000000-0000-4000-8000-f00000000008', '00000000-0000-4000-8000-c00000000005', 'DRAFT',     'SUBMITTED',           null, null, null),
  ('00000000-0000-4000-8000-f00000000009', '00000000-0000-4000-8000-c00000000005', 'SUBMITTED', 'PENDING_CONFIRMATION', null, null, null)
on conflict (id) do nothing;
