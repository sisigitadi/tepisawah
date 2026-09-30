/**
 * Tables view model (Phase 6).
 *
 * Pure mapping between the @tepisawah/database records and the admin form state,
 * plus the loader hook the page shares. Keeping this free of React lets the
 * mappers be unit-tested directly and keeps the page presentational.
 *
 * A table form starts as a draft: an unsaved table has no id, defaults to the
 * AVAILABLE status and an active record — the least surprising state for a new
 * table. Capacity is held as a string so the input can stay controlled while
 * empty (unknown capacity is null in the database, never 0).
 */
import { useCallback, useEffect, useState } from "react";

import type {
  RestaurantTable,
  TableQr,
  TableStatus,
} from "@tepisawah/database";
import { TABLE_STATUSES } from "@tepisawah/database";

export interface TableForm {
  tableCode: string;
  name: string;
  capacity: string;
  status: TableStatus;
  isActive: boolean;
}

export type LoadStatus = "loading" | "ready" | "error";

export interface LoaderResult {
  status: LoadStatus;
  error: string | null;
  tables: RestaurantTable[];
  qrs: TableQr[];
}

export const EMPTY_TABLE_FORM: TableForm = {
  tableCode: "",
  name: "",
  capacity: "",
  status: "AVAILABLE",
  isActive: true,
};

/** Indonesian labels for the five operational statuses (DATABASE_SCHEMA §17). */
export const TABLE_STATUS_LABELS: Record<TableStatus, string> = {
  AVAILABLE: "Tersedia",
  OCCUPIED: "Terisi",
  WAITING_SERVICE: "Menunggu layanan",
  WAITING_PAYMENT: "Menunggu pembayaran",
  CLEANING: "Pembersihan",
};

export const TABLE_STATUS_OPTIONS = TABLE_STATUSES.map((status) => ({
  value: status,
  label: TABLE_STATUS_LABELS[status],
}));

export function toTableForm(table: RestaurantTable | null): TableForm {
  if (table === null) return { ...EMPTY_TABLE_FORM };
  return {
    tableCode: table.tableCode,
    name: table.name,
    capacity: table.capacity === null ? "" : String(table.capacity),
    status: table.status,
    isActive: table.isActive,
  };
}

export function toTableInput(form: TableForm): import("@tepisawah/database").TableInput {
  const trimmed = form.capacity.trim();
  return {
    tableCode: form.tableCode,
    name: form.name,
    capacity: trimmed === "" ? null : Number.parseInt(trimmed, 10),
    status: form.status,
    isActive: form.isActive,
  };
}

/**
 * Shared loader state. `reload` re-runs the loader and `setStatus` lets a page
 * flag a save in flight without a full reload.
 */
export function useTablesState(loader: () => Promise<LoaderResult>): {
  state: LoaderResult;
  reload: () => void;
  setStatus: (patch: Partial<LoaderResult>) => void;
} {
  const [state, setState] = useState<LoaderResult>({
    status: "loading",
    error: null,
    tables: [],
    qrs: [],
  });

  const run = useCallback(async () => {
    setState((previous) => ({ ...previous, status: "loading", error: null }));
    const result = await loader();
    setState(result);
  }, [loader]);

  useEffect(() => {
    void run();
  }, [run]);

  return {
    state,
    reload: () => void run(),
    setStatus: (patch) => setState((previous) => ({ ...previous, ...patch })),
  };
}
