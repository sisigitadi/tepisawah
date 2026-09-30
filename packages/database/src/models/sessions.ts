/**
 * Table session models (Phase 7): database row mappers.
 *
 * Mirrors migration `007_table_sessions` and docs/database/DATABASE_SCHEMA.md
 * §19. Database snake_case rows are mapped to camelCase application records;
 * nullability is preserved so an unreadable column never degrades into a fake
 * value (a NULL closed_at reads as null, never as "closed now"). An unknown
 * status falls back to the default rather than widening the vocabulary.
 *
 * Audit descriptors (AUTH_RBAC_RLS.md §39-§40) are produced for open / attach /
 * close so the admin UI can describe what changed without re-reading the row.
 */
import type {
  AttachOrderInput,
  AttachOrderResult,
  ResolvedTableSession,
  SessionOrderLink,
  SessionStatus,
  SessionsAuditEvent,
  TableSession,
} from "./sessions-types.js";
import { isSessionOpen, isValidSessionStatus } from "./sessions-validation.js";

export type {
  AttachOrderInput,
  AttachOrderResult,
  ResolvedTableSession,
  SessionOrderLink,
  SessionStatus,
  SessionsAuditEvent,
  SessionsEntity,
  TableSession,
} from "./sessions-types.js";

/** Raw `select * from table_sessions` shape. */
export interface SessionRow {
  id: string | null;
  table_id: string | null;
  status: string | null;
  opened_at: string | null;
  closed_at: string | null;
  opened_by: string | null;
  closed_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/** Raw `select * from table_session_order_links` shape. */
export interface SessionOrderLinkRow {
  id: string | null;
  session_id: string | null;
  order_id: string | null;
  order_code: string | null;
  attached_at: string | null;
}

/** Raw `attach_order_to_session()` RPC reply shape. */
export interface AttachOrderRow {
  session_id: string | null;
  table_id: string | null;
  status: string | null;
  order_id: string | null;
  order_code: string | null;
  attached: boolean | null;
  order_count: number | null;
}

/** Unknown status falls back to OPEN rather than widening the vocabulary. */
function toStatus(value: string | null): SessionStatus {
  return value !== null && isValidSessionStatus(value) ? value : "OPEN";
}

export function toTableSession(row: SessionRow, orderCount = 0): TableSession {
  return {
    id: row.id ?? "",
    tableId: row.table_id ?? "",
    status: toStatus(row.status),
    openedAt: row.opened_at ?? "",
    closedAt: row.closed_at,
    openedBy: row.opened_by,
    closedBy: row.closed_by,
    orderCount,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
  };
}

export function toSessionOrderLink(row: SessionOrderLinkRow): SessionOrderLink {
  return {
    id: row.id ?? "",
    sessionId: row.session_id ?? "",
    orderId: row.order_id ?? "",
    orderCode: row.order_code ?? "",
    attachedAt: row.attached_at ?? "",
  };
}

/**
 * Map the attach reply. `attached` is normalised to a strict boolean so a
 * missing flag can never read as a silent success, and an unknown session
 * status degrades the same way the direct row mapping does.
 */
export function toAttachOrderResult(row: AttachOrderRow | null): AttachOrderResult | null {
  if (!row) return null;
  if (row.session_id === null || row.order_id === null) return null;
  return {
    sessionId: row.session_id,
    tableId: row.table_id ?? "",
    status: toStatus(row.status),
    orderId: row.order_id,
    orderCode: row.order_code ?? "",
    attached: row.attached === true,
    orderCount: row.order_count ?? 0,
  };
}

/**
 * Map the session half of the QR projection (API_CONTRACT.md §8.2). Returns
 * null when the resolver found no open session, so the customer flow treats
 * "no session yet" as an absent field rather than a fake one.
 */
export function toResolvedTableSession(row: {
  session_id: string | null;
  session_status: string | null;
}): ResolvedTableSession | null {
  if (row.session_id === null) return null;
  return { id: row.session_id, status: toStatus(row.session_status) };
}

/** Client-writable columns for an attach (the only client payload there is). */
export function toAttachOrderArgs(input: AttachOrderInput): Record<string, unknown> {
  return {
    p_session_id: input.sessionId.trim(),
    p_order_id: input.orderId.trim(),
    p_order_code: input.orderCode.trim(),
  };
}

/** Audit descriptor for `open_table_session()`. */
export function describeSessionOpen(session: TableSession, tableCode: string): SessionsAuditEvent {
  return {
    entity: "table_session",
    action: "open",
    entityId: session.id,
    label: `Sesi ${tableCode} dibuka`,
    changedFields: ["status"],
  };
}

/** Audit descriptor for `attach_order_to_session()`. */
export function describeSessionAttach(
  session: TableSession,
  tableCode: string,
  result: AttachOrderResult,
): SessionsAuditEvent {
  return {
    entity: "table_session",
    action: "attach_order",
    entityId: session.id,
    label: `Order ${result.orderCode} ditambahkan ke sesi ${tableCode}`,
    changedFields: result.attached ? ["order_count"] : [],
  };
}

/** Audit descriptor for `close_table_session()`. */
export function describeSessionClose(session: TableSession, tableCode: string): SessionsAuditEvent {
  return {
    entity: "table_session",
    action: "close",
    entityId: session.id,
    label: `Sesi ${tableCode} ditutup`,
    changedFields: ["status", "closed_at", "closed_by"],
  };
}

/** True while the mapped session can still accept orders. */
export function sessionAcceptsOrders(session: TableSession): boolean {
  return isSessionOpen(session.status);
}
