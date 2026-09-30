/**
 * Tables admin queries (Phase 6).
 *
 * Read/write paths for `tables`, plus the QR lifecycle through the
 * `regenerate_table_qr()` / `deactivate_table_qr()` SECURITY DEFINER functions
 * from migration 006 part 3. Every write rides the RLS-enforced browser client,
 * so RLS answers the six questions from AUTH_RBAC_RLS.md §21 server-side.
 * Validation runs before any write (§47): a rejected patch returns field errors
 * and never reaches the network. Results never throw — an error degrades to an
 * explicit failure so callers fail closed.
 *
 * `table_qr` grants nothing to any client role (part 2), so the two QR calls are
 * single RPCs — there is no client-side delete-then-insert path here, which
 * means a QR roll-over can never leave a table with two active QRs or with none
 * (AUTH_RBAC_RLS.md §8: the critical mutation is one server-side transaction).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../generated/index.js";
import {
  describeQrMint,
  describeQrRetire,
  describeTableChange,
  toTable,
  toTableRow,
  toTableQr,
  validateTable,
  type RestaurantTable,
  type TableErrors,
  type TableInput,
  type TableQr,
  type TableRow,
  type TableQrRow,
  type TablesAuditEvent,
} from "../models/index.js";

export interface TablesQueryError {
  message: string;
  fieldErrors?: Record<string, string>;
}

export interface TablesQueryResult<T> {
  data: T | null;
  error: TablesQueryError | null;
}

/** Generated table types are absent until the Supabase CLI lands (see
 * scripts/generate-types.mjs). The write chains are typed against this local
 * row-shaped builder; reads cast their rows the way queries/authorization.ts
 * does. Nothing weakens the runtime contract — the browser client still sends
 * exactly one parameterized query. */
interface SupabaseFailure {
  message: string;
  code?: string;
}

interface SelectChain {
  maybeSingle: <T>() => Promise<{ data: T | null; error: SupabaseFailure | null }>;
  single: <T>() => Promise<{ data: T | null; error: SupabaseFailure | null }>;
  order: (
    column: string,
    options?: { ascending?: boolean },
  ) => Promise<{ data: unknown[] | null; error: SupabaseFailure | null }>;
  eq: (column: string, value: string) => SelectChain;
}

interface MutateChain {
  eq: (column: string, value: string) => { select: (columns?: string) => SelectChain };
  select: (columns?: string) => SelectChain;
}

interface UntypedTable {
  select: (columns?: string) => SelectChain;
  insert: (rows: Record<string, unknown>[]) => MutateChain;
  update: (row: Record<string, unknown>) => MutateChain;
}

function untypedTable(client: SupabaseClient<Database>, name: string): UntypedTable {
  return (client as unknown as { from: (table: string) => UntypedTable }).from(name);
}

/** The generated RPC types land with the Supabase CLI, so `rpc()` is typed
 * against this local shape — the same approach queries/catalog.ts takes. */
