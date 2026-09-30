/**
 * Table sessions view model (Phase 7).
 *
 * Pure mapping between the @tepisawah/database records and the admin page
 * state, plus the loader hook the page shares. Keeping this free of React lets
 * the mappers be unit-tested and keeps the page presentational.
 *
 * Session status is its own two-value vocabulary (DATABASE_SCHEMA.md §19),
 * deliberately separate from table status: a table can be AVAILABLE while its
 * session is still OPEN, and closing a session never implies the furniture
 * changed.
 */
import { useCallback, useEffect, useState } from "react";

import type { TableSession } from "@tepisawah/database";

export type LoadStatus = "loading" | "ready" | "error";

export interface LoaderResult {
  status: LoadStatus;
  error: string | null;
  rows: import("./service.js").TableSessionRow[];
}

/** Indonesian labels for the two session statuses (DATABASE_SCHEMA.md §19). */
export const SESSION_STATUS_LABELS: Record<TableSession["status"], string> = {
  OPEN: "Berlangsung",
  CLOSED: "Selesai",
};

/** The order count an open session has accrued, for the list badge. */
export function orderCountLabel(session: TableSession | null): string {
  if (session === null) return "Belum ada sesi";
  return `${session.orderCount} order`;
}

/** True while a session may still accept orders. */
export function isOpen(session: TableSession | null): boolean {
  return session !== null && session.status === "OPEN";
}

/**
 * Shared loader state. `reload` re-runs the loader and `setStatus` lets the page
 * flag a save in flight without a full reload.
 */
export function useSessionsState(loader: () => Promise<LoaderResult>): {
  state: LoaderResult;
  reload: () => void;
  setStatus: (patch: Partial<LoaderResult>) => void;
} {
  const [state, setState] = useState<LoaderResult>({
    status: "loading",
    error: null,
    rows: [],
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
