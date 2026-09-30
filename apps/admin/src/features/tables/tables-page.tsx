/**
 * Tables page (Phase 6 — CLINE_IMPLEMENTATION_PLAN.md §12).
 *
 * Admin management of the floor: tables, their operational status and their
 * printed QR. Archival is soft (`is_active = false`) — the database never grants
 * DELETE on `tables`, so an archived table keeps its history and stops resolving
 * QR scans instead of vanishing (DATABASE_SCHEMA.md §17).
 *
 * The QR is a revocable credential, not a table id (AUTH_RBAC_RLS.md §18): the
 * printed code is public, the token is the secret, and rolling the QR over is
 * one server-side transaction so a table is never left with two live QRs or
 * with none. Staff with `tables.qr_manage` see the token because they must print
 * it; RLS refuses the whole `table_qr` row to anyone else.
 *
 * The permission checks here are UX-only: every read and write is re-checked by
 * RLS server-side (AUTH_RBAC_RLS.md §47).
 */
import { AccessDenied, useAuth } from "@tepisawah/auth";
import { Button, Card, StatusBadge } from "@tepisawah/ui";
import { PERMISSIONS } from "@tepisawah/permissions";
import { useCallback, useState } from "react";
import type { ReactNode } from "react";

import {
  activeQrFor,
  deactivateQr,
  loadTables,
  regenerateQr,
  saveTable,
} from "./service.js";
import type { TablesSnapshot } from "./service.js";
import {
  EMPTY_TABLE_FORM,
  TABLE_STATUS_LABELS,
  toTableForm,
  toTableInput,
  useTablesState,
  type LoaderResult,
  type TableForm,
} from "./use-tables.js";
import { TableFormFields } from "./table-form.js";

function toLoaderResult(snapshot: TablesSnapshot & { error: string | null }): LoaderResult {
  return {
    status: snapshot.error === null ? "ready" : "error",
    error: snapshot.error,
    tables: snapshot.tables,
    qrs: snapshot.qrs,
  };
}

