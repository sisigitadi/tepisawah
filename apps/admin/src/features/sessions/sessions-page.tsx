/**
 * Table sessions page (Phase 7 — CLINE_IMPLEMENTATION_PLAN.md §13).
 *
 * The operational view of the floor: which tables have a dining visit open, how
 * many orders that visit has accrued, and the open/close commands.
 *
 * The phase rules are visible here by construction (DATABASE_SCHEMA.md §19):
 *   * a session is opened per table, not per order — several orders attach to
 *     the one open session, and the count next to it is the evidence;
 *   * closing is a deliberate staff action on a session, never an automatic
 *     consequence of an order finishing — there is no per-order close control
 *     anywhere on this page;
 *   * the status shown is read from the database, never derived client-side.
 *
 * The permission checks are UX-only: every read and write is re-checked by RLS
 * server-side (AUTH_RBAC_RLS.md §47).
 */
import { AccessDenied, useAuth } from "@tepisawah/auth";
import { Button, Card, StatusBadge } from "@tepisawah/ui";
import { PERMISSIONS } from "@tepisawah/permissions";
import { useCallback, useState } from "react";
import type { ReactNode } from "react";

import { closeSession, loadSessions, openSession } from "./service.js";
import type { SessionsSnapshot, TableSessionRow } from "./service.js";
import {
  SESSION_STATUS_LABELS,
  isOpen,
  orderCountLabel,
  useSessionsState,
  type LoaderResult,
} from "./use-sessions.js";

function toLoaderResult(snapshot: SessionsSnapshot): LoaderResult {
  return {
    status: snapshot.error === null ? "ready" : "error",
    error: snapshot.error,
    rows: snapshot.rows,
  };
}

export function SessionsPage(): ReactNode {
  const { can } = useAuth();
  const canRead = can(PERMISSIONS.TABLE_SESSIONS_READ);
  const canManage = can(PERMISSIONS.TABLE_SESSIONS_MANAGE);

  const loader = useCallback(async (): Promise<LoaderResult> => {
    const snapshot = await loadSessions();
    return toLoaderResult(snapshot);
  }, []);

  const { state, reload, setStatus } = useSessionsState(loader);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!canRead) {
    return <AccessDenied />;
  }

  if (state.status === "loading" && state.rows.length === 0) {
    return (
      <div className="sessions-page" aria-busy="true">
        <h1 className="sessions-page__title">Sesi Meja</h1>
        <p role="status">Memuat sesi meja…</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="sessions-page">
        <h1 className="sessions-page__title">Sesi Meja</h1>
        <Card>
          <p role="alert">{state.error}</p>
          <Button variant="ghost" onClick={reload}>
            Coba lagi
          </Button>
        </Card>
      </div>
    );
  }

  const open = async (row: TableSessionRow): Promise<void> => {
    setBusyId(row.table.id);
    const result = await openSession(row.table.id, row.table.tableCode);
    setBusyId(null);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setMessage(`Sesi ${row.table.tableCode} dibuka.`);
    reload();
  };

  const close = async (row: TableSessionRow): Promise<void> => {
    if (row.session === null) return;
    setBusyId(row.table.id);
    const result = await closeSession(row.session.id, row.table.tableCode);
    setBusyId(null);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setMessage(`Sesi ${row.table.tableCode} ditutup.`);
    setStatus({ rows: state.rows });
    reload();
  };

  return (
    <div className="sessions-page">
      <h1 className="sessions-page__title">Sesi Meja</h1>
      <p className="sessions-page__hint">
        Satu meja memiliki satu sesi aktif; beberapa order dapat masuk ke dalam
        sesi yang sama.
      </p>

      {message !== null ? (
        <p className="sessions-page__message" role="status">
          {message}
        </p>
      ) : null}

      {state.rows.length === 0 ? (
        <Card>
          <p>Belum ada meja. Tambahkan meja pada halaman Meja terlebih dahulu.</p>
        </Card>
      ) : (
        <ul className="list" aria-label="Daftar sesi meja">
          {state.rows.map((row) => {
            const openSession = isOpen(row.session);
            return (
              <li className="list__row" key={row.table.id}>
                <span className="list__cell list__cell--code">{row.table.tableCode}</span>
                <span className="list__cell">{row.table.name}</span>
                <span className="list__cell">
                  {openSession ? (
                    <StatusBadge status="active" label={SESSION_STATUS_LABELS.OPEN} />
                  ) : (
                    <StatusBadge status="completed" label={SESSION_STATUS_LABELS.CLOSED} />
                  )}
                </span>
                <span className="list__cell">{orderCountLabel(row.session)}</span>
                <span className="list__cell list__cell--actions">
                  {openSession ? (
                    <Button
                      variant="ghost"
                      disabled={!canManage || busyId === row.table.id}
                      onClick={() => void close(row)}
                    >
                      Tutup sesi
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      disabled={!canManage || busyId === row.table.id}
                      onClick={() => void open(row)}
                    >
                      Buka sesi
                    </Button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
