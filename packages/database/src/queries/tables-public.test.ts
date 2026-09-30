/**
 * Tables public query tests (Phase 6).
 *
 * Exercises the customer-facing QR entry point against a fake RPC client that
 * models the `resolve_table_qr()` SECURITY DEFINER boundary: an anonymous
 * caller only ever sees the projection row, and every rejection arrives as an
 * empty result that the query layer turns into an explicit failure
 * (API_CONTRACT.md §8.2, AUTH_RBAC_RLS.md §18).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../generated/index.js";
import {
  parseQrPayload,
  resolveTableQr,
} from "./tables-public.js";
import type { ResolveTableQrRow } from "../models/index.js";

interface RpcConfig {
  resolveRow?: ResolveTableQrRow | null;
  /** Simulates an RPC failure. */
  deny?: boolean;
  /** Records the args the client was asked to send. */
  calls?: { tableCode: string; token: string }[];
}

function fakeClient(config: RpcConfig): SupabaseClient<Database> {
  const error = {
    message: 'permission denied for function "resolve_table_qr"',
    code: "42501",
  };

  const run = () => {
    if (config.deny) return Promise.resolve({ data: null, error });
    return Promise.resolve({ data: config.resolveRow ?? null, error: null });
  };

  const chain = {
    maybeSingle: () => run(),
  };

  const client = {
    rpc: (_name: string, args?: Record<string, unknown>) => {
      config.calls?.push({
        tableCode: String(args?.p_table_code ?? ""),
        token: String(args?.p_token ?? ""),
      });
      return chain;
    },
  };

  return client as unknown as SupabaseClient<Database>;
}

const RESOLVE_ROW: ResolveTableQrRow = {
  table_id: "tbl-1",
  table_code: "A12",
  table_name: "Meja A12",
  restaurant_name: "Tepi Sawah",
  is_open: true,
  session_id: "ses-1",
  session_status: "OPEN",
};

describe("tables public queries", () => {
  describe("resolveTableQr", () => {
    it("resolves a valid QR to the minimal ordering context", async () => {
      const config: RpcConfig = { resolveRow: RESOLVE_ROW, calls: [] };
      const result = await resolveTableQr(fakeClient(config), "A12", "token-printed");
      expect(result.error).toBeNull();
      expect(result.data?.tableId).toBe("tbl-1");
      expect(result.data?.tableCode).toBe("A12");
      expect(result.data?.tableName).toBe("Meja A12");
      expect(result.data?.restaurantName).toBe("Tepi Sawah");
      expect(result.data?.isOpen).toBe(true);
      expect(result.data?.session?.id).toBe("ses-1");
      expect(result.data?.session?.status).toBe("OPEN");
      expect(config.calls).toEqual([
        { tableCode: "A12", token: "token-printed" },
      ]);
    });

    it("carries a null session when the table has no open visit", async () => {
      const client = fakeClient({
        resolveRow: { ...RESOLVE_ROW, session_id: null, session_status: null },
      });
      const result = await resolveTableQr(client, "A12", "token-printed");
      expect(result.error).toBeNull();
      expect(result.data?.session).toBeNull();
    });

    it("never echoes the token back in the projection", async () => {
      const client = fakeClient({ resolveRow: RESOLVE_ROW });
      const result = await resolveTableQr(client, "A12", "token-printed");
      expect(JSON.stringify(result.data)).not.toContain("token-printed");
    });

    it("trims the payload before the round trip", async () => {
      const config: RpcConfig = { resolveRow: RESOLVE_ROW, calls: [] };
      await resolveTableQr(fakeClient(config), "  A12 ", " token-printed ");
      expect(config.calls?.[0]).toEqual({
        tableCode: "A12",
        token: "token-printed",
      });
    });

    it("fails closed for an unknown code (invalid QR)", async () => {
      const client = fakeClient({ resolveRow: null });
      const result = await resolveTableQr(client, "ZZ9", "token-printed");
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe("QR_NOT_FOUND");
    });

    it("fails closed for an unknown token (invalid QR)", async () => {
      const client = fakeClient({ resolveRow: null });
      const result = await resolveTableQr(client, "A12", "token-wrong");
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe("QR_NOT_FOUND");
    });

    it("fails closed when the token belongs to another table", async () => {
      const client = fakeClient({ resolveRow: null });
      const result = await resolveTableQr(client, "A12", "token-for-b13");
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe("QR_NOT_FOUND");
    });

    it("fails closed for a retired QR", async () => {
      const client = fakeClient({ resolveRow: null });
      const result = await resolveTableQr(client, "A12", "token-retired");
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe("QR_NOT_FOUND");
    });

    it("fails closed for an expired QR", async () => {
      const client = fakeClient({ resolveRow: null });
      const result = await resolveTableQr(client, "A12", "token-expired");
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe("QR_NOT_FOUND");
    });

    it("fails closed for an inactive (archived) table", async () => {
      const client = fakeClient({ resolveRow: null });
      const result = await resolveTableQr(client, "A12", "token-printed");
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe("QR_NOT_FOUND");
    });

    it("reflects a changed table configuration in the projection", async () => {
      const client = fakeClient({
        resolveRow: { ...RESOLVE_ROW, table_code: "B13", table_name: "Meja B13" },
      });
      const result = await resolveTableQr(client, "B13", "token-printed");
      expect(result.data?.tableCode).toBe("B13");
      expect(result.data?.tableName).toBe("Meja B13");
    });

    it("stops resolving at the old code after the table was re-coded", async () => {
      const client = fakeClient({ resolveRow: null });
      const result = await resolveTableQr(client, "A12", "token-printed");
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe("QR_NOT_FOUND");
    });

    it("rejects an empty code before any round trip", async () => {
      const config: RpcConfig = { calls: [] };
      const result = await resolveTableQr(fakeClient(config), "", "token-printed");
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe("QR_MISSING_CODE");
      expect(config.calls).toHaveLength(0);
    });

    it("rejects an empty token before any round trip", async () => {
      const config: RpcConfig = { calls: [] };
      const result = await resolveTableQr(fakeClient(config), "A12", "");
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe("QR_MISSING_TOKEN");
      expect(config.calls).toHaveLength(0);
    });

    it("fails closed when the RPC is denied", async () => {
      const client = fakeClient({ deny: true });
      const result = await resolveTableQr(client, "A12", "token-printed");
      expect(result.data).toBeNull();
      expect(result.error?.message).toMatch(/permission denied/);
    });

    it("drops a projection row that is missing required fields", async () => {
      const client = fakeClient({
        resolveRow: { ...RESOLVE_ROW, table_name: null },
      });
      const result = await resolveTableQr(client, "A12", "token-printed");
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe("QR_NOT_FOUND");
    });
  });

  describe("parseQrPayload", () => {
    it("reads the two query parameters a printed QR carries", () => {
      expect(parseQrPayload({ table: "A12", t: "token-printed" })).toEqual({
        tableCode: "A12",
        token: "token-printed",
      });
    });

    it("trims whitespace from both halves", () => {
      expect(parseQrPayload({ table: " A12 ", t: " abc " })).toEqual({
        tableCode: "A12",
        token: "abc",
      });
    });

    it("reports a missing half as null", () => {
      expect(parseQrPayload({ table: "A12" })).toEqual({
        tableCode: "A12",
        token: null,
      });
      expect(parseQrPayload({ t: "token-printed" })).toEqual({
        tableCode: null,
        token: "token-printed",
      });
    });

    it("reports an empty payload as two nulls", () => {
      expect(parseQrPayload({})).toEqual({ tableCode: null, token: null });
    });
  });
});
