/**
 * Table sessions service (Phase 7).
 *
 * Bridges the admin UI to the @tepisawah/database table-session query layer.
 * Every call rides the RLS-enforced browser client, so a session without
 * table_sessions.read / table_sessions.manage receives an empty list or an RLS
 * denial — the UI can never widen what the database refuses
 * (AUTH_RBAC_RLS.md §2.2: frontend permission is only UX).
 *
 * The three commands map one-to-one onto the SECURITY DEFINER RPCs from
 * migration 007 part 3, so the one-OPEN-session-per-table invariant, the
 * idempotent reuse of an open session and the refusal to attach to a closed
 * session are all decided server-side. This service never decides session
 * state; it only reports what the database returned.
 *
 * Session writes close out a dining visit, so they are auditable
 * (AUTH_RBAC_RLS.md §39-§40). audit_logs lands with migration 014, so until
 * then a successful change is recorded through the application logger as a
 * TABLE_SESSIONS_UPDATED event; Phase 14 swaps the logger for the audit writer
 * without changing this shape.
 */
import {
  closeTableSession,
  fetchActiveTableSession,
  fetchTableSessions,
  fetchTables,
  openTableSession,
  type RestaurantTable,
  type SessionsAuditEvent,
  type TableSession,
} from "@tepisawah/database";

import { logger } from "../../lib/logger.js";
import { getSupabaseClient } from "../../lib/supabase.js";

export interface TableSessionRow {
  table: RestaurantTable;
  /** The table's open session, or null before staff open one. */
  session: TableSession | null;
  /** Recent sessions for the table, open first, for the history drawer. */
  history: TableSession[];
}

export interface SessionsSnapshot {
  rows: TableSessionRow[];
  error: string | null;
}

export type ServiceResult<T> = {
  data: T | null;
  error: string | null;
};

/** Load the admin view: tables paired with their active session and history. */
export async function loadSessions(): Promise<SessionsSnapshot> {
  const client = getSupabaseClient();

  const tablesResult = await fetchTables(client);
  if (tablesResult.error) {
    return { rows: [], error: tablesResult.error.message };
  }

  const tables = tablesResult.data ?? [];
  const rows = await Promise.all(
    tables.map(async (table): Promise<TableSessionRow> => {
      const [active, history] = await Promise.all([
        fetchActiveTableSession(client, table.id),
        fetchTableSessions(client, table.id),
      ]);
      return {
        table,
        session: active.data,
        history: history.data ?? [],
      };
    }),
  );

  return { rows, error: null };
}

/**
 * Open a table's session — one server-side call, idempotent. The RPC reuses an
 * already-open session instead of erroring, so a double-tap lands on the same
 * row (AUTH_RBAC_RLS.md §46).
 */
export async function openSession(
  tableId: string,
  tableCode: string,
): Promise<ServiceResult<{ session: TableSession; audit: SessionsAuditEvent | null }>> {
  const client = getSupabaseClient();
  const result = await openTableSession(client, tableId, tableCode);
  if (result.error || !result.data) {
    return { data: null, error: result.error?.message ?? "Sesi tidak dapat dibuka." };
  }
  logAudit(result.data.audit);
  return { data: result.data, error: null };
}

/**
 * Close a table's session — one server-side call, the only route to CLOSED. A
 * double close or a missing session surfaces as an error rather than a silent
 * no-op, so duplicate actions stay visible.
 */
export async function closeSession(
  sessionId: string,
  tableCode: string,
): Promise<ServiceResult<{ session: TableSession; audit: SessionsAuditEvent | null }>> {
  const client = getSupabaseClient();
  const result = await closeTableSession(client, sessionId, tableCode);
  if (result.error || !result.data) {
    return { data: null, error: result.error?.message ?? "Sesi tidak dapat ditutup." };
  }
  logAudit(result.data.audit);
  return { data: result.data, error: null };
}

function logAudit(event: SessionsAuditEvent | null): void {
  if (event !== null && event.changedFields.length > 0) {
    logger.info("TABLE_SESSIONS_UPDATED", event);
  }
}
