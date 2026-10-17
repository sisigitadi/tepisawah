/**
 * Cash drawer & cashier shift queries.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../generated/index.js";
import {
  toCashShift,
  toCashTransaction,
  isValidCloseCashShiftInput,
  isValidOpenCashShiftInput,
  isValidRecordCashTransactionInput,
  type CashShift,
  type CashTransaction,
  type CloseCashShiftInput,
  type CurrentShiftPayload,
  type OpenCashShiftInput,
  type RecordCashTransactionInput,
} from "../models/index.js";

interface SupabaseFailure {
  message: string;
}

interface CashDrawerResult<T> {
  data: T | null;
  error: { message: string } | null;
}

interface RpcChain {
  single: <T>() => Promise<{ data: T | null; error: SupabaseFailure | null }>;
}

interface OrderChain extends PromiseLike<{ data: unknown[] | null; error: SupabaseFailure | null }> {
  limit: (n: number) => Promise<{ data: unknown[] | null; error: SupabaseFailure | null }>;
}

interface UntypedClient {
  rpc: (fn: string, args?: Record<string, unknown>) => RpcChain;
  from: (table: string) => {
    select: (cols: string) => {
      order: (col: string, opts: { ascending: boolean }) => OrderChain;
    };
  };
}

function untypedClient(client: SupabaseClient<Database>): UntypedClient {
  return client as unknown as UntypedClient;
}

export async function getCurrentCashShift(
  client: SupabaseClient<Database>,
): Promise<CashDrawerResult<CurrentShiftPayload>> {
  const { data, error } = await untypedClient(client)
    .rpc("get_current_cash_shift")
    .single<{
      active: boolean;
      shift: Record<string, unknown> | null;
      transactions: Array<Record<string, unknown>>;
    }>();

  if (error) {
    return { data: null, error: { message: error.message } };
  }

  const shift = data?.shift ? toCashShift(data.shift) : null;
  const transactions = (data?.transactions ?? []).map(toCashTransaction);

  return {
    data: {
      active: Boolean(data?.active && shift !== null),
      shift,
      transactions,
    },
    error: null,
  };
}

export async function openCashShift(
  client: SupabaseClient<Database>,
  input: OpenCashShiftInput,
): Promise<CashDrawerResult<CashShift>> {
  if (!isValidOpenCashShiftInput(input)) {
    return { data: null, error: { message: "Nominal modal awal kasir tidak valid." } };
  }

  const { data, error } = await untypedClient(client)
    .rpc("open_cash_shift", {
      p_starting_cash: input.startingCash,
      p_shift_name: input.shiftName ?? "Shift Pagi",
    })
    .single<{ success: boolean; message: string; shift: Record<string, unknown> }>();

  if (error) {
    return { data: null, error: { message: error.message } };
  }

  if (!data?.shift) {
    return { data: null, error: { message: "Gagal membuka shift kasir." } };
  }

  return { data: toCashShift(data.shift), error: null };
}

export async function recordCashTransaction(
  client: SupabaseClient<Database>,
  input: RecordCashTransactionInput,
): Promise<CashDrawerResult<CashTransaction>> {
  if (!isValidRecordCashTransactionInput(input)) {
    return { data: null, error: { message: "Data transaksi kas masuk/keluar tidak lengkap." } };
  }

  const { data, error } = await untypedClient(client)
    .rpc("record_cash_transaction", {
      p_shift_id: input.shiftId,
      p_type: input.type,
      p_amount: input.amount,
      p_reason: input.reason,
    })
    .single<{ success: boolean; transaction: Record<string, unknown> }>();

  if (error) {
    return { data: null, error: { message: error.message } };
  }

  if (!data?.transaction) {
    return { data: null, error: { message: "Gagal mencatat transaksi kas." } };
  }

  return { data: toCashTransaction(data.transaction), error: null };
}

export async function closeCashShift(
  client: SupabaseClient<Database>,
  input: CloseCashShiftInput,
): Promise<CashDrawerResult<CashShift>> {
  if (!isValidCloseCashShiftInput(input)) {
    return { data: null, error: { message: "Nominal uang fisik kasir tidak valid." } };
  }

  const { data, error } = await untypedClient(client)
    .rpc("close_cash_shift", {
      p_shift_id: input.shiftId,
      p_actual_cash: input.actualCash,
      p_notes: input.notes ?? null,
    })
    .single<{ success: boolean; message: string; shift: Record<string, unknown> }>();

  if (error) {
    return { data: null, error: { message: error.message } };
  }

  if (!data?.shift) {
    return { data: null, error: { message: "Gagal menutup shift kasir." } };
  }

  return { data: toCashShift(data.shift), error: null };
}

export async function fetchShiftHistory(
  client: SupabaseClient<Database>,
  limit: number = 20,
): Promise<CashDrawerResult<CashShift[]>> {
  const { data, error } = await untypedClient(client)
    .from("cash_shifts")
    .select("*")
    .order("opened_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { data: null, error: { message: error.message } };
  }

  const shifts = ((data ?? []) as Array<Record<string, unknown>>).map(toCashShift);
  return { data: shifts, error: null };
}

export async function fetchShiftTransactions(
  client: SupabaseClient<Database>,
  _shiftId: string,
): Promise<CashDrawerResult<CashTransaction[]>> {
  const { data, error } = await untypedClient(client)
    .from("cash_transactions")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return { data: null, error: { message: error.message } };
  }

  const txs = ((data ?? []) as Array<Record<string, unknown>>).map(toCashTransaction);
  return { data: txs, error: null };
}
