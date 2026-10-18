/**
 * Cash Drawer & Shift Management Modal.
 *
 * Provides complete cashier shift lifecycle:
 * 1. Buka Kasir: Opening shift with starting float (modal awal).
 * 2. Status & Rekap: Live cash balance in drawer (modal awal + penjualan tunai + kas masuk - kas keluar).
 * 3. Kas Masuk / Kas Keluar: Operational cash transactions with reason and staff logging.
 * 4. Tutup Kasir: Shift reconciliation, discrepancy calculation, and shift report printing.
 */

import { useState, useEffect, useMemo, type ReactNode } from "react";
import { Modal, Button } from "@tepisawah/ui";
import {
  type CashShift,
  type CashTransaction,
  openCashShift,
  recordCashTransaction,
  closeCashShift,
  fetchShiftTransactions,
} from "@tepisawah/database";
import { getSupabaseClient } from "../../lib/supabase.js";

export interface CashDrawerModalProps {
  open: boolean;
  onClose: () => void;
  currentShift: CashShift | null;
  cashierId: string;
  cashierName: string;
  onShiftUpdated: () => void;
}

type TabType = "summary" | "transaction" | "close";

const formatIDR = (val: number): string => {
  return "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(val));
};

export function CashDrawerModal({
  open,
  onClose,
  currentShift,
  cashierId,
  cashierName,
  onShiftUpdated,
}: CashDrawerModalProps): ReactNode {
  const [activeTab, setActiveTab] = useState<TabType>("summary");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);

  // Buka Kasir form state
  const [openShiftName, setOpenShiftName] = useState("Shift Pagi");
  const [openStartingCash, setOpenStartingCash] = useState("500000");
  const [openNotes, setOpenNotes] = useState("");

  // Kas Masuk/Keluar form state
  const [txType, setTxType] = useState<"CASH_IN" | "CASH_OUT">("CASH_OUT");
  const [txAmount, setTxAmount] = useState("");
  const [txReason, setTxReason] = useState("Beli Es Batu Tambahan");
  const [txNotes, setTxNotes] = useState("");

  // Tutup Kasir form state
  const [actualCash, setActualCash] = useState("");
  const [closingNotes, setClosingNotes] = useState("");

  // Pilihan Waktu Rekap & Printer Thermal (Bukan Screenshot)
  const [rekapPeriod, setRekapPeriod] = useState<"session" | "today" | "morning" | "afternoon">("session");
  const [rekapPaperWidth, setRekapPaperWidth] = useState<"80mm" | "58mm">("80mm");
  const [showThermalPreview, setShowThermalPreview] = useState(false);

  // Load transactions when shift changes
  useEffect(() => {
    if (open && currentShift) {
      void (async () => {
        const res = await fetchShiftTransactions(getSupabaseClient(), currentShift.id);
        if (res.data) {
          setTransactions(res.data);
        }
      })();
    }
  }, [open, currentShift]);

  const handleOpenShift = async () => {
    const cash = Number.parseInt(openStartingCash.replaceAll(/[.,]/g, ""), 10);
    if (isNaN(cash) || cash < 0) {
      setError("Nominal modal awal tidak valid.");
      return;
    }
    setLoading(true);
    setError(null);
    const client = getSupabaseClient();
    const res = await openCashShift(client, {
      startingCash: cash,
      shiftName: openShiftName,
    });
    setLoading(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    onShiftUpdated();
    setActiveTab("summary");
  };

  const handleRecordTransaction = async () => {
    if (!currentShift) return;
    const amount = Number.parseInt(txAmount.replaceAll(/[.,]/g, ""), 10);
    if (isNaN(amount) || amount <= 0) {
      setError("Nominal transaksi harus lebih dari 0.");
      return;
    }
    setLoading(true);
    setError(null);
    const client = getSupabaseClient();
    const res = await recordCashTransaction(client, {
      shiftId: currentShift.id,
      type: txType,
      amount,
      reason: txNotes.trim() ? `${txReason} - ${txNotes.trim()}` : txReason,
    });
    setLoading(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    setTxAmount("");
    setTxNotes("");
    onShiftUpdated();
    // Reload transactions
    const txRes = await fetchShiftTransactions(client, currentShift.id);
    if (txRes.data) setTransactions(txRes.data);
    setActiveTab("summary");
  };

  const handleCloseShift = async () => {
    if (!currentShift) return;
    const actual = Number.parseInt(actualCash.replaceAll(/[.,]/g, ""), 10);
    if (isNaN(actual) || actual < 0) {
      setError("Nominal fisik kas di laci tidak valid.");
      return;
    }
    setLoading(true);
    setError(null);
    const client = getSupabaseClient();
    const res = await closeCashShift(client, {
      shiftId: currentShift.id,
      actualCash: actual,
      notes: closingNotes.trim() || null,
    });
    setLoading(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    onShiftUpdated();
    onClose();
  };

  const actualNum = Number.parseInt(actualCash.replaceAll(/[.,]/g, ""), 10) || 0;
  const expectedNum = currentShift?.expectedCash ?? 0;
  const difference = actualNum - expectedNum;

  const todayFormatted = useMemo(() => {
    return new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Jakarta",
    }).format(new Date());
  }, []);

  const openedAtFormatted = useMemo(() => {
    if (!currentShift) return "";
    try {
      return new Intl.DateTimeFormat("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
      }).format(new Date(currentShift.openedAt));
    } catch {
      return currentShift.openedAt;
    }
  }, [currentShift]);

  const rekapPeriodLabel = useMemo(() => {
    switch (rekapPeriod) {
      case "session":
        return `Sesi Shift Ini (${currentShift?.shiftName ?? "Aktif"})`;
      case "today":
        return "Hari Ini Penuh (00:00 - 23:59 WIB)";
      case "morning":
        return "Shift Pagi (07:00 - 15:30 WIB)";
      case "afternoon":
        return "Shift Sore (15:00 - 23:00 WIB)";
      default:
        return "Sesi Shift Ini";
    }
  }, [rekapPeriod, currentShift]);

  const handlePrintThermalRekap = (isClosing = false) => {
    document.body.classList.add("printing-thermal-rekap");
    window.print();
    window.setTimeout(() => {
      document.body.classList.remove("printing-thermal-rekap");
    }, 1500);
  };

  const renderThermalPaper = (isClosing = false) => {
    if (!currentShift) return null;
    const is58 = rekapPaperWidth === "58mm";
    return (
      <div
        className={`pos-thermal__paper ${is58 ? "pos-thermal__paper--58mm" : ""}`}
        style={{
          width: is58 ? "220px" : "300px",
          margin: "0 auto",
          padding: is58 ? "8px 6px" : "14px 12px",
          background: "#fff",
          color: "#000",
          fontFamily: "'Courier New', Courier, monospace",
          fontSize: is58 ? "9.5px" : "11px",
          lineHeight: 1.35,
          border: "1px dashed #cbd5e1",
          boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ textAlign: "center", fontWeight: "bold", fontSize: is58 ? "12px" : "14px" }}>
          TEPI SAWAH RESTO &amp; CAFE
        </div>
        <div style={{ textAlign: "center", fontSize: is58 ? "8px" : "9.5px", marginBottom: "6px" }}>
          Jl. Raya Ciperna No. 88, Cirebon
          <br />
          WA / Hotline: 0812-2200-2026
        </div>
        <div
          style={{
            textAlign: "center",
            fontWeight: 800,
            borderTop: "1px dashed #000",
            borderBottom: "1px dashed #000",
            padding: "3px 0",
            margin: "4px 0 6px",
          }}
        >
          {isClosing ? "*** LAPORAN TUTUP SHIFT (Z-REPORT) ***" : "*** REKAP KAS LACI (X-REPORT) ***"}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Tanggal:</span>
          <span>{todayFormatted}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Waktu Cetak:</span>
          <span>{new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Periode:</span>
          <span>{rekapPeriodLabel}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Shift / Kasir:</span>
          <span>{currentShift.shiftName} ({currentShift.staffName})</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Sesi Buka:</span>
          <span>{openedAtFormatted} WIB</span>
        </div>

        <div style={{ borderTop: "1px dashed #000", margin: "6px 0 4px" }} />
        <div style={{ fontWeight: "bold", marginBottom: "3px" }}>RINGKASAN FISIK LACI KAS:</div>
        
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Modal Kas Awal:</span>
          <span>{formatIDR(currentShift.startingCash)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Penjualan Tunai (+):</span>
          <span>{formatIDR(currentShift.cashSales)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Kas Masuk Ops (+):</span>
          <span>{formatIDR(currentShift.cashIn)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Kas Keluar Ops (-):</span>
          <span>{formatIDR(currentShift.cashOut)}</span>
        </div>

        <div style={{ borderTop: "1px solid #000", margin: "4px 0" }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
          <span>KAS SISTEM DI LACI:</span>
          <span>{formatIDR(currentShift.expectedCash)}</span>
        </div>

        {isClosing && actualCash && (
          <>
            <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Hitungan Riil Fisik:</span>
              <span>{formatIDR(actualNum)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
              <span>Selisih Kas:</span>
              <span>
                {difference === 0
                  ? "Rp 0 (COCOK/PAS)"
                  : difference > 0
                    ? `+${formatIDR(difference)} (LEBIH)`
                    : `-${formatIDR(Math.abs(difference))} (KURANG)`}
              </span>
            </div>
          </>
        )}

        {transactions.length > 0 && (
          <>
            <div style={{ borderTop: "1px dashed #000", margin: "6px 0 4px" }} />
            <div style={{ fontWeight: "bold", marginBottom: "3px" }}>
              RINCIAN KAS OPERASIONAL ({transactions.length}):
            </div>
            {transactions.map((t) => (
              <div key={t.id} style={{ display: "flex", justifyContent: "space-between", fontSize: is58 ? "8.5px" : "9.5px" }}>
                <span>
                  {new Date(t.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}{" "}
                  [{t.type === "CASH_IN" ? "+" : "-"}] {t.reason.length > 15 ? `${t.reason.slice(0, 14)}…` : t.reason}
                </span>
                <span>{formatIDR(t.amount)}</span>
              </div>
            ))}
          </>
        )}

        <div style={{ borderTop: "1px dashed #000", margin: "8px 0 6px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", textAlign: "center", marginTop: "12px", fontSize: is58 ? "8.5px" : "9.5px" }}>
          <div style={{ flex: 1 }}>
            <div>Kasir,</div>
            <div style={{ height: "26px" }} />
            <div>( {currentShift.staffName} )</div>
          </div>
          <div style={{ flex: 1 }}>
            <div>Supervisor,</div>
            <div style={{ height: "26px" }} />
            <div>( ____________ )</div>
          </div>
        </div>

        <div style={{ textAlign: "center", fontSize: is58 ? "8px" : "9px", marginTop: "10px", color: "#333", borderTop: "1px dashed #000", paddingTop: "4px" }}>
          * Dicetak langsung dari Terminal POS Tepi Sawah *
        </div>
      </div>
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span>💵</span>
          <span>{currentShift ? `Laci Kas & Sesi Shift (${currentShift.shiftName})` : "Buka Kasir Baru (Shift Buka)"}</span>
        </div>
      }
      description={
        currentShift
          ? `Kasir aktif: ${currentShift.staffName} • Dibuka: ${openedAtFormatted} WIB • Shift: ${currentShift.shiftName}`
          : `Tanggal: ${todayFormatted} • Masukkan modal awal kasir untuk mulai menerima pembayaran tunai di terminal.`
      }
    >
      <div style={{ padding: "0.5rem 0", color: "#1e293b" }}>
        {error && (
          <div
            style={{
              padding: "0.75rem",
              marginBottom: "1rem",
              borderRadius: "6px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#991b1b",
              fontSize: "0.85rem",
            }}
          >
            {error}
          </div>
        )}

        {/* Jika belum ada shift yang buka */}
        {!currentShift ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.85rem",
                padding: "0.75rem 1rem",
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: "8px",
                color: "#166534",
              }}
            >
              <div style={{ fontSize: "1.4rem" }}>📅</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                  Tanggal Operasional: {todayFormatted}
                </div>
                <div style={{ fontSize: "0.785rem", color: "#15803d", marginTop: "2px" }}>
                  Jam Terminal: {new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB • Pastikan uang fisik di laci dihitung sebelum shift dimulai
                </div>
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                Pilih Nama Shift
              </label>
              <select
                className="admin-form-input"
                style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                value={openShiftName}
                onChange={(e) => setOpenShiftName(e.target.value)}
              >
                <option value="Shift Pagi">Shift Pagi (07:00 - 15:30)</option>
                <option value="Shift Sore">Shift Sore (15:00 - 23:00)</option>
                <option value="Shift Weekend / Full">Shift Weekend / Full Day</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                Modal Kas Awal di Laci (Float)
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontWeight: 700, color: "#64748b" }}>Rp</span>
                <input
                  type="text"
                  className="admin-form-input"
                  style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "1.1rem", fontWeight: 700 }}
                  value={openStartingCash}
                  onChange={(e) => setOpenStartingCash(e.target.value)}
                  placeholder="500000"
                />
              </div>
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                {[200000, 300000, 500000, 1000000].map((nominal) => (
                  <button
                    key={nominal}
                    type="button"
                    onClick={() => setOpenStartingCash(String(nominal))}
                    style={{
                      padding: "4px 8px",
                      borderRadius: "4px",
                      border: "1px solid #cbd5e1",
                      background: "#f8fafc",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                    }}
                  >
                    {formatIDR(nominal)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                Catatan Buka Kasir (Opsional)
              </label>
              <input
                type="text"
                className="admin-form-input"
                style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                value={openNotes}
                onChange={(e) => setOpenNotes(e.target.value)}
                placeholder="Contoh: Pecahan 50k (6 lbr), 20k (5 lbr), 10k (10 lbr)..."
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
              <Button variant="secondary" onClick={onClose} disabled={loading}>
                Batal
              </Button>
              <Button variant="primary" onClick={handleOpenShift} loading={loading}>
                Buka Kasir Sekarang
              </Button>
            </div>
          </div>
        ) : (
          /* Jika sudah ada shift aktif */
          <div>
            {/* Tabs navigasi modal */}
            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                borderBottom: "1px solid #e2e8f0",
                paddingBottom: "0.5rem",
                marginBottom: "1rem",
              }}
            >
              <button
                type="button"
                onClick={() => setActiveTab("summary")}
                style={{
                  padding: "0.4rem 0.75rem",
                  borderRadius: "6px",
                  border: "none",
                  background: activeTab === "summary" ? "#1e293b" : "transparent",
                  color: activeTab === "summary" ? "#fff" : "#64748b",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                📊 Ringkasan Kas
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("transaction")}
                style={{
                  padding: "0.4rem 0.75rem",
                  borderRadius: "6px",
                  border: "none",
                  background: activeTab === "transaction" ? "#1e293b" : "transparent",
                  color: activeTab === "transaction" ? "#fff" : "#64748b",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                💸 Kas Masuk / Keluar
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("close")}
                style={{
                  padding: "0.4rem 0.75rem",
                  borderRadius: "6px",
                  border: "none",
                  background: activeTab === "close" ? "#b91c1c" : "transparent",
                  color: activeTab === "close" ? "#fff" : "#b91c1c",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                🔒 Tutup Kasir (End Shift)
              </button>
            </div>

            {/* Tab 1: Ringkasan Kas */}
            {activeTab === "summary" && (
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.75rem 1rem",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    marginBottom: "1rem",
                    fontSize: "0.85rem",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                  }}
                >
                  <div>
                    <div style={{ color: "#64748b", fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 600 }}>
                      Tanggal &amp; Waktu Buka Shift
                    </div>
                    <strong style={{ color: "#1e293b", fontSize: "0.95rem" }}>
                      📅 {openedAtFormatted} WIB
                    </strong>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: "#64748b", fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 600 }}>
                      Petugas Kasir
                    </div>
                    <strong style={{ color: "#183a1d", fontSize: "0.95rem" }}>
                      👤 {currentShift.staffName} ({currentShift.shiftName})
                    </strong>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                    gap: "0.75rem",
                    marginBottom: "1.25rem",
                  }}
                >
                  <div style={{ background: "#f8fafc", padding: "0.75rem", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                    <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Modal Awal</span>
                    <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#1e293b" }}>{formatIDR(currentShift.startingCash)}</div>
                  </div>
                  <div style={{ background: "#f0fdf4", padding: "0.75rem", borderRadius: "8px", border: "1px solid #bbf7d0" }}>
                    <span style={{ fontSize: "0.75rem", color: "#166534" }}>Penjualan Tunai</span>
                    <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#166534" }}>{formatIDR(currentShift.cashSales)}</div>
                  </div>
                  <div style={{ background: "#eff6ff", padding: "0.75rem", borderRadius: "8px", border: "1px solid #bfdbfe" }}>
                    <span style={{ fontSize: "0.75rem", color: "#1e40af" }}>Kas Masuk (+)</span>
                    <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#1e40af" }}>+{formatIDR(currentShift.cashIn)}</div>
                  </div>
                  <div style={{ background: "#fef2f2", padding: "0.75rem", borderRadius: "8px", border: "1px solid #fecaca" }}>
                    <span style={{ fontSize: "0.75rem", color: "#991b1b" }}>Kas Keluar (-)</span>
                    <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#991b1b" }}>-{formatIDR(currentShift.cashOut)}</div>
                  </div>
                </div>

                <div
                  className="rekap-screen-only"
                  style={{
                    padding: "1rem",
                    borderRadius: "8px",
                    background: "#0f172a",
                    color: "#fff",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "1rem",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>TOTAL KAS DI LACI (EXPECTED CASH)</div>
                    <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#38bdf8" }}>
                      {formatIDR(currentShift.expectedCash)}
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    onClick={() => handlePrintThermalRekap(false)}
                    style={{ background: "#0284c7", color: "#fff", fontWeight: 700 }}
                  >
                    🖨️ Cetak Struk Rekap
                  </Button>
                </div>

                {/* Panel Pilihan Waktu Rekap & Lebar Kertas Thermal */}
                <div
                  className="rekap-screen-only"
                  style={{
                    padding: "0.85rem 1rem",
                    borderRadius: "8px",
                    background: "#f8fafc",
                    border: "1px solid #cbd5e1",
                    marginBottom: "1.25rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem", flexWrap: "wrap", gap: "0.5rem" }}>
                    <strong style={{ fontSize: "0.85rem", color: "#1e293b", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                      ⚙️ Pengaturan Cetak Rekap Thermal
                    </strong>
                    <button
                      type="button"
                      onClick={() => setShowThermalPreview(!showThermalPreview)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#2563eb",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        textDecoration: "underline",
                      }}
                    >
                      {showThermalPreview ? "✕ Tutup Pratinjau Kertas" : "👁️ Pratinjau Kertas Struk"}
                    </button>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "0.75rem", alignItems: "flex-end" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.75rem", color: "#64748b", marginBottom: "3px", fontWeight: 600 }}>
                        Pilihan Waktu Rekap:
                      </label>
                      <select
                        className="admin-form-input"
                        style={{ width: "100%", padding: "0.4rem 0.5rem", borderRadius: "5px", border: "1px solid #cbd5e1", fontSize: "0.8rem" }}
                        value={rekapPeriod}
                        onChange={(e) => setRekapPeriod(e.target.value as any)}
                      >
                        <option value="session">Sesi Shift Ini (Aktif)</option>
                        <option value="today">Hari Ini Penuh (00:00 - 23:59 WIB)</option>
                        <option value="morning">Shift Pagi (07:00 - 15:30 WIB)</option>
                        <option value="afternoon">Shift Sore (15:00 - 23:00 WIB)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.75rem", color: "#64748b", marginBottom: "3px", fontWeight: 600 }}>
                        Ukuran Kertas Thermal:
                      </label>
                      <select
                        className="admin-form-input"
                        style={{ width: "100%", padding: "0.4rem 0.5rem", borderRadius: "5px", border: "1px solid #cbd5e1", fontSize: "0.8rem" }}
                        value={rekapPaperWidth}
                        onChange={(e) => setRekapPaperWidth(e.target.value as any)}
                      >
                        <option value="80mm">80mm (Desktop Thermal)</option>
                        <option value="58mm">58mm (Mini Bluetooth / BP-ECO58)</option>
                      </select>
                    </div>

                    <div>
                      <Button
                        variant="secondary"
                        onClick={() => handlePrintThermalRekap(false)}
                        style={{ height: "34px", fontSize: "0.8rem", padding: "0 0.85rem", whiteSpace: "nowrap" }}
                      >
                        🖨️ Cetak ({rekapPaperWidth})
                      </Button>
                    </div>
                  </div>

                  {/* Pratinjau Kertas Thermal di Layar */}
                  {showThermalPreview && (
                    <div style={{ marginTop: "1rem", padding: "0.75rem", background: "#e2e8f0", borderRadius: "6px" }}>
                      <div style={{ fontSize: "0.725rem", color: "#475569", textAlign: "center", marginBottom: "0.5rem", fontWeight: 700 }}>
                        FORMAT STRUK THERMAL ASLI (KOMPATIBEL 58MM/80MM ESC/POS • BUKAN SCREENSHOT):
                      </div>
                      {renderThermalPaper(false)}
                    </div>
                  )}
                </div>

                {/* Print area murni untuk thermal driver/browser */}
                <div
                  id="thermal-rekap-print-area"
                  className={`pos-thermal-rekap-print ${rekapPaperWidth === "58mm" ? "pos-thermal-rekap-print--58mm" : ""}`}
                  style={{ display: showThermalPreview ? "none" : "none" }}
                >
                  {renderThermalPaper(false)}
                </div>

                {/* Riwayat Kas Operasional */}
                <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.9rem", color: "#334155" }}>
                  Catatan Kas Masuk / Keluar Shift Ini:
                </h4>
                {transactions.length === 0 ? (
                  <p style={{ fontSize: "0.8rem", color: "#64748b", margin: 0 }}>Belum ada pengeluaran/pemasukan kas operasional pada shift ini.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "160px", overflowY: "auto" }}>
                    {transactions.map((t) => (
                      <div
                        key={t.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "0.5rem 0.75rem",
                          borderRadius: "6px",
                          background: t.type === "CASH_IN" ? "#f0fdf4" : "#fef2f2",
                          border: t.type === "CASH_IN" ? "1px solid #bbf7d0" : "1px solid #fecaca",
                          fontSize: "0.8rem",
                        }}
                      >
                        <div>
                          <strong>{t.type === "CASH_IN" ? "🟢 [Masuk] " : "🔴 [Keluar] "} {t.reason}</strong>
                          <div style={{ color: "#64748b", fontSize: "0.725rem", marginTop: "2px" }}>
                            📅 {new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date(t.createdAt))} WIB
                          </div>
                        </div>
                        <span style={{ fontWeight: 700, color: t.type === "CASH_IN" ? "#166534" : "#991b1b" }}>
                          {t.type === "CASH_IN" ? "+" : "-"}{formatIDR(t.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Kas Masuk / Keluar */}
            {activeTab === "transaction" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                    Tipe Transaksi
                  </label>
                  <div style={{ display: "flex", gap: "0.75rem" }}>
                    <label
                      style={{
                        flex: 1,
                        padding: "0.6rem",
                        borderRadius: "6px",
                        border: txType === "CASH_OUT" ? "2px solid #b91c1c" : "1px solid #cbd5e1",
                        background: txType === "CASH_OUT" ? "#fef2f2" : "#fff",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="radio"
                        name="txType"
                        checked={txType === "CASH_OUT"}
                        onChange={() => {
                          setTxType("CASH_OUT");
                          setTxReason("Beli Es Batu Tambahan");
                        }}
                      />
                      <strong style={{ color: "#991b1b", fontSize: "0.85rem" }}>🔴 Kas Keluar (Pengeluaran)</strong>
                    </label>

                    <label
                      style={{
                        flex: 1,
                        padding: "0.6rem",
                        borderRadius: "6px",
                        border: txType === "CASH_IN" ? "2px solid #059669" : "1px solid #cbd5e1",
                        background: txType === "CASH_IN" ? "#f0fdf4" : "#fff",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="radio"
                        name="txType"
                        checked={txType === "CASH_IN"}
                        onChange={() => {
                          setTxType("CASH_IN");
                          setTxReason("Tambah Modal Kembalian");
                        }}
                      />
                      <strong style={{ color: "#065f46", fontSize: "0.85rem" }}>🟢 Kas Masuk (Pemasukan)</strong>
                    </label>
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                    Nominal Transaksi (Rp)
                  </label>
                  <input
                    type="text"
                    className="admin-form-input"
                    style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "1.1rem", fontWeight: 700 }}
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    placeholder="Contoh: 25000"
                  />
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                    {[10000, 20000, 50000, 100000, 200000, 500000].map((nominal) => (
                      <button
                        key={nominal}
                        type="button"
                        onClick={() => setTxAmount(String(nominal))}
                        style={{
                          padding: "4px 8px",
                          borderRadius: "4px",
                          border: "1px solid #cbd5e1",
                          background: "#f8fafc",
                          fontSize: "0.75rem",
                          cursor: "pointer",
                        }}
                      >
                        {formatIDR(nominal)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                    Alasan / Kategori Operasional
                  </label>
                  <select
                    className="admin-form-input"
                    style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                    value={txReason}
                    onChange={(e) => setTxReason(e.target.value)}
                  >
                    {txType === "CASH_OUT" ? (
                      <>
                        <option value="Beli Es Batu Tambahan">Beli Es Batu Tambahan</option>
                        <option value="Beli ATK / Kertas Struk Kasir">Beli ATK / Kertas Struk Kasir</option>
                        <option value="Beli Gas LPG Operasional">Beli Gas LPG Operasional</option>
                        <option value="Beli Bumbu / Bahan Segar Dapur Darurat">Beli Bumbu / Bahan Segar Dapur Darurat</option>
                        <option value="Operasional Galon Air Minum">Operasional Galon Air Minum</option>
                        <option value="Pengeluaran Lainnya">Pengeluaran Lainnya</option>
                      </>
                    ) : (
                      <>
                        <option value="Tambah Modal Kembalian Kasir">Tambah Modal Kembalian Kasir</option>
                        <option value="Tukar Uang Pecahan Kecil">Tukar Uang Pecahan Kecil</option>
                        <option value="Titipan Kas Dari Supervisor/Owner">Titipan Kas Dari Supervisor/Owner</option>
                        <option value="Pemasukan Lainnya">Pemasukan Lainnya</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                    Keterangan Tambahan (Opsional)
                  </label>
                  <input
                    type="text"
                    className="admin-form-input"
                    style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                    value={txNotes}
                    onChange={(e) => setTxNotes(e.target.value)}
                    placeholder="Contoh: 3 bal es batu kristal via warung sebelah..."
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <Button variant="secondary" onClick={() => setActiveTab("summary")}>
                    Kembali
                  </Button>
                  <Button variant="primary" onClick={handleRecordTransaction} loading={loading}>
                    Simpan Transaksi Kas
                  </Button>
                </div>
              </div>
            )}

            {/* Tab 3: Tutup Kasir */}
            {activeTab === "close" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div style={{ background: "#fffbeb", padding: "0.75rem", borderRadius: "8px", border: "1px solid #fde68a", fontSize: "0.8rem", color: "#92400e" }}>
                  ⚠️ <strong>Prosedur Tutup Shift:</strong> Hitung seluruh uang kertas & koin fisik yang ada di dalam laci kasir, lalu masukkan nominalnya di bawah ini untuk mencocokkan dengan catatan sistem.
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.65rem 0.85rem",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    fontSize: "0.825rem",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                  }}
                >
                  <div>
                    <span style={{ color: "#64748b" }}>Tanggal Tutup: </span>
                    <strong style={{ color: "#1e293b" }}>📅 {todayFormatted}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748b" }}>Shift Dibuka: </span>
                    <strong style={{ color: "#166534" }}>{openedAtFormatted} WIB</strong>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem", background: "#f8fafc", borderRadius: "6px" }}>
                  <span style={{ fontSize: "0.85rem", color: "#64748b" }}>Kas Seharusnya di Laci (Sistem):</span>
                  <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1e293b" }}>{formatIDR(expectedNum)}</span>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                    Hitungan Uang Fisik Riil di Laci (Actual Cash)
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontWeight: 700, color: "#64748b" }}>Rp</span>
                    <input
                      type="text"
                      className="admin-form-input"
                      style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "1.2rem", fontWeight: 700 }}
                      value={actualCash}
                      onChange={(e) => setActualCash(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Indikator Selisih */}
                {actualCash && (
                  <div
                    style={{
                      padding: "0.75rem",
                      borderRadius: "6px",
                      background: difference === 0 ? "#f0fdf4" : difference > 0 ? "#fffbeb" : "#fef2f2",
                      border: difference === 0 ? "1px solid #bbf7d0" : difference > 0 ? "1px solid #fde68a" : "1px solid #fecaca",
                      fontSize: "0.85rem",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span>
                      {difference === 0
                        ? "🟢 Kas Pas (Cocok Sempurna)"
                        : difference > 0
                          ? "🟡 Lebih Kas (Kelebihan Fisik)"
                          : "🔴 Kurang Kas (Kekurangan Fisik)"}
                    </span>
                    <strong
                      style={{
                        color: difference === 0 ? "#166534" : difference > 0 ? "#b45309" : "#b91c1c",
                        fontSize: "1.05rem",
                      }}
                    >
                      {difference > 0 ? `+${formatIDR(difference)}` : formatIDR(difference)}
                    </strong>
                  </div>
                )}

                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                    Catatan Penutupan Kasir (Opsional)
                  </label>
                  <input
                    type="text"
                    className="admin-form-input"
                    style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                    value={closingNotes}
                    onChange={(e) => setClosingNotes(e.target.value)}
                    placeholder="Keterangan penyerahan ke kasir shift berikutnya..."
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <Button variant="secondary" onClick={() => setActiveTab("summary")}>
                    Kembali
                  </Button>
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => handlePrintThermalRekap(true)}
                    title="Cetak struk rekap tutup shift (Z-Report)"
                  >
                    🖨️ Cetak Struk Tutup
                  </Button>
                  <Button variant="danger" onClick={handleCloseShift} loading={loading}>
                    Tutup Kasir &amp; Selesaikan Shift
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
