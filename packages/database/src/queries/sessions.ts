/**
 * Table session admin queries (Phase 7).
 *
 * Read/write paths for `table_sessions` and `table_session_order_links`. Every
 * mutation is a single SECURITY DEFINER RPC from migration 007 part 3, because
 * those tables grant nothing to any client role (part 1/part 2): there is no
 * client-side insert/update/delete path to get wrong. A session can therefore
 * only be opened, attached to or closed by a caller the function re-authorized
 * itself — the one-OPEN-session-per-table invariant never depends on the
 * frontend sending the right sequence (AUTH_RBAC_RLS.md §8: critical mutations
 * are server-side, authorized, atomic, idempotent, auditable).
 *
 * The phase rules are enforced here by construction, not by cooperation:
 *   * one order is never one session — orders attach to an existing session;
 *   * a session is never closed because an order finished — the only close
 *     route is `close_table_session()`;
 *   * session state is never decided client-side — every status below is read
 *     from what the database returned.
 *
 * Results never throw: an error degrades to an explicit failure so callers fail
 * closed (TESTING_STRATEGY).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../generated/index.js";
import {
  describeSessionAttach,
  describeSessionClose,
  describeSessionOpen,
  toAttachOrderArgs,
  toAttachOrderResult,
  toSessionOrderLink,
  toTableSession,
  isValidAttachOrderInput,
  type AttachOrderInput,
  type AttachOrderResult,
  type AttachOrderRow,
  type SessionOrderLink,
  type SessionOrderLinkRow,
  type SessionRow,
  type SessionsAuditEvent,
  type TableSession,
} from "../models/index.js";

export interface SessionsQueryError {
  message: string;
}

export interface SessionsQueryResult<T> {
  data: T | null;
  error: SessionsQueryError | null;
}

interface SupabaseFailure {
  message: string;
  code?: string;
}

interface SelectChain {
  maybeSingle: <T>() => Promise<{ data: T | null; error: SupabaseFailure | null }>;
  order: (
    column: string,
    options?: { ascending?: boolean },
  ) => Promise<{ data: unknown[] | null; error: SupabaseFailure | null }>;
  eq: (column: string, value: string) => SelectChain;
}

interface UntypedTable {
  select: (columns?: string) => SelectChain;
}

/** The generated RPC types land with the Supabase CLI, so `rpc()` is typed
 * against this local shape — the same approach queries/tables.ts takes. */
interface UntypedRpc {
  data: unknown | null;
  error: SupabaseFailure | null;
}

function untypedTable(client: SupabaseClient<Database>, name: string): UntypedTable {
  return (client as unknown as { from: (table: string) => UntypedTable }).from(name);
}

function untypedRpc(
  client: SupabaseClient<Database>,
  fn: string,
  args: Record<string, unknown>,
): Promise<UntypedRpc> {
  return (
    client as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<UntypedRpc>;
    }
  ).rpc(fn, args);
}

function failure(error: SupabaseFailure | null): SessionsQueryError {
  return { message: error?.message ?? "Kueri sesi meja gagal." };
}

/** Normalise an RPC reply into a single row: PostgREST returns the declared
 * `returns setof` rows as an array, a plain JSON value as an object. */
function singleRow(data: unknown): Record<string, unknown> | null {
  if (Array.isArray(data)) return (data[0] as Record<string, unknown>) ?? null;
  if (data && typeof data === "object") return data as Record<string, unknown>;
  return null;
}

/**
 * The active (OPEN) session of one table, or null. Staff use this before
 * attaching an order or closing out. The lookup is the `get_active_table_session()`
 * function, so a closed table resolves to null rather than to the last session.
 */
export async function fetchActiveTableSession(
  client: SupabaseClient<Database>,
  tableId: string,
): Promise<SessionsQueryResult<TableSession>> {
  if (!tableId) return { data: null, error: { message: "Id meja wajib diisi." } };

  const { data, error } = await untypedRpc(client, "get_active_table_session", {
    pTableId: tableId,
  });

  if (error) return { data: null, error: failure(error) };

  const row = singleRow(data) as unknown as SessionRow | null;
  if (row === null || row.id === null) return { data: null, error: null };
  return { data: toTableSession(row), error: null };
}

/**
 * Recent sessions for one table (history included), newest first. Closure is
 * soft and history-preserving (DATABASE_SCHEMA.md §19), so the list spans both
 * statuses. Order counts come from the link table in a second read, which is a
 * read-only path under `table_sessions.read`.
 */
export async function fetchTableSessions(
  client: SupabaseClient<Database>,
  tableId: string,
): Promise<SessionsQueryResult<TableSession[]>> {
  if (!tableId) return { data: null, error: { message: "Id meja wajib diisi." } };

  const { data, error } = await untypedTable(client, "table_sessions")
    .select("id, table_id, status, opened_at, closed_at, opened_by, closed_by, created_at, updated_at")
    .eq("table_id", tableId)
    .order("opened_at", { ascending: false });

  if (error) return { data: null, error: failure(error) };

  const rows = (data ?? []) as unknown as SessionRow[];
  const ids = rows.map((row) => row.id).filter((id): id is string => id !== null);

  const counts = await fetchOrderCounts(client, ids);
  if (counts === null) {
    return { data: null, error: { message: "Kueri sesi meja gagal." } };
  }

  return {
    data: rows.map((row) => toTableSession(row, counts.get(row.id ?? "") ?? 0)),
    error: null,
  };
}

