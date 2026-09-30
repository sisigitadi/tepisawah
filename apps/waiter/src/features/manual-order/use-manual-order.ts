/**
 * Manual order view model (Phase 8A).
 *
 * Owns the page state so the page component stays declarative. Loading is split
 * into tables + catalog because they fail independently — a waiter whose
 * session lost `table_sessions.read` can still see the menu, and the table list
 * arriving with zero open sessions is reported rather than papered over.
 *
 * Session state is never decided here. The active session is resolved from the
 * backend and re-validated inside `create_draft_order()`, so a session closed
 * by a cashier mid-order surfaces as a server refusal on submit
 * (MASTER prompt: jangan mengandalkan frontend untuk menentukan session state).
 */
import { useCallback, useEffect, useState } from "react";

import type { DraftOrder, PublicCatalogCategory, RestaurantTable, TableSession } from "@tepisawah/database";

import {
  loadManualOrderCatalog,
  loadManualOrderTables,
  manualOrderIdempotencyKey,
  manualOrderSubmitIdempotencyKey,
  submitManualOrder,
  submitManualOrderForConfirmation,
  type ManualOrderLine,
} from "./service.js";

type LoadPhase = "loading" | "ready" | "error";
type SubmitPhase = "idle" | "submitting" | "error" | "done";
/** Sending the accepted draft to the kitchen (Phase 8B). */
type ConfirmPhase = "idle" | "confirming" | "error" | "done";

export interface ManualOrderState {
  /** Catalog + tables load. */
  loadPhase: LoadPhase;
  loadError: string | null;
  catalog: PublicCatalogCategory[];
  tables: RestaurantTable[];
  /** Active (OPEN) session per table id. */
  sessions: Map<string, TableSession>;
  /** The table the waiter is entering an order for. */
  tableId: string | null;
  /** Lines keyed by product id for easy quantity bumps. */
  lines: ManualOrderLine[];
  customerNote: string;
  internalNote: string;
  submitPhase: SubmitPhase;
  submitError: string | null;
  /** Sending the draft to PENDING_CONFIRMATION (Phase 8B). */
  confirmPhase: ConfirmPhase;
  confirmError: string | null;
  /** The created DRAFT order, once the backend accepts it. */
  created: DraftOrder | null;
  /** The same order after it reached PENDING_CONFIRMATION. */
  confirmed: DraftOrder | null;
  /**
   * Stable across retries of one order, fresh for the next. Paired with a
   * fingerprint of the lines in the idempotency key, so a retry collapses to
   * the first order while a changed order does not (API_CONTRACT.md §2.3).
   */
  attemptId: string;
}

const INITIAL: ManualOrderState = {
  loadPhase: "loading",
  loadError: null,
  catalog: [],
  tables: [],
  sessions: new Map(),
  tableId: null,
  lines: [],
  customerNote: "",
  internalNote: "",
  submitPhase: "idle",
  submitError: null,
  confirmPhase: "idle",
  confirmError: null,
  created: null,
  confirmed: null,
  attemptId: newAttemptId(),
};

function newAttemptId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function lineFor(lines: ManualOrderLine[], productId: string): ManualOrderLine | undefined {
  return lines.find((line) => line.productId === productId);
}

