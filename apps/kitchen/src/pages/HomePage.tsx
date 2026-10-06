/**
 * @tepisawah/kitchen — Home page (Kitchen Display System / KDS).
 *
 * Designed in compliance with docs/design/MASTER_DESIGN_SYSTEM.md §16:
 * - Speed, high visibility and readable from working distances
 * - Order ID, Table, Elapsed Time, Items, Quantity, Notes, Direct Action
 * - Transition flow: CONFIRMED -> PREPARING -> READY
 * - Zero financial details displayed
 *
 * The board is LIVE: tickets come from the `orders` / `order_items` tables
 * through the RLS-gated `orders_staff_read` policy (migration 008 part 1), so
 * an order the customer or waiter just placed appears here on the next poll —
 * no fixture, no second source of truth. Status moves go through the guarded
 * `transition_order()` command, which re-checks `kitchen.start` /
 * `kitchen.ready` and the optimistic version server-side (API_CONTRACT.md
 * §13, §26); the buttons are disabled without those permissions, because the
 * guard is UX-only — the backend is the authority.
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@tepisawah/auth";
import { PERMISSIONS } from "@tepisawah/permissions";
import { orderBoardStatusLabel, useOrderBoardChannel } from "@tepisawah/database";

import {
  loadBoard,
  markReady,
  startCooking,
  type StaffOrder,
} from "../lib/board.js";
import { getSupabaseClient } from "../lib/supabase.js";

/** Minutes elapsed since `iso`, floored for the ⏱ badge. */
function elapsedMinutesSince(iso: string | null, now: number): number {
  if (iso === null) return 0;
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return 0;
  return Math.max(0, Math.floor((now - then) / 60_000));
}

const CLOCK_TICK_MS = 30_000;
const OVERDUE_MINUTES = 15;

