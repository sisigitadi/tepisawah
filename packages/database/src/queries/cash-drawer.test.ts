import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../generated/index.js";
import {
  closeCashShift,
  fetchShiftHistory,
  getCurrentCashShift,
  openCashShift,
  recordCashTransaction,
} from "./cash-drawer.js";

function makeFakeClient(config: {
  rpcResult?: Record<string, unknown>;
  rpcError?: { message: string };
  tableData?: unknown[];
}) {
  return {
    rpc: (_fn: string, _args?: Record<string, unknown>) => ({
      single: async () => ({
        data: config.rpcError ? null : (config.rpcResult ?? null),
        error: config.rpcError ?? null,
      }),
    }),
    from: (_table: string) => ({
      select: () => ({
        order: () => {
          const res = {
            data: config.tableData ?? [],
            error: null,
          };
          return {
            then: (onfulfilled?: (val: typeof res) => unknown) =>
              Promise.resolve(res).then(onfulfilled),
            limit: async () => res,
          };
        },
      }),
    }),
  } as unknown as SupabaseClient<Database>;
}

describe("cash-drawer queries", () => {
  it("fetches the current active cash shift", async () => {
    const client = makeFakeClient({
      rpcResult: {
        active: true,
        shift: {
          id: "shift-1",
          staff_id: "user-1",
          staff_name: "Kasir Budi",
          shift_name: "Shift Pagi",
          opened_at: "2026-10-17T08:00:00Z",
          closed_at: null,
          starting_cash: 200000,
          cash_sales: 150000,
          cash_in: 0,
          cash_out: 25000,
          expected_cash: 325000,
          actual_cash: null,
          cash_difference: null,
          status: "OPEN",
        },
        transactions: [
          {
            id: "tx-1",
            shift_id: "shift-1",
            type: "CASH_OUT",
            amount: 25000,
            reason: "Beli Es Batu",
            created_by: "user-1",
            created_at: "2026-10-17T09:30:00Z",
          },
        ],
      },
    });

    const result = await getCurrentCashShift(client);
    expect(result.error).toBeNull();
    expect(result.data).not.toBeNull();
    expect(result.data!.active).toBe(true);
    expect(result.data!.shift?.startingCash).toBe(200000);
    expect(result.data!.transactions.length).toBe(1);
    expect(result.data!.transactions[0]!.reason).toBe("Beli Es Batu");
  });

  it("opens a new cash shift", async () => {
    const client = makeFakeClient({
      rpcResult: {
        success: true,
        message: "Shift dibuka",
        shift: {
          id: "shift-2",
          staff_id: "user-1",
          staff_name: "Kasir Budi",
          shift_name: "Shift Siang",
          starting_cash: 300000,
          status: "OPEN",
        },
      },
    });

    const result = await openCashShift(client, { startingCash: 300000, shiftName: "Shift Siang" });
    expect(result.error).toBeNull();
    expect(result.data?.id).toBe("shift-2");
    expect(result.data?.startingCash).toBe(300000);
  });

  it("records cash in or cash out transaction", async () => {
    const client = makeFakeClient({
      rpcResult: {
        success: true,
        transaction: {
          id: "tx-2",
          shift_id: "shift-2",
          type: "CASH_OUT",
          amount: 50000,
          reason: "Beli Galon Aqua",
        },
      },
    });

    const result = await recordCashTransaction(client, {
      shiftId: "shift-2",
      type: "CASH_OUT",
      amount: 50000,
      reason: "Beli Galon Aqua",
    });

    expect(result.error).toBeNull();
    expect(result.data?.amount).toBe(50000);
    expect(result.data?.type).toBe("CASH_OUT");
  });

  it("closes an active shift and records actual cash and difference", async () => {
    const client = makeFakeClient({
      rpcResult: {
        success: true,
        shift: {
          id: "shift-2",
          starting_cash: 300000,
          expected_cash: 450000,
          actual_cash: 450000,
          cash_difference: 0,
          status: "CLOSED",
        },
      },
    });

    const result = await closeCashShift(client, {
      shiftId: "shift-2",
      actualCash: 450000,
      notes: "Kas pas",
    });

    expect(result.error).toBeNull();
    expect(result.data?.status).toBe("CLOSED");
    expect(result.data?.cashDifference).toBe(0);
  });

  it("fetches past shift history", async () => {
    const client = makeFakeClient({
      tableData: [
        {
          id: "shift-old",
          staff_id: "user-1",
          shift_name: "Shift Pagi",
          starting_cash: 200000,
          actual_cash: 200000,
          cash_difference: 0,
          status: "CLOSED",
        },
      ],
    });

    const result = await fetchShiftHistory(client);
    expect(result.error).toBeNull();
    expect(result.data?.length).toBe(1);
    expect(result.data![0]!.id).toBe("shift-old");
  });
});
