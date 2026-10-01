/**
 * @tepisawah/database — live board subscription (Supabase Realtime).
 *
 * The staff boards (kitchen KDS, cashier confirmation queue, cashier payment
 * terminal, waiter ready board) used to poll every 15 seconds. This hook
 * replaces the polling with a Realtime `postgres_changes` subscription on the
 * `orders` table: any INSERT/UPDATE (a customer submitting, the kitchen
 * cooking, the waiter serving, the cashier settling) triggers one debounced
 * refetch of the board's own query, so every screen re-reads the truth
 * through the same RLS-gated path as before — the subscription is only a
 * *signal*, never a data source (MASTER prompt: the database is the
 * authority; no second representation of order state).
 *
 * Security semantics (Realtime docs, Postgres Changes → Security):
 * - events are evaluated against the table's RLS policies for the
 *   subscribing role, and
 * - a subscriber that cannot SELECT the row at all (RLS would exclude it)
 *   receives nothing and the subscription fails closed with a CHANNEL_ERROR.
 *
 * `orders` carries no anon SELECT policy by design (migration 008), so an
 * anonymous browser gets no order events; a staff session with
 * `orders_staff_read` receives exactly the rows it could already read via
 * REST — no widening, no leaking (AUTH_RBAC_RLS.md §27). A DELETE event is
 * not expected on the operational path (orders are transitioned, never
 * deleted) and is ignored for refresh purposes only if it ever fires.
 *
 * Robustness: because the event is a signal and not data, a dropped socket
 * degrades to the 60-second polling safety net (REFRESH_SAFETY_NET_MS) and
 * recovers transparently; the UI also keeps working when the publication is
 * not yet configured server-side (subscribe state stays CHANNEL_ERROR and
 * the safety net carries the board).
 *
 * React is an optional peer: the hook is exported from the package's React
 * entry so staff apps share one implementation.
 */
import { useEffect, useRef, useState } from "react";
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
  RealtimePostgresInsertPayload,
  RealtimePostgresUpdatePayload,
  SupabaseClient,
} from "@supabase/supabase-js";

import type { Database } from "../generated/index.js";

/** Refetch at least this often even without events (safety net). */
const REFRESH_SAFETY_NET_MS = 60_000;

/** Collapse event bursts (multi-step transitions, whole-board replays). */
const REFRESH_DEBOUNCE_MS = 150;

/** How long a refetch must stall before we consider the board stale. */
const STALE_AFTER_MS = 5_000;

export type OrderBoardChannelStatus =
  | "connecting"
  | "live"
  | "offline";

/**
 * The events this subscription reacts to, with their row shapes. The row is
 * typed loosely on purpose: the payload is only a *signal* here — the refresh
 * always re-reads through the RLS-gated query path, so nothing trusts these
 * fields.
 */
export type OrderBoardEvent =
  | RealtimePostgresInsertPayload<{ [key: string]: unknown }>
  | RealtimePostgresUpdatePayload<{ [key: string]: unknown }>;

/**
 * Subscribe to `orders` changes and re-run `refresh` whenever the table moves.
 *
 * The callback identity is captured in a ref, so callers may pass an inline
 * closure without resubscribing on every render. Returns the channel status
 * for a small UI indicator, plus whether the latest refetch is stalled
 * (socket down and the safety net is carrying the board).
 */
export function useOrderBoardChannel(
  client: SupabaseClient<Database>,
  refresh: () => Promise<unknown> | unknown,
): { status: OrderBoardChannelStatus; stale: boolean } {
  const [status, setStatus] = useState<OrderBoardChannelStatus>("connecting");
  const [stale, setStale] = useState<boolean>(false);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    let debounce: number | null = null;
    let safetyNet: number | null = null;
    let staleTimer: number | null = null;
    let disposed = false;

    const scheduleRefresh = (): void => {
      if (debounce !== null) window.clearTimeout(debounce);
      debounce = window.setTimeout(() => {
        debounce = null;
        setStale(true);
        void Promise.resolve(refreshRef.current()).finally(() => {
          if (!disposed) setStale(false);
        });
      }, REFRESH_DEBOUNCE_MS);
    };

    const onEvent = (
      _payload: RealtimePostgresChangesPayload<{ [key: string]: unknown }>,
    ): void => {
      // INSERT/UPDATE cover the whole lifecycle (submit, confirm, cook,
      // ready, serve, pay); the subscription registers for "*" so deletes,
      // should one ever happen, also reconcile the board.
      scheduleRefresh();
    };

    const channel: RealtimeChannel = client
      .channel("order-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, onEvent)
      .subscribe((state: string) => {
        if (disposed) return;
        if (state === "SUBSCRIBED") setStatus("live");
        else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") setStatus("offline");
        else if (state === "CLOSED") setStatus("offline");
      });

    // Safety net: poll rarely; also refresh once shortly after mount so a
    // board opened between events still converges without waiting a minute.
    safetyNet = window.setInterval(scheduleRefresh, REFRESH_SAFETY_NET_MS);
    staleTimer = window.setTimeout(scheduleRefresh, 400);

    return () => {
      disposed = true;
      if (debounce !== null) window.clearTimeout(debounce);
      if (safetyNet !== null) window.clearInterval(safetyNet);
      if (staleTimer !== null) window.clearTimeout(staleTimer);
      void client.removeChannel(channel);
    };
  }, [client]);

  return { status, stale };
}

/** One-line label for a board's connection chip. */
export function orderBoardStatusLabel(status: OrderBoardChannelStatus): string {
  if (status === "live") return "Realtime";
  if (status === "offline") return "Offline — mencoba ulang";
  return "Menghubungkan…";
}
