/**
 * Tables service (Phase 6).
 *
 * Bridges the admin UI to the @tepisawah/database tables query layer. Every call
 * rides the RLS-enforced browser client, so a session without
 * tables.read / tables.create / tables.update / tables.archive /
 * tables.qr_manage receives empty results or an RLS error — the UI can never
 * widen what the database refuses (AUTH_RBAC_RLS.md §2.2).
 *
 * Table and QR writes change where a customer order lands, so they are auditable
 * (AUTH_RBAC_RLS.md §39-§40). The audit_logs table lands with migration 014,
 * so until then a successful change is recorded through the application logger
 * as a TABLES_UPDATED event carrying the field-level diff; Phase 14 swaps the
 * logger for the audit writer without changing this shape.
 */
import {
  createTable,
  fetchTableQrs,
  fetchTables,
  mintTableQr,
  retireTableQr,
  updateTable,
  type RestaurantTable,
  type TableInput,
  type TableQr,
  type TablesAuditEvent,
} from "@tepisawah/database";

import { logger } from "../../lib/logger.js";
import { getSupabaseClient } from "../../lib/supabase.js";
import { isDemoMode } from "../../lib/demo-mode.js";
import { demoQrs, demoTables, demoTimestamp } from "../../lib/demo-data.js";

export interface TablesSnapshot {
  tables: RestaurantTable[];
  qrs: TableQr[];
}

export interface TablesSaveResult {
  record: RestaurantTable;
  audit: TablesAuditEvent | null;
}

export interface QrMintResult {
  qr: TableQr;
  audit: TablesAuditEvent;
}

export type ServiceResult<T> = {
  data: T | null;
  error: string | null;
  fieldErrors: Record<string, string> | null;
};

/** Load the admin view: tables and their printed QRs in one round trip. */
export async function loadTables(): Promise<TablesSnapshot & { error: string | null }> {
  if (isDemoMode()) {
    return { tables: demoTables, qrs: demoQrs, error: null };
  }

  const client = getSupabaseClient();
  const [tablesResult, qrsResult] = await Promise.all([
    fetchTables(client),
    fetchTableQrs(client),
  ]);

  const failure = tablesResult.error ?? qrsResult.error;
  if (failure) {
    return { tables: [], qrs: [], error: failure.message };
  }

  return {
    tables: tablesResult.data ?? [],
    qrs: qrsResult.data ?? [],
    error: null,
  };
}

/** The live QR printed for a table, if any (the newest active row). */
export function activeQrFor(qrs: readonly TableQr[], tableId: string): TableQr | null {
  const live = qrs.filter((qr) => qr.tableId === tableId && qr.isActive);
  if (live.length === 0) return null;
  return live.reduce((newest, qr) =>
    newest.createdAt < qr.createdAt ? qr : newest,
  );
}

function logAudit(event: TablesAuditEvent | null): void {
  if (event !== null && event.changedFields.length > 0) {
    logger.info("TABLES_UPDATED", event);
  }
}

function toError(
  message?: string,
  fieldErrors?: Record<string, string>,
): ServiceResult<never> {
  return {
    data: null,
    error: message ?? "Perubahan meja gagal disimpan.",
    fieldErrors: fieldErrors ?? null,
  };
}

