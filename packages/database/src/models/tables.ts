/**
 * Tables models (Phase 6): database row mappers.
 *
 * Mirrors migration `006_tables` and docs/database/DATABASE_SCHEMA.md
 * §17-§18. Database snake_case rows are mapped to camelCase application
 * records; nullability is preserved so an unreadable column never degrades
 * into a fake value (a NULL capacity reads as null, never as "seats 0").
 *
 * Public/private boundary (AUTH_RBAC_RLS.md §17, §46): the admin records are
 * internal; {@link PublicTableResolve} is the only customer-safe projection and
 * mirrors the `resolve_table_qr()` SQL function. A retired, expired or
 * archived QR never reaches it — the function applies those filters, and the
 * mapper preserves an empty result as null.
 */
import type {
  PublicTableResolve,
  RestaurantTable,
  TableInput,
  TableQr,
  TableStatus,
} from "./tables-types.js";
import { isValidTableStatus } from "./tables-validation.js";
import { toResolvedTableSession } from "./sessions.js";

export type {
  PublicTableResolve,
  RestaurantTable,
  TableErrors,
  TableInput,
  TableQr,
  TableStatus,
  TablesAuditEvent,
  TablesEntity,
} from "./tables-types.js";
export { TABLE_STATUSES } from "./tables-types.js";

/** Raw `select * from tables` shape. */
export interface TableRow {
  id: string | null;
  table_code: string | null;
  name: string | null;
  capacity: number | null;
  status: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

/** Raw `select * from table_qr` shape (the token column is admin-only). */
export interface TableQrRow {
  id: string | null;
  table_id: string | null;
  token: string | null;
  is_active: boolean | null;
  created_at: string | null;
  expires_at: string | null;
}

/** Raw `resolve_table_qr()` RPC row shape. The two `session_*` columns land
 * with Phase 7 (migration 007 part 4) and are nullable: a table with no open
 * session resolves them both as null. */
export interface ResolveTableQrRow {
  table_id: string | null;
  table_code: string | null;
  table_name: string | null;
  restaurant_name: string | null;
  is_open: boolean | null;
  session_id: string | null;
  session_status: string | null;
}

/** Unknown status falls back to the default rather than widening the vocabulary. */
function toStatus(value: string | null): TableStatus {
  return value !== null && isValidTableStatus(value) ? value : "AVAILABLE";
}

export function toTable(row: TableRow): RestaurantTable {
  return {
    id: row.id ?? "",
    tableCode: row.table_code ?? "",
    name: row.name ?? "",
    capacity: row.capacity ?? null,
    status: toStatus(row.status),
    isActive: row.is_active === true,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
  };
}

export function toTableQr(row: TableQrRow): TableQr {
  return {
    id: row.id ?? "",
    tableId: row.table_id ?? "",
    token: row.token ?? "",
    isActive: row.is_active === true,
    createdAt: row.created_at ?? "",
    expiresAt: row.expires_at,
  };
}

/** Client-writable columns only; the id and timestamps are never accepted. */
export function toTableRow(input: TableInput): Record<string, unknown> {
  return {
    table_code: input.tableCode.trim(),
    name: input.name.trim(),
    capacity: input.capacity,
    status: input.status,
    is_active: input.isActive,
  };
}

/**
 * Map the public projection. Returns null when the database resolved nothing:
 * an unknown code, a retired or expired QR, a token from another table, or an
 * archived table all arrive as an empty result and the caller must treat that
 * as "QR tidak valid" (API_CONTRACT.md §8.2, AUTH_RBAC_RLS.md §18).
 */
export function toPublicTableResolve(row: ResolveTableQrRow | null): PublicTableResolve | null {
  if (!row) return null;
  if (row.table_id === null || row.table_code === null || row.table_name === null) return null;
  return {
    tableId: row.table_id,
    tableCode: row.table_code,
    tableName: row.table_name,
    restaurantName: row.restaurant_name,
    isOpen: row.is_open === true,
    session: toResolvedTableSession(row),
  };
}
