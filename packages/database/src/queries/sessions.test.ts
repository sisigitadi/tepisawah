/**
 * Table session admin query tests (Phase 7).
 *
 * Read/write paths against a fake RLS-enforcing client. The fake models the
 * security boundary the way Postgres would: a session without the right grant
 * receives an RLS denial, and the query layer must degrade to an explicit
 * failure rather than a partial record (TESTING_STRATEGY Layer 2). The four
 * commands are single RPCs, so the fake models one server-side transaction — a
 * denied or refused call changes nothing, which is what makes the duplicate and
 * stale-session tests meaningful.
 *
 * Covers the six scenarios the phase asks for: multiple orders, concurrent
 * order creation, session close validation, unauthorized access, stale session
 * and duplicate action.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../generated/index.js";
import {
  attachOrderToSession,
  closeTableSession,
  fetchActiveTableSession,
  fetchSessionOrders,
  fetchTableSessions,
  openTableSession,
} from "./sessions.js";
import type {
  AttachOrderRow,
  SessionOrderLinkRow,
  SessionRow,
} from "../models/index.js";

type Table = "table_sessions" | "table_session_order_links";

interface FakeConfig {
  sessionRows?: SessionRow[];
  linkRows?: SessionOrderLinkRow[];
  /** RLS denial, keyed by table name or by RPC function name. */
  deny?: string;
  /** Refuse the next attach the way `attach_order_to_session()` refuses a
   * closed session (class 23) or a vanished one (P0002). */
  attachError?: { message: string; code: string };
  /** Records what the client was asked to call. */
  rpcCalls?: { fn: string; args: unknown }[];
  /** Records the link rows the client was asked to insert. */
  writes?: { table: Table; rows: unknown[] }[];
}

const RLS_ERROR = {
  message: 'permission denied for table "table_sessions"',
  code: "42501",
};

const RPC_DENY_ERROR = {
  message: "permission denied for function open_table_session",
  code: "42501",
};

function fakeClient(config: FakeConfig): SupabaseClient<Database> {
  config.rpcCalls = config.rpcCalls ?? [];
  config.writes = config.writes ?? [];

  // Copy the fixtures: a close mutates its session row, and a shared mutable
  // fixture would leak between tests and break isolation.
  config.sessionRows = (config.sessionRows ?? []).map((row) => ({ ...row }));
  config.linkRows = (config.linkRows ?? []).map((row) => ({ ...row }));

  const sessions = (): SessionRow[] => config.sessionRows ?? [];
  const links = (): SessionOrderLinkRow[] => config.linkRows ?? [];

  // The four RPCs mirror migration 007 part 3 exactly: open reuses an existing
  // OPEN session rather than creating a second one, close refuses a closed
  // session, and attach is idempotent on order_id.
  const rpc = (fn: string, args: Record<string, unknown>) => {
    config.rpcCalls?.push({ fn, args });

    if (config.deny === fn) {
      return Promise.resolve({ data: null, error: RPC_DENY_ERROR });
    }

    if (fn === "open_table_session") {
      const tableId = args.p_table_id as string;
      const existing = sessions().find(
        (row) => row.table_id === tableId && row.status === "OPEN",
      );
      if (existing) return Promise.resolve({ data: existing, error: null });
      const fresh: SessionRow = {
        id: "ses-new",
        table_id: tableId,
        status: "OPEN",
        opened_at: "2026-09-29T10:00:00Z",
        closed_at: null,
        opened_by: null,
        closed_by: null,
        created_at: "2026-09-29T10:00:00Z",
        updated_at: "2026-09-29T10:00:00Z",
      };
      config.sessionRows = [...sessions(), fresh];
      return Promise.resolve({ data: fresh, error: null });
    }

    if (fn === "get_active_table_session") {
      const row = sessions().find(
        (candidate) =>
          candidate.table_id === (args.p_table_id as string) &&
          candidate.status === "OPEN",
      );
      return Promise.resolve({ data: row ?? null, error: null });
    }

    if (fn === "attach_order_to_session") {
      if (config.attachError) {
        return Promise.resolve({ data: null, error: config.attachError });
      }
      const sessionId = args.p_session_id as string;
      const session = sessions().find((row) => row.id === sessionId);
      const tableId = session?.table_id ?? "tbl-1";
      const orderId = args.p_order_id as string;
      const already = links().some((row) => row.order_id === orderId);
      if (!already) {
        config.linkRows = [
          ...links(),
          {
            id: `link-${orderId}`,
            session_id: sessionId,
            order_id: orderId,
            order_code: args.p_order_code as string,
            attached_at: "2026-09-29T10:05:00Z",
          },
        ];
      }
      const reply: AttachOrderRow = {
        session_id: sessionId,
        table_id: tableId,
        status: session?.status ?? "OPEN",
        order_id: orderId,
        order_code: args.p_order_code as string,
        attached: !already,
        order_count: links().filter((row) => row.session_id === sessionId).length,
      };
      return Promise.resolve({ data: reply, error: null });
    }

    // close_table_session
    const row = sessions().find((candidate) => candidate.id === (args.p_session_id as string));
    if (!row) {
      return Promise.resolve({
        data: null,
        error: { message: "Table session not found", code: "P0002" },
      });
    }
    if (row.status !== "OPEN") {
      return Promise.resolve({
        data: null,
        error: { message: "Table session is already closed", code: "23003" },
      });
    }
    row.status = "CLOSED";
    row.closed_at = "2026-09-29T11:00:00Z";
    row.closed_by = "staff-1";
    return Promise.resolve({ data: row, error: null });
  };

  const client = {
    rpc,
    from: (table: Table) => {
      const filter: Record<string, unknown> = {};
      const self: Record<string, unknown> = {
        eq: (column: string, value: unknown) => {
          filter[column] = value;
          return self;
        },
        select: () => self,
        order: (_column: string) => {
          const rows =
            table === "table_sessions" ? (sessions() as unknown[]) : (links() as unknown[]);
          const matched = rows.filter((row) => {
            const record = row as Record<string, unknown>;
            return Object.entries(filter).every(([column, value]) => record[column] === value);
          });
          if (config.deny === table) {
            return Promise.resolve({ data: null, error: RLS_ERROR });
          }
          return Promise.resolve({ data: matched, error: null });
        },
      };
      return { select: () => self };
    },
  };

  return client as unknown as SupabaseClient<Database>;
}

