/**
 * @tepisawah/admin — Transactions & Orders Ledger Page (Buku Transaksi & Jejak Audit).
 *
 * Implements authoritative, append-only transaction history logging from Day 1 to present.
 * Immutable audit visibility: orders + order_status_history with RLS protection.
 * Safe from edit or deletion by clients.
 */
import { useEffect, useState, useMemo, useCallback, type ReactNode } from "react";
import { useAuth } from "@tepisawah/auth";
import { getSupabaseClient } from "../../lib/supabase.js";
import { isDemoMode } from "../../lib/demo-mode.js";

export interface TransactionItem {
  id: string;
  order_number: string;
  table_id: string;
  table_name?: string;
  table_number?: number;
  source: string;
  status: string;
  notes?: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  created_at: string;
  updated_at: string;
  items?: {
    id: string;
    product_name?: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    notes?: string | null;
  }[];
}

export interface StatusHistoryItem {
  id: string;
  from_status: string | null;
  to_status: string;
  actor_id: string | null;
  actor_role: string | null;
  reason: string | null;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  PAID: { label: "Lunas / Terbayar", bg: "#ecfdf5", color: "#065f46", border: "#a7f3d0" },
  COMPLETED: { label: "Selesai", bg: "#f0fdf4", color: "#166534", border: "#bbf7d0" },
  SERVED: { label: "Disajikan", bg: "#eff6ff", color: "#1e40af", border: "#bfdbfe" },
  READY: { label: "Siap Saji", bg: "#f0fdfa", color: "#115e59", border: "#99f6e4" },
  PREPARING: { label: "Dimasak", bg: "#fff7ed", color: "#9a3412", border: "#fed7aa" },
  CONFIRMED: { label: "Terkonfirmasi", bg: "#faf5ff", color: "#6b21a8", border: "#e9d5ff" },
  PENDING_CONFIRMATION: { label: "Menunggu Konfirmasi", bg: "#fefce8", color: "#854d0e", border: "#fef08a" },
  SUBMITTED: { label: "Diajukan", bg: "#fefce8", color: "#854d0e", border: "#fef08a" },
  DRAFT: { label: "Draft", bg: "#f8fafc", color: "#475569", border: "#cbd5e1" },
  CANCELLED: { label: "Dibatalkan", bg: "#fef2f2", color: "#991b1b", border: "#fecaca" },
  REJECTED: { label: "Ditolak", bg: "#fef2f2", color: "#991b1b", border: "#fecaca" },
  REFUNDED: { label: "Refund", bg: "#fdf4ff", color: "#86198f", border: "#f5d0fe" },
};

