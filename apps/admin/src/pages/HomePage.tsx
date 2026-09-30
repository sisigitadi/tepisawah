/**
 * @tepisawah/admin — home page (Executive & Operational Overview).
 *
 * Designed in compliance with docs/design/MASTER_DESIGN_SYSTEM.md and
 * visual-references/01-stitch-admin-overview.png.
 */
import type { ReactNode } from "react";

export function HomePage(): ReactNode {
  return (
    <div className="overview-page">
      <header className="overview-header">
        <div>
          <h1 className="overview-title">Dashboard Overview</h1>
          <p className="overview-subtitle">
            Ringkasan performa operasional harian, status meja, dan tata kelola resto.
          </p>
        </div>
        <div className="overview-actions">
          <span className="badge-live">● Live Operational</span>
        </div>
      </header>

      {/* KPI Metrics */}
      <section className="metrics-grid">
        <div className="metric-card">
          <span className="metric-label">Total Pesanan Hari Ini</span>
          <div className="metric-value">48</div>
          <span className="metric-trend positive">↑ 12% dibanding kemarin</span>
        </div>

        <div className="metric-card">
          <span className="metric-label">Pendapatan Kotor (Est.)</span>
          <div className="metric-value">Rp 3.840.000</div>
          <span className="metric-trend positive">↑ 8% tren positif</span>
        </div>

        <div className="metric-card">
          <span className="metric-label">Meja Aktif / Terisi</span>
          <div className="metric-value">12 / 18</div>
          <span className="metric-detail">66% okupansi meja saat ini</span>
        </div>

        <div className="metric-card">
          <span className="metric-label">Rata-rata Waktu Masak</span>
          <div className="metric-value">14 mnt</div>
          <span className="metric-trend neutral">Sesuai target standar dapur</span>
        </div>
      </section>

      {/* Operational Pipeline Summary */}
      <section className="pipeline-section">
        <h2 className="section-title">Status Pipeline Pesanan Realtime</h2>
        <div className="pipeline-grid">
          <div className="pipeline-col">
            <div className="pipeline-col-header pending">
              <span>Menunggu Konfirmasi</span>
              <span className="col-count">3</span>
            </div>
            <div className="pipeline-card">
              <div className="card-top">
                <strong>#ORD-092</strong>
                <span className="table-badge">Meja A02</span>
              </div>
              <p className="card-desc">2x Nasi Liwet Komplit, 2x Es Kelapa</p>
              <span className="card-time">3 mnt lalu • QR Customer</span>
            </div>
            <div className="pipeline-card">
              <div className="card-top">
                <strong>#ORD-093</strong>
                <span className="table-badge">Meja B05</span>
              </div>
              <p className="card-desc">1x Gurame Bakar Madu, 1x Cah Kangkung</p>
              <span className="card-time">1 mnt lalu • Waiter</span>
            </div>
          </div>

          <div className="pipeline-col">
            <div className="pipeline-col-header kitchen">
              <span>Dapur (Sedang Dimasak)</span>
              <span className="col-count">4</span>
            </div>
            <div className="pipeline-card">
              <div className="card-top">
                <strong>#ORD-089</strong>
                <span className="table-badge">Meja Gazebo 1</span>
              </div>
              <p className="card-desc">1x Ayam Goreng Lengkuas, 2x Sayur Asem</p>
              <span className="card-time">9 mnt lalu • KDS Active</span>
            </div>
            <div className="pipeline-card">
              <div className="card-top">
                <strong>#ORD-090</strong>
                <span className="table-badge">Meja C01</span>
              </div>
              <p className="card-desc">4x Sambal Terasi, 4x Nasi Putih</p>
              <span className="card-time">5 mnt lalu • KDS Active</span>
            </div>
          </div>

          <div className="pipeline-col">
            <div className="pipeline-col-header ready">
              <span>Siap Disajikan</span>
              <span className="col-count">2</span>
            </div>
            <div className="pipeline-card">
              <div className="card-top">
                <strong>#ORD-088</strong>
                <span className="table-badge">Meja A04</span>
              </div>
              <p className="card-desc">Es Jeruk Kelapa Muda (2)</p>
              <span className="card-time">Siap di pick-up counter</span>
            </div>
          </div>

          <div className="pipeline-col">
            <div className="pipeline-col-header payment">
              <span>Menunggu Pembayaran</span>
              <span className="col-count">2</span>
            </div>
            <div className="pipeline-card">
              <div className="card-top">
                <strong>#ORD-084</strong>
                <span className="table-badge">Meja B02</span>
              </div>
              <p className="card-desc">Rp 215.000 (Tunai / QRIS)</p>
              <span className="card-time">Menunggu di kasir</span>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Governance Links */}
      <section className="governance-grid">
        <div className="gov-card">
          <h3>Katalog & Menu Restoran</h3>
          <p>Atur kategori, varian produk, modifiers, dan ketersediaan stok menu.</p>
        </div>
        <div className="gov-card">
          <h3>Manajemen Meja & QR Code</h3>
          <p>Generate QR code meja digital, atur status sesi pelanggan aktif.</p>
        </div>
        <div className="gov-card">
          <h3>Konfigurasi Resto & Audit Log</h3>
          <p>Atur jam operasional, sistem pembayaran, pajak, dan tinjau log audit.</p>
        </div>
      </section>
    </div>
  );
}
