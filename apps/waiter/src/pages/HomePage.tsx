/**
 * @tepisawah/waiter — Home page (Waiter Handheld Service Console).
 *
 * Designed in compliance with docs/design/MASTER_DESIGN_SYSTEM.md §17:
 * - Table status inspection
 * - Ready orders (food waiting to be served)
 * - Service requests (Call Waiter, Request Bill)
 * - Serve action & quick manual order trigger
 *
 * The "Siap Saji" board is LIVE: it lists every READY order from the
 * database through the `orders_staff_read` RLS policy, and "Tandai Sudah
 * Disajikan" moves one READY -> SERVED through the guarded
 * `transition_order()` command (`orders.serve`, optimistic version —
 * API_CONTRACT.md §13, §26). The other two tabs are still design samples.
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@tepisawah/auth";
import { PERMISSIONS } from "@tepisawah/permissions";
import { orderBoardStatusLabel, useOrderBoardChannel } from "@tepisawah/database";

import {
  loadReadyOrders,
  serveOrder,
  type StaffOrder,
} from "../features/ready-orders/index.js";
import { getSupabaseClient } from "../lib/supabase.js";

interface ServiceCall {
  id: string;
  table: string;
  type: "CALL_WAITER" | "BILL_REQUEST" | "ADD_UTENSILS";
  timeAgo: string;
}

interface ReadyOrder {
  id: string;
  orderNumber: string;
  table: string;
  items: string[];
  readySince: string;
  /** Database order, carried so the serve action has its version handle. */
  raw: StaffOrder;
}

/** "x mnt lalu" since the kitchen marked the order ready. */
function readyAgo(iso: string | null, now: number): string {
  if (iso === null) return "baru saja";
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "baru saja";
  const minutes = Math.max(0, Math.floor((now - then) / 60_000));
  return `${minutes} mnt lalu`;
}

function toReadyOrder(order: StaffOrder, now: number): ReadyOrder {
  return {
    id: order.id,
    orderNumber: `#${order.orderNumber}`,
    table: order.tableName,
    items: order.items.map((item) => `${item.quantity}x ${item.name}`),
    readySince: readyAgo(order.updatedAt ?? order.createdAt, now),
    raw: order,
  };
}

interface WaiterTable {
  id: string;
  name: string;
  area: string;
  status: "occupied" | "available" | "needs_attention";
  orderSummary?: string;
}

const SAMPLE_SERVICE_CALLS: ServiceCall[] = [
  { id: "sc-1", table: "Meja 02", type: "BILL_REQUEST", timeAgo: "2 mnt lalu" },
  { id: "sc-2", table: "Meja 05", type: "CALL_WAITER", timeAgo: "4 mnt lalu" },
];

const SAMPLE_TABLES: WaiterTable[] = [
  { id: "w-1", name: "Meja 01", area: "Saung A", status: "occupied", orderSummary: "Masakan siap antar" },
  { id: "w-2", name: "Meja 02", area: "Saung A", status: "needs_attention", orderSummary: "Minta Tagihan" },
  { id: "w-3", name: "Meja 03", area: "Saung A", status: "available" },
  { id: "w-4", name: "Meja 04", area: "Gazebo B", status: "occupied", orderSummary: "Sedang dipersiapkan dapur" },
  { id: "w-5", name: "Meja 05", area: "Gazebo B", status: "needs_attention", orderSummary: "Panggil Pelayan" },
  { id: "w-6", name: "Meja 06", area: "Gazebo B", status: "available" },
];