export function TablesPage(): ReactNode {
  const { can } = useAuth();
  const canRead = can(PERMISSIONS.TABLES_READ);
  const canCreate = can(PERMISSIONS.TABLES_CREATE);
  const canUpdate = can(PERMISSIONS.TABLES_UPDATE);
  const canArchive = can(PERMISSIONS.TABLES_ARCHIVE);
  const canManageQr = can(PERMISSIONS.TABLES_QR_MANAGE);

  const loader = useCallback(async (): Promise<LoaderResult> => {
    const snapshot = await loadTables();
    return toLoaderResult(snapshot);
  }, []);

  const { state, reload, setStatus } = useTablesState(loader);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TableForm>(EMPTY_TABLE_FORM);
  const [errors, setErrors] = useState<Record<string, string> | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!canRead) {
    return <AccessDenied />;
  }

  if (state.status === "loading" && state.tables.length === 0) {
    return <p aria-live="polite">Memuat meja…</p>;
  }

  if (state.status === "error") {
    return (
      <Card elevation="low" title="Tidak dapat memuat meja">
        <p role="alert">{state.error}</p>
        <Button variant="secondary" onClick={reload}>
          Coba lagi
        </Button>
      </Card>
    );
  }

  const canEditTable = editingId === null ? canCreate : canUpdate;
  const showEditor = editingId !== null || canCreate;

  const startCreate = (): void => {
    setEditingId(null);
    setDraft(toTableForm(null));
    setErrors(null);
    setMessage(null);
  };

  const startEdit = (id: string): void => {
    const current = state.tables.find((row) => row.id === id) ?? null;
    setEditingId(id);
    setDraft(toTableForm(current));
    setErrors(null);
    setMessage(null);
  };

  const cancel = (): void => {
    setEditingId(null);
    setErrors(null);
    setMessage(null);
  };

  const submit = async (): Promise<void> => {
    const wasCreating = editingId === null;
    setStatus({ status: "loading" });
    const current =
      editingId === null
        ? null
        : state.tables.find((row) => row.id === editingId) ?? null;
    const result = await saveTable(editingId, toTableInput(draft), current);
    setStatus({ status: "ready" });
    if (result.error) {
      setErrors(result.fieldErrors);
      setMessage(result.error);
      return;
    }
    cancel();
    setMessage(
      wasCreating
        ? `Meja ${result.data?.record.tableCode} dibuat.`
        : `Meja ${result.data?.record.tableCode} diperbarui.`,
    );
    await reload();
  };

  const toggleArchive = async (id: string): Promise<void> => {
    const current = state.tables.find((row) => row.id === id) ?? null;
    if (current === null) return;
    setStatus({ status: "loading" });
    const result = await saveTable(
      id,
      {
        tableCode: current.tableCode,
        name: current.name,
        capacity: current.capacity,
        status: current.status,
        isActive: !current.isActive,
      },
      current,
    );
    setStatus({ status: "ready" });
    if (result.error) {
      setErrors(null);
      setMessage(result.error);
      return;
    }
    setMessage(
      current.isActive
        ? `Meja ${current.tableCode} dinonaktifkan.`
        : `Meja ${current.tableCode} diaktifkan kembali.`,
    );
    await reload();
  };

  const mintQr = async (id: string): Promise<void> => {
    const current = state.tables.find((row) => row.id === id) ?? null;
    if (current === null) return;
    setStatus({ status: "loading" });
    const result = await regenerateQr(id, current);
    setStatus({ status: "ready" });
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setMessage(`QR baru untuk meja ${current.tableCode} telah dibuat.`);
    await reload();
  };

  const retireQr = async (id: string): Promise<void> => {
    const current = state.tables.find((row) => row.id === id) ?? null;
    if (current === null) return;
    setStatus({ status: "loading" });
    const result = await deactivateQr(
      id,
      current,
      activeQrFor(state.qrs, id),
    );
    setStatus({ status: "ready" });
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setMessage(result.data?.retired
      ? `QR meja ${current.tableCode} dinonaktifkan.`
      : `Tidak ada QR aktif untuk meja ${current.tableCode}.`);
    await reload();
  };

  return (
    <div className="tables-page">
      <div className="toolbar">
        <h2 className="toolbar__title">Meja</h2>
        {canCreate ? (
          <Button variant="secondary" onClick={startCreate}>
            Tambah meja
          </Button>
        ) : null}
      </div>

      {!canCreate && !canUpdate ? (
        <p className="hint">Hanya baca — peran Anda tidak dapat mengubah meja.</p>
      ) : null}

      {message !== null ? (
        <p className="hint" role="status">
          {message}
        </p>
      ) : null}

      {showEditor ? (
        <TableFormFields
          form={draft}
          errors={errors}
          editable={canEditTable}
          saving={state.status === "loading"}
          onChange={(patch) => {
            setDraft((previous) => ({ ...previous, ...patch }));
            setErrors(null);
          }}
          onSubmit={submit}
        />
      ) : null}

      {editingId !== null ? (
        <div className="actions">
          <Button variant="ghost" onClick={cancel}>
            Batal
          </Button>
        </div>
      ) : null}

      {state.tables.length === 0 ? (
        <Card elevation="low" title="Belum ada meja">
          <p className="empty">
            Tambahkan meja pertama untuk mulai mencetak QR.
          </p>
        </Card>
      ) : (
        <ul className="list">
          {state.tables.map((table) => {
            const qr = activeQrFor(state.qrs, table.id);
            return (
              <li key={table.id} className="list__row">
                <div className="list__main">
                  <span className="list__code">{table.tableCode}</span>
                  <span className="list__name">{table.name}</span>
                  {table.capacity !== null ? (
                    <span className="list__capacity">
                      {table.capacity} kursi
                    </span>
                  ) : null}
                  <StatusBadge
                    status={table.status}
                    label={TABLE_STATUS_LABELS[table.status]}
                  />
                  {table.isActive ? null : (
                    <StatusBadge status="archived" label="Nonaktif" />
                  )}
                  {qr !== null ? (
                    <span className="list__qr">QR aktif</span>
                  ) : (
                    <span className="list__qr list__qr--none">Tanpa QR</span>
                  )}
                </div>
                <div className="list__actions">
                  {canUpdate ? (
                    <Button size="sm" variant="ghost" onClick={() => startEdit(table.id)}>
                      Edit
                    </Button>
                  ) : null}
                  {canManageQr ? (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => mintQr(table.id)}
                      >
                        {qr !== null ? "Perbarui QR" : "Buat QR"}
                      </Button>
                      {qr !== null ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => retireQr(table.id)}
                        >
                          Hentikan QR
                        </Button>
                      ) : null}
                    </>
                  ) : null}
                  {canArchive ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleArchive(table.id)}
                    >
                      {table.isActive ? "Nonaktifkan" : "Aktifkan"}
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
