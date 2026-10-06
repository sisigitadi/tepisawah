/**
 * Komponen Halaman 2: Sisi Belakang Kartu / Stiker Meja (Stiker QRIS & Fasilitas Meja).
 *
 * Menampilkan stiker pembayaran QRIS standar nasional Bank Indonesia,
 * informasi akses WiFi meja restoran, jam operasional, dan kontak media sosial.
 */
import type { ReactNode } from "react";
import type { QrisStickerConfig } from "./qris-sticker-settings.js";

export type StickerDesignTemplate = "forest_gold" | "minimal_clean" | "warm_rustic";

export interface TableCardBackProps {
  tableCode: string;
  tableName?: string | null;
  template: StickerDesignTemplate;
  config: QrisStickerConfig;
  qrisDataUrl: string | null;
}

export function TableCardBack({
  tableCode,
  tableName,
  template,
  config,
  qrisDataUrl,
}: TableCardBackProps): ReactNode {
  const isCustomName =
    tableName &&
    tableName.trim().toLowerCase() !== `meja ${tableCode.trim().toLowerCase()}` &&
    tableName.trim().toLowerCase() !== tableCode.trim().toLowerCase();

  return (
    <div className={`sticker-card sticker-card--${template} sticker-card--back`}>
      {/* Header Kartu */}
      <div className="sticker-card__header">
        <div className="sticker-brand">
          <img src="/logo.png" alt="Logo Tepi Sawah" className="sticker-logo" />
          <div className="sticker-brand-text">
            <span className="sticker-brand-name">TEPI SAWAH</span>
            <span className="sticker-brand-tag">Restaurant &amp; Coffee • Ciperna</span>
          </div>
        </div>
        <span className="sticker-card-side-tag no-print">Halaman 2 • Belakang</span>
      </div>

      {/* Badge Nomor Meja */}
      <div className="sticker-table-badge">
        <span className="sticker-table-code">MEJA {tableCode}</span>
        <span className="sticker-table-name">
          {isCustomName ? `${tableName} • ` : ""}
          Pembayaran QRIS &amp; Fasilitas
        </span>
      </div>

      {/* FRAME STIKER QRIS NASIONAL */}
      {config.showQrisCode ? (
        <div className="sticker-qris-container">
          <div className="qris-card-header">
            <div className="qris-brand-row">
              <span className="qris-badge-title">QRIS</span>
              <span className="qris-badge-subtitle">PEMBAYARAN DIGITAL NASIONAL</span>
            </div>
          </div>

          <div className="qris-merchant-info">
            <span className="qris-merchant-name">{config.merchantName}</span>
            <div className="qris-meta-row">
              <span className="qris-nmid">NMID: {config.nmid}</span>
              <span className="qris-city">{config.city}</span>
            </div>
          </div>

          {/* QR Image Frame */}
          <div className="qris-qr-box">
            {qrisDataUrl ? (
              <img
                src={qrisDataUrl}
                alt={`QRIS ${config.merchantName}`}
                className="qris-qr-image"
              />
            ) : (
              <div className="qris-loading-placeholder">
                <span>Memuat QRIS…</span>
              </div>
            )}
          </div>

          <div className="qris-card-footer">
            <span className="qris-footer-slogan">SATU QRIS UNTUK SEMUA PEMBAYARAN</span>
            <span className="qris-footer-apps">{config.paymentGuide}</span>
          </div>
        </div>
      ) : null}

      {/* FASILITAS MEJA & WIFI RESTORAN */}
      <div className="sticker-back-content">
        {config.showWifi ? (
          <div className="sticker-back-section">
            <div className="sticker-back-section-title">
              <span>📶</span> Akses WiFi Restoran
            </div>
            <div className="sticker-wifi-box">
              <div className="sticker-wifi-row">
                <span className="sticker-wifi-label">Nama WiFi (SSID):</span>
                <span className="sticker-wifi-val">{config.wifiSsid}</span>
              </div>
              <div className="sticker-wifi-row">
                <span className="sticker-wifi-label">Kata Sandi:</span>
                <span className="sticker-wifi-val">{config.wifiPassword}</span>
              </div>
            </div>
          </div>
        ) : null}

        {config.operationalHours ? (
          <div className="sticker-back-section">
            <div className="sticker-back-section-title">
              <span>🕒</span> Jam Operasional
            </div>
            <p className="sticker-hours-val">{config.operationalHours}</p>
          </div>
        ) : null}
      </div>

      {/* Footer Info Kartu */}
      <div className="sticker-card__footer">
        <p className="sticker-help-text">
          Instagram: <strong>{config.instagram}</strong> • {config.city}
        </p>
        <span className="sticker-table-url">{config.footerUrl}</span>
      </div>
    </div>
  );
}
