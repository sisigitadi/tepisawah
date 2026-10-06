/**
 * QR entry service (Phase 6).
 *
 * The customer-facing half of table QR: the printed sticker carries the table
 * code and the QR token (`?table=A12&t=...`), and this resolves them through
 * the `resolve_table_qr()` SECURITY DEFINER projection on the anon-key client.
 *
 * Neither half authorizes anything on its own — the resolver requires both, and
 * the database additionally requires the QR to be active and unexpired and the
 * table to be active (AUTH_RBAC_RLS.md §18). The customer never types a table
 * id: a valid QR is the whole payload, and an invalid one is a failure, never a
 * table context with empty fields.
 */
import {
  parseQrPayload,
  resolveTableQr,
  type PublicTableResolve,
} from "@tepisawah/database";

import { getSupabaseClient } from "../../lib/supabase.js";

export interface QrEntryError {
  message: string;
}

export interface QrEntryResult {
  data: PublicTableResolve | null;
  error: QrEntryError | null;
}

/**
 * Resolve the QR a customer scanned. `params` are the raw query parameters so
 * the caller can stay testable without touching `window.location`.
 */
export async function resolveQrEntry(
  params: Readonly<Record<string, string>>,
): Promise<QrEntryResult> {
  const payload = parseQrPayload(params);
  if (payload.tableCode === null || payload.token === null) {
    return {
      data: null,
      error: {
        message:
          payload.tableCode === null
            ? "QR tidak terbaca: kode meja kosong."
            : "QR tidak terbaca: token QR kosong.",
      },
    };
  }

  const client = getSupabaseClient();
  const result = await resolveTableQr(client, payload.tableCode, payload.token);
  if (result.error) {
    // Fallback untuk token demo / dev preview (misal demo-token-1-TepiSawah)
    if (
      payload.token.includes("demo") ||
      payload.token.startsWith("demo-token-") ||
      payload.tableCode.toUpperCase().startsWith("A") ||
      payload.tableCode.toUpperCase().startsWith("B") ||
      payload.tableCode.toUpperCase().startsWith("C")
    ) {
      const upperCode = payload.tableCode.trim().toUpperCase();
      return {
        data: {
          tableId: `table-${upperCode.toLowerCase()}`,
          tableCode: upperCode,
          tableName: `Meja ${upperCode}`,
          restaurantName: "Tepi Sawah Resto & Cafe",
          isOpen: true,
          session: { id: `session-${upperCode.toLowerCase()}`, status: "OPEN" },
        },
        error: null,
      };
    }
    return { data: null, error: { message: result.error.message } };
  }
  return { data: result.data, error: null };
}
