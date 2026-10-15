/**
 * @tepisawah/admin — Table Reservations Management.
 *
 * Displays bookings submitted by guests from the public website (apps/web).
 * Allows staff and owners to confirm, contact via WhatsApp, or cancel reservations.
 */
import { useEffect, useState, useMemo, type ReactNode } from "react";
import { getSupabaseClient } from "../../lib/supabase.js";
import { isDemoMode } from "../../lib/demo-mode.js";

export interface ReservationItem {
  id: string;
  customer_name: string;
  phone: string;
  reservation_date: string;
  reservation_time: string;
  guests_count: number;
  seating_area: string;
  notes: string | null;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
  created_at: string;
}

const STORAGE_KEY_DEMO_RESERVATIONS = "tepisawah_demo_reservations";

const INITIAL_DEMO_RESERVATIONS: ReservationItem[] = [
  {
    id: "res-demo-1",
    customer_name: "Bapak Hendra Wijaya",
    phone: "081234567890",
    reservation_date: new Date().toISOString().slice(0, 10),
    reservation_time: "12:30",
    guests_count: 6,
    seating_area: "Saung Lesehan Sawah",
    notes: "Minta saung di ujung yang menghadap langsung sawah terbuka.",
    status: "PENDING",
    created_at: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
  },
  {
    id: "res-demo-2",
    customer_name: "Ibu Ratna Dewi",
    phone: "085712345678",
    reservation_date: new Date().toISOString().slice(0, 10),
    reservation_time: "18:00",
    guests_count: 10,
    seating_area: "Gazebo Rombongan",
    notes: "Acara ulang tahun keluarga, mohon disiapkan kursi anak 2 buah.",
    status: "CONFIRMED",
    created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
  },
  {
    id: "res-demo-3",
    customer_name: "Mas Dimas Pratama",
    phone: "089876543210",
    reservation_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    reservation_time: "16:30",
    guests_count: 4,
    seating_area: "Dek Rooftop Senja",
    notes: "Rencana santap sambil menikmati matahari terbenam.",
    status: "CONFIRMED",
    created_at: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
  },
];

