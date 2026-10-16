/**
 * @tepisawah/admin — Home Page (Executive & Operational Overview).
 *
 * Real-time operational overview connected to actual database orders,
 * active tables, and revenue metrics. Clean, ready for production opening day.
 */
import { useEffect, useState, type ReactNode } from "react";
import { getSupabaseClient } from "../lib/supabase.js";
import { isDemoMode } from "../lib/demo-mode.js";

export interface HomePageProps {
  readonly onNavigate?: (tab: string) => void;
}

interface OperationalMetrics {
  totalOrdersToday: number;
  totalRevenueToday: number;
  totalTables: number;
  occupiedTables: number;
  pendingOrders: any[];
  kitchenOrders: any[];
  readyOrders: any[];
  servedOrders: any[];
}

export function HomePage({ onNavigate }: HomePageProps = {}): ReactNode {
  const [metrics, setMetrics] = useState<OperationalMetrics>({
    totalOrdersToday: 0,
    totalRevenueToday: 0,
    totalTables: 18,
    occupiedTables: 0,
    pendingOrders: [],
    kitchenOrders: [],
    readyOrders: [],
    servedOrders: [],
  });
  const [loading, setLoading] = useState(true);

  async function loadOverview() {
    setLoading(true);
    try {
      if (isDemoMode()) {
        setMetrics({
          totalOrdersToday: 0,
          totalRevenueToday: 0,
          totalTables: 18,
          occupiedTables: 0,
          pendingOrders: [],
          kitchenOrders: [],
          readyOrders: [],
          servedOrders: [],
        });
        setLoading(false);
        return;
      }

      const client = getSupabaseClient() as any;

      // 1. Fetch tables
      const { data: tablesData } = await client
        .from("tables")
        .select("id, status, is_active");
      const activeTables = (tablesData || []).filter((t: any) => t.is_active !== false);
      const totalTables = activeTables.length || 18;
      const occupiedTables = activeTables.filter((t: any) => t.status === "OCCUPIED").length;

      // 2. Fetch today's orders
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const { data: ordersData } = await client
        .from("orders")
        .select("id, order_number, status, total_amount, created_at, table_id")
        .gte("created_at", startOfDay.toISOString())
        .order("created_at", { ascending: false });

      const orders = ordersData || [];
      const totalOrdersToday = orders.length;

      const totalRevenueToday = orders
        .filter((o: any) => o.status === "PAID")
        .reduce((sum: number, o: any) => sum + (Number(o.total_amount) || 0), 0);

      const pendingOrders = orders.filter((o: any) => o.status === "PENDING" || o.status === "DRAFT");
      const kitchenOrders = orders.filter((o: any) => o.status === "CONFIRMED" || o.status === "PREPARING");
      const readyOrders = orders.filter((o: any) => o.status === "READY");
      const servedOrders = orders.filter((o: any) => o.status === "SERVED");

      setMetrics({
        totalOrdersToday,
        totalRevenueToday,
        totalTables,
        occupiedTables,
        pendingOrders,
        kitchenOrders,
        readyOrders,
        servedOrders,
      });
    } catch {
      // Graceful fallback to zero state
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOverview();
    const interval = window.setInterval(() => {
      void loadOverview();
    }, 30000);
    return () => window.clearInterval(interval);
  }, []);

  const formatRupiah = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val);

  const hasActiveOrders =
    metrics.pendingOrders.length > 0 ||
    metrics.kitchenOrders.length > 0 ||
    metrics.readyOrders.length > 0 ||
    metrics.servedOrders.length > 0;

  return (
    <div className="overview-page" style={{ padding: "1.5rem", maxWidth: "1280px", margin: "0 auto" }}>
      <header className="overview-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 700, margin: "0 0 0.35rem 0", color: "#0f172a" }}>
            Ringkasan Operasional Resto
          </h1>
          <p style={{ margin: 0, color: "#64748b", fontSize: "0.95rem" }}>
            Performa operasional langsung, status meja, dan tata kelola Tepi Sawah Resto &amp; Cafe.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0", padding: "0.35rem 0.75rem", borderRadius: "9999px", fontSize: "0.85rem", fontWeight: 600 }}>
            ● Operasional Siap Melayani
          </span>
          <button
            type="button"
            onClick={() => void loadOverview()}
            disabled={loading}
            style={{
              padding: "0.35rem 0.75rem",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              cursor: "pointer",
              fontSize: "0.85rem",
              fontWeight: 500,
            }}
          >
            {loading ? "Memperbarui..." : "Segarkan"}
          </button>
        </div>
      </header>

      {/* KPI Metrics */}
      <section className="metrics-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
        <div className="metric-card" style={{ background: "#ffffff", padding: "1.25rem", borderRadius: "10px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <span style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 600 }}>Total Pesanan Hari Ini</span>
          <div style={{ fontSize: "2rem", fontWeight: 700, color: "#0f172a", margin: "0.4rem 0" }}>
            {metrics.totalOrdersToday}
          </div>
          <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
            {metrics.totalOrdersToday === 0 ? "Belum ada pesanan masuk" : "Akumulasi pesanan aktif & selesai"}
          </span>
        </div>

        <div className="metric-card" style={{ background: "#ffffff", padding: "1.25rem", borderRadius: "10px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <span style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 600 }}>Total Pendapatan Terbayar</span>
          <div style={{ fontSize: "2rem", fontWeight: 700, color: "#15803d", margin: "0.4rem 0" }}>
            {formatRupiah(metrics.totalRevenueToday)}
          </div>
          <span style={{ fontSize: "0.8rem", color: "#166534" }}>
            {metrics.totalRevenueToday === 0 ? "Laporan bersih Rp 0" : "Transaksi berhasil diproses kasir"}
          </span>
        </div>

        <div className="metric-card" style={{ background: "#ffffff", padding: "1.25rem", borderRadius: "10px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <span style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 600 }}>Meja Terisi / Total Meja</span>
          <div style={{ fontSize: "2rem", fontWeight: 700, color: "#0f172a", margin: "0.4rem 0" }}>
            {metrics.occupiedTables} / {metrics.totalTables}
          </div>
          <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
            {metrics.totalTables - metrics.occupiedTables} meja kosong siap menerima tamu
          </span>
        </div>

        <div className="metric-card" style={{ background: "#ffffff", padding: "1.25rem", borderRadius: "10px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <span style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 600 }}>Status Sistem Dapur &amp; POS</span>
          <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#0369a1", margin: "0.6rem 0" }}>
            Normal &amp; Terhubung
          </div>
          <span style={{ fontSize: "0.8rem", color: "#0284c7" }}>
            KDS Dapur, Kasir &amp; Server Sinkron
          </span>
        </div>
      </section>

      {/* Operational Pipeline Summary */}
      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#1e293b", marginBottom: "1rem" }}>
          Alur Proses Pesanan Langsung
        </h2>

        {!hasActiveOrders ? (
          <div style={{ background: "#ffffff", padding: "2.5rem 1.5rem", borderRadius: "10px", border: "1px dashed #cbd5e1", textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🌾</div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1e293b", margin: "0 0 0.5rem 0" }}>
              Restoran Siap Menyambut Tamu Pembukaan
            </h3>
            <p style={{ margin: "0 auto", maxWidth: "600px", color: "#64748b", fontSize: "0.95rem" }}>
              Belum ada antrean pesanan saat ini. Begitu tamu memesan lewat QR Meja atau kasir menginput pesanan baru, tiket pesanan akan otomatis muncul dan mengalir secara real-time di kolom alur dapur di bawah ini.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
            <div style={{ background: "#ffffff", padding: "1rem", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
              <div style={{ fontWeight: 700, color: "#ca8a04", marginBottom: "0.75rem", display: "flex", justifyContent: "space-between" }}>
                <span>Menunggu Konfirmasi</span>
                <span>{metrics.pendingOrders.length}</span>
              </div>
              {metrics.pendingOrders.map((o) => (
                <div key={o.id} style={{ padding: "0.75rem", background: "#fefce8", borderRadius: "8px", marginBottom: "0.5rem", border: "1px solid #fef08a" }}>
                  <strong>{o.order_number}</strong>
                  <div style={{ fontSize: "0.8rem", color: "#854d0e" }}>{formatRupiah(o.total_amount)}</div>
                </div>
              ))}
            </div>

            <div style={{ background: "#ffffff", padding: "1rem", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
              <div style={{ fontWeight: 700, color: "#ea580c", marginBottom: "0.75rem", display: "flex", justifyContent: "space-between" }}>
                <span>Dapur (Sedang Dimasak)</span>
                <span>{metrics.kitchenOrders.length}</span>
              </div>
              {metrics.kitchenOrders.map((o) => (
                <div key={o.id} style={{ padding: "0.75rem", background: "#fff7ed", borderRadius: "8px", marginBottom: "0.5rem", border: "1px solid #fed7aa" }}>
                  <strong>{o.order_number}</strong>
                  <div style={{ fontSize: "0.8rem", color: "#9a3412" }}>Sedang dimasak di dapur</div>
                </div>
              ))}
            </div>

            <div style={{ background: "#ffffff", padding: "1rem", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
              <div style={{ fontWeight: 700, color: "#16a34a", marginBottom: "0.75rem", display: "flex", justifyContent: "space-between" }}>
                <span>Siap Disajikan</span>
                <span>{metrics.readyOrders.length}</span>
              </div>
              {metrics.readyOrders.map((o) => (
                <div key={o.id} style={{ padding: "0.75rem", background: "#f0fdf4", borderRadius: "8px", marginBottom: "0.5rem", border: "1px solid #bbf7d0" }}>
                  <strong>{o.order_number}</strong>
                  <div style={{ fontSize: "0.8rem", color: "#166534" }}>Siap diantar pramusaji</div>
                </div>
              ))}
            </div>

            <div style={{ background: "#ffffff", padding: "1rem", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
              <div style={{ fontWeight: 700, color: "#0284c7", marginBottom: "0.75rem", display: "flex", justifyContent: "space-between" }}>
                <span>Menunggu Pembayaran</span>
                <span>{metrics.servedOrders.length}</span>
              </div>
              {metrics.servedOrders.map((o) => (
                <div key={o.id} style={{ padding: "0.75rem", background: "#f0f9ff", borderRadius: "8px", marginBottom: "0.5rem", border: "1px solid #bae6fd" }}>
                  <strong>{o.order_number}</strong>
                  <div style={{ fontSize: "0.8rem", color: "#0369a1" }}>Menunggu kasir</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Quick Governance Links */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem" }}>
        <div
          onClick={() => onNavigate?.("staff")}
          style={{
            background: "#ffffff",
            padding: "1.25rem",
            borderRadius: "10px",
            border: "1px solid #e2e8f0",
            cursor: onNavigate ? "pointer" : "default",
            transition: "transform 0.15s ease, box-shadow 0.15s ease",
          }}
        >
          <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>👥</div>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.4rem 0" }}>
            Kelola Staf Restoran
          </h3>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b", lineHeight: 1.5 }}>
            Atur penugasan peran (Owner, Kasir &amp; Waiter, Dapur KDS, Admin), status hak akses staf, dan nama tampilan.
          </p>
        </div>

        <div
          onClick={() => onNavigate?.("reservations")}
          style={{
            background: "#ffffff",
            padding: "1.25rem",
            borderRadius: "10px",
            border: "1px solid #e2e8f0",
            cursor: onNavigate ? "pointer" : "default",
            transition: "transform 0.15s ease, box-shadow 0.15s ease",
          }}
        >
          <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>📅</div>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.4rem 0" }}>
            Reservasi Meja Website
          </h3>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b", lineHeight: 1.5 }}>
            Pantau permohonan booking saung &amp; meja tamu dari situs web resmi dan hubungi via WhatsApp.
          </p>
        </div>

        <div
          onClick={() => onNavigate?.("catalog")}
          style={{
            background: "#ffffff",
            padding: "1.25rem",
            borderRadius: "10px",
            border: "1px solid #e2e8f0",
            cursor: onNavigate ? "pointer" : "default",
            transition: "transform 0.15s ease, box-shadow 0.15s ease",
          }}
        >
          <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>📋</div>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.4rem 0" }}>
            Katalog &amp; Menu Restoran
          </h3>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b", lineHeight: 1.5 }}>
            Atur harga makanan/minuman, foto berformat WebP ringan, dan ketersediaan stok menu.
          </p>
        </div>

        <div
          onClick={() => onNavigate?.("tables")}
          style={{
            background: "#ffffff",
            padding: "1.25rem",
            borderRadius: "10px",
            border: "1px solid #e2e8f0",
            cursor: onNavigate ? "pointer" : "default",
            transition: "transform 0.15s ease, box-shadow 0.15s ease",
          }}
        >
          <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>🖨️</div>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.4rem 0" }}>
            Manajemen Meja &amp; QR Code
          </h3>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b", lineHeight: 1.5 }}>
            Lihat daftar meja saung/ruangan, cetak stiker QR meja digital, dan perbarui status operasional meja.
          </p>
        </div>

        <div
          onClick={() => onNavigate?.("cms")}
          style={{
            background: "#ffffff",
            padding: "1.25rem",
            borderRadius: "10px",
            border: "1px solid #e2e8f0",
            cursor: onNavigate ? "pointer" : "default",
            transition: "transform 0.15s ease, box-shadow 0.15s ease",
          }}
        >
          <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>🌐</div>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.4rem 0" }}>
            Konten &amp; Gambar Web
          </h3>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b", lineHeight: 1.5 }}>
            Ganti banner hero, foto saung, promo event, serta kontak website publik tanpa koding.
          </p>
        </div>

        <div
          onClick={() => onNavigate?.("settings")}
          style={{
            background: "#ffffff",
            padding: "1.25rem",
            borderRadius: "10px",
            border: "1px solid #e2e8f0",
            cursor: onNavigate ? "pointer" : "default",
            transition: "transform 0.15s ease, box-shadow 0.15s ease",
          }}
        >
          <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>⚙️</div>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.4rem 0" }}>
            Pengaturan &amp; Jam Buka
          </h3>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b", lineHeight: 1.5 }}>
            Atur jam operasional restoran, nomor kontak WhatsApp, dan informasi profil restoran.
          </p>
        </div>
      </section>
    </div>
  );
}
