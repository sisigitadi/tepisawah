/**
 * Permission constants — the authoritative machine-readable permission list.
 *
 * Values follow `<domain>.<action>` (AUTH_RBAC_RLS.md §7) and mirror the
 * `permissions` table seeded in `supabase/seed`. They are stable identifiers:
 * a UI label may change without touching the permission id.
 *
 * The database remains the authority (REPOSITORY_STRUCTURE.md §21): these
 * constants exist so frontend code references a typed id instead of a string
 * literal. They are never trusted server-side.
 */
export const PERMISSIONS = {
  // Catalog (AUTH_RBAC_RLS.md §8 — Catalog)
  CATALOG_READ: "catalog.read",
  CATALOG_CREATE: "catalog.create",
  CATALOG_UPDATE: "catalog.update",
  CATALOG_ARCHIVE: "catalog.archive",
  CATEGORIES_MANAGE: "categories.manage",
  MODIFIERS_MANAGE: "modifiers.manage",

  // Tables (§8 — Tables)
  TABLES_READ: "tables.read",
  TABLES_CREATE: "tables.create",
  TABLES_UPDATE: "tables.update",
  TABLES_ARCHIVE: "tables.archive",
  TABLES_QR_MANAGE: "tables.qr_manage",
  TABLE_SESSIONS_READ: "table_sessions.read",
  TABLE_SESSIONS_MANAGE: "table_sessions.manage",

  // Orders (§8 — Orders)
  ORDERS_READ: "orders.read",
  ORDERS_CREATE_MANUAL: "orders.create_manual",
  ORDERS_CONFIRM: "orders.confirm",
  ORDERS_REJECT: "orders.reject",
  ORDERS_TRANSITION: "orders.transition",
  ORDERS_CANCEL: "orders.cancel",
  ORDERS_RECALL: "orders.recall",
  // Mark Served (AUTH_RBAC_RLS.md §9 matrix: Waiter / Supervisor / Admin /
  // Owner). The transition engine maps READY -> SERVED onto this grant.
  ORDERS_SERVE: "orders.serve",

  // Kitchen (§8 — Kitchen)
  KITCHEN_READ: "kitchen.read",
  KITCHEN_START: "kitchen.start",
  KITCHEN_READY: "kitchen.ready",
  KITCHEN_RECALL: "kitchen.recall",

  // Service requests (§8 — Service)
  SERVICE_REQUESTS_READ: "service_requests.read",
  SERVICE_REQUESTS_CREATE: "service_requests.create",
  SERVICE_REQUESTS_ACKNOWLEDGE: "service_requests.acknowledge",
  SERVICE_REQUESTS_RESOLVE: "service_requests.resolve",

  // Payments (§8 — Payments)
  PAYMENTS_READ: "payments.read",
  PAYMENTS_CREATE: "payments.create",
  PAYMENTS_REFUND: "payments.refund",
  PAYMENTS_VOID: "payments.void",

  // Users (§8 — Users)
  USERS_READ: "users.read",
  USERS_CREATE: "users.create",
  USERS_UPDATE: "users.update",
  USERS_DISABLE: "users.disable",
  USERS_ROLES_MANAGE: "users.roles_manage",

  // Roles (§8 — Roles)
  ROLES_READ: "roles.read",
  ROLES_MANAGE: "roles.manage",
  PERMISSIONS_READ: "permissions.read",

  // Audit (§8 — Audit)
  AUDIT_READ: "audit.read",

  // Settings (§8 — Settings)
  SETTINGS_READ: "settings.read",
  SETTINGS_MANAGE: "settings.manage",

  // Dashboard (§8 — Dashboard)
  DASHBOARD_READ: "dashboard.read",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Type-level list of every permission value. */
export const ALL_PERMISSIONS: readonly Permission[] = Object.values(
  PERMISSIONS,
);