interface UntypedRpc {
  data: unknown | null;
  error: SupabaseFailure | null;
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

function failure(error: SupabaseFailure | null): TablesQueryError {
  return { message: error?.message ?? "Kueri meja gagal." };
}

function invalid<E extends Record<string, string>>(errors: E): TablesQueryError {
  return { message: "Validasi gagal.", fieldErrors: errors };
}

/**
 * Every table including archived ones, code order. The admin list needs archived
 * rows so a deactivated table can be found and restored.
 */
export async function fetchTables(
  client: SupabaseClient<Database>,
): Promise<TablesQueryResult<RestaurantTable[]>> {
  const { data, error } = await untypedTable(client, "tables")
    .select("*")
    .order("table_code", { ascending: true });

  if (error) return { data: null, error: failure(error) };
  return { data: ((data ?? []) as unknown as TableRow[]).map(toTable), error: null };
}

/**
 * The QR rows an admin renders next to their tables. The select is RLS-gated on
 * `tables.qr_manage` (migration 006 part 2), so a session without it receives
 * an RLS denial rather than a partial list — callers must only ask for this
 * when the session may manage QRs.
 */
export async function fetchTableQrs(
  client: SupabaseClient<Database>,
): Promise<TablesQueryResult<TableQr[]>> {
  const { data, error } = await untypedTable(client, "table_qr")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return { data: null, error: failure(error) };
  return { data: ((data ?? []) as unknown as TableQrRow[]).map(toTableQr), error: null };
}

export async function createTable(
  client: SupabaseClient<Database>,
  input: TableInput,
): Promise<TablesQueryResult<RestaurantTable>> {
  const errors = validateTable(input);
  if (Object.keys(errors).length > 0) return { data: null, error: invalid(errors) };

  const { data, error } = await untypedTable(client, "tables")
    .insert([toTableRow(input)])
    .select("*")
    .single<TableRow>();

  if (error) return { data: null, error: failure(error) };
  if (!data) return { data: null, error: { message: "Meja tidak dibuat." } };
  return { data: toTable(data), error: null };
}

export async function updateTable(
  client: SupabaseClient<Database>,
  id: string,
  input: TableInput,
  current: RestaurantTable,
): Promise<TablesQueryResult<{ table: RestaurantTable; audit: TablesAuditEvent | null }>> {
  if (!id) return { data: null, error: { message: "Id meja wajib diisi." } };

  const errors = validateTable(input);
  if (Object.keys(errors).length > 0) return { data: null, error: invalid(errors) };

  const { data, error } = await untypedTable(client, "tables")
    .update(toTableRow(input))
    .eq("id", id)
    .select("*")
    .single<TableRow>();

  if (error) return { data: null, error: failure(error) };
  if (!data) return { data: null, error: { message: "Meja tidak ditemukan." } };

  const table = toTable(data);
  const event = describeTableChange(current, table);
  const audit = event.changedFields.length > 0 ? event : null;
  return { data: { table, audit }, error: null };
}

/**
 * Mint (or roll over) a table's printed QR — one `regenerate_table_qr()` call,
 * so the previous QR is retired and the fresh token inserted in one server-side
 * transaction. The function is the only write path to `table_qr` and re-checks
 * `tables.qr_manage` inside, so a session that lost the permission cannot mint.
 *
 * Returns the fresh token because staff must print it; it never appears in the
 * public projection (queries/tables-public.ts).
 */
export async function mintTableQr(
  client: SupabaseClient<Database>,
  tableId: string,
  table: RestaurantTable,
): Promise<TablesQueryResult<{ qr: TableQr; audit: TablesAuditEvent }>> {
  if (!tableId) return { data: null, error: { message: "Id meja wajib diisi." } };

  const { data, error } = await untypedRpc(client, "regenerate_table_qr", {
    pTableId: tableId,
  });

  if (error) return { data: null, error: failure(error) };

  const row = (data ?? null) as unknown as TableQrRow | TableQrRow[] | null;
  const created = Array.isArray(row) ? row[0] ?? null : row;
  if (created === null || created.id === null) {
    return { data: null, error: { message: "QR tidak dapat dibuat." } };
  }

  const qr = toTableQr(created);
  return {
    data: { qr, audit: describeQrMint(table, qr.token) },
    error: null,
  };
}

/**
 * Retire a table's printed QR — one `deactivate_table_qr()` call. The table
 * itself stays active; only QR entry closes. Idempotent server-side, so the
 * audit event is only produced when a QR actually retired.
 */
export async function retireTableQr(
  client: SupabaseClient<Database>,
  tableId: string,
  table: RestaurantTable,
  current: TableQr | null,
): Promise<TablesQueryResult<{ retired: boolean; audit: TablesAuditEvent | null }>> {
  if (!tableId) return { data: null, error: { message: "Id meja wajib diisi." } };

  const { data, error } = await untypedRpc(client, "deactivate_table_qr", {
    pTableId: tableId,
  });

  if (error) return { data: null, error: failure(error) };

  const retired = data === true;
  return {
    data: { retired, audit: retired ? describeQrRetire(table, current) : null },
    error: null,
  };
}

export type { TableErrors };
