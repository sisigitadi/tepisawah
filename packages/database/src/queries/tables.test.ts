/**
 * Tables admin query tests (Phase 6).
 *
 * Read/write paths against a fake RLS-enforcing client. The fake models the
 * security boundary the way Postgres would: a session without the right grant
 * receives an RLS denial, and the query layer must degrade to an explicit
 * failure rather than a partial record (TESTING_STRATEGY Layer 2). The QR
 * mutations are single RPCs, so the fake models one server-side transaction:
 * a denied mint leaves the previously printed QR exactly as it was.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../generated/index.js";
import {
  createTable,
  fetchTableQrs,
  fetchTables,
  mintTableQr,
  retireTableQr,
  updateTable,
} from "./tables.js";
import type {
  RestaurantTable,
  TableInput,
  TableQr,
  TableQrRow,
  TableRow,
} from "../models/index.js";

type Table = "tables" | "table_qr";

interface FakeConfig {
  tableRows?: TableRow[];
  qrRows?: TableQrRow[];
  /** RLS denial, keyed by table or by RPC function name. */
  deny?: string;
  /** Records what the client was asked to write. */
  writes: { table: Table; rows: unknown[] }[];
  /** Records RPC calls (the atomic QR mint / retire). */
  rpcCalls?: { fn: string; args: unknown }[];
}

const RLS_ERROR = {
  message: 'permission denied for table "tables"',
  code: "42501",
};

const RPC_DENY_ERROR = {
  message: "permission denied for function regenerate_table_qr",
  code: "42501",
};

function fakeClient(config: FakeConfig): SupabaseClient<Database> {
  config.rpcCalls = config.rpcCalls ?? [];

  const rowsFor = (table: Table): unknown[] =>
    table === "tables" ? config.tableRows ?? [] : config.qrRows ?? [];

  const readAll = (table: Table) =>
    config.deny === table
      ? Promise.resolve({ data: null, error: RLS_ERROR })
      : Promise.resolve({ data: rowsFor(table), error: null });

  const readOne = (table: Table) => {
    if (config.deny === table) {
      return Promise.resolve({ data: null, error: RLS_ERROR });
    }
    const rows = rowsFor(table);
    return Promise.resolve({ data: rows[0] ?? null, error: null });
  };

  // A mutation records its payload, then answers like a fresh read of the
  // written row. Reads (no pending payload) never record a write.
  const chain = (table: Table, pending?: unknown[]) => {
    const self: Record<string, unknown> = {
      eq: () => self,
      select: () => self,
      single: () => {
        if (pending !== undefined) config.writes.push({ table, rows: pending });
        return readOne(table);
      },
      order: () => {
        if (pending !== undefined) config.writes.push({ table, rows: pending });
        return readAll(table);
      },
    };
    return self;
  };

  // `regenerate_table_qr` is one transaction: it retires the previous QR and
  // inserts the fresh token, or — when denied — changes nothing. Modelling the
  // all-or-nothing commit here is what makes the duplicate-QR regression test
  // meaningful.
  const rpc = (fn: string, args: Record<string, unknown>) => {
    config.rpcCalls?.push({ fn, args });
    if (config.deny === fn) {
      return Promise.resolve({ data: null, error: RPC_DENY_ERROR });
    }
    if (fn === "regenerate_table_qr") {
      const fresh: TableQrRow = {
        id: "qr-2",
        table_id: args.p_table_id as string,
        token: "token-fresh",
        is_active: true,
        created_at: "2026-01-02T00:00:00Z",
        expires_at: null,
      };
      config.qrRows = [
        fresh,
        ...(config.qrRows ?? []).map((row) => ({ ...row, is_active: false })),
      ];
      return Promise.resolve({ data: fresh, error: null });
    }
    if (fn === "list_table_qrs") {
      return Promise.resolve({ data: config.qrRows ?? [], error: null });
    }
    // deactivate_table_qr
    const hadActive = (config.qrRows ?? []).some((row) => row.is_active === true);
    config.qrRows = (config.qrRows ?? []).map((row) => ({
      ...row,
      is_active: false,
    }));
    return Promise.resolve({ data: hadActive, error: null });
  };

  const client = {
    rpc,
    from: (table: Table) => ({
      select: () => chain(table),
      insert: (rows: unknown[]) => chain(table, rows),
      update: (row: unknown) => chain(table, [row]),
    }),
  };

  return client as unknown as SupabaseClient<Database>;
}

