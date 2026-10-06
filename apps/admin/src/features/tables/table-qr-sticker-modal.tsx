/**
 * Modal Desain & Cetak Kartu / Stiker Meja QR Code Tepi Sawah.
 *
 * Mendukung:
 * 1. Pilihan 3 Template Desain (Nuansa Sawah, Akrilik Minimalis, Saung Klasik).
 * 2. Tampilan 2 Halaman (Halaman 1: Sisi Depan QR, Halaman 2: Sisi Belakang Info & WiFi).
 * 3. Cetak 2 Halaman (Tent Card Bolak-balik / Lipat Dua).
 * 4. Download file gambar QR Code per meja (PNG).
 * 5. Salin link pemesanan meja.
 */
import { useEffect, useState, type ReactNode } from "react";
import QRCode from "qrcode";
import type { RestaurantTable, TableQr } from "@tepisawah/database";
import {
  type QrisStickerConfig,
  loadQrisStickerConfig,
} from "./qris-sticker-settings.js";
import { QrisStickerFormModal } from "./qris-sticker-form-modal.js";
import { TableCardBack } from "./table-card-back.js";

export type StickerDesignTemplate = "forest_gold" | "minimal_clean" | "warm_rustic";

export interface TableQrStickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Daftar seluruh meja */
  tables: readonly RestaurantTable[];
  /** Daftar token QR aktif */
  qrs: readonly TableQr[];
  /** Meja yang dipilih (null jika mode cetak semua) */
  selectedTableId: string | null;
}

interface TableWithQr {
  table: RestaurantTable;
  qr: TableQr;
  qrDataUrl: string;
  orderUrl: string;
}

