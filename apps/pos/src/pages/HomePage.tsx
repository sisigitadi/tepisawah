/**
 * @tepisawah/pos — Home page (Point of Sale Operational Terminal).
 *
 * Designed in compliance with docs/design/MASTER_DESIGN_SYSTEM.md and Stitch POS specifications:
 * - High contrast operational UI
 * - Table status grid with active guest counts and totals
 * - Quick order / bill checkout summary pane
 * - Direct action buttons for cashier operations
 */
import { useState, type ReactNode } from "react";

interface TableItem {
  id: string;
  name: string;
  area: string;
  status: "occupied" | "available" | "billing" | "reserved";
  guests: number;
  orderNumber?: string;
  total?: number;
  timeActive?: string;
}

const SAMPLE_TABLES: TableItem[] = [
  { id: "1", name: "Meja 01", area: "Area Saung A", status: "occupied", guests: 4, orderNumber: "ORD-2026-001", total: 245000, timeActive: "35m" },
  { id: "2", name: "Meja 02", area: "Area Saung A", status: "billing", guests: 2, orderNumber: "ORD-2026-004", total: 120000, timeActive: "50m" },
  { id: "3", name: "Meja 03", area: "Area Saung A", status: "available", guests: 0 },
  { id: "4", name: "Meja 04", area: "Area Gazebo B", status: "occupied", guests: 6, orderNumber: "ORD-2026-002", total: 410000, timeActive: "22m" },
  { id: "5", name: "Meja 05", area: "Area Gazebo B", status: "reserved", guests: 4 },
  { id: "6", name: "Meja 06", area: "Area Gazebo B", status: "available", guests: 0 },
  { id: "7", name: "Meja 07", area: "Area Lesehan C", status: "occupied", guests: 5, orderNumber: "ORD-2026-007", total: 315000, timeActive: "15m" },
  { id: "8", name: "Meja 08", area: "Area Lesehan C", status: "available", guests: 0 },
];

const formatIDR = (val: number): string =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(val);

