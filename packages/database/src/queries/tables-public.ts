/**
 * Tables public queries (Phase 6).
 *
 * The customer-facing QR entry point. Rides the RLS-enforced browser client and
 * hits the `resolve_table_qr()` SECURITY DEFINER projection from migration 006
 * part 3, so an anonymous caller never receives a grant on `tables` or
 * `table_qr` (AUTH_RBAC_RLS.md §17, §18, §46).
 *
 * The printed QR carries the table code and the QR token (AUTH_RBAC_RLS.md §18:
 * the code is public and not a secret; the token is the revocable credential).
 * Neither authorizes anything on its own — the resolver requires both, and the
 * database additionally requires the QR to be active and unexpired and the
 * table to be active. The result is the minimal ordering context
 * (API_CONTRACT.md §8.2); the token is never echoed back.
 *
 * Fails closed: any error or unresolvable QR is a failure, never a table
 * context with empty fields.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../generated/index.js";
import { toPublicTableResolve, type PublicTableResolve, type ResolveTableQrRow } from "../models/index.js";

export interface TablesPublicError {
  message: string;
  /** `resolve_table_qr()` code, when the failure came from the database. */
  code?: string;
}

export interface TablesPublicResult<T> {
  data: T | null;
  error: TablesPublicError | null;
}

/** Generated `Database` is a placeholder until the Supabase CLI lands, so
 * `rpc(...)` is untyped for parameterized calls (queries/catalog-public.ts). */
interface RpcFailure {
  message: string;
  code?: string;
}

interface RpcChain {
  maybeSingle: <T>() => Promise<{ data: T | null; error: RpcFailure | null }>;
}

function rpcClient(client: SupabaseClient<Database>): {
  rpc: (name: string, args?: Record<string, unknown>) => RpcChain;
} {
  return client as unknown as {
    rpc: (name: string, args?: Record<string, unknown>) => RpcChain;
  };
}

/** Local reason codes for the states the resolver reports as an empty result. */
export type QrResolveFailureCode =
  | "QR_MISSING_CODE"
  | "QR_MISSING_TOKEN"
  | "QR_NOT_FOUND";

function qrError(code: QrResolveFailureCode): TablesPublicError {
  const messages: Record<QrResolveFailureCode, string> = {
    QR_MISSING_CODE: "QR tidak terbaca: kode meja kosong.",
    QR_MISSING_TOKEN: "QR tidak terbaca: token QR kosong.",
    QR_NOT_FOUND:
      "QR tidak valid. Meja tidak ditemukan, QR sudah dinonaktifkan, atau meja sedang tidak aktif.",
  };
  return { message: messages[code], code };
}

/**
 * Resolve a scanned QR. Both halves of the payload are required before the
 * round trip — the table code alone never authorizes a lookup
 * (AUTH_RBAC_RLS.md §18), and the token alone carries no table.
 *
 * `null` data with a `QR_NOT_FOUND` error is the expected failure shape for
 * every rejected sticker: unknown code, unknown token, a token belonging to
 * another table, a retired QR, an expired QR, or an archived table.
 */
export async function resolveTableQr(
  client: SupabaseClient<Database>,
  tableCode: string,
  token: string,
): Promise<TablesPublicResult<PublicTableResolve>> {
  if (!tableCode.trim()) {
    return { data: null, error: qrError("QR_MISSING_CODE") };
  }
  if (!token.trim()) {
    return { data: null, error: qrError("QR_MISSING_TOKEN") };
  }

  const { data, error } = await rpcClient(client)
    .rpc("resolve_table_qr", {
      p_table_code: tableCode.trim(),
      p_token: token.trim(),
    })
    .maybeSingle<ResolveTableQrRow>();

  if (error) {
    return { data: null, error: { message: error.message, code: error.code } };
  }

  const resolved = toPublicTableResolve(data);
  if (resolved === null) {
    return { data: null, error: qrError("QR_NOT_FOUND") };
  }
  return { data: resolved, error: null };
}

/** Parse the two query parameters a printed QR carries (`?table=A12&t=...`). */
export interface QrPayload {
  tableCode: string | null;
  token: string | null;
}

export function parseQrPayload(params: Readonly<Record<string, string>>): QrPayload {
  const raw = (key: string): string => {
    const value = params[key];
    return typeof value === "string" ? value.trim() : "";
  };
  return { tableCode: raw("table") || null, token: raw("t") || null };
}