export async function saveTable(
  id: string | null,
  input: TableInput,
  current: RestaurantTable | null,
): Promise<ServiceResult<TablesSaveResult>> {
  if (isDemoMode()) {
    if (id === null) {
      const record: RestaurantTable = {
        id: `tbl-${Date.now()}`,
        ...input,
        createdAt: demoTimestamp(),
        updatedAt: demoTimestamp(),
      };
      demoTables.push(record);
      const audit: TablesAuditEvent = {
        entity: "table",
        action: "create",
        entityId: record.id,
        label: record.tableCode,
        changedFields: ["tableCode", "name", "capacity", "status", "isActive"],
      };
      return { data: { record, audit }, error: null, fieldErrors: null };
    }
    const existing = demoTables.find((table) => table.id === id);
    if (!existing) {
      return { data: null, error: "Meja tidak ditemukan.", fieldErrors: null };
    }
    const changedFields = Object.keys(input).filter(
      (field) => input[field as keyof TableInput] !== existing[field as keyof RestaurantTable],
    );
    Object.assign(existing, input, { updatedAt: demoTimestamp() });
    return {
      data: {
        record: existing,
        audit: {
          entity: "table",
          action: "update",
          entityId: existing.id,
          label: existing.tableCode,
          changedFields,
        },
      },
      error: null,
      fieldErrors: null,
    };
  }

  const client = getSupabaseClient();

  if (id === null) {
    const result = await createTable(client, input);
    if (result.error || !result.data) {
      return toError(result.error?.message, result.error?.fieldErrors);
    }
    const audit: TablesAuditEvent = {
      entity: "table",
      action: "create",
      entityId: result.data.id,
      label: result.data.tableCode,
      changedFields: ["tableCode", "name", "capacity", "status", "isActive"],
    };
    logger.info("TABLES_UPDATED", audit);
    return { data: { record: result.data, audit }, error: null, fieldErrors: null };
  }
  if (current === null) {
    return { data: null, error: "Meja tidak ditemukan.", fieldErrors: null };
  }

  const result = await updateTable(client, id, input, current);
  if (result.error || !result.data) {
    return toError(result.error?.message, result.error?.fieldErrors);
  }
  logAudit(result.data.audit);
  return {
    data: { record: result.data.table, audit: result.data.audit },
    error: null,
    fieldErrors: null,
  };
}

/** Mint (or roll over) the printed QR for a table — one server-side call. */
export async function regenerateQr(
  tableId: string,
  table: RestaurantTable,
): Promise<ServiceResult<QrMintResult>> {
  if (isDemoMode()) {
    for (const qr of demoQrs) {
      if (qr.tableId === tableId && qr.isActive) qr.isActive = false;
    }
    const qr: TableQr = {
      id: `qr-${Date.now()}`,
      tableId,
      token: `demo-token-${Math.random().toString(36).slice(2, 10)}`,
      isActive: true,
      createdAt: demoTimestamp(),
      expiresAt: null,
    };
    demoQrs.push(qr);
    const audit: TablesAuditEvent = {
      entity: "table_qr",
      action: "qr_mint",
      entityId: tableId,
      label: table.tableCode,
      changedFields: ["token"],
    };
    return { data: { qr, audit }, error: null, fieldErrors: null };
  }

  const client = getSupabaseClient();
  const result = await mintTableQr(client, tableId, table);
  if (result.error || !result.data) {
    return toError(result.error?.message);
  }
  logAudit(result.data.audit);
  return { data: result.data, error: null, fieldErrors: null };
}

/** Retire the printed QR for a table — the table itself stays active. */
export async function deactivateQr(
  tableId: string,
  table: RestaurantTable,
  current: TableQr | null,
): Promise<ServiceResult<{ retired: boolean; audit: TablesAuditEvent | null }>> {
  if (isDemoMode()) {
    let retired = false;
    for (const qr of demoQrs) {
      if (qr.tableId === tableId && qr.isActive) {
        qr.isActive = false;
        retired = true;
      }
    }
    return {
      data: {
        retired,
        audit: {
          entity: "table_qr",
          action: "qr_retire",
          entityId: tableId,
          label: table.tableCode,
          changedFields: current ? ["isActive"] : [],
        },
      },
      error: null,
      fieldErrors: null,
    };
  }

  const client = getSupabaseClient();
  const result = await retireTableQr(client, tableId, table, current);
  if (result.error || !result.data) {
    return toError(result.error?.message);
  }
  logAudit(result.data.audit);
  return { data: result.data, error: null, fieldErrors: null };
}