export function HomePage(): ReactNode {
  const [selectedTable, setSelectedTable] = useState<TableItem>(SAMPLE_TABLES[0]);
  const [filterArea, setFilterArea] = useState<string>("all");

  const filteredTables = filterArea === "all"
    ? SAMPLE_TABLES
    : SAMPLE_TABLES.filter(t => t.area.toLowerCase().includes(filterArea.toLowerCase()));

  return (
    <div className="pos-terminal">
      {/* Top Operational Bar */}
      <header className="pos-topbar">
        <div className="pos-topbar__info">
          <span className="pos-cashier-badge">Kasir: Siti Rahmawati</span>
          <span className="pos-shift-info">Shift Pagi • Shift #2026-09</span>
        </div>
        <div className="pos-topbar__stats">
          <div className="stat-pill">
            <span className="stat-label">Terisi:</span>
            <strong>3 Meja</strong>
          </div>
          <div className="stat-pill">
            <span className="stat-label">Minta Tagihan:</span>
            <strong className="text-warning">1 Meja</strong>
          </div>
          <div className="stat-pill">
            <span className="stat-label">Total Omset Shift:</span>
            <strong className="text-success">Rp 1.090.000</strong>
          </div>
        </div>
      </header>

      {/* Main Terminal View: Tables + Selected Bill pane */}
      <div className="pos-layout">
        {/* Left Side: Tables Grid */}
        <section className="pos-tables-panel">
          <div className="pos-panel-header">
            <h2 className="pos-heading">Manajemen Meja & Transaksi</h2>
            <div className="pos-filters">
              <button
                type="button"
                className={`filter-btn ${filterArea === "all" ? "active" : ""}`}
                onClick={() => setFilterArea("all")}
              >
                Semua Meja ({SAMPLE_TABLES.length})
              </button>
              <button
                type="button"
                className={`filter-btn ${filterArea === "Saung" ? "active" : ""}`}
                onClick={() => setFilterArea("Saung")}
              >
                Saung A
              </button>
              <button
                type="button"
                className={`filter-btn ${filterArea === "Gazebo" ? "active" : ""}`}
                onClick={() => setFilterArea("Gazebo")}
              >
                Gazebo B
              </button>
              <button
                type="button"
                className={`filter-btn ${filterArea === "Lesehan" ? "active" : ""}`}
                onClick={() => setFilterArea("Lesehan")}
              >
                Lesehan C
              </button>
            </div>
          </div>

          <div className="pos-tables-grid">
            {filteredTables.map((tbl) => {
              const isSelected = selectedTable.id === tbl.id;
              return (
                <div
                  key={tbl.id}
                  className={`pos-table-card status-${tbl.status} ${isSelected ? "selected" : ""}`}
                  onClick={() => setSelectedTable(tbl)}
                >
                  <div className="table-card__top">
                    <span className="table-name">{tbl.name}</span>
                    <span className={`table-badge badge-${tbl.status}`}>
                      {tbl.status === "occupied" && "Terisi"}
                      {tbl.status === "available" && "Kosong"}
                      {tbl.status === "billing" && "Minta Bill"}
                      {tbl.status === "reserved" && "Reservasi"}
                    </span>
                  </div>
                  <div className="table-area-text">{tbl.area}</div>
                  {tbl.status !== "available" && tbl.status !== "reserved" ? (
                    <div className="table-card__body">
                      <div className="table-guests">👥 {tbl.guests} Tamu • ⏱ {tbl.timeActive}</div>
                      <div className="table-order-num">{tbl.orderNumber}</div>
                      <div className="table-total">{tbl.total ? formatIDR(tbl.total) : "—"}</div>
                    </div>
                  ) : (
                    <div className="table-card__body empty">
                      <span className="empty-label">
                        {tbl.status === "available" ? "Siap Digunakan" : "Dipesan Pukul 13:00"}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Right Side: Active Bill & Action Center */}
        <aside className="pos-bill-panel">
          <div className="bill-panel-header">
            <h3>Detail Tagihan — {selectedTable.name}</h3>
            <span className={`status-pill status-${selectedTable.status}`}>
              {selectedTable.status.toUpperCase()}
            </span>
          </div>

          {selectedTable.total ? (
            <div className="bill-content">
              <div className="bill-meta">
                <div className="meta-row">
                  <span>No. Pesanan:</span>
                  <strong>{selectedTable.orderNumber}</strong>
                </div>
                <div className="meta-row">
                  <span>Tamu:</span>
                  <strong>{selectedTable.guests} Orang</strong>
                </div>
                <div className="meta-row">
                  <span>Waktu Berjalan:</span>
                  <strong>{selectedTable.timeActive}</strong>
                </div>
              </div>

              <div className="bill-items">
                <h4>Daftar Menu:</h4>
                <div className="bill-item-row">
                  <span>1x Gurame Bakar Madu</span>
                  <span>Rp 95.000</span>
                </div>
                <div className="bill-item-row">
                  <span>2x Nasi Liwet Kastrol</span>
                  <span>Rp 70.000</span>
                </div>
                <div className="bill-item-row">
                  <span>1x Karedok Leunca Pasundan</span>
                  <span>Rp 25.000</span>
                </div>
                <div className="bill-item-row">
                  <span>3x Es Teh Manis Sereh</span>
                  <span>Rp 45.000</span>
                </div>
                <div className="bill-item-row sub">
                  <span>1x Sambal Dadak Terasi</span>
                  <span>Rp 10.000</span>
                </div>
              </div>

              <div className="bill-summary">
                <div className="sum-row">
                  <span>Subtotal</span>
                  <span>{formatIDR(selectedTable.total)}</span>
                </div>
                <div className="sum-row">
                  <span>PB1 / Pajak Resto (10%)</span>
                  <span>{formatIDR(selectedTable.total * 0.1)}</span>
                </div>
                <div className="sum-row total">
                  <span>Total Tagihan</span>
                  <span>{formatIDR(selectedTable.total * 1.1)}</span>
                </div>
              </div>

              <div className="bill-actions">
                <button type="button" className="btn-pos-pay primary">
                  💳 Proses Pembayaran (Kasir)
                </button>
                <div className="btn-group-half">
                  <button type="button" className="btn-pos-sec">
                    🖨 Cetak Struk
                  </button>
                  <button type="button" className="btn-pos-sec">
                    ➕ Tambah Menu
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bill-empty">
              <p>Meja ini sedang tidak memiliki pesanan aktif.</p>
              <button type="button" className="btn-pos-pay primary">
                Buka Sesi Meja Baru
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