export function HomePage(): ReactNode {
  const { can } = useAuth();
  const [readyOrders, setReadyOrders] = useState<ReadyOrder[]>([]);
  const [boardPhase, setBoardPhase] = useState<"loading" | "ready" | "error">("loading");
  const [boardError, setBoardError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const [serviceCalls, setServiceCalls] = useState<ServiceCall[]>(SAMPLE_SERVICE_CALLS);
  const [activeTab, setActiveTab] = useState<"ready" | "requests" | "tables">("ready");

  const refreshBoard = useCallback(async () => {
    const result = await loadReadyOrders();
    if (result.error) {
      setBoardError(result.error.message);
      setBoardPhase("error");
      return;
    }
    setBoardError(null);
    setBoardPhase("ready");
    setNow(Date.now());
    setReadyOrders((result.data ?? []).map((order) => toReadyOrder(order, Date.now())));
  }, []);

  // Live: the kitchen marking an order ready (UPDATE on `orders`) lands the
  // card here instantly; a slow poll remains as the safety net
  // (useOrderBoardChannel).
  const boardChannel = useOrderBoardChannel(getSupabaseClient(), refreshBoard);

  // Keep the "x mnt lalu" badges honest without refetching.
  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(clock);
  }, []);

  /**
   * One guarded server-side hop: READY -> SERVED. The command re-checks
   * `orders.serve` and the version the card rendered (§26); the board
   * refetches so the tab always matches the database.
   */
  const handleServeOrder = useCallback(
    async (order: ReadyOrder) => {
      if (busyId !== null) return;
      setBusyId(order.id);
      setActionError(null);
      const result = await serveOrder(order.raw);
      setBusyId(null);
      if (result.error) {
        setActionError(result.error.message);
        void refreshBoard();
        return;
      }
      void refreshBoard();
    },
    [busyId, refreshBoard],
  );

  const handleResolveCall = (id: string) => {
    setServiceCalls((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="waiter-handheld">
      {/* Top Bar */}
      <header className="waiter-topbar">
        <div className="waiter-brand-row">
          <img src="/logo.png" alt="Tepi Sawah" className="waiter-logo" />
          <div className="waiter-staff-info">
            <span className="waiter-badge">Pramusaji: Dimas</span>
            <span className="waiter-section">Area: Saung & Gazebo</span>
            <span
              className={`live-chip live-chip--${boardChannel.status}`}
              title="Koneksi realtime papan siap saji"
            >
              {orderBoardStatusLabel(boardChannel.status)}
            </span>
          </div>
        </div>
        <a href="?order" className="btn-manual-order">
          ➕ Buat Pesanan Manual
        </a>
      </header>

      {/* Handheld Nav Tabs */}
      <nav className="waiter-tabs">
        <button
          type="button"
          className={`waiter-tab-btn ${activeTab === "ready" ? "active" : ""}`}
          onClick={() => setActiveTab("ready")}
        >
          🍽 Siap Saji ({readyOrders.length})
        </button>
        <button
          type="button"
          className={`waiter-tab-btn ${activeTab === "requests" ? "active" : ""}`}
          onClick={() => setActiveTab("requests")}
        >
          🔔 Panggilan ({serviceCalls.length})
        </button>
        <button
          type="button"
          className={`waiter-tab-btn ${activeTab === "tables" ? "active" : ""}`}
          onClick={() => setActiveTab("tables")}
        >
          🪑 Meja ({SAMPLE_TABLES.length})
        </button>
      </nav>

      {/* Main Tab Content */}
      <main className="waiter-body">
        {/* Ready Orders Tab — live from the database */}
        {activeTab === "ready" && (
          <div className="waiter-section-content">
            <h2 className="waiter-heading">Pesanan Siap Diantar ke Tamu</h2>
            {boardError !== null ? (
              <div className="waiter-alert" role="alert">
                <span>Papan tidak dapat dimuat: {boardError}</span>
                <button
                  type="button"
                  className="waiter-alert__retry"
                  onClick={() => void refreshBoard()}
                >
                  Coba lagi
                </button>
              </div>
            ) : null}
            {actionError !== null ? (
              <div className="waiter-alert" role="alert">
                {actionError}
              </div>
            ) : null}
            {boardPhase === "loading" ? (
              <p aria-live="polite">Memuat papan siap saji…</p>
            ) : boardPhase === "ready" && readyOrders.length === 0 ? (
              <div className="waiter-empty-card">
                <span>✓</span> Semua hidangan dapur telah diantar.
              </div>
            ) : (
              <div className="ready-orders-list">
                {readyOrders.map((order) => (
                  <div key={order.id} className="ready-order-card">
                    <div className="ready-order-top">
                      <div className="ready-target">
                        <span className="ready-table-title">{order.table}</span>
                        <span className="ready-order-code">{order.orderNumber}</span>
                      </div>
                      <span className="ready-time">⏱ Siap {order.readySince}</span>
                    </div>

                    <div className="ready-items-box">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="ready-item-row">• {item}</div>
                      ))}
                    </div>

                    <button
                      type="button"
                      className="btn-waiter-serve"
                      disabled={busyId !== null || !can(PERMISSIONS.ORDERS_SERVE)}
                      title={
                        can(PERMISSIONS.ORDERS_SERVE)
                          ? undefined
                          : "Sesi Anda tidak memegang izin orders.serve"
                      }
                      onClick={() => void handleServeOrder(order)}
                    >
                      {busyId === order.id
                        ? "Memproses…"
                        : "✓ Tandai Sudah Disajikan ke Tamu"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Service Requests Tab */}
        {activeTab === "requests" && (
          <div className="waiter-section-content">
            <h2 className="waiter-heading">Permintaan Layanan Tamu</h2>
            {serviceCalls.length === 0 ? (
              <div className="waiter-empty-card">
                <span>✓</span> Tidak ada panggilan pelayan aktif.
              </div>
            ) : (
              <div className="service-calls-list">
                {serviceCalls.map((call) => (
                  <div key={call.id} className="call-card">
                    <div className="call-info">
                      <span className="call-table">{call.table}</span>
                      <span className="call-type">
                        {call.type === "BILL_REQUEST" && "Minta Tagihan Kasir"}
                        {call.type === "CALL_WAITER" && "Panggil Pramusaji"}
                        {call.type === "ADD_UTENSILS" && "Minta Alat Makan Tambahan"}
                      </span>
                      <span className="call-time">{call.timeAgo}</span>
                    </div>
                    <button
                      type="button"
                      className="btn-resolve-call"
                      onClick={() => handleResolveCall(call.id)}
                    >
                      Dihadiri ✓
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tables Status Tab */}
        {activeTab === "tables" && (
          <div className="waiter-section-content">
            <h2 className="waiter-heading">Status Meja Pelayanan</h2>
            <div className="waiter-tables-grid">
              {SAMPLE_TABLES.map((t) => (
                <div key={t.id} className={`waiter-tbl-card ${t.status}`}>
                  <div className="tbl-card-top">
                    <strong>{t.name}</strong>
                    <span className="tbl-area">{t.area}</span>
                  </div>
                  <div className="tbl-card-status">
                    {t.status === "occupied" && "🟢 Terisi"}
                    {t.status === "available" && "⚪ Kosong"}
                    {t.status === "needs_attention" && "🔴 Perlu Perhatian"}
                  </div>
                  {t.orderSummary ? (
                    <div className="tbl-summary">{t.orderSummary}</div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
