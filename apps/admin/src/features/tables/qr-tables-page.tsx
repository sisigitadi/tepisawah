/**
 * Halaman Khusus: Lihat & Cetak QR Meja (Admin Console).
 *
 * Menampilkan seluruh meja beserta kode QR aktifnya secara visual,
 * dengan pilihan 3 template desain kartu akrilik/stiker,
 * dukungan cetak 2 halaman (Halaman 1: Sisi Depan QR, Halaman 2: Sisi Belakang Info & WiFi),
 * pembagian cetak ringkas 2 halaman A4 untuk seluruh meja,
 * tombol unduh gambar QR PNG, dan salin link pemesanan.
 */
import { useEffect, useState, useCallback, type ReactNode } from "react";
import QRCode from "qrcode";
import { Button, Card } from "@tepisawah/ui";
import { loadTables, activeQrFor } from "./service.js";
import type { RestaurantTable, TableQr } from "@tepisawah/database";
import {
  type QrisStickerConfig,
  loadQrisStickerConfig,
} from "./qris-sticker-settings.js";
import { QrisStickerFormModal } from "./qris-sticker-form-modal.js";
import { TableCardBack } from "./table-card-back.js";

export type StickerDesignTemplate = "forest_gold" | "minimal_clean" | "warm_rustic";

interface TableQrItem {
  table: RestaurantTable;
  qr: TableQr | null;
  qrDataUrl: string | null;
  orderUrl: string | null;
}

/** Sisi Depan Kartu Meja (Muka QR Code & Scan Pemesanan) */
function TableCardFront({
  item,
  template,
}: {
  item: TableQrItem;
  template: StickerDesignTemplate;
}) {
  const isCustomName =
    item.table.name &&
    item.table.name.trim().toLowerCase() !== `meja ${item.table.tableCode.trim().toLowerCase()}` &&
    item.table.name.trim().toLowerCase() !== item.table.tableCode.trim().toLowerCase();

  return (
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

      {/* Badge Nomor Meja - Rapi tanpa pengulangan teks A1Meja A14 kursi */}
      <div className="sticker-table-badge">
        <span className="sticker-table-code">MEJA {item.table.tableCode}</span>
        <span className="sticker-table-name">
          {isCustomName ? `${item.table.name} • ` : ""}
          {item.table.capacity ? `${item.table.capacity} Kursi` : ""}
        </span>
      </div>

      {/* Frame Gambar QR Code */}
      <div className="sticker-qr-frame">
        {item.qrDataUrl ? (
          <img
            src={item.qrDataUrl}
            alt={`QR Code Meja ${item.table.tableCode}`}
            className="sticker-qr-image"
          />
        ) : (
          <div className="qr-unminted-placeholder">
            <span>Belum Dibuat QR</span>
          </div>
        )}
      </div>

      {/* Instruksi 3 Langkah Pengunjung */}
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
  );
}

