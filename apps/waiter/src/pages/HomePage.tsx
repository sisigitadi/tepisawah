/**
 * @tepisawah/waiter — Home page (Waiter Handheld Service Console).
 *
 * Designed in compliance with docs/design/MASTER_DESIGN_SYSTEM.md §17:
 * - Table status inspection
 * - Ready orders (food waiting to be served)
 * - Service requests (Call Waiter, Request Bill)
 * - Serve action & quick manual order trigger
 */
import { useState, type ReactNode } from "react";

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

const SAMPLE_READY_ORDERS: ReadyOrder[] = [
  {
    id: "ro-1",
    orderNumber: "ORD-001",
    table: "Meja 01",
    readySince: "3 mnt lalu",
    items: ["1x Gurame Bakar Madu", "2x Nasi Liwet Sawah Komplit", "1x Karedok Leunca Segar"],
  },
  {
    id: "ro-2",
    orderNumber: "ORD-004",
    table: "Meja 02",
    readySince: "1 mnt lalu",
    items: ["1x Pepes Ikan Mas", "1x Bakwan Jagung"],
  },
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
  const [readyOrders, setReadyOrders] = useState<ReadyOrder[]>(SAMPLE_READY_ORDERS);
  const [serviceCalls, setServiceCalls] = useState<ServiceCall[]>(SAMPLE_SERVICE_CALLS);
  const [activeTab, setActiveTab] = useState<"ready" | "requests" | "tables">("ready");

  const handleServeOrder = (id: string) => {
    setReadyOrders((prev) => prev.filter((o) => o.id !== id));
  };

  const handleResolveCall = (id: string) => {
    setServiceCalls((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="waiter-handheld">
      {/* Top Bar */}
      <header className="waiter-topbar">
        <div className="waiter-staff-info">
          <span className="waiter-badge">Pramusaji: Dimas</span>
          <span className="waiter-section">Area: Saung & Gazebo</span>
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
        {/* Ready Orders Tab */}
        {activeTab === "ready" && (
          <div className="waiter-section-content">
            <h2 className="waiter-heading">Pesanan Siap Diantar ke Tamu</h2>
            {readyOrders.length === 0 ? (
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
                      onClick={() => handleServeOrder(order.id)}
                    >
                      ✓ Tandai Sudah Disajikan ke Tamu
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
