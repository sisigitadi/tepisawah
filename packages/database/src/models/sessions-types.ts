/**
 * Table session type contracts (Phase 7).
 *
 * Canonical field lists come from docs/database/DATABASE_SCHEMA.md §19
 * (table_sessions) and docs/api/API_CONTRACT.md §9.1-§9.3 (Open / Get / Close
 * Table Session) plus §10.1 (create order carries tableSessionId).
 *
 * Session status is its own two-value vocabulary, independent of both table
 * status (Phase 6) and order status (Phase 8). The one invariant the whole
 * phase rests on (DATABASE_SCHEMA.md §19, CLINE_IMPLEMENTATION_PLAN.md §13):
 * one table has at most one OPEN session, and that session may hold several
 * orders. Neither fact is ever decided by the frontend — the partial unique
 * index in migration 007 part 1 is the authority (MASTER prompt: the database
 * is the source of truth, the backend is the authority).
 */

/** Lifecycle of one dining visit. */
export const SESSION_STATUSES = ["OPEN", "CLOSED"] as const;

export type SessionStatus = (typeof SESSION_STATUSES)[number];

/** Admin record for `table_sessions` (internal). */
export interface TableSession {
  id: string;
  tableId: string;
  status: SessionStatus;
  openedAt: string;
  /** Present once the session is closed; closure is soft and history-preserving. */
  closedAt: string | null;
  /** Staff member who opened the session, when the backend recorded one. */
  openedBy: string | null;
  closedBy: string | null;
  /** Number of orders attached to the session so far. */
  orderCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Admin record for `table_session_order_links` (internal). */
export interface SessionOrderLink {
  id: string;
  sessionId: string;
  orderId: string;
  orderCode: string;
  attachedAt: string;
}

/**
 * Payload for attaching an order to its session. The order id/code are the
 * caller's; the session is the authority on whether the attach is allowed.
 */
export interface AttachOrderInput {
  sessionId: string;
  orderId: string;
  orderCode: string;
}

/**
 * `attach_order_to_session()` reply (API_CONTRACT.md §10.1). `attached` is
 * false when the order was already linked — a retried request after a network
 * drop — so the client can treat a duplicate as success without a second
 * insert (AUTH_RBAC_RLS.md §46).
 */
export interface AttachOrderResult {
  sessionId: string;
  tableId: string;
  status: SessionStatus;
  orderId: string;
  orderCode: string;
  attached: boolean;
  orderCount: number;
}

/** The active session of a resolved table, as the QR projection carries it
 * (API_CONTRACT.md §8.2). Id and status only: no staff ids, no order ids. */
export interface ResolvedTableSession {
  id: string;
  status: SessionStatus;
}

/** A table-session write, for the audit descriptor below. */
export type SessionsEntity = "table_session";

/** Audit descriptor for one table-session change (AUTH_RBAC_RLS.md §39-§40). */
export interface SessionsAuditEvent {
  entity: SessionsEntity;
  /** "open" | "attach_order" | "close" */
  action: string;
  entityId: string;
  label: string;
  changedFields: string[];
}