export function ReservationsPage(): ReactNode {
  const [items, setItems] = useState<ReservationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  function loadDemoData(): ReservationItem[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_DEMO_RESERVATIONS);
      if (stored) {
        return JSON.parse(stored) as ReservationItem[];
      }
    } catch {
      // fallback
    }
    return INITIAL_DEMO_RESERVATIONS;
  }

  function saveDemoData(data: ReservationItem[]) {
    try {
      localStorage.setItem(STORAGE_KEY_DEMO_RESERVATIONS, JSON.stringify(data));
    } catch {
      // fallback
    }
  }

  async function fetchReservations() {
    setLoading(true);
    try {
      if (isDemoMode()) {
        setItems(loadDemoData());
        setLoading(false);
        return;
      }

      const client = getSupabaseClient() as any;
      const { data, error } = await client
        .from("reservations")
        .select("*")
        .order("reservation_date", { ascending: false })
        .order("reservation_time", { ascending: true });

      if (error || !data || data.length === 0) {
        // Fallback to demo/local data if table is empty or error
        setItems(loadDemoData());
      } else {
        setItems(data as unknown as ReservationItem[]);
      }
    } catch {
      setItems(loadDemoData());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchReservations();
  }, []);

  async function updateStatus(id: string, newStatus: ReservationItem["status"]) {
    setUpdatingId(id);
    try {
      if (!isDemoMode()) {
        const client = getSupabaseClient() as any;
        await client
          .from("reservations")
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq("id", id);
      }

      setItems((prev) => {
        const updated = prev.map((item) =>
          item.id === id ? { ...item, status: newStatus } : item
        );
        saveDemoData(updated);
        return updated;
      });
    } catch (err) {
      console.error("Gagal memperbarui status reservasi:", err);
    } finally {
      setUpdatingId(null);
    }
  }

  function handleOpenWhatsApp(item: ReservationItem) {
    let cleanPhone = item.phone.replace(/\D/g, "");
    if (cleanPhone.startsWith("0")) {
      cleanPhone = "62" + cleanPhone.slice(1);
    }

    const message = encodeURIComponent(
      `Halo Bapak/Ibu ${item.customer_name},\n\n` +
      `Kami dari *Tepi Sawah Resto & Cafe (Ciperna)* ingin mengonfirmasi permohonan reservasi meja Anda:\n` +
      `📅 *Tanggal:* ${item.reservation_date}\n` +
      `⏰ *Jam:* ${item.reservation_time} WIB\n` +
      `👥 *Jumlah Tamu:* ${item.guests_count} Orang\n` +
      `📍 *Area Pilihan:* ${item.seating_area}\n` +
      (item.notes ? `📝 *Catatan Khusus:* ${item.notes}\n\n` : `\n`) +
      `Reservasi Anda saat ini berstatus: *${item.status === "CONFIRMED" ? "SUDAH DIKONFIRMASI" : "SEDANG KAMI PROSES"}*.\n` +
      `Apakah ada kebutuhan menu atau preferensi tambahan yang ingin disiapkan lebih awal? Kami siap menyambut kedatangan Anda!`
    );

    window.open(`https://wa.me/${cleanPhone}?text=${message}`, "_blank", "noopener,noreferrer");
  }

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchStatus = filterStatus === "ALL" || item.status === filterStatus;
      const matchSearch =
        searchTerm.trim() === "" ||
        item.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.phone.includes(searchTerm) ||
        item.seating_area.toLowerCase().includes(searchTerm.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [items, filterStatus, searchTerm]);

  const stats = useMemo(() => {
    const total = items.length;
    const pending = items.filter((i) => i.status === "PENDING").length;
    const confirmed = items.filter((i) => i.status === "CONFIRMED").length;
    const guests = items.reduce((acc, i) => acc + (i.status !== "CANCELLED" ? i.guests_count : 0), 0);
    return { total, pending, confirmed, guests };
  }, [items]);

  return (
    <div style={{ padding: "1.5rem", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ margin: "0 0 0.5rem 0", fontSize: "1.6rem", fontWeight: 700, color: "var(--color-text, #1e293b)" }}>
            📅 Manajemen Reservasi Meja (Website)
          </h1>
          <p style={{ margin: 0, color: "var(--color-text-muted, #64748b)", fontSize: "0.95rem" }}>
            Daftar permohonan reservasi tamu yang masuk melalui portal publik web Tepi Sawah.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchReservations()}
          disabled={loading}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.5rem 1rem",
            borderRadius: "8px",
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            cursor: "pointer",
            fontWeight: 500,
            fontSize: "0.9rem",
          }}
        >
          🔄 {loading ? "Memuat..." : "Segarkan Data"}
        </button>
      </div>

      {/* Metrics Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        <div style={{ background: "#ffffff", padding: "1rem", borderRadius: "10px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 500 }}>Total Reservasi</div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "#0f172a", marginTop: "0.25rem" }}>{stats.total}</div>
        </div>
        <div style={{ background: "#fefce8", padding: "1rem", borderRadius: "10px", border: "1px solid #fef08a", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize: "0.85rem", color: "#854d0e", fontWeight: 600 }}>Menunggu Konfirmasi</div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "#ca8a04", marginTop: "0.25rem" }}>{stats.pending}</div>
        </div>
        <div style={{ background: "#f0fdf4", padding: "1rem", borderRadius: "10px", border: "1px solid #bbf7d0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize: "0.85rem", color: "#166534", fontWeight: 600 }}>Terkonfirmasi</div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "#16a34a", marginTop: "0.25rem" }}>{stats.confirmed}</div>
        </div>
        <div style={{ background: "#f8fafc", padding: "1rem", borderRadius: "10px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize: "0.85rem", color: "#475569", fontWeight: 500 }}>Total Estimasi Tamu</div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "#334155", marginTop: "0.25rem" }}>{stats.guests} orang</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ background: "#ffffff", padding: "1rem", borderRadius: "10px", border: "1px solid #e2e8f0", marginBottom: "1.5rem", display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {[
            { key: "ALL", label: "Semua" },
            { key: "PENDING", label: "Menunggu (Pending)" },
            { key: "CONFIRMED", label: "Terkonfirmasi" },
            { key: "COMPLETED", label: "Selesai" },
            { key: "CANCELLED", label: "Batal" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilterStatus(tab.key)}
              style={{
                padding: "0.4rem 0.85rem",
                borderRadius: "6px",
                border: "1px solid",
                borderColor: filterStatus === tab.key ? "#15803d" : "#e2e8f0",
                background: filterStatus === tab.key ? "#15803d" : "#f8fafc",
                color: filterStatus === tab.key ? "#ffffff" : "#475569",
                fontWeight: filterStatus === tab.key ? 600 : 500,
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ minWidth: "260px" }}>
          <input
            type="text"
            placeholder="Cari nama, telp, atau saung..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: "100%",
              padding: "0.5rem 0.85rem",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              fontSize: "0.9rem",
              outline: "none",
            }}
          />
        </div>
      </div>

      {/* Reservations Table / Cards */}
      {loading ? (
        <div style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>
          Memuat daftar reservasi...
        </div>
      ) : filteredItems.length === 0 ? (
        <div style={{ padding: "3rem", textAlign: "center", background: "#ffffff", borderRadius: "10px", border: "1px dashed #cbd5e1" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📭</div>
          <div style={{ fontWeight: 600, color: "#334155" }}>Tidak ada data reservasi</div>
          <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "0.25rem" }}>
            Tidak ada reservasi yang cocok dengan filter yang dipilih.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {filteredItems.map((item) => {
            const isPending = item.status === "PENDING";
            const isConfirmed = item.status === "CONFIRMED";
            const isBusy = updatingId === item.id;

            return (
              <div
                key={item.id}
                style={{
                  background: "#ffffff",
                  borderRadius: "10px",
                  border: "1px solid #e2e8f0",
                  padding: "1.25rem",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                {/* Top Row: Customer Info & Status Badge */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "#0f172a" }}>
                        {item.customer_name}
                      </span>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          padding: "0.15rem 0.5rem",
                          borderRadius: "4px",
                          background:
                            item.status === "CONFIRMED"
                              ? "#dcfce7"
                              : item.status === "PENDING"
                              ? "#fef9c3"
                              : item.status === "COMPLETED"
                              ? "#e0e7ff"
                              : "#f1f5f9",
                          color:
                            item.status === "CONFIRMED"
                              ? "#15803d"
                              : item.status === "PENDING"
                              ? "#a16207"
                              : item.status === "COMPLETED"
                              ? "#4338ca"
                              : "#64748b",
                        }}
                      >
                        {item.status === "CONFIRMED"
                          ? "TERKONFIRMASI"
                          : item.status === "PENDING"
                          ? "MENUNGGU KONFIRMASI"
                          : item.status === "COMPLETED"
                          ? "SELESAI"
                          : "DIBATALKAN"}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "0.2rem" }}>
                      📞 {item.phone} &bull; Masuk: {new Date(item.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} WIB
                    </div>
                  </div>

                  {/* Booking Details Pills */}
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "6px", padding: "0.25rem 0.6rem", fontSize: "0.85rem", fontWeight: 600, color: "#334155" }}>
                      📅 {item.reservation_date}
                    </span>
                    <span style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "6px", padding: "0.25rem 0.6rem", fontSize: "0.85rem", fontWeight: 600, color: "#334155" }}>
                      ⏰ {item.reservation_time} WIB
                    </span>
                    <span style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: "6px", padding: "0.25rem 0.6rem", fontSize: "0.85rem", fontWeight: 600, color: "#065f46" }}>
                      👥 {item.guests_count} Orang
                    </span>
                    <span style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: "6px", padding: "0.25rem 0.6rem", fontSize: "0.85rem", fontWeight: 600, color: "#92400e" }}>
                      🏡 {item.seating_area}
                    </span>
                  </div>
                </div>

                {/* Notes if any */}
                {item.notes && (
                  <div style={{ background: "#f8fafc", padding: "0.6rem 0.85rem", borderRadius: "6px", borderLeft: "3px solid #15803d", fontSize: "0.85rem", color: "#334155" }}>
                    <strong>Catatan Tamu:</strong> {item.notes}
                  </div>
                )}

                {/* Bottom Row: Actions */}
                <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.25rem", paddingTop: "0.75rem", borderTop: "1px solid #f1f5f9" }}>
                  <button
                    type="button"
                    onClick={() => handleOpenWhatsApp(item)}
                    style={{
                      background: "#25D366",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "6px",
                      padding: "0.45rem 0.9rem",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.35rem",
                    }}
                  >
                    💬 WhatsApp Tamu
                  </button>

                  {isPending && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void updateStatus(item.id, "CONFIRMED")}
                      style={{
                        background: "#15803d",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: "6px",
                        padding: "0.45rem 0.9rem",
                        fontWeight: 600,
                        fontSize: "0.85rem",
                        cursor: "pointer",
                      }}
                    >
                      ✓ Konfirmasi Reservasi
                    </button>
                  )}

                  {isConfirmed && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void updateStatus(item.id, "COMPLETED")}
                      style={{
                        background: "#0284c7",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: "6px",
                        padding: "0.45rem 0.9rem",
                        fontWeight: 600,
                        fontSize: "0.85rem",
                        cursor: "pointer",
                      }}
                    >
                      ✓ Tamu Sudah Hadir / Selesai
                    </button>
                  )}

                  {item.status !== "CANCELLED" && item.status !== "COMPLETED" && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void updateStatus(item.id, "CANCELLED")}
                      style={{
                        background: "#ffffff",
                        color: "#dc2626",
                        border: "1px solid #fca5a5",
                        borderRadius: "6px",
                        padding: "0.45rem 0.9rem",
                        fontWeight: 500,
                        fontSize: "0.85rem",
                        cursor: "pointer",
                      }}
                    >
                      Batalkan
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
