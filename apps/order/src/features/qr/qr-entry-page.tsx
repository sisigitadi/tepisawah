/**
 * QR entry page (Phase 6 — CLINE_IMPLEMENTATION_PLAN.md §12).
 *
 * What a customer sees after scanning the table sticker: the resolved ordering
 * context, or a clear message when the QR is not usable. The page holds no
 * authorization — the resolution happened server-side through
 * `resolve_table_qr()` and the result is the minimal projection
 * (API_CONTRACT.md §8.2): no token, no capacity, no staff or audit data.
 *
 * Ordering itself (catalog, cart, checkout) lands with later phases; this page
 * resolves and presents the table the order will belong to, and `isOpen` from
 * the restaurant configuration gates entry.
 *
 * Phase 7 adds the table's active dining session (API_CONTRACT.md §8.2). The
 * customer sees whether staff have opened their visit; the session id is the
 * handle the later order-creation call carries back (§10.1). Only the id and
 * status ever cross the boundary — staff ids and order ids stay internal
 * (AUTH_RBAC_RLS.md §17-§18).
 */
import { Button, Card } from "@tepisawah/ui";
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";

import { resolveQrEntry } from "./service.js";
import type { QrEntryError } from "./service.js";
import type { PublicTableResolve } from "@tepisawah/database";

export interface QrEntryPageProps {
  /** Query parameters the printed QR carries; defaults to the current URL. */
  params?: Readonly<Record<string, string>>;
  /** Called when the customer starts an order at the resolved table. */
  onStart?: (table: PublicTableResolve) => void;
}

type Phase = "loading" | "ready" | "error";

function readUrlParams(): Record<string, string> {
  const entries = new URLSearchParams(window.location.search).entries();
  const params: Record<string, string> = {};
  for (const [key, value] of entries) {
    params[key] = value;
  }
  return params;
}

export function QrEntryPage(props: QrEntryPageProps): ReactNode {
  const { params, onStart } = props;
  const [phase, setPhase] = useState<Phase>("loading");
  const [table, setTable] = useState<PublicTableResolve | null>(null);
  const [failure, setFailure] = useState<QrEntryError | null>(null);

  const run = useCallback(async () => {
    setPhase("loading");
    setFailure(null);
    const result = await resolveQrEntry(params ?? readUrlParams());
    setTable(result.data);
    setFailure(result.error);
    setPhase(result.error === null ? "ready" : "error");
  }, [params]);

  useEffect(() => {
    void run();
  }, [run]);

  if (phase === "loading") {
    return <p aria-live="polite">Memuat meja…</p>;
  }

  if (phase === "error" || table === null) {
    return (
      <Card elevation="low" title="QR tidak dapat digunakan">
        <p role="alert">{failure?.message ?? "QR tidak valid."}</p>
        <p className="qr-entry__hint">
          Pastikan Anda memindai QR yang tertempel di meja. Jika masalah berlanjut,
          minta staf untuk memeriksa QR meja.
        </p>
        <Button variant="secondary" onClick={run}>
          Pindai ulang
        </Button>
      </Card>
    );
  }

  return (
    <div className="qr-entry">
      <Card
        elevation="low"
        title={table.tableName}
        description={table.restaurantName ?? undefined}
      >
        <p className="qr-entry__code">
          Meja <strong>{table.tableCode}</strong>
        </p>
        {table.isOpen ? (
          <p className="qr-entry__open">Meja siap menerima pesanan.</p>
        ) : (
          <p className="qr-entry__closed">
            Meja ini sedang tidak menerima pesanan.
          </p>
        )}
        {table.session !== null ? (
          <p className="qr-entry__session">
            Sesi meja sudah dibuka staf. Pesanan Anda akan masuk ke sesi ini.
          </p>
        ) : (
          <p className="qr-entry__session qr-entry__session--idle">
            Sesi meja belum dibuka. Staf akan membukanya saat Anda memesan.
          </p>
        )}
      </Card>
      <div className="qr-entry__actions">
        <Button
          variant="primary"
          fullWidth
          disabled={!table.isOpen}
          onClick={() => onStart?.(table)}
        >
          Mulai pesanan
        </Button>
      </div>
    </div>
  );
}