const OPEN_SESSION_ROW: SessionRow = {
  id: "ses-1",
  table_id: "tbl-1",
  status: "OPEN",
  opened_at: "2026-09-29T09:00:00Z",
  closed_at: null,
  opened_by: "staff-1",
  closed_by: null,
  created_at: "2026-09-29T09:00:00Z",
  updated_at: "2026-09-29T09:00:00Z",
};

describe("table session admin queries", () => {
  describe("fetchActiveTableSession", () => {
    it("returns the open session for a table", async () => {
      const client = fakeClient({ sessionRows: [OPEN_SESSION_ROW] });
      const result = await fetchActiveTableSession(client, "tbl-1");
      expect(result.error).toBeNull();
      expect(result.data?.id).toBe("ses-1");
      expect(result.data?.status).toBe("OPEN");
    });

    it("returns null when the table has no open session", async () => {
      const client = fakeClient({
        sessionRows: [{ ...OPEN_SESSION_ROW, status: "CLOSED", closed_at: "2026-09-29T10:00:00Z" }],
      });
      const result = await fetchActiveTableSession(client, "tbl-1");
      expect(result.error).toBeNull();
      expect(result.data).toBeNull();
    });

    it("refuses an empty table id before it reaches the network", async () => {
      const config: FakeConfig = { sessionRows: [OPEN_SESSION_ROW] };
      const client = fakeClient(config);
      const result = await fetchActiveTableSession(client, "");
      expect(result.data).toBeNull();
      expect(result.error?.message).toBe("Id meja wajib diisi.");
      expect(config.rpcCalls).toHaveLength(0);
    });
  });

  describe("openTableSession", () => {
    it("opens a session through one rpc call", async () => {
      const config: FakeConfig = { sessionRows: [] };
      const client = fakeClient(config);
      const result = await openTableSession(client, "tbl-1", "A12");
      expect(result.error).toBeNull();
      expect(result.data?.session.status).toBe("OPEN");
      expect(config.rpcCalls).toEqual([
        { fn: "open_table_session", args: { p_table_id: "tbl-1" } },
      ]);
    });

    // Duplicate action: a double-tap or a retried request must land on the same
    // session, never a second one (the partial unique index is the backstop).
    it("reuses the existing open session instead of creating a second one", async () => {
      const config: FakeConfig = { sessionRows: [OPEN_SESSION_ROW] };
      const client = fakeClient(config);
      const first = await openTableSession(client, "tbl-1", "A12");
      const second = await openTableSession(client, "tbl-1", "A12");
      expect(first.error).toBeNull();
      expect(second.error).toBeNull();
      expect(first.data?.session.id).toBe("ses-1");
      expect(second.data?.session.id).toBe("ses-1");
      expect(config.sessionRows?.filter((row) => row.status === "OPEN")).toHaveLength(1);
    });

    it("refuses an empty table id", async () => {
      const client = fakeClient({ sessionRows: [] });
      const result = await openTableSession(client, "", "A12");
      expect(result.data).toBeNull();
      expect(result.error?.message).toBe("Id meja wajib diisi.");
    });

    it("degrades an unauthorized open to an explicit failure", async () => {
      const client = fakeClient({ sessionRows: [], deny: "open_table_session" });
      const result = await openTableSession(client, "tbl-1", "A12");
      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("permission denied");
    });
  });

  describe("attachOrderToSession — multiple orders", () => {
    it("attaches several orders to the same session and counts them", async () => {
      const client = fakeClient({ sessionRows: [OPEN_SESSION_ROW], linkRows: [] });
      const first = await attachOrderToSession(
        client,
        { sessionId: "ses-1", orderId: "ord-1", orderCode: "ORD-001" },
        "A12",
      );
      const second = await attachOrderToSession(
        client,
        { sessionId: "ses-1", orderId: "ord-2", orderCode: "ORD-002" },
        "A12",
      );
      expect(first.error).toBeNull();
      expect(second.error).toBeNull();
      expect(first.data?.result.orderCount).toBe(1);
      expect(second.data?.result.orderCount).toBe(2);
      expect(first.data?.audit?.label).toContain("ORD-001");
    });

    it("reads the attached orders back in attachment order", async () => {
      const client = fakeClient({
        sessionRows: [OPEN_SESSION_ROW],
        linkRows: [
          { id: "l1", session_id: "ses-1", order_id: "ord-1", order_code: "ORD-001", attached_at: "2026-09-29T09:10:00Z" },
          { id: "l2", session_id: "ses-1", order_id: "ord-2", order_code: "ORD-002", attached_at: "2026-09-29T09:20:00Z" },
          { id: "l3", session_id: "ses-2", order_id: "ord-9", order_code: "ORD-009", attached_at: "2026-09-29T09:30:00Z" },
        ],
      });
      const result = await fetchSessionOrders(client, "ses-1");
      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(2);
      expect(result.data?.map((link) => link.orderCode)).toEqual(["ORD-001", "ORD-002"]);
    });

    // Concurrent order creation: two writers racing the same order collapse into
    // one attach; the loser is told it attached nothing and the count is stable.
    it("reports attached=false for a duplicate order instead of double counting", async () => {
      const client = fakeClient({ sessionRows: [OPEN_SESSION_ROW], linkRows: [] });
      await attachOrderToSession(
        client,
        { sessionId: "ses-1", orderId: "ord-1", orderCode: "ORD-001" },
        "A12",
      );
      const retry = await attachOrderToSession(
        client,
        { sessionId: "ses-1", orderId: "ord-1", orderCode: "ORD-001" },
        "A12",
      );
      expect(retry.error).toBeNull();
      expect(retry.data?.result.attached).toBe(false);
      expect(retry.data?.result.orderCount).toBe(1);
    });

    it("refuses an incomplete attach payload before it reaches the network", async () => {
      const config: FakeConfig = { sessionRows: [OPEN_SESSION_ROW] };
      const client = fakeClient(config);
      const result = await attachOrderToSession(
        client,
        { sessionId: "ses-1", orderId: "", orderCode: "ORD-001" },
        "A12",
      );
      expect(result.data).toBeNull();
      expect(result.error?.message).toBe("Data order tidak lengkap.");
      expect(config.rpcCalls).toHaveLength(0);
    });

    // Stale session: an attach against a closed visit is refused server-side,
    // never silently accepted.
    it("fails closed when the session is already closed", async () => {
      const client = fakeClient({
        sessionRows: [OPEN_SESSION_ROW],
        attachError: { message: "Table session is closed", code: "23003" },
      });
      const result = await attachOrderToSession(
        client,
        { sessionId: "ses-1", orderId: "ord-1", orderCode: "ORD-001" },
        "A12",
      );
      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("closed");
    });

    it("degrades an unauthorized attach to an explicit failure", async () => {
      const client = fakeClient({
        sessionRows: [OPEN_SESSION_ROW],
        deny: "attach_order_to_session",
      });
      const result = await attachOrderToSession(
        client,
        { sessionId: "ses-1", orderId: "ord-1", orderCode: "ORD-001" },
        "A12",
      );
      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("permission denied");
    });
  });

  describe("closeTableSession — close validation", () => {
    it("closes an open session and records who closed it", async () => {
      const client = fakeClient({ sessionRows: [OPEN_SESSION_ROW] });
      const result = await closeTableSession(client, "ses-1", "A12");
      expect(result.error).toBeNull();
      expect(result.data?.session.status).toBe("CLOSED");
      expect(result.data?.session.closedAt).toBe("2026-09-29T11:00:00Z");
      expect(result.data?.audit?.changedFields).toEqual(["status", "closed_at", "closed_by"]);
    });

    // Duplicate action: closing twice must surface, not no-op.
    it("refuses to close a session that is already closed", async () => {
      const client = fakeClient({ sessionRows: [OPEN_SESSION_ROW] });
      const first = await closeTableSession(client, "ses-1", "A12");
      const second = await closeTableSession(client, "ses-1", "A12");
      expect(first.error).toBeNull();
      expect(second.data).toBeNull();
      expect(second.error?.message).toContain("already closed");
    });

    it("reports a missing session rather than closing nothing", async () => {
      const client = fakeClient({ sessionRows: [OPEN_SESSION_ROW] });
      const result = await closeTableSession(client, "ses-missing", "A12");
      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("not found");
    });

    it("refuses an empty session id", async () => {
      const client = fakeClient({ sessionRows: [OPEN_SESSION_ROW] });
      const result = await closeTableSession(client, "", "A12");
      expect(result.data).toBeNull();
      expect(result.error?.message).toBe("Id sesi wajib diisi.");
    });

    it("degrades an unauthorized close to an explicit failure", async () => {
      const config: FakeConfig = {
        sessionRows: [OPEN_SESSION_ROW],
        deny: "close_table_session",
      };
      const client = fakeClient(config);
      const result = await closeTableSession(client, "ses-1", "A12");
      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("permission denied");
      expect(config.sessionRows?.[0]?.status).toBe("OPEN");
    });
  });

  describe("fetchTableSessions", () => {
    it("lists open and closed history with order counts", async () => {
      const client = fakeClient({
        sessionRows: [
          OPEN_SESSION_ROW,
          { ...OPEN_SESSION_ROW, id: "ses-0", status: "CLOSED", closed_at: "2026-09-29T08:00:00Z", opened_at: "2026-09-29T06:00:00Z" },
        ],
        linkRows: [
          { id: "l1", session_id: "ses-1", order_id: "ord-1", order_code: "ORD-001", attached_at: "2026-09-29T09:10:00Z" },
          { id: "l2", session_id: "ses-1", order_id: "ord-2", order_code: "ORD-002", attached_at: "2026-09-29T09:20:00Z" },
          { id: "l3", session_id: "ses-0", order_id: "ord-0", order_code: "ORD-000", attached_at: "2026-09-29T06:30:00Z" },
        ],
      });
      const result = await fetchTableSessions(client, "tbl-1");
      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(2);
      const byId = new Map(result.data?.map((row) => [row.id, row.orderCount]));
      expect(byId.get("ses-1")).toBe(2);
      expect(byId.get("ses-0")).toBe(1);
    });

    it("degrades an RLS denial on the session table to a failure", async () => {
      const client = fakeClient({
        sessionRows: [OPEN_SESSION_ROW],
        deny: "table_sessions",
      });
      const result = await fetchTableSessions(client, "tbl-1");
      expect(result.data).toBeNull();
      expect(result.error).not.toBeNull();
    });
  });
});
