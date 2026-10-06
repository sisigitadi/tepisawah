/**
 * Modal Isian Halaman 2: Stiker QRIS & Fasilitas Meja (Admin Console).
 *
 * Mengatur data merchant QRIS, NMID, akses WiFi tamu, jam buka,
 * dan teks instruksi yang dicetak pada Halaman 2 kartu meja / tent card.
 */
import { useState, type ReactNode } from "react";
import { Button } from "@tepisawah/ui";
import {
  type QrisStickerConfig,
  DEFAULT_QRIS_STICKER_CONFIG,
  saveQrisStickerConfig,
} from "./qris-sticker-settings.js";

export interface QrisStickerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: QrisStickerConfig;
  onSaved: (newConfig: QrisStickerConfig) => void;
}

export function QrisStickerFormModal({
  isOpen,
  onClose,
  config,
  onSaved,
}: QrisStickerFormModalProps): ReactNode {
  const [draft, setDraft] = useState<QrisStickerConfig>(config);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveQrisStickerConfig(draft);
    onSaved(draft);
    setSuccessNotice("Isian Halaman 2 berhasil disimpan!");
    setTimeout(() => {
      setSuccessNotice(null);
      onClose();
    }, 800);
  };

  const handleReset = () => {
    setDraft({ ...DEFAULT_QRIS_STICKER_CONFIG });
  };

  return (
    <div className="table-sticker-modal-overlay">
      <div className="table-sticker-modal" style={{ maxWidth: "42rem" }}>
        {/* Header Modal */}
        <div className="table-sticker-modal__head no-print">
          <div>
            <h2 className="table-sticker-modal__title">
              ⚙️ Isian Halaman 2: Stiker QRIS &amp; Info Meja
            </h2>
            <p className="table-sticker-modal__sub">
              Sesuaikan data merchant QRIS, NMID, akses WiFi, dan panduan pembayaran yang tercetak di Halaman 2 (Sisi Belakang Kartu Meja).
            </p>
          </div>
          <button
            type="button"
            className="table-sticker-close-btn"
            onClick={onClose}
            aria-label="Tutup"
          >
            ✕
          </button>
        </div>

        {successNotice ? (
          <div
            style={{
              padding: "0.75rem 1rem",
              background: "#dcfce7",
              color: "#15803d",
              borderRadius: "8px",
              fontWeight: 600,
              fontSize: "0.85rem",
              margin: "0 1.5rem 1rem",
            }}
          >
            ✓ {successNotice}
          </div>
        ) : null}

        {/* Form Isian */}
        <form onSubmit={handleSave} style={{ padding: "0 1.5rem 1.5rem", overflowY: "auto", maxHeight: "75vh" }}>
          {/* SECTION 1: IDENTITAS QRIS */}
          <div style={{ marginBottom: "1.25rem", padding: "1rem", background: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem", color: "#183a1d", display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span>💳</span> Data Stiker QRIS Nasional
            </h3>

            <div style={{ display: "grid", gap: "0.75rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#334155", marginBottom: "0.25rem" }}>
                  Nama Merchant QRIS:
                </label>
                <input
                  type="text"
                  value={draft.merchantName}
                  onChange={(e) => setDraft({ ...draft, merchantName: e.target.value })}
                  style={{ width: "100%", padding: "0.45rem 0.65rem", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "0.85rem" }}
                  placeholder="Contoh: TEPI SAWAH RESTO & COFFEE"
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#334155", marginBottom: "0.25rem" }}>
                    Nomor NMID:
                  </label>
                  <input
                    type="text"
                    value={draft.nmid}
                    onChange={(e) => setDraft({ ...draft, nmid: e.target.value })}
                    style={{ width: "100%", padding: "0.45rem 0.65rem", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "0.85rem" }}
                    placeholder="Contoh: ID1026002938475"
                    required
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#334155", marginBottom: "0.25rem" }}>
                    Kota / Lokasi:
                  </label>
                  <input
                    type="text"
                    value={draft.city}
                    onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                    style={{ width: "100%", padding: "0.45rem 0.65rem", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "0.85rem" }}
                    placeholder="Contoh: Ciperna, Cirebon"
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#334155", marginBottom: "0.25rem" }}>
                  String / Payload Kode QRIS:
                </label>
                <textarea
                  rows={2}
                  value={draft.qrisPayload}
                  onChange={(e) => setDraft({ ...draft, qrisPayload: e.target.value })}
                  style={{ width: "100%", padding: "0.45rem 0.65rem", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "0.78rem", fontFamily: "monospace" }}
                  placeholder="String payload QRIS standar Bank Indonesia..."
                />
                <span style={{ fontSize: "0.7rem", color: "#64748b" }}>
                  String ini akan otomatis di-generate menjadi gambar QR Code QRIS pada Halaman 2.
                </span>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#334155", marginBottom: "0.25rem" }}>
                  Aplikasi / Bank yang Didukung:
                </label>
                <input
                  type="text"
                  value={draft.paymentGuide}
                  onChange={(e) => setDraft({ ...draft, paymentGuide: e.target.value })}
                  style={{ width: "100%", padding: "0.45rem 0.65rem", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "0.85rem" }}
                  placeholder="Contoh: BCA, Mandiri, BRI, BNI, GoPay, OVO, ShopeePay, DANA"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: AKSES WIFI TAMU */}
          <div style={{ marginBottom: "1.25rem", padding: "1rem", background: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <h3 style={{ margin: 0, fontSize: "0.95rem", color: "#183a1d", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <span>📶</span> Akses WiFi Meja Restoran
              </h3>
              <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.78rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={draft.showWifi}
                  onChange={(e) => setDraft({ ...draft, showWifi: e.target.checked })}
                />
                Tampilkan di Kartu
              </label>
            </div>

            {draft.showWifi ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#334155", marginBottom: "0.25rem" }}>
                    Nama Jaringan (SSID):
                  </label>
                  <input
                    type="text"
                    value={draft.wifiSsid}
                    onChange={(e) => setDraft({ ...draft, wifiSsid: e.target.value })}
                    style={{ width: "100%", padding: "0.45rem 0.65rem", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "0.85rem" }}
                    placeholder="Contoh: TepiSawah_Guest"
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#334155", marginBottom: "0.25rem" }}>
                    Kata Sandi WiFi:
                  </label>
                  <input
                    type="text"
                    value={draft.wifiPassword}
                    onChange={(e) => setDraft({ ...draft, wifiPassword: e.target.value })}
                    style={{ width: "100%", padding: "0.45rem 0.65rem", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "0.85rem" }}
                    placeholder="Contoh: tepisawahresto"
                  />
                </div>
              </div>
            ) : null}
          </div>

          {/* SECTION 3: JAM OPERASIONAL & FOOTER */}
          <div style={{ marginBottom: "1.25rem", padding: "1rem", background: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem", color: "#183a1d", display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span>🕒</span> Jam Operasional &amp; Footer
            </h3>

            <div style={{ display: "grid", gap: "0.75rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#334155", marginBottom: "0.25rem" }}>
                    Jam Operasional:
                  </label>
                  <input
                    type="text"
                    value={draft.operationalHours}
                    onChange={(e) => setDraft({ ...draft, operationalHours: e.target.value })}
                    style={{ width: "100%", padding: "0.45rem 0.65rem", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "0.85rem" }}
                    placeholder="Contoh: Buka Setiap Hari: 10.00 – 22.00 WIB"
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#334155", marginBottom: "0.25rem" }}>
                    Instagram / Media Sosial:
                  </label>
                  <input
                    type="text"
                    value={draft.instagram}
                    onChange={(e) => setDraft({ ...draft, instagram: e.target.value })}
                    style={{ width: "100%", padding: "0.45rem 0.65rem", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "0.85rem" }}
                    placeholder="Contoh: @tepisawah.resto"
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#334155", marginBottom: "0.25rem" }}>
                  Teks Link Footer:
                </label>
                <input
                  type="text"
                  value={draft.footerUrl}
                  onChange={(e) => setDraft({ ...draft, footerUrl: e.target.value })}
                  style={{ width: "100%", padding: "0.45rem 0.65rem", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "0.85rem" }}
                  placeholder="Contoh: tepisawah.id"
                />
              </div>
            </div>
          </div>

          {/* Tombol Aksi */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={handleReset}
              style={{
                padding: "0.45rem 0.85rem",
                fontSize: "0.78rem",
                color: "#64748b",
                background: "transparent",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              🔄 Reset ke Default
            </button>

            <div style={{ display: "flex", gap: "0.5rem" }}>
              <Button variant="secondary" onClick={onClose}>
                Batal
              </Button>
              <Button variant="primary" type="submit">
                💾 Simpan Isian Halaman 2
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