const TABLE_ROW: TableRow = {
  id: "tbl-1",
  table_code: "A12",
  name: "Meja A12",
  capacity: 4,
  status: "AVAILABLE",
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const TABLE: RestaurantTable = {
  id: "tbl-1",
  tableCode: "A12",
  name: "Meja A12",
  capacity: 4,
  status: "AVAILABLE",
  isActive: true,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const QR_ROW: TableQrRow = {
  id: "qr-1",
  table_id: "tbl-1",
  token: "token-printed",
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
  expires_at: null,
};

const INPUT: TableInput = {
  tableCode: "A12",
  name: "Meja A12",
  capacity: 4,
  status: "AVAILABLE",
  isActive: true,
};

describe("tables admin queries", () => {
  describe("fetchTables", () => {
    it("reads the stored rows in code order", async () => {
      const client = fakeClient({
        writes: [],
        tableRows: [
          { ...TABLE_ROW, id: "tbl-2", table_code: "A9" },
          TABLE_ROW,
        ],
      });
      const result = await fetchTables(client);
      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0]?.tableCode).toBe("A9");
    });

    it("reads archived tables so they can be restored", async () => {
      const client = fakeClient({
        writes: [],
        tableRows: [{ ...TABLE_ROW, is_active: false }],
      });
      const result = await fetchTables(client);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0]?.isActive).toBe(false);
    });

    it("reads an empty floor as an empty array", async () => {
      const client = fakeClient({ writes: [] });
      const result = await fetchTables(client);
      expect(result.data).toEqual([]);
      expect(result.error).toBeNull();
    });

    it("fails closed under an RLS denial", async () => {
      const client = fakeClient({ writes: [], deny: "tables" });
      const result = await fetchTables(client);
      expect(result.data).toBeNull();
      expect(result.error?.message).toMatch(/permission denied/);
    });
  });

  describe("fetchTableQrs", () => {
    it("reads the printed QR rows", async () => {
      const client = fakeClient({ writes: [], qrRows: [QR_ROW] });
      const result = await fetchTableQrs(client);
      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0]?.token).toBe("token-printed");
    });

    it("fails closed when the session cannot manage QRs", async () => {
      // The server function raises 42501 (insufficient_privilege) when the
      // caller lacks tables.qr_manage — modelled here as an RPC denial.
      const client = fakeClient({ writes: [], deny: "list_table_qrs" });
      const result = await fetchTableQrs(client);
      expect(result.data).toBeNull();
      expect(result.error).not.toBeNull();
    });
  });

  describe("createTable", () => {
    it("writes a valid table and returns the record", async () => {
      const config: FakeConfig = { writes: [], tableRows: [TABLE_ROW] };
      const result = await createTable(fakeClient(config), INPUT);
      expect(result.error).toBeNull();
      expect(result.data?.tableCode).toBe("A12");
      expect(config.writes).toHaveLength(1);
      expect(config.writes[0]?.table).toBe("tables");
    });

    it("rejects a blank code before any write", async () => {
      const config: FakeConfig = { writes: [] };
      const result = await createTable(
        fakeClient(config),
        { ...INPUT, tableCode: "  " },
      );
      expect(result.data).toBeNull();
      expect(result.error?.fieldErrors?.tableCode).toBeDefined();
      expect(config.writes).toHaveLength(0);
    });

    it("rejects a negative capacity before any write", async () => {
      const config: FakeConfig = { writes: [] };
      const result = await createTable(
        fakeClient(config),
        { ...INPUT, capacity: -1 },
      );
      expect(result.error?.fieldErrors?.capacity).toBeDefined();
      expect(config.writes).toHaveLength(0);
    });

    it("fails closed under an RLS denial", async () => {
      const client = fakeClient({ writes: [], deny: "tables" });
      const result = await createTable(client, INPUT);
      expect(result.data).toBeNull();
      expect(result.error?.message).toMatch(/permission denied/);
    });
  });

  describe("updateTable", () => {
    it("applies a configuration change and audits it", async () => {
      const config: FakeConfig = {
        writes: [],
        tableRows: [{ ...TABLE_ROW, capacity: 6, updated_at: "2026-01-02" }],
      };
      const result = await updateTable(
        fakeClient(config),
        "tbl-1",
        { ...INPUT, capacity: 6 },
        TABLE,
      );
      expect(result.error).toBeNull();
      expect(result.data?.table.capacity).toBe(6);
      expect(result.data?.audit?.changedFields).toEqual(["capacity"]);
    });

    it("reports an archive as an archive, not an update", async () => {
      const config: FakeConfig = {
        writes: [],
        tableRows: [{ ...TABLE_ROW, is_active: false }],
      };
      const result = await updateTable(
        fakeClient(config),
        "tbl-1",
        { ...INPUT, isActive: false },
        TABLE,
      );
      expect(result.data?.audit?.action).toBe("archive");
      expect(result.data?.table.isActive).toBe(false);
    });

    it("produces no audit event when nothing changed", async () => {
      const config: FakeConfig = { writes: [], tableRows: [TABLE_ROW] };
      const result = await updateTable(fakeClient(config), "tbl-1", INPUT, TABLE);
      expect(result.data?.audit).toBeNull();
    });

    it("rejects an invalid status before any write", async () => {
      const config: FakeConfig = { writes: [] };
      const result = await updateTable(
        fakeClient(config),
        "tbl-1",
        { ...INPUT, status: "BUSY" as never },
        TABLE,
      );
      expect(result.error?.fieldErrors?.status).toBeDefined();
      expect(config.writes).toHaveLength(0);
    });

    it("requires the table id", async () => {
      const client = fakeClient({ writes: [] });
      const result = await updateTable(client, "", INPUT, TABLE);
      expect(result.data).toBeNull();
      expect(result.error?.message).toBeDefined();
    });

    it("fails closed under an RLS denial", async () => {
      const client = fakeClient({ writes: [], deny: "tables" });
      const result = await updateTable(client, "tbl-1", INPUT, TABLE);
      expect(result.data).toBeNull();
      expect(result.error?.message).toMatch(/permission denied/);
    });
  });

  describe("mintTableQr", () => {
    it("mints a fresh QR through one RPC and audits the mint", async () => {
      const config: FakeConfig = { writes: [], qrRows: [QR_ROW] };
      const result = await mintTableQr(fakeClient(config), "tbl-1", TABLE);
      expect(result.error).toBeNull();
      expect(result.data?.qr.token).toBe("token-fresh");
      expect(result.data?.audit.action).toBe("qr_mint");
      expect(config.rpcCalls).toEqual([
        { fn: "regenerate_table_qr", args: { p_table_id: "tbl-1" } },
      ]);
    });

    it("retires the previous QR so a table never has two live QRs", async () => {
      const config: FakeConfig = { writes: [], qrRows: [QR_ROW] };
      await mintTableQr(fakeClient(config), "tbl-1", TABLE);
      const live = (config.qrRows ?? []).filter((row) => row.is_active === true);
      expect(live).toHaveLength(1);
      expect(live[0]?.token).toBe("token-fresh");
    });

    it("never writes through the client table on the QR path", async () => {
      const config: FakeConfig = { writes: [], qrRows: [] };
      await mintTableQr(fakeClient(config), "tbl-1", TABLE);
      expect(config.writes).toHaveLength(0);
    });

    it("leaves the printed QR untouched when the mint is denied", async () => {
      const config: FakeConfig = {
        writes: [],
        qrRows: [QR_ROW],
        deny: "regenerate_table_qr",
      };
      const result = await mintTableQr(fakeClient(config), "tbl-1", TABLE);
      expect(result.data).toBeNull();
      expect(result.error?.message).toMatch(/permission denied/);
      expect(config.qrRows?.[0]?.is_active).toBe(true);
      expect(config.qrRows).toHaveLength(1);
    });

    it("requires the table id", async () => {
      const client = fakeClient({ writes: [] });
      const result = await mintTableQr(client, "", TABLE);
      expect(result.data).toBeNull();
      expect(result.error?.message).toBeDefined();
    });
  });

  describe("retireTableQr", () => {
    it("retires the printed QR through one RPC and audits it", async () => {
      const config: FakeConfig = { writes: [], qrRows: [QR_ROW] };
      const printed: TableQr = {
        id: "qr-1",
        tableId: "tbl-1",
        token: "token-printed",
        isActive: true,
        createdAt: "2026-01-01T00:00:00Z",
        expiresAt: null,
      };
      const result = await retireTableQr(fakeClient(config), "tbl-1", TABLE, printed);
      expect(result.error).toBeNull();
      expect(result.data?.retired).toBe(true);
      expect(result.data?.audit?.action).toBe("qr_retire");
      expect(config.qrRows?.[0]?.is_active).toBe(false);
    });

    it("is idempotent: no audit event when there was nothing to retire", async () => {
      const config: FakeConfig = {
        writes: [],
        qrRows: [{ ...QR_ROW, is_active: false }],
      };
      const result = await retireTableQr(fakeClient(config), "tbl-1", TABLE, null);
      expect(result.data?.retired).toBe(false);
      expect(result.data?.audit).toBeNull();
    });

    it("keeps the table active: only QR entry closes", async () => {
      const config: FakeConfig = { writes: [], qrRows: [QR_ROW] };
      await retireTableQr(fakeClient(config), "tbl-1", TABLE, null);
      expect(config.writes).toHaveLength(0);
    });

    it("fails closed when the retire is denied", async () => {
      const config: FakeConfig = {
        writes: [],
        qrRows: [QR_ROW],
        deny: "deactivate_table_qr",
      };
      const result = await retireTableQr(fakeClient(config), "tbl-1", TABLE, null);
      expect(result.data).toBeNull();
      expect(result.error?.message).toMatch(/permission denied/);
    });
  });
});