export function TableQrStickerModal({
  isOpen,
  onClose,
  tables,
  qrs,
  selectedTableId,
}: TableQrStickerModalProps): ReactNode {
  const [template, setTemplate] = useState<StickerDesignTemplate>("forest_gold");
  const [activeSide, setActiveSide] = useState<"both" | "front" | "back">("both");
  const [items, setItems] = useState<TableWithQr[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Pengaturan Stiker QRIS & Halaman 2
  const [qrisConfig, setQrisConfig] = useState<QrisStickerConfig>(loadQrisStickerConfig);
  const [qrisDataUrl, setQrisDataUrl] = useState<string | null>(null);
  const [isQrisModalOpen, setIsQrisModalOpen] = useState<boolean>(false);

  // Generate QRIS QR code data URL
  useEffect(() => {
    let active = true;
    if (!qrisConfig.showQrisCode || !qrisConfig.qrisPayload) {
      setQrisDataUrl(null);
      return;
    }
    QRCode.toDataURL(qrisConfig.qrisPayload, {
      width: 320,
      margin: 1,
      color: { dark: "#0f172a", light: "#ffffff" },
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (active) setQrisDataUrl(url);
      })
      .catch((err) => {
        console.error("Gagal generate QRIS QR code:", err);
      });
    return () => {
      active = false;
    };
  }, [qrisConfig.showQrisCode, qrisConfig.qrisPayload]);

  // Filter meja yang memiliki QR aktif
  const targetTables = selectedTableId
    ? tables.filter((t) => t.id === selectedTableId && t.isActive)
    : tables.filter((t) => t.isActive);

  // Generate QR Code data URL untuk setiap meja
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);

    async function generateQrs() {
      // Resolve base order URL: customer scan tetap menuju subdomain order.tepisawah.id
      const origin = window.location.origin;
      const isLocal = origin.includes("localhost") || origin.includes("127.0.0.1");
      const orderBase = isLocal
        ? "http://localhost:5174"
        : "https://order.tepisawah.id";

      const list: TableWithQr[] = [];

      for (const table of targetTables) {
        // Cari QR aktif terbaru untuk meja ini
        const activeQrs = qrs.filter((q) => q.tableId === table.id && q.isActive);
        if (activeQrs.length === 0) continue;

        const latestQr = activeQrs.reduce((a, b) =>
          a.createdAt > b.createdAt ? a : b,
        );

        const orderUrl = `${orderBase}/?table=${encodeURIComponent(table.tableCode)}&t=${encodeURIComponent(latestQr.token)}`;

        try {
          const qrDataUrl = await QRCode.toDataURL(orderUrl, {
            width: 360,
            margin: 2,
            color: {
              dark: "#183a1d", // Deep Moss
              light: "#ffffff",
            },
            errorCorrectionLevel: "H",
          });

          list.push({
            table,
            qr: latestQr,
            qrDataUrl,
            orderUrl,
          });
        } catch (err) {
          console.error(`Gagal generate QR untuk meja ${table.tableCode}:`, err);
        }
      }

      if (isMounted) {
        setItems(list);
        setLoading(false);
      }
    }

    generateQrs();

    return () => {
      isMounted = false;
    };
  }, [isOpen, selectedTableId, tables, qrs]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyLink = async (item: TableWithQr) => {
    try {
      await navigator.clipboard.writeText(item.orderUrl);
      setCopiedId(item.table.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Non-blocking
    }
  };

  const handleDownloadQr = (item: TableWithQr) => {
    const link = document.createElement("a");
    link.download = `QR_Meja_${item.table.tableCode}_TepiSawah.png`;
    link.href = item.qrDataUrl;
    link.click();
  };

  return (
    <div className="table-sticker-modal-overlay">
      <div className="table-sticker-modal">
        {/* Header (Hidden on Print) */}
        <div className="table-sticker-modal__head no-print">
          <div>
            <h2 className="table-sticker-modal__title">
              {selectedTableId ? `Kartu Meja ${items[0]?.table.tableCode ?? ""}` : "Cetak Kartu Meja 2 Halaman"}
            </h2>
            <p className="table-sticker-modal__sub">
              Pilih template desain kartu akrilik meja (Halaman 1: Muka QR Order • Halaman 2: Muka Info WiFi &amp; Pembayaran), lalu cetak atau unduh gambar QR.
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

        {/* Toolbar Kontrol Desain & Sisi Halaman (Hidden on Print) */}
        <div className="table-sticker-controls no-print">
          <div className="table-sticker-template-picker">
            <span className="control-label">Pilihan Desain:</span>
            <div className="template-chips">
              <button
                type="button"
                className={`template-chip ${template === "forest_gold" ? "template-chip--active" : ""}`}
                onClick={() => setTemplate("forest_gold")}
              >
                🌲 Nuansa Sawah
              </button>
              <button
                type="button"
                className={`template-chip ${template === "minimal_clean" ? "template-chip--active" : ""}`}
                onClick={() => setTemplate("minimal_clean")}
              >
                ✨ Akrilik Minimalis
              </button>
              <button
                type="button"
                className={`template-chip ${template === "warm_rustic" ? "template-chip--active" : ""}`}
                onClick={() => setTemplate("warm_rustic")}
              >
                🌾 Saung Klasik
              </button>
            </div>
          </div>

          <div className="table-sticker-template-picker">
            <span className="control-label">Tampilan Sisi:</span>
            <div className="template-chips">
              <button
                type="button"
                className={`template-chip ${activeSide === "both" ? "template-chip--active" : ""}`}
                onClick={() => setActiveSide("both")}
              >
                📑 Kedua Sisi (Depan &amp; Belakang)
              </button>
              <button
                type="button"
                className={`template-chip ${activeSide === "front" ? "template-chip--active" : ""}`}
                onClick={() => setActiveSide("front")}
              >
                📄 Halaman 1 (QR)
              </button>
              <button
                type="button"
                className={`template-chip ${activeSide === "back" ? "template-chip--active" : ""}`}
                onClick={() => setActiveSide("back")}
              >
                📄 Halaman 2 (WiFi)
              </button>
            </div>
          </div>

          <div className="table-sticker-actions-bar">
            <button
              type="button"
              className="ui-button ui-button--secondary"
              onClick={() => setIsQrisModalOpen(true)}
              title="Atur data merchant QRIS, NMID, WiFi, dan info jam buka untuk Halaman 2"
            >
              ⚙️ Isian Halaman 2 (Stiker QRIS)
            </button>
            <button
              type="button"
              className="ui-button ui-button--primary btn-print-all"
              onClick={handlePrint}
              disabled={items.length === 0}
            >
              🖨️ Cetak 2 Halaman ({items.length > 1 ? `${items.length} Meja` : "Meja Ini"})
            </button>
          </div>
        </div>

        {/* Konten Kartu Stiker Meja (Tercetak di Kertas) */}
        <div className="table-sticker-preview-area">
          {loading ? (
            <p className="loading-notice no-print">Sedang menghasilkan kode QR meja…</p>
          ) : items.length === 0 ? (
            <div className="empty-notice no-print">
              <p>Belum ada meja yang memiliki token QR aktif.</p>
              <p>Klik tombol <strong>"Buat QR"</strong> pada daftar meja terlebih dahulu.</p>
            </div>
          ) : (
            <div className={`sticker-cards-grid sticker-cards-grid--${template}`}>
              {items.map((item) => {
                const isCustomName =
                  item.table.name &&
                  item.table.name.trim().toLowerCase() !== `meja ${item.table.tableCode.trim().toLowerCase()}` &&
                  item.table.name.trim().toLowerCase() !== item.table.tableCode.trim().toLowerCase();

                return (
                  <div key={item.table.id} className="sticker-card-wrapper">
                    {/* HALAMAN 1: SISI DEPAN */}
                    {activeSide === "both" || activeSide === "front" ? (
                      <div className={`sticker-card sticker-card--${template} sticker-card--front`}>
                        {/* Header Kartu */}
                        <div className="sticker-card__header">
                          <div className="sticker-brand">
                            <img src="/logo.png" alt="Logo Tepi Sawah" className="sticker-logo" />
                            <div className="sticker-brand-text">
                              <span className="sticker-brand-name">TEPI SAWAH</span>
                              <span className="sticker-brand-tag">Restaurant &amp; Coffee • Ciperna</span>
                            </div>
                          </div>
                          <span className="sticker-card-side-tag no-print">Halaman 1 • Depan</span>
                        </div>

                        {/* Badge Nomor Meja */}
                        <div className="sticker-table-badge">
                          <span className="sticker-table-code">MEJA {item.table.tableCode}</span>
                          <span className="sticker-table-name">
                            {isCustomName ? `${item.table.name} • ` : ""}
                            {item.table.capacity ? `${item.table.capacity} Kursi` : ""}
                          </span>
                        </div>

                        {/* Gambar QR Code */}
                        <div className="sticker-qr-frame">
                          <img
                            src={item.qrDataUrl}
                            alt={`QR Code Meja ${item.table.tableCode}`}
                            className="sticker-qr-image"
                          />
                        </div>

                        {/* Instruksi Pelanggan */}
                        <div className="sticker-instructions">
                          <div className="sticker-step">
                            <span className="step-num">1</span>
                            <span>Buka Kamera HP Anda</span>
                          </div>
                          <div className="sticker-step">
                            <span className="step-num">2</span>
                            <span>Arahkan ke QR Code di atas</span>
                          </div>
                          <div className="sticker-step">
                            <span className="step-num">3</span>
                            <span>Pesan Menu Tanpa Antre</span>
                          </div>
                        </div>

                        {/* Footer Info */}
                        <div className="sticker-card__footer">
                          <p className="sticker-help-text">
                            Butuh bantuan? Silakan panggil pramusaji kami.
                          </p>
                          <span className="sticker-table-url">tepisawah.id</span>
                        </div>
                      </div>
                    ) : null}

                    {/* Garis Lipat Tent Card */}
                    {activeSide === "both" ? (
                      <div className="sticker-tent-fold-indicator no-print">
                        <span>Garis Lipat Tent Card Akrilik</span>
                      </div>
                    ) : null}

                    {/* Pemisah Halaman Cetak saat Mencetak Tent Card 2 Halaman */}
                    <div className="print-page-break" />

                    {/* HALAMAN 2: SISI BELAKANG (STIKER QRIS & FASILITAS MEJA) */}
                    {activeSide === "both" || activeSide === "back" ? (
                      <TableCardBack
                        tableCode={item.table.tableCode}
                        tableName={item.table.name}
                        template={template}
                        config={qrisConfig}
                        qrisDataUrl={qrisDataUrl}
                      />
                    ) : null}

                    {/* Tombol Aksi per Meja (Hidden on Print) */}
                    <div className="sticker-card-tools no-print">
                      <button
                        type="button"
                        className="btn-tool"
                        onClick={() => handleDownloadQr(item)}
                        title="Download Gambar QR PNG"
                      >
                        💾 Unduh QR PNG
                      </button>
                      <button
                        type="button"
                        className="btn-tool"
                        onClick={() => handleCopyLink(item)}
                        title="Salin Link Web Order Meja"
                      >
                        {copiedId === item.table.id ? "✓ Link Disalin" : "🔗 Salin Link"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Isian Halaman 2 (Stiker QRIS & Fasilitas) */}
        <QrisStickerFormModal
          isOpen={isQrisModalOpen}
          onClose={() => setIsQrisModalOpen(false)}
          config={qrisConfig}
          onSaved={(newCfg) => setQrisConfig(newCfg)}
        />
      </div>
    </div>
  );
}