/** The orders attached to one session, oldest first. */
export async function fetchSessionOrders(
  client: SupabaseClient<Database>,
  sessionId: string,
): Promise<SessionsQueryResult<SessionOrderLink[]>> {
  if (!sessionId) return { data: null, error: { message: "Id sesi wajib diisi." } };

  const { data, error } = await untypedTable(client, "table_session_order_links")
    .select("id, session_id, order_id, order_code, attached_at")
    .eq("session_id", sessionId)
    .order("attached_at", { ascending: true });

  if (error) return { data: null, error: failure(error) };
  return {
    data: ((data ?? []) as unknown as SessionOrderLinkRow[]).map(toSessionOrderLink),
    error: null,
  };
}

async function fetchOrderCounts(
  client: SupabaseClient<Database>,
  sessionIds: string[],
): Promise<Map<string, number> | null> {
  if (sessionIds.length === 0) return new Map();

  const { data, error } = await untypedTable(client, "table_session_order_links")
    .select("session_id")
    .order("attached_at", { ascending: true });
  if (error) return null;

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as unknown as { session_id: string | null }[]) {
    if (row.session_id !== null && sessionIds.includes(row.session_id)) {
      counts.set(row.session_id, (counts.get(row.session_id) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * Open a table's session — one `open_table_session()` call. Idempotent and
 * race-safe server-side: the partial unique index means a second concurrent
 * open returns the first session instead of failing, so a double-tap on the
 * button or a retried request reuses the same row (AUTH_RBAC_RLS.md §46).
 */
export async function openTableSession(
  client: SupabaseClient<Database>,
  tableId: string,
  tableCode: string,
): Promise<SessionsQueryResult<{ session: TableSession; audit: SessionsAuditEvent | null }>> {
  if (!tableId) return { data: null, error: { message: "Id meja wajib diisi." } };

  const { data, error } = await untypedRpc(client, "open_table_session", {
    pTableId: tableId,
  });

  if (error) return { data: null, error: failure(error) };

  const row = singleRow(data) as unknown as SessionRow | null;
  if (row === null || row.id === null) {
    return { data: null, error: { message: "Sesi tidak dapat dibuka." } };
  }

  const session = toTableSession(row);
  // The session may already have been open; only a fresh open is audited.
  const audit = describeSessionOpen(session, tableCode);
  return { data: { session, audit }, error: null };
}

/**
 * Attach one order to its session — one `attach_order_to_session()` call. A
 * duplicate attach (the same order id) reports `attached: false` and is still
 * a success: the order is where it should be (AUTH_RBAC_RLS.md §46).
 * Attaching to a closed session is refused by the function, so a stale session
 * surfaces as an explicit error instead of a silent write.
 */
export async function attachOrderToSession(
  client: SupabaseClient<Database>,
  input: AttachOrderInput,
  tableCode: string,
): Promise<SessionsQueryResult<{ result: AttachOrderResult; audit: SessionsAuditEvent | null }>> {
  if (!isValidAttachOrderInput(input)) {
    return { data: null, error: { message: "Data order tidak lengkap." } };
  }

  const { data, error } = await untypedRpc(
    client,
    "attach_order_to_session",
    toAttachOrderArgs(input),
  );

  if (error) return { data: null, error: failure(error) };

  const result = toAttachOrderResult(singleRow(data) as unknown as AttachOrderRow | null);
  if (result === null) {
    return { data: null, error: { message: "Order tidak dapat ditambahkan ke sesi." } };
  }

  const session: TableSession = {
    id: result.sessionId,
    tableId: result.tableId,
    status: result.status,
    openedAt: "",
    closedAt: null,
    openedBy: null,
    closedBy: null,
    orderCount: result.orderCount,
    createdAt: "",
    updatedAt: "",
  };

  return {
    data: {
      result,
      audit: describeSessionAttach(session, tableCode, result),
    },
    error: null,
  };
}

/**
 * Close a table's session — one `close_table_session()` call, the only route
 * to CLOSED. Double close is refused by the function (already closed), and a
 * missing session is reported as not found, so duplicate actions always
 * surface instead of silently doing nothing.
 */
export async function closeTableSession(
  client: SupabaseClient<Database>,
  sessionId: string,
  tableCode: string,
): Promise<SessionsQueryResult<{ session: TableSession; audit: SessionsAuditEvent | null }>> {
  if (!sessionId) return { data: null, error: { message: "Id sesi wajib diisi." } };

  const { data, error } = await untypedRpc(client, "close_table_session", {
    pSessionId: sessionId,
  });

  if (error) return { data: null, error: failure(error) };

  const row = singleRow(data) as unknown as SessionRow | null;
  if (row === null || row.id === null) {
    return { data: null, error: { message: "Sesi tidak dapat ditutup." } };
  }

  const session = toTableSession(row);
  return { data: { session, audit: describeSessionClose(session, tableCode) }, error: null };
}