export function HomePage(): ReactNode {
  const { can } = useAuth();
  const [orders, setOrders] = useState<StaffOrder[]>([]);
  const [loaded, setLoaded] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  const refresh = useCallback(async () => {
    const result = await loadBoard();
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setError(null);
    setLoaded(true);
    setOrders(result.data ?? []);
  }, []);

  // Live: any INSERT/UPDATE on `orders` (submit, confirm, cook, ready, serve,
  // pay) triggers a debounced refetch; a slow poll remains as the safety net
  // for dropped sockets (useOrderBoardChannel).
  const boardChannel = useOrderBoardChannel(getSupabaseClient(), refresh);

  // Keep the ⏱ badges honest without refetching.
  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => window.clearInterval(clock);
  }, []);

  /**
   * One guarded server-side hop. The command re-validates the permission and
   * the version the board rendered (API_CONTRACT.md §26); on success only
   * status/version are merged into the local copy so the card does not
   * flicker, and the next poll reconciles everything else. On failure the
   * board shows the refusal and reconciles immediately.
   */
  const advance = useCallback(
    async (order: StaffOrder) => {
      if (busyId !== null) return;
      setBusyId(order.id);
      setActionError(null);
      const result =
        order.status === "CONFIRMED"
          ? await startCooking(order)
          : await markReady(order);
      setBusyId(null);
      if (result.error || result.data === null) {
        setActionError(result.error?.message ?? "Status tidak dapat diubah.");
        void refresh();
        return;
      }
      const fresh = result.data.order;
      setOrders((prev) =>
        prev.map((current) =>
          current.id === fresh.id
            ? { ...current, status: fresh.status, version: fresh.version }
            : current,
        ),
      );
    },
    [busyId, refresh],
  );

  const visible = filter === "ALL"
    ? orders
    : orders.filter((order) => order.status === filter);

  const preparingCount = orders.filter(o => o.status === "PREPARING").length;
  const confirmedCount = orders.filter(o => o.status === "CONFIRMED").length;
  const readyCount = orders.filter(o => o.status === "READY").length;

  return (
    <div className="kds-screen">
      {/* KDS Header Bar */}
      <header className="kds-header">
        <div className="kds-brand">
          <img src="/logo.png" alt="Tepi Sawah" className="kds-logo" />
          <span className="kds-title">LAYAR PESANAN DAPUR</span>
          <span className="kds-station">Stasiun: Dapur Utama &amp; Bakaran</span>
          <span
            className={`live-chip live-chip--${boardChannel.status}`}
            title="Koneksi realtime papan dapur"
          >
            {orderBoardStatusLabel(boardChannel.status)}
          </span>
        </div>
        <div className="kds-stats">
          <button
            type="button"
            className={`kds-stat-btn ${filter === "ALL" ? "active" : ""}`}
            onClick={() => setFilter("ALL")}
          >
            Semua ({orders.length})
          </button>
          <button
            type="button"
            className={`kds-stat-btn ${filter === "CONFIRMED" ? "active" : ""}`}
            onClick={() => setFilter("CONFIRMED")}
          >
            Antrian Baru ({confirmedCount})
          </button>
          <button
            type="button"
            className={`kds-stat-btn ${filter === "PREPARING" ? "active" : ""}`}
            onClick={() => setFilter("PREPARING")}
          >
            Sedang Dimasak ({preparingCount})
          </button>
          <button
            type="button"
            className={`kds-stat-btn ${filter === "READY" ? "active" : ""}`}
            onClick={() => setFilter("READY")}
          >
            Siap Saji ({readyCount})
          </button>
        </div>
      </header>

      {/* Board states */}
      {error !== null ? (
        <main className="kds-main">
          <div className="kds-tickets-grid">
            <div className="kds-ticket-card" role="alert">
              <div className="ticket-header">
                <div className="ticket-order-ref">
                  <span className="ticket-order-num">Papan tidak dapat dimuat</span>
                </div>
                <div className="ticket-timer">⟳</div>
              </div>
              <div className="ticket-items-list">
                <div className="ticket-item-row">
                  <div className="item-detail">
                    <div className="item-title">{error}</div>
                  </div>
                </div>
              </div>
              <div className="ticket-footer">
                <button
                  type="button"
                  className="kds-btn-action btn-start"
                  onClick={() => void refresh()}
                >
                  ⟳ Coba lagi
                </button>
              </div>
            </div>
          </div>
        </main>
      ) : (
        <main className="kds-main">
          {actionError !== null ? (
            <p className="kds-empty-note" role="alert">
              {actionError}
            </p>
          ) : null}
          {loaded && orders.length === 0 ? (
            <p aria-live="polite" className="kds-empty-note">
              Belum ada pesanan di dapur. Pesanan baru muncul otomatis.
            </p>
          ) : null}
          <div className="kds-tickets-grid">
            {visible.map((order) => {
              const elapsed = elapsedMinutesSince(
                order.updatedAt ?? order.createdAt,
                now,
              );
              const isOverdue = elapsed >= OVERDUE_MINUTES;
              return (
                <div
                  key={order.id}
                  className={`kds-ticket-card status-${order.status.toLowerCase()} ${isOverdue ? "overdue" : ""}`}
                >
                  {/* Ticket Card Top */}
                  <div className="ticket-header">
                    <div className="ticket-order-ref">
                      <span className="ticket-order-num">#{order.orderNumber}</span>
                      <span className="ticket-table-name">{order.tableName}</span>
                      {order.tableCode ? (
                        <span className="ticket-area-sub">{order.tableCode}</span>
                      ) : null}
                    </div>
                    <div className={`ticket-timer ${isOverdue ? "timer-alert" : ""}`}>
                      ⏱ {elapsed}m
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="ticket-items-list">
                    {order.items.map((item) => (
                      <div key={item.id} className="ticket-item-row">
                        <div className="item-qty-badge">{item.quantity}x</div>
                        <div className="item-detail">
                          <div className="item-title">{item.name}</div>
                          {item.notes ? (
                            <div className="item-instruction">Catatan: {item.notes}</div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Bottom Status Button */}
                  <div className="ticket-footer">
                    {order.status === "CONFIRMED" && (
                      <button
                        type="button"
                        className="kds-btn-action btn-start"
                        disabled={busyId !== null || !can(PERMISSIONS.KITCHEN_START)}
                        onClick={() => void advance(order)}
                      >
                        {busyId === order.id ? "Memproses…" : "▶ Mulai Memasak"}
                      </button>
                    )}
                    {order.status === "PREPARING" && (
                      <button
                        type="button"
                        className="kds-btn-action btn-ready"
                        disabled={busyId !== null || !can(PERMISSIONS.KITCHEN_READY)}
                        onClick={() => void advance(order)}
                      >
                        {busyId === order.id ? "Memproses…" : "✓ Selesai / Siap Diantar"}
                      </button>
                    )}
                    {order.status === "READY" && (
                      <div className="ticket-ready-notice">
                        ✓ Menunggu Waiter Ambil
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      )}
    </div>
  );
}
