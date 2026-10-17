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

import type {
  DraftOrder,
  OrderType,
  PublicCatalogCategory,
  RestaurantTable,
  TableSession,
} from "@tepisawah/database";

import {
  loadManualOrderCatalog,
  loadManualOrderTables,
  manualOrderIdempotencyKey,
  manualOrderSubmitIdempotencyKey,
  openManualOrderTableSession,
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
  /** Service channel / dining mode (DINE_IN, TAKE_AWAY, GOFOOD, GRABFOOD, SHOPEEFOOD) */
  orderType: OrderType;
  /** Guest name for take away or tableless order */
  customerName: string;
  /** External delivery platform reference (e.g. #GF-1234, Driver name) */
  externalReference: string;
  catalog: PublicCatalogCategory[];
  tables: RestaurantTable[];
  /** Active (OPEN) session per table id. */
  sessions: Map<string, TableSession>;
  /** The table the waiter is entering an order for (required for DINE_IN). */
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
  orderType: "DINE_IN",
  customerName: "",
  externalReference: "",
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
  openingSession: boolean;
  sessionError: string | null;
  canSubmit: boolean;
  /** True once a draft exists and it has not been sent to the kitchen yet. */
  canConfirm: boolean;
  setOrderType: (orderType: OrderType) => void;
  setCustomerName: (customerName: string) => void;
  setExternalReference: (externalReference: string) => void;
  setTable: (tableId: string) => void;
  openSessionForSelectedTable: () => Promise<void>;
  addLine: (productId: string) => void;
  decrementLine: (productId: string) => void;
  toggleModifier: (productId: string, modifierId: string) => void;
  setLineQuantity: (productId: string, quantity: number) => void;
  setLineNotes: (productId: string, notes: string) => void;
  setCustomerNote: (note: string) => void;
  setInternalNote: (note: string) => void;
  submit: () => Promise<void>;
  confirm: () => Promise<void>;
  reset: () => void;
} {
  const [state, setState] = useState<ManualOrderState>(INITIAL);
  const [openingSession, setOpeningSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

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
    const isDineIn = state.orderType === "DINE_IN";
    if (isDineIn && (!state.tableId || !activeSession)) return;
    if (state.lines.length === 0) return;

    setState((prev) => ({ ...prev, submitPhase: "submitting", submitError: null }));

    const result = await submitManualOrder({
      orderType: state.orderType,
      customerName: state.customerName.trim() || null,
      externalReference: state.externalReference.trim() || null,
      tableId: isDineIn ? state.tableId : null,
      tableSessionId: isDineIn ? (activeSession?.id ?? null) : null,
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
  }, [
    state.orderType,
    state.customerName,
    state.externalReference,
    state.tableId,
    state.lines,
    state.customerNote,
    state.internalNote,
    state.attemptId,
    activeSession,
  ]);

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

  const openSessionForSelectedTable = useCallback(async () => {
    if (!state.tableId) return;
    const table = state.tables.find((t) => t.id === state.tableId);
    if (!table) return;

    setOpeningSession(true);
    setSessionError(null);
    const result = await openManualOrderTableSession(table.id, table.tableCode);
    setOpeningSession(false);

    if (result.error || !result.data) {
      setSessionError(result.error?.message ?? "Gagal membuka sesi meja.");
      return;
    }

    const newSession = result.data;
    setState((prev) => {
      const nextSessions = new Map(prev.sessions);
      nextSessions.set(table.id, newSession);
      return {
        ...prev,
        sessions: nextSessions,
      };
    });
  }, [state.tableId, state.tables]);

  return {
    ...state,
    activeSession,
    openingSession,
    sessionError,
    canSubmit:
      (state.orderType === "DINE_IN"
        ? activeSession !== null
        : state.orderType === "TAKE_AWAY"
        ? state.customerName.trim().length > 0
        : state.externalReference.trim().length > 0) &&
      state.lines.length > 0 &&
      state.submitPhase !== "submitting" &&
      state.submitPhase !== "done",
    /** True once a draft exists and it has not been sent to the kitchen yet. */
    canConfirm:
      state.created !== null &&
      state.confirmPhase !== "confirming" &&
      state.confirmPhase !== "done",
    openSessionForSelectedTable,
    setOrderType: (orderType) => {
      setState((prev) => ({
        ...prev,
        orderType,
        created: null,
        submitPhase: "idle",
        attemptId: newAttemptId(),
      }));
    },
    setCustomerName: (customerName) => setState((prev) => ({ ...prev, customerName })),
    setExternalReference: (externalReference) => setState((prev) => ({ ...prev, externalReference })),
    setTable: (tableId) => {
      setSessionError(null);
      setState((prev) => ({
        ...prev,
        tableId,
        lines: [],
        created: null,
        submitPhase: "idle",
        attemptId: newAttemptId(),
      }));
    },
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
        let defaultModifiers: string[] = [];
        for (const cat of prev.catalog) {
          const prod = cat.products.find((p) => p.productId === productId);
          if (prod) {
            defaultModifiers = prod.modifiers
              .filter((m) => m.isRequired)
              .map((m) => m.modifierId);
            break;
          }
        }
        return {
          ...prev,
          lines: [
            ...prev.lines,
            {
              productId,
              quantity: 1,
              ...(defaultModifiers.length > 0 ? { modifierIds: defaultModifiers } : {}),
            },
          ],
        };
      }),
    toggleModifier: (productId, modifierId) =>
      setState((prev) => ({
        ...prev,
        lines: prev.lines.map((line) => {
          if (line.productId !== productId) return line;
          const current = line.modifierIds ?? [];
          const next = current.includes(modifierId)
            ? current.filter((id) => id !== modifierId)
            : [...current, modifierId];
          return {
            ...line,
            ...(next.length > 0 ? { modifierIds: next } : { modifierIds: undefined }),
          };
        }),
      })),
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
