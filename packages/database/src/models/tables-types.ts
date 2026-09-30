/**
 * Tables + QR type contracts (Phase 6).
 *
 * Canonical field lists come from docs/database/DATABASE_SCHEMA.md §17-§18 and
 * docs/api/API_CONTRACT.md §8.1-§8.2. The operational status vocabulary is the
 * one docs/design/MASTER_DESIGN_SYSTEM.md §14 defines and DATABASE_SCHEMA.md
 * §17 reserves: table status is a separate vocabulary from order status and is
 * never derived from it.
 *
 * Two records, two boundaries (AUTH_RBAC_RLS.md §17, §46):
 *   - {@link RestaurantTable} / {@link TableQr} are the internal admin view.
 *     `TableQr.token` is the secret the printed sticker carries; it reaches
 *     this record only because staff with `tables.qr_manage` must be able to
 *     print the QR, and RLS refuses the whole row to anyone else.
 *   - {@link PublicTableResolve} is the only customer-safe projection and
 *     mirrors `resolve_table_qr()` in migration 006 part 3. It never carries
 *     the token, the capacity, the status, roles, staff or audit data.
 *
 * Nothing outside the Phase 6 scope is modelled here: no table sessions, no
 * order linkage, no floor-plan layout (CLINE_IMPLEMENTATION_PLAN.md §12).
 */
import type { ResolvedTableSession } from "./sessions-types.js";

/** Operational state of the furniture (MASTER_DESIGN_SYSTEM.md §14). */
export const TABLE_STATUSES = [
  "AVAILABLE",
  "OCCUPIED",
  "WAITING_SERVICE",
  "WAITING_PAYMENT",
  "CLEANING",
] as const;

export type TableStatus = (typeof TABLE_STATUSES)[number];

/** Admin record for `tables` (internal; the public flow never reads it). */
export interface RestaurantTable {
  id: string;
  /** The code printed on the QR and used on the floor plan, e.g. "A12". */
  tableCode: string;
  /** Display label, e.g. "Meja A12". */
  name: string;
  /** Seats, unknown when null. */
  capacity: number | null;
  status: TableStatus;
  /** False archives the table: its QR stops resolving but history survives. */
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Admin record for the table's currently printed QR (`table_qr`). */
export interface TableQr {
  id: string;
  tableId: string;
  /** Secret carried by the printed sticker. Never returned to a customer. */
  token: string;
  isActive: boolean;
  createdAt: string;
  /** Optional hard expiry; null means the QR does not expire on its own. */
  expiresAt: string | null;
}

/**
 * Client-writable table patch. The id and timestamps are never accepted from a
 * client; the RLS column GRANT in migration 006 part 1 mirrors this exactly.
 */
export interface TableInput {
  tableCode: string;
  name: string;
  capacity: number | null;
  status: TableStatus;
  isActive: boolean;
}

/** Field-keyed validation errors; an empty object means valid. */
export type TableErrors = Partial<Record<keyof TableInput, string>>;

/**
 * The customer-facing QR resolution (API_CONTRACT.md §8.2), produced by
 * `resolve_table_qr()`. Deliberately minimal: this is everything the ordering
 * flow needs and nothing more.
 *
 * `session` is the table's active dining session (Phase 7, §8.2): the id the
 * order-creation call carries back as `tableSessionId`, plus its status. It is
 * null before the staff open a session. Only the id and status are ever
 * exposed — staff ids and order ids stay internal (AUTH_RBAC_RLS.md §17-§18).
 */
export interface PublicTableResolve {
  tableId: string;
  tableCode: string;
  tableName: string;
  restaurantName: string | null;
  isOpen: boolean;
  session: ResolvedTableSession | null;
}

/** A tables/QR write, for the audit descriptor below. */
export type TablesEntity = "table" | "table_qr";

/** Audit descriptor for one tables/QR change (AUTH_RBAC_RLS.md §39-§40). */
export interface TablesAuditEvent {
  entity: TablesEntity;
  /** "create" | "update" | "archive" | "restore" | "qr_mint" | "qr_retire" */
  action: string;
  entityId: string;
  /** Human-readable label for the audit trail. */
  label: string;
  changedFields: string[];
}
