/**
 * @tepisawah/web — official footer + fixed mobile conversion bar.
 */
import type { ReactNode } from "react";
import { Icon } from "../../../components/icons.js";
import { useReservation } from "../reservation.js";
import { MAPS_URL } from "./SiteHeader.js";

const FOOTER_LINKS: ReadonlyArray<{ label: string; href: string }> = [
  { label: "Beranda", href: "#home" },
  { label: "Menu Pilihan", href: "#menu-pilihan" },
  { label: "Promo & Paket", href: "#promo-paket" },
  { label: "Tentang Kami", href: "#tentang-kami" },
  { label: "Pesan di Meja (QR)", href: "#qr-order" },
  { label: "Galeri Suasana", href: "#galeri" },
  { label: "Reservasi Rombongan", href: "#reservasi" },
  { label: "Petunjuk Lokasi", href: "#lokasi" },
];

export function SiteFooter(): ReactNode {
  const { openReservation } = useReservation();

  return (
    <>
      {/* Fixed mobile conversion bar */}
      <div className="web-cta-bar">
        <div className="web-cta-bar-inner">
          <a
            className="web-btn web-btn-amber web-btn-flex"
            href="#menu-pilihan"
          >
            <Icon name="book-open" size={16} />
            <span>Lihat Menu</span>
          </a>
          <button
            type="button"
            className="web-btn web-btn-forest-line"
            onClick={() => openReservation()}
          >
            <Icon name="calendar" size={16} />
            <span>Reservasi</span>
          </button>
          <a
            className="web-cta-bar-map"
            href={MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Buka Peta"
          >
            <Icon name="map-pin" size={16} />
          </a>
        </div>
      </div>

      <footer className="web-footer">
        <div className="web-shell web-footer-grid">
          <div className="web-footer-brand">
            <div className="web-footer-brand-row">
              <span className="web-footer-logo">
                <img src="/logo.png" alt="Logo Tepi Sawah Restaurant & Coffee" />
              </span>
              <div>
                <span className="web-footer-name">
                  TEPI SAWAH RESTAURANT &amp; COFFEE
                </span>
                <span className="web-footer-tag">Ciperna • Cirebon</span>
              </div>
            </div>
            <p className="web-footer-desc">
              Restoran dan coffee destination bernuansa pedesaan otentik di
              tengah hamparan sawah hijau Ciperna. Menyajikan olahan ayam
              roaster rempah, gurame bakar madu, nasi liwet tradisional, serta
              racikan kopi senja khas Nusantara.
            </p>
            <div className="web-footer-meta">
              <p className="web-footer-addr">
                <Icon name="map-pin" size={14} className="web-ico-gold" />
                <span>
                  Jl. Raya Ciperna (Dekat Gerbang Tol Ciperna), Kec. Talun, Kab.
                  Cirebon
                </span>
              </p>
              <p className="web-footer-hours">
                <Icon name="clock" size={14} className="web-ico-amber" />
                <span>Buka Setiap Hari: 09:00 – 22:00 WIB</span>
              </p>
            </div>
          </div>

          <div className="web-footer-col">
            <h4 className="web-footer-col-title">Navigasi Halaman</h4>
            <ul>
              {FOOTER_LINKS.map((link) => (
                <li key={link.href}>
                  <a href={link.href}>{link.label}</a>
                </li>
              ))}
            </ul>
          </div>

          <div className="web-footer-col">
            <h4 className="web-footer-col-title">Layanan &amp; Kontak</h4>
            <div className="web-footer-contact">
              <p>Pemesanan hanya tersedia di tempat:</p>
              <span className="web-footer-order">
                <Icon name="qr-code" size={12} />
                <span>Scan QR di meja • Kasir • Pramusaji</span>
              </span>
              <button
                type="button"
                className="web-btn web-btn-forest web-btn-flex"
                onClick={() => openReservation()}
              >
                <Icon name="calendar" size={14} />
                <span>Reservasi Meja</span>
              </button>
              <a
                className="web-btn web-btn-outline-light web-btn-flex"
                href={MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon name="map" size={14} />
                <span>Buka Google Maps</span>
              </a>
            </div>
          </div>
        </div>

        <div className="web-shell web-footer-bottom">
          <p>
            © 2026 Tepi Sawah Restaurant &amp; Coffee. Ciperna, Cirebon. All
            rights reserved.
          </p>
          <p>Kuliner Nusantara &amp; Coffee di Tepi Sawah</p>
        </div>
      </footer>
    </>
  );
}