export function useManualOrder(): ManualOrderState & {
  /** The session the selected table currently has open, or null. */
  activeSession: TableSession | null;
  canSubmit: boolean;
  /** True once a draft exists and it has not been sent to the kitchen yet. */
  canConfirm: boolean;
  setTable: (tableId: string) => void;
  addLine: (productId: string) => void;
  decrementLine: (productId: string) => void;
  setLineQuantity: (productId: string, quantity: number) => void;
  setLineNotes: (productId: string, notes: string) => void;
  setCustomerNote: (note: string) => void;
  setInternalNote: (note: string) => void;
  submit: () => Promise<void>;
  confirm: () => Promise<void>;
  reset: () => void;
} {
  const [state, setState] = useState<ManualOrderState>(INITIAL);

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, loadPhase: "loading", loadError: null }));

    const [tablesResult, catalogResult] = await Promise.all([
      loadManualOrderTables(),
      loadManualOrderCatalog(),
    ]);

    if (tablesResult.error || !tablesResult.data) {
      setState((prev) => ({
        ...prev,
        loadPhase: "error",
        loadError: tablesResult.error?.message ?? "Data meja gagal dimuat.",
      }));
      return;
    }

    if (catalogResult.error || !catalogResult.data) {
      setState((prev) => ({
        ...prev,
        loadPhase: "error",
        loadError: catalogResult.error?.message ?? "Menu gagal dimuat.",
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      loadPhase: "ready",
      loadError: null,
      tables: tablesResult.data!.tables,
      sessions: tablesResult.data!.sessions,
      catalog: catalogResult.data!,
    }));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeSession = state.tableId ? state.sessions.get(state.tableId) ?? null : null;

  const submit = useCallback(async () => {
    if (!state.tableId || !activeSession || state.lines.length === 0) return;

    setState((prev) => ({ ...prev, submitPhase: "submitting", submitError: null }));

    const result = await submitManualOrder({
      tableId: state.tableId,
      tableSessionId: activeSession.id,
      items: state.lines,
      customerNote: state.customerNote.trim() || null,
      internalNote: state.internalNote.trim() || null,
      idempotencyKey: manualOrderIdempotencyKey(state.attemptId, state.lines),
    });

    if (result.error || !result.data) {
      setState((prev) => ({
        ...prev,
        submitPhase: "error",
        submitError: result.error?.message ?? "Pesanan gagal dibuat.",
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      submitPhase: "done",
      submitError: null,
      created: result.data!.order,
    }));
  }, [state.tableId, state.lines, state.customerNote, state.internalNote, activeSession]);

  /**
   * Send the accepted draft to PENDING_CONFIRMATION (API_CONTRACT.md §11.2).
   *
   * A draft alone is invisible to the cashier queue, which filters on
   * PENDING_CONFIRMATION (API_CONTRACT.md §12.1) — this is the step that puts
   * the order in front of the cashier. Idempotent on its own key, so a waiter
   * double-tapping "Kirim order" produces one confirmation, not two
   * (API_CONTRACT.md §2.3, §14).
   */
  const confirm = useCallback(async () => {
    if (!state.created) return;

    setState((prev) => ({ ...prev, confirmPhase: "confirming", confirmError: null }));

    const result = await submitManualOrderForConfirmation({
      orderId: state.created.id,
      idempotencyKey: manualOrderSubmitIdempotencyKey(state.attemptId, state.created.id),
    });

    if (result.error || !result.data) {
      setState((prev) => ({
        ...prev,
        confirmPhase: "error",
        confirmError: result.error?.message ?? "Pesanan gagal dikirim.",
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      confirmPhase: "done",
      confirmError: null,
      confirmed: result.data!.order,
    }));
  }, [state.created, state.attemptId]);

  return {
    ...state,
    activeSession,
    canSubmit:
      activeSession !== null &&
      state.lines.length > 0 &&
      state.submitPhase !== "submitting" &&
      state.submitPhase !== "done",
    /** True once a draft exists and it has not been sent to the kitchen yet. */
    canConfirm:
      state.created !== null &&
      state.confirmPhase !== "confirming" &&
      state.confirmPhase !== "done",
    setTable: (tableId) =>
      setState((prev) => ({
        ...prev,
        tableId,
        lines: [],
        created: null,
        submitPhase: "idle",
        attemptId: newAttemptId(),
      })),
    addLine: (productId) =>
      setState((prev) => {
        const existing = lineFor(prev.lines, productId);
        if (existing) {
          return {
            ...prev,
            lines: prev.lines.map((line) =>
              line.productId === productId
                ? { ...line, quantity: line.quantity + 1 }
                : line,
            ),
          };
        }
        return { ...prev, lines: [...prev.lines, { productId, quantity: 1 }] };
      }),
    decrementLine: (productId) =>
      setState((prev) => {
        const existing = lineFor(prev.lines, productId);
        if (!existing) return prev;
        if (existing.quantity <= 1) {
          return { ...prev, lines: prev.lines.filter((line) => line.productId !== productId) };
        }
        return {
          ...prev,
          lines: prev.lines.map((line) =>
            line.productId === productId
              ? { ...line, quantity: line.quantity - 1 }
              : line,
          ),
        };
      }),
    setLineQuantity: (productId, quantity) =>
      setState((prev) => {
        if (!(quantity >= 1)) {
          return { ...prev, lines: prev.lines.filter((line) => line.productId !== productId) };
        }
        return {
          ...prev,
          lines: prev.lines.map((line) =>
            line.productId === productId ? { ...line, quantity } : line,
          ),
        };
      }),
    setLineNotes: (productId, notes) =>
      setState((prev) => ({
        ...prev,
        lines: prev.lines.map((line) =>
          line.productId === productId ? { ...line, notes: notes || null } : line,
        ),
      })),
    setCustomerNote: (customerNote) => setState((prev) => ({ ...prev, customerNote })),
    setInternalNote: (internalNote) => setState((prev) => ({ ...prev, internalNote })),
    submit,
    confirm,
    reset: () =>
      setState({
        ...INITIAL,
        attemptId: newAttemptId(),
        loadPhase: "ready",
        tables: state.tables,
        sessions: state.sessions,
        catalog: state.catalog,
      }),
  };
}
