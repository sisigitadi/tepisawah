/**
 * @tepisawah/waiter — Home page (Waiter Handheld Service Console).
 *
 * Designed in compliance with docs/design/MASTER_DESIGN_SYSTEM.md §17:
 * - Table status inspection
 * - Ready orders (food waiting to be served)
 * - Service requests (Call Waiter, Request Bill)
 * - Serve action & quick manual order trigger
 *
 * Supports kitchen bypass when kitchen KDS is disabled:
 * - Direct serve mode: orders can be served directly to guests
 * - Manual cook/serve mode: waiters can start cooking ("Mulai Masak") and deliver ("Selesai & Antar")
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@tepisawah/auth";
import { PERMISSIONS } from "@tepisawah/permissions";
import { orderBoardStatusLabel, useOrderBoardChannel } from "@tepisawah/database";
import { loadOrderFlowSettings, type OrderFlowSettings } from "@tepisawah/config";

import {
  loadReadyOrders,
  serveOrder,
  startCookingOrder,
  markOrderReady,
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
  status: StaffOrder["status"];
  /** Database order, carried so the serve action has its version handle. */
  raw: StaffOrder;
}

/** "x mnt lalu" since the order was updated. */
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
    status: order.status,
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

export function HomePage(): ReactNode {
  const { user, profile, can } = useAuth();
  const [flowSettings, setFlowSettings] = useState<OrderFlowSettings>(() => loadOrderFlowSettings());
  const [readyOrders, setReadyOrders] = useState<ReadyOrder[]>([]);
  const [boardPhase, setBoardPhase] = useState<"loading" | "ready" | "error">("loading");
  const [boardError, setBoardError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const [serviceCalls, setServiceCalls] = useState<ServiceCall[]>([]);
  const [tables, setTables] = useState<WaiterTable[]>([]);
  const [activeTab, setActiveTab] = useState<"ready" | "requests" | "tables">("ready");

  const waiterName = profile?.display_name || profile?.username || user?.email || "Pramusaji";

  // Sync settings when Admin updates them
  useEffect(() => {
    const handleFlowChange = () => setFlowSettings(loadOrderFlowSettings());
    window.addEventListener("tepisawah_order_flow_updated", handleFlowChange);
    window.addEventListener("storage", handleFlowChange);
    return () => {
      window.removeEventListener("tepisawah_order_flow_updated", handleFlowChange);
      window.removeEventListener("storage", handleFlowChange);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const fetchLiveTables = async () => {
      try {
        const client = getSupabaseClient();
        const { data } = await client
          .from("tables")
          .select("id, table_number, area, status, is_active")
          .eq("is_active", true)
          .order("table_number", { ascending: true });

        if (data && active) {
          setTables(
            data.map((t: any) => ({
              id: t.id,
              name: `Meja ${t.table_number}`,
              area: t.area || "Lobi Ciperna",
              status: t.status === "OCCUPIED" ? "occupied" : "available",
            }))
          );
        }
      } catch {
        // Fallback silently if offline or unseeded
      }
    };
    void fetchLiveTables();
    return () => {
      active = false;
    };
  }, []);

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

  const boardChannel = useOrderBoardChannel(getSupabaseClient(), refreshBoard);

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(clock);
  }, []);

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

  const handleStartCooking = useCallback(
    async (order: ReadyOrder) => {
      if (busyId !== null) return;
      setBusyId(order.id);
      setActionError(null);
      const result = await startCookingOrder(order.raw);
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

  const handleMarkReady = useCallback(
    async (order: ReadyOrder) => {
      if (busyId !== null) return;
      setBusyId(order.id);
      setActionError(null);
      const result = await markOrderReady(order.raw);
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

  const isKitchenActive = flowSettings.kitchenEnabled;
  const canServe = can(PERMISSIONS.ORDERS_SERVE);

  return (
    <div className="waiter-handheld">
      {/* Top Bar */}
      <header className="waiter-topbar">
        <div className="waiter-brand-row">
          <img src="/logo.png" alt="Tepi Sawah" className="waiter-logo" />
          <div className="waiter-staff-info">
            <span className="waiter-badge">Pramusaji: {waiterName}</span>
            {!isKitchenActive ? (
              <span
                style={{
                  background: "#fef3c7",
                  color: "#92400e",
                  padding: "0.15rem 0.5rem",
                  borderRadius: "4px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                }}
              >
                Dapur: {flowSettings.kitchenBypassMode === "direct_serve" ? "Langsung Antar" : "Masak Mandiri"}
              </span>
            ) : (
              <span className="waiter-section">Area: Saung & Gazebo</span>
            )}
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
          {isKitchenActive ? "🍽 Siap Saji" : "🍽 Dapur & Saji"} ({readyOrders.length})
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
          🪑 Meja ({tables.length})
        </button>
      </nav>

      {/* Main Tab Content */}
      <main className="waiter-body">
        {/* Ready / Kitchen Board Tab */}
        {activeTab === "ready" && (
          <div className="waiter-section-content">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <h2 className="waiter-heading" style={{ margin: 0 }}>
                {isKitchenActive
                  ? "Pesanan Siap Diantar ke Tamu"
                  : flowSettings.kitchenBypassMode === "manual_cook_serve"
                    ? "Alur Memasak & Antar Hidangan"
                    : "Pesanan Siap Diantar ke Tamu"}
              </h2>
              {!isKitchenActive && (
                <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                  Mode Dapur Nonaktif ({flowSettings.kitchenBypassMode === "direct_serve" ? "Bypass KDS" : "Masak Mandiri"})
                </span>
              )}
            </div>

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
              <p aria-live="polite">Memuat papan pesanan…</p>
            ) : boardPhase === "ready" && readyOrders.length === 0 ? (
              <div className="waiter-empty-card">
                <span>✓</span> Semua hidangan telah disajikan ke tamu.
              </div>
            ) : (
              <div className="ready-orders-list">
                {readyOrders.map((order) => {
                  const isBusy = busyId === order.id;
                  const anyBusy = busyId !== null;
                  return (
                    <div key={order.id} className="ready-order-card">
                      <div className="ready-order-top">
                        <div className="ready-target">
                          <span className="ready-table-title">{order.table}</span>
                          <span className="ready-order-code">{order.orderNumber}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          {!isKitchenActive && (
                            <span
                              className="waiter-status-badge"
                              style={{
                                background:
                                  order.status === "CONFIRMED"
                                    ? "#fef3c7"
                                    : order.status === "PREPARING"
                                      ? "#fed7aa"
                                      : "#d1fae5",
                                color:
                                  order.status === "CONFIRMED"
                                    ? "#92400e"
                                    : order.status === "PREPARING"
                                      ? "#c2410c"
                                      : "#065f46",
                              }}
                            >
                              {order.status === "CONFIRMED"
                                ? "🍳 Menunggu Masak"
                                : order.status === "PREPARING"
                                  ? "🔥 Sedang Masak"
                                  : "🍽 Siap Saji"}
                            </span>
                          )}
                          <span className="ready-time">⏱ {order.readySince}</span>
                        </div>
                      </div>

                      <div className="ready-items-box">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="ready-item-row">• {item}</div>
                        ))}
                      </div>

                      {/* Actions according to status */}
                      {order.status === "CONFIRMED" && (
                        <div className="waiter-action-row">
                          <button
                            type="button"
                            className="btn-waiter-cook"
                            disabled={anyBusy}
                            onClick={() => void handleStartCooking(order)}
                          >
                            {isBusy ? "Memproses…" : "🍳 Mulai Masak"}
                          </button>
                          <button
                            type="button"
                            className="btn-waiter-serve"
                            disabled={anyBusy || !canServe}
                            onClick={() => void handleServeOrder(order)}
                          >
                            {isBusy ? "Memproses…" : "✓ Langsung Antar"}
                          </button>
                        </div>
                      )}

                      {order.status === "PREPARING" && (
                        <div className="waiter-action-row">
                          <button
                            type="button"
                            className="btn-waiter-serve"
                            disabled={anyBusy || !canServe}
                            onClick={() => void handleServeOrder(order)}
                          >
                            {isBusy ? "Memproses…" : "✓ Selesai & Antar ke Tamu"}
                          </button>
                          <button
                            type="button"
                            className="btn-waiter-outline"
                            disabled={anyBusy}
                            onClick={() => void handleMarkReady(order)}
                          >
                            🍽 Siap Saji
                          </button>
                        </div>
                      )}

                      {(order.status === "READY" || isKitchenActive) && (
                        <button
                          type="button"
                          className="btn-waiter-serve"
                          disabled={anyBusy || !canServe}
                          title={
                            canServe
                              ? undefined
                              : "Sesi Anda tidak memegang izin orders.serve"
                          }
                          onClick={() => void handleServeOrder(order)}
                        >
                          {isBusy ? "Memproses…" : "✓ Tandai Sudah Disajikan ke Tamu"}
                        </button>
                      )}
                    </div>
                  );
                })}
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
                        {call.type === "ADD_UTENSILS" && "Minta Tambah Alat Makan"}
                      </span>
                      <span className="call-time">{call.timeAgo}</span>
                    </div>
                    <button
                      type="button"
                      className="btn-resolve-call"
                      onClick={() => handleResolveCall(call.id)}
                    >
                      ✓ Selesai
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tables Inspection Tab */}
        {activeTab === "tables" && (
          <div className="waiter-section-content">
            <h2 className="waiter-heading">Status Meja Tamu</h2>
            <div className="waiter-tables-grid">
              {tables.map((t) => (
                <div key={t.id} className={`table-status-card status-${t.status}`}>
                  <span className="table-card-name">{t.name}</span>
                  <span className="table-card-area">{t.area}</span>
                  <span className="table-card-status">
                    {t.status === "occupied" ? "🔴 Terisi" : "🟢 Kosong"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