export function QrTablesPage(): ReactNode {
  const [template, setTemplate] = useState<StickerDesignTemplate>("forest_gold");
  const [items, setItems] = useState<TableQrItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "has_qr" | "no_qr">("all");
  const [activeSide, setActiveSide] = useState<"both" | "front" | "back">("both");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [printTarget, setPrintTarget] = useState<"all_2pages" | "single_tent" | null>(null);
  const [printingTableId, setPrintingTableId] = useState<string | null>(null);

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

  const fetchAndGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);

    const snapshot = await loadTables();
    if (snapshot.error) {
      setError(snapshot.error);
      setLoading(false);
      return;
    }

    const origin = window.location.origin;
    const isLocal = origin.includes("localhost") || origin.includes("127.0.0.1");
    // URL scan customer tetap menuju subdomain pemesanan order.tepisawah.id
    const orderBase = isLocal ? "http://localhost:5174" : "https://order.tepisawah.id";

    const generated: TableQrItem[] = [];

    for (const table of snapshot.tables) {
      const activeQr = activeQrFor(snapshot.qrs, table.id);

      if (activeQr) {
        const orderUrl = `${orderBase}/?table=${encodeURIComponent(table.tableCode)}&t=${encodeURIComponent(activeQr.token)}`;
        try {
          const qrDataUrl = await QRCode.toDataURL(orderUrl, {
            width: 380,
            margin: 2,
            color: {
              dark: "#183a1d",
              light: "#ffffff",
            },
            errorCorrectionLevel: "H",
          });

          generated.push({
            table,
            qr: activeQr,
            qrDataUrl,
            orderUrl,
          });
        } catch {
          generated.push({
            table,
            qr: activeQr,
            qrDataUrl: null,
            orderUrl,
          });
        }
      } else {
        generated.push({
          table,
          qr: null,
          qrDataUrl: null,
          orderUrl: null,
        });
      }
    }

    setItems(generated);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAndGenerate();
  }, [fetchAndGenerate]);

  /** Cetak Semua Meja ke dalam tepat 2 Halaman A4 */
  const handlePrintAll2Pages = () => {
    setPrintTarget("all_2pages");
    setPrintingTableId(null);
    setTimeout(() => {
      window.print();
      setPrintTarget(null);
    }, 60);
  };

  /** Cetak 2 Halaman (Depan & Belakang) untuk satu meja tertentu */
  const handlePrintSingleTent = (tableId: string) => {
    setPrintTarget("single_tent");
    setPrintingTableId(tableId);
    setTimeout(() => {
      window.print();
      setPrintTarget(null);
      setPrintingTableId(null);
    }, 60);
  };

  const handleDownloadQr = (item: TableQrItem) => {
    if (!item.qrDataUrl) return;
    const link = document.createElement("a");
    link.download = `QR_Meja_${item.table.tableCode}_TepiSawah.png`;
    link.href = item.qrDataUrl;
    link.click();
  };

  const handleCopyLink = async (item: TableQrItem) => {
    if (!item.orderUrl) return;
    try {
      await navigator.clipboard.writeText(item.orderUrl);
      setCopiedId(item.table.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Non-blocking
    }
  };

  const filteredItems = items.filter((item) => {
    if (filter === "has_qr") return item.qr !== null;
    if (filter === "no_qr") return item.qr === null;
    return true;
  });

  const activeQrCount = items.filter((i) => i.qr !== null).length;

  // Membagi meja menjadi tepat 2 halaman untuk mode batch print 2 halaman
  const midIndex = Math.ceil(filteredItems.length / 2);
  const page1Items = filteredItems.slice(0, midIndex);
  const page2Items = filteredItems.slice(midIndex);

  return (
    <section className="qr-tables-page">
      {/* Header Halaman (Hidden on print) */}
      <header className="qr-page-header no-print">
        <div className="qr-page-header__left">
          <div className="qr-page-title-row">
            <h1>Lihat &amp; Cetak QR Meja</h1>
            <span className="qr-badge-counter">{activeQrCount} Meja Siap Cetak</span>
          </div>
          <p className="qr-page-sub">
            Lihat kartu meja 2 halaman (Halaman 1: Sisi Depan QR Code • Halaman 2: Sisi Belakang Info &amp; WiFi), pilih desain kartu, dan cetak dengan tata letak 2 halaman rapi.
          </p>
        </div>

        <div className="qr-page-header__actions">
          <Button
            variant="secondary"
            onClick={() => setIsQrisModalOpen(true)}
            title="Atur data merchant QRIS, NMID, WiFi, dan jam operasional untuk Halaman 2"
          >
            ⚙️ Isian Halaman 2 (Stiker QRIS)
          </Button>
          <button
            type="button"
            className="ui-button ui-button--primary btn-print-batch"
            onClick={handlePrintAll2Pages}
            disabled={activeQrCount === 0 || loading}
            title="Cetak seluruh meja terfilter ke dalam tepat 2 Halaman A4"
          >
            📑 Cetak Semua Meja (2 Halaman)
          </button>
          <Button variant="secondary" onClick={fetchAndGenerate} loading={loading}>
            🔄 Segarkan
          </Button>
        </div>
      </header>

      {/* Kontrol Desain, Filter & Pilihan Sisi Halaman (Hidden on print) */}
      <div className="qr-page-controls-bar no-print">
        <div className="control-group">
          <span className="control-label">Pilihan Desain Kartu:</span>
          <div className="template-chips">
            <button
              type="button"
              className={`template-chip ${template === "forest_gold" ? "template-chip--active" : ""}`}
              onClick={() => setTemplate("forest_gold")}
            >
              🌲 Nuansa Sawah (Forest &amp; Gold)
            </button>
            <button
              type="button"
              className={`template-chip ${template === "minimal_clean" ? "template-chip--active" : ""}`}
              onClick={() => setTemplate("minimal_clean")}
            >
              ✨ Akrilik Minimalis (Modern Clean)
            </button>
            <button
              type="button"
              className={`template-chip ${template === "warm_rustic" ? "template-chip--active" : ""}`}
              onClick={() => setTemplate("warm_rustic")}
            >
              🌾 Saung Klasik (Warm Rustic)
            </button>
          </div>
        </div>

        <div className="control-group">
          <span className="control-label">Tampilan Sisi Kartu:</span>
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
              📄 Halaman 1 (Sisi Depan - QR)
            </button>
            <button
              type="button"
              className={`template-chip ${activeSide === "back" ? "template-chip--active" : ""}`}
              onClick={() => setActiveSide("back")}
            >
              📄 Halaman 2 (Sisi Belakang - WiFi)
            </button>
          </div>
        </div>

        <div className="control-group">
          <span className="control-label">Filter Meja:</span>
          <div className="filter-chips">
            <button
              type="button"
              className={`filter-chip ${filter === "all" ? "filter-chip--active" : ""}`}
              onClick={() => setFilter("all")}
            >
              Semua Meja ({items.length})
            </button>
            <button
              type="button"
              className={`filter-chip ${filter === "has_qr" ? "filter-chip--active" : ""}`}
              onClick={() => setFilter("has_qr")}
            >
              Memiliki QR ({activeQrCount})
            </button>
            <button
              type="button"
              className={`filter-chip ${filter === "no_qr" ? "filter-chip--active" : ""}`}
              onClick={() => setFilter("no_qr")}
            >
              Tanpa QR ({items.length - activeQrCount})
            </button>
          </div>
        </div>
      </div>

      {/* Petunjuk Penggunaan Cetak 2 Halaman */}
      <div className="qr-page-hint-box no-print">
        <div className="hint-icon">💡</div>
        <div className="hint-text">
          <strong>Fitur Cetak 2 Halaman (Table Tent Card &amp; Batch Print):</strong>
          <p>
            • <strong>Cetak Meja Ini (2 Halaman)</strong>: Mencetak 1 meja dengan 2 halaman (Halaman 1: Muka QR Order • Halaman 2: Muka Info WiFi &amp; Pembayaran) siap dilipat dua atau diselipkan ke stand akrilik bolak-balik.<br />
            • <strong>Cetak Semua Meja (2 Halaman)</strong>: Membagi otomatis daftar 6 meja ke dalam tepat 2 lembar kertas A4 tanpa terpotong.
          </p>
        </div>
      </div>

      {/* Area Tampilan Kartu QR */}
      <div className="qr-page-grid-container">
        {loading ? (
          <div className="qr-loading-box no-print">
            <p>Sedang memuat data meja dan menghasilkan gambar QR Code…</p>
          </div>
        ) : error ? (
          <Card elevation="low" title="Gagal memuat QR meja">
            <p role="alert">{error}</p>
            <Button variant="secondary" onClick={fetchAndGenerate}>
              Coba lagi
            </Button>
          </Card>
        ) : filteredItems.length === 0 ? (
          <div className="qr-empty-box no-print">
            <p>Tidak ada meja yang cocok dengan filter yang dipilih.</p>
          </div>
        ) : printTarget === "all_2pages" ? (
          /* Render Khusus Cetak Semua Meja 2 Halaman */
          <div className="print-2pages-container">
            {/* HALAMAN 1 (Meja Bagian 1) */}
            <div className="print-page-1">
              {page1Items.map((item) => (
                <div key={`p1-${item.table.id}`} className="qr-item-card-wrapper">
                  {activeSide === "back" ? (
                    <TableCardBack
                      tableCode={item.table.tableCode}
                      tableName={item.table.name}
                      template={template}
                      config={qrisConfig}
                      qrisDataUrl={qrisDataUrl}
                    />
                  ) : (
                    <TableCardFront item={item} template={template} />
                  )}
                </div>
              ))}
            </div>

            {/* Pemisah Halaman Eksplisit Menuju Halaman 2 */}
            <div className="print-page-break" />

            {/* HALAMAN 2 (Meja Bagian 2) */}
            <div className="print-page-2">
              {page2Items.map((item) => (
                <div key={`p2-${item.table.id}`} className="qr-item-card-wrapper">
                  {activeSide === "back" ? (
                    <TableCardBack
                      tableCode={item.table.tableCode}
                      tableName={item.table.name}
                      template={template}
                      config={qrisConfig}
                      qrisDataUrl={qrisDataUrl}
                    />
                  ) : (
                    <TableCardFront item={item} template={template} />
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Tampilan Standar Web & Cetak Per Meja 2 Halaman */
          <div className={`qr-cards-grid qr-cards-grid--${template}`}>
            {filteredItems.map((item) => {
              const isHiddenOnSinglePrint =
                printingTableId !== null && printingTableId !== item.table.id;

              return (
                <div
                  key={item.table.id}
                  className={`qr-item-card-wrapper ${isHiddenOnSinglePrint ? "print-hidden" : ""}`}
                >
                  {/* Halaman 1: Sisi Depan */}
                  {activeSide === "both" || activeSide === "front" ? (
                    <TableCardFront item={item} template={template} />
                  ) : null}

                  {/* Garis lipat tent card jika menampilkan kedua sisi di preview web */}
                  {activeSide === "both" ? (
                    <div className="sticker-tent-fold-indicator no-print">
                      <span>Garis Lipat Tent Card Akrilik</span>
                    </div>
                  ) : null}

                  {/* Pemisah Halaman Cetak saat Mencetak Meja Tunggal (Menghasilkan Halaman 1 & Halaman 2) */}
                  {printTarget === "single_tent" && printingTableId === item.table.id ? (
                    <div className="print-page-break" />
                  ) : null}

                  {/* Halaman 2: Sisi Belakang */}
                  {activeSide === "both" || activeSide === "back" ? (
                    <TableCardBack
                      tableCode={item.table.tableCode}
                      tableName={item.table.name}
                      template={template}
                      config={qrisConfig}
                      qrisDataUrl={qrisDataUrl}
                    />
                  ) : null}

                  {/* Tombol Aksi per Meja (Hidden on print) */}
                  <div className="qr-item-tools no-print">
                    {item.qr !== null && item.qrDataUrl ? (
                      <>
                        <button
                          type="button"
                          className="btn-qr-action btn-qr-action--print"
                          onClick={() => handlePrintSingleTent(item.table.id)}
                          title="Cetak 2 Halaman (Depan & Belakang) untuk meja ini"
                        >
                          🖨️ Cetak 2 Halaman
                        </button>
                        <button
                          type="button"
                          className="btn-qr-action"
                          onClick={() => handleDownloadQr(item)}
                          title="Download gambar QR Code PNG"
                        >
                          💾 Unduh PNG
                        </button>
                        <button
                          type="button"
                          className="btn-qr-action"
                          onClick={() => handleCopyLink(item)}
                          title="Salin link pemesanan meja"
                        >
                          {copiedId === item.table.id ? "✓ Disalin" : "🔗 Salin Link"}
                        </button>
                      </>
                    ) : (
                      <span className="no-qr-hint">QR meja belum aktif</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <QrisStickerFormModal
        isOpen={isQrisModalOpen}
        onClose={() => setIsQrisModalOpen(false)}
        config={qrisConfig}
        onSaved={(newCfg) => setQrisConfig(newCfg)}
      />
    </section>
  );
}