export function TransactionsLedgerPage(): ReactNode {
  const { user } = useAuth();
  const [orders, setOrders] = useState<TransactionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [periodFilter, setPeriodFilter] = useState<"ALL" | "TODAY" | "7DAYS" | "30DAYS">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PAID" | "ACTIVE" | "CANCELLED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Order Details Modal
  const [selectedOrder, setSelectedOrder] = useState<TransactionItem | null>(null);
  const [orderHistory, setOrderHistory] = useState<StatusHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const formatRupiah = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val);

  const formatDateTime = (iso: string) => {
    try {
      return new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Jakarta",
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      if (isDemoMode()) {
        setOrders([]);
        setLoading(false);
        return;
      }

      const client = getSupabaseClient() as any;

      // 1. Fetch tables map
      const { data: tablesData } = await client
        .from("tables")
        .select("id, name, number");
      const tableMap = new Map<string, { name: string; number: number }>();
      for (const t of tablesData || []) {
        tableMap.set(t.id, { name: t.name || `Meja ${t.number}`, number: t.number });
      }

      // 2. Build query
      let query = client
        .from("orders")
        .select(`
          id,
          order_number,
          table_id,
          source,
          status,
          notes,
          subtotal,
          discount,
          tax,
          total,
          created_at,
          updated_at,
          order_items (
            id,
            product_name_snapshot,
            quantity,
            unit_price_snapshot,
            line_total,
            notes
          )
        `)
        .order("created_at", { ascending: false });

      if (periodFilter === "TODAY") {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        query = query.gte("created_at", start.toISOString());
      } else if (periodFilter === "7DAYS") {
        const start = new Date();
        start.setDate(start.getDate() - 7);
        query = query.gte("created_at", start.toISOString());
      } else if (periodFilter === "30DAYS") {
        const start = new Date();
        start.setDate(start.getDate() - 30);
        query = query.gte("created_at", start.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      const items: TransactionItem[] = (data || []).map((row: any) => {
        const tInfo = tableMap.get(row.table_id);
        return {
          id: row.id,
          order_number: row.order_number,
          table_id: row.table_id,
          table_name: tInfo?.name || "Meja Resto",
          table_number: tInfo?.number,
          source: row.source,
          status: row.status,
          notes: row.notes,
          subtotal: Number(row.subtotal) || 0,
          discount: Number(row.discount) || 0,
          tax: Number(row.tax) || 0,
          total: Number(row.total) || 0,
          created_at: row.created_at,
          updated_at: row.updated_at,
          items: Array.isArray(row.order_items)
            ? row.order_items.map((oi: any) => ({
                id: oi.id,
                product_name: oi.product_name_snapshot || oi.product_name || "Menu",
                quantity: oi.quantity || 1,
                unit_price: Number(oi.unit_price_snapshot ?? oi.unit_price) || 0,
                subtotal: Number(oi.line_total ?? oi.subtotal) || 0,
                notes: oi.notes,
              }))
            : [],
        };
      });

      setOrders(items);
    } catch (err: any) {
      console.error("Gagal memuat buku transaksi:", err);
      setErrorMsg(err.message || "Gagal menghubungi database transaksi.");
    } finally {
      setLoading(false);
    }
  }, [periodFilter]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  // Open Order Details & Fetch Status History (Audit Trail)
  async function handleOpenDetails(order: TransactionItem) {
    setSelectedOrder(order);
    setLoadingHistory(true);
    setOrderHistory([]);
    try {
      const client = getSupabaseClient() as any;
      const { data, error } = await client
        .from("order_status_history")
        .select("id, from_status, to_status, actor_id, actor_role, reason, created_at")
        .eq("order_id", order.id)
        .order("created_at", { ascending: true });

      if (error) {
        console.warn("Gagal memuat status history:", error);
      } else {
        setOrderHistory(data || []);
      }
    } catch (err) {
      console.warn("Error order history:", err);
    } finally {
      setLoadingHistory(false);
    }
  }

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Status filter
      if (statusFilter === "PAID" && o.status !== "PAID" && o.status !== "COMPLETED") return false;
      if (
        statusFilter === "ACTIVE" &&
        !["CONFIRMED", "PREPARING", "READY", "SERVED", "PENDING_CONFIRMATION", "SUBMITTED"].includes(o.status)
      ) {
        return false;
      }
      if (statusFilter === "CANCELLED" && !["CANCELLED", "REJECTED", "REFUNDED"].includes(o.status)) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNum = o.order_number.toLowerCase().includes(q);
        const matchTable = (o.table_name || "").toLowerCase().includes(q);
        const matchNotes = (o.notes || "").toLowerCase().includes(q);
        if (!matchNum && !matchTable && !matchNotes) return false;
      }

      return true;
    });
  }, [orders, statusFilter, searchQuery]);

  // Metrics
  const stats = useMemo(() => {
    const totalTransactions = orders.length;
    const paidOrders = orders.filter((o) => o.status === "PAID" || o.status === "COMPLETED");
    const activeOrders = orders.filter((o) =>
      ["CONFIRMED", "PREPARING", "READY", "SERVED", "PENDING_CONFIRMATION", "SUBMITTED"].includes(o.status)
    );
    const cancelledOrders = orders.filter((o) => ["CANCELLED", "REJECTED", "REFUNDED"].includes(o.status));

    const totalRevenue = paidOrders.reduce((acc, o) => acc + o.total, 0);

    return {
      totalTransactions,
      paidCount: paidOrders.length,
      activeCount: activeOrders.length,
      cancelledCount: cancelledOrders.length,
      totalRevenue,
    };
  }, [orders]);

  return (
    <div className="ledger-page" style={{ padding: "1.5rem", maxWidth: "1280px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.25rem" }}>
        <div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 700, margin: "0 0 0.35rem 0", color: "#0f172a" }}>
            💰 Buku Transaksi &amp; Jejak Audit (Ledger)
          </h1>
          <p style={{ margin: 0, color: "#64748b", fontSize: "0.95rem" }}>
            Pencatatan resmi seluruh transaksi resto dari pembukaan pertama hingga sekarang. Terkoneksi ke basis data PostgreSQL permanen.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button
            type="button"
            onClick={() => void loadTransactions()}
            disabled={loading}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              fontWeight: 600,
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            {loading ? "Memuat…" : "🔄 Segarkan Data"}
          </button>
        </div>
      </div>

      {/* Security & Immutability Notice */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          padding: "0.85rem 1rem",
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: "8px",
          color: "#166534",
          fontSize: "0.875rem",
          marginBottom: "1.5rem",
        }}
      >
        <span style={{ fontSize: "1.25rem" }} aria-hidden="true">🔒</span>
        <div>
          <strong>Sistem Pencatatan Transaksi Terlindungi (Append-Only Audit):</strong> Semua pesanan, mutasi status, dan pembayaran dihitung langsung dari katalog resmi dan disimpan permanen di database PostgreSQL. Dilindungi aturan RLS sehingga transaksi sah tidak dapat diedit atau dihapus sembarangan oleh siapapun.
        </div>
      </div>

      {/* Metrics Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ background: "#ffffff", padding: "1.25rem", borderRadius: "10px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 600 }}>Total Omset Terbayar</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "#15803d", marginTop: "0.25rem" }}>
            {formatRupiah(stats.totalRevenue)}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.25rem" }}>
            Dari {stats.paidCount} transaksi lunas
          </div>
        </div>

        <div style={{ background: "#ffffff", padding: "1.25rem", borderRadius: "10px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 600 }}>Total Pesanan Masuk</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "#0f172a", marginTop: "0.25rem" }}>
            {stats.totalTransactions}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.25rem" }}>
            Semua transaksi terdata
          </div>
        </div>

        <div style={{ background: "#ffffff", padding: "1.25rem", borderRadius: "10px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 600 }}>Sedang Berjalan di Meja/Dapur</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "#ca8a04", marginTop: "0.25rem" }}>
            {stats.activeCount}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.25rem" }}>
            Pesanan aktif belum selesai
          </div>
        </div>

        <div style={{ background: "#ffffff", padding: "1.25rem", borderRadius: "10px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 600 }}>Dibatalkan / Void</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "#dc2626", marginTop: "0.25rem" }}>
            {stats.cancelledCount}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.25rem" }}>
            Pesanan batal berjejak audit
          </div>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div
        style={{
          background: "#ffffff",
          padding: "1rem",
          borderRadius: "10px",
          border: "1px solid #e2e8f0",
          marginBottom: "1.25rem",
          display: "flex",
          flexWrap: "wrap",
          gap: "1rem",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Period Tabs */}
        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
          {[
            { key: "ALL", label: "Semua Waktu" },
            { key: "TODAY", label: "Hari Ini" },
            { key: "7DAYS", label: "7 Hari Terakhir" },
            { key: "30DAYS", label: "30 Hari Terakhir" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setPeriodFilter(tab.key as any)}
              style={{
                padding: "0.4rem 0.85rem",
                borderRadius: "6px",
                border: "1px solid",
                borderColor: periodFilter === tab.key ? "#166534" : "#e2e8f0",
                background: periodFilter === tab.key ? "#15803d" : "#f8fafc",
                color: periodFilter === tab.key ? "#ffffff" : "#475569",
                fontWeight: 600,
                fontSize: "0.825rem",
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Status Filter Tabs */}
        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
          {[
            { key: "ALL", label: "Semua Status" },
            { key: "PAID", label: "Lunas (PAID)" },
            { key: "ACTIVE", label: "Aktif / Berjalan" },
            { key: "CANCELLED", label: "Batal / Refund" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key as any)}
              style={{
                padding: "0.4rem 0.85rem",
                borderRadius: "6px",
                border: "1px solid",
                borderColor: statusFilter === tab.key ? "#0f172a" : "#e2e8f0",
                background: statusFilter === tab.key ? "#0f172a" : "#f8fafc",
                color: statusFilter === tab.key ? "#ffffff" : "#475569",
                fontWeight: 600,
                fontSize: "0.825rem",
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div style={{ minWidth: "240px", flex: "1 1 240px" }}>
          <input
            type="text"
            placeholder="Cari nomor transaksi, meja, atau catatan…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "0.45rem 0.75rem",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              fontSize: "0.875rem",
            }}
          />
        </div>
      </div>

      {/* Ledger Table */}
      {loading ? (
        <div style={{ padding: "3rem", textAlign: "center", background: "#ffffff", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: "1.1rem", fontWeight: 600, color: "#475569" }}>Memuat buku transaksi…</div>
        </div>
      ) : errorMsg ? (
        <div style={{ padding: "1.5rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", color: "#991b1b" }}>
          <strong>Peringatan Basis Data:</strong> {errorMsg}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div style={{ padding: "3rem", textAlign: "center", background: "#ffffff", borderRadius: "10px", border: "1px dashed #cbd5e1" }}>
          <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#334155" }}>Belum Ada Transaksi</div>
          <div style={{ fontSize: "0.9rem", color: "#64748b", marginTop: "0.35rem" }}>
            Pesanan dari pelanggan (QR Meja), kasir, maupun pelayan akan tercatat di sini secara otomatis.
          </div>
        </div>
      ) : (
        <div style={{ background: "#ffffff", borderRadius: "10px", border: "1px solid #e2e8f0", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569" }}>
                <th style={{ padding: "0.85rem 1rem", fontWeight: 600 }}>No. Pesanan &amp; Waktu</th>
                <th style={{ padding: "0.85rem 1rem", fontWeight: 600 }}>Meja &amp; Sumber</th>
                <th style={{ padding: "0.85rem 1rem", fontWeight: 600 }}>Jumlah Menu</th>
                <th style={{ padding: "0.85rem 1rem", fontWeight: 600 }}>Total Nilai</th>
                <th style={{ padding: "0.85rem 1rem", fontWeight: 600 }}>Status Transaksi</th>
                <th style={{ padding: "0.85rem 1rem", fontWeight: 600, textAlign: "right" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((o) => {
                const sConf = STATUS_CONFIG[o.status] || {
                  label: o.status,
                  bg: "#f1f5f9",
                  color: "#334155",
                  border: "#cbd5e1",
                };
                const totalItemsCount = (o.items || []).reduce((acc, it) => acc + it.quantity, 0);

                return (
                  <tr key={o.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "0.85rem 1rem" }}>
                      <div style={{ fontWeight: 700, color: "#0f172a" }}>{o.order_number}</div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.15rem" }}>
                        {formatDateTime(o.created_at)}
                      </div>
                    </td>

                    <td style={{ padding: "0.85rem 1rem" }}>
                      <div style={{ fontWeight: 600, color: "#334155" }}>{o.table_name}</div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                        {o.source === "CUSTOMER_QR" ? "📱 QR Meja" : o.source === "POS" ? "🖥️ Kasir POS" : "🧑‍🍳 Pelayan"}
                      </div>
                    </td>

                    <td style={{ padding: "0.85rem 1rem" }}>
                      <span style={{ fontWeight: 600 }}>{totalItemsCount} item</span>
                      <div style={{ fontSize: "0.75rem", color: "#64748b", maxWidth: "200px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {(o.items || []).map((it) => `${it.quantity}x ${it.product_name}`).join(", ")}
                      </div>
                    </td>

                    <td style={{ padding: "0.85rem 1rem" }}>
                      <div style={{ fontWeight: 700, color: "#0f172a" }}>{formatRupiah(o.total)}</div>
                      <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                        Subtotal: {formatRupiah(o.subtotal)}
                      </div>
                    </td>

                    <td style={{ padding: "0.85rem 1rem" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "0.25rem 0.65rem",
                          borderRadius: "9999px",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          background: sConf.bg,
                          color: sConf.color,
                          border: `1px solid ${sConf.border}`,
                        }}
                      >
                        {sConf.label}
                      </span>
                    </td>

                    <td style={{ padding: "0.85rem 1rem", textAlign: "right" }}>
                      <button
                        type="button"
                        onClick={() => void handleOpenDetails(o)}
                        style={{
                          padding: "0.35rem 0.75rem",
                          borderRadius: "6px",
                          border: "1px solid #cbd5e1",
                          background: "#ffffff",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          color: "#0f172a",
                          cursor: "pointer",
                        }}
                      >
                        Detail &amp; Audit Trail
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Order Details & Audit Trail Modal */}
      {selectedOrder && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            zIndex: 1000,
          }}
          onClick={() => setSelectedOrder(null)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "12px",
              maxWidth: "680px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
              padding: "1.5rem",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem", borderBottom: "1px solid #e2e8f0", paddingBottom: "0.75rem" }}>
              <div>
                <h2 style={{ fontSize: "1.3rem", fontWeight: 700, margin: 0, color: "#0f172a" }}>
                  Rincian Transaksi: {selectedOrder.order_number}
                </h2>
                <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "0.25rem" }}>
                  {selectedOrder.table_name} • Dibuat: {formatDateTime(selectedOrder.created_at)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: "1.25rem",
                  cursor: "pointer",
                  color: "#64748b",
                }}
              >
                ✕
              </button>
            </div>

            {/* Items Breakdown */}
            <div style={{ marginBottom: "1.25rem" }}>
              <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: "0.5rem", color: "#334155" }}>
                Menu yang Dipesan
              </div>
              <div style={{ background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
                {(selectedOrder.items || []).map((it, idx) => (
                  <div
                    key={it.id || idx}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "0.65rem 0.85rem",
                      borderBottom: idx === (selectedOrder.items?.length || 0) - 1 ? "none" : "1px solid #e2e8f0",
                      fontSize: "0.875rem",
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 600 }}>{it.quantity}x {it.product_name}</span>
                      {it.notes && (
                        <div style={{ fontSize: "0.75rem", color: "#64748b", fontStyle: "italic" }}>
                          Catatan: {it.notes}
                        </div>
                      )}
                    </div>
                    <div style={{ fontWeight: 600 }}>{formatRupiah(it.subtotal)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Summary */}
            <div style={{ background: "#f8fafc", padding: "0.85rem", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "1.25rem", fontSize: "0.875rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                <span style={{ color: "#64748b" }}>Subtotal:</span>
                <span>{formatRupiah(selectedOrder.subtotal)}</span>
              </div>
              {selectedOrder.discount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem", color: "#15803d" }}>
                  <span>Diskon:</span>
                  <span>- {formatRupiah(selectedOrder.discount)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                <span style={{ color: "#64748b" }}>Pajak Restoran (PB1):</span>
                <span>{formatRupiah(selectedOrder.tax)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.5rem", paddingTop: "0.5rem", borderTop: "1px solid #cbd5e1", fontWeight: 700, fontSize: "1.05rem", color: "#0f172a" }}>
                <span>Total Akhir:</span>
                <span>{formatRupiah(selectedOrder.total)}</span>
              </div>
            </div>

            {/* Immutable Audit Trail Timeline */}
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: "0.5rem", color: "#334155", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span>📜 Jejak Audit Siklus Transaksi (Immutable Audit Trail)</span>
              </div>

              {loadingHistory ? (
                <div style={{ padding: "1rem", textAlign: "center", color: "#64748b", fontSize: "0.85rem" }}>
                  Memuat riwayat perubahan status…
                </div>
              ) : orderHistory.length === 0 ? (
                <div style={{ padding: "0.75rem", background: "#f8fafc", borderRadius: "6px", color: "#64748b", fontSize: "0.85rem" }}>
                  Jejak status awal: Terdaftar di sistem pada {formatDateTime(selectedOrder.created_at)}.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {orderHistory.map((h, i) => (
                    <div
                      key={h.id || i}
                      style={{
                        padding: "0.65rem 0.85rem",
                        background: "#ffffff",
                        borderRadius: "6px",
                        border: "1px solid #e2e8f0",
                        fontSize: "0.825rem",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, color: "#0f172a" }}>
                          Status diubah menjadi: <span style={{ color: "#166534" }}>{h.to_status}</span>
                          {h.from_status && <span style={{ color: "#64748b", fontWeight: 400 }}> (sebelumnya: {h.from_status})</span>}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.15rem" }}>
                          Oleh Peran: <strong>{h.actor_role || "Sistem"}</strong>
                          {h.reason && ` • Alasan: "${h.reason}"`}
                        </div>
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#94a3b8", whiteSpace: "nowrap" }}>
                        {formatDateTime(h.created_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ marginTop: "1.5rem", textAlign: "right" }}>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                style={{
                  padding: "0.5rem 1.25rem",
                  background: "#0f172a",
                  color: "#ffffff",
                  borderRadius: "6px",
                  border: "none",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  cursor: "pointer",
                }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
