/**
 * @tepisawah/web — site header.
 *
 * Realtime operating-status notice bar + sticky deepmoss navbar with a
 * mobile drawer, lifted from the Stitch production homepage reference.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "../../../components/icons.js";
import { useOpenStatus } from "../../../hooks/index.js";

export const MAPS_URL =
  "https://www.google.com/maps/place/6%C2%B046'16.3%22S+108%C2%B030'45.4%22E/@-6.7711837,108.5119553,19z";

const NAV_LINKS: ReadonlyArray<{ label: string; href: string }> = [
  { label: "Beranda", href: "#home" },
  { label: "Menu", href: "#menu-pilihan" },
  { label: "Promo & Paket", href: "#promo-paket" },
  { label: "Tentang Kami", href: "#tentang-kami" },
  { label: "Cara Pesan", href: "#qr-order" },
  { label: "Galeri Suasana", href: "#galeri" },
  { label: "Reservasi", href: "#reservasi" },
  { label: "Lokasi", href: "#lokasi" },
];

function StatusBadge(): ReactNode {
  const { isOpen, loading } = useOpenStatus();

  if (loading) {
    return (
      <span className="web-status-badge web-status-checking">
        <span className="web-status-dot" />
        <span>MEMERIKSA JAM BUKA...</span>
      </span>
    );
  }

  return isOpen ? (
    <span className="web-status-badge web-status-open">
      <span className="web-status-dot" />
      <span>BUKA SEKARANG (OPEN NOW)</span>
    </span>
  ) : (
    <span className="web-status-badge web-status-closed">
      <span className="web-status-dot" />
      <span>SEDANG TUTUP • BUKA KEMBALI 09:00 WIB</span>
    </span>
  );
}

export function SiteHeader(): ReactNode {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close the drawer with Escape so keyboard users aren't trapped.
  useEffect(() => {
    if (!drawerOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setDrawerOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  return (
    <>
      {/* Top notice bar — realtime status */}
      <div className="web-topbar">
        <div className="web-shell web-topbar-inner">
          <div className="web-topbar-status">
            <StatusBadge />
            <span className="web-topbar-sep" aria-hidden="true">
              |
            </span>
            <span className="web-topbar-hours">
              <Icon name="clock" size={14} className="web-ico-amber" />
              Buka Setiap Hari: <strong>09:00 – 22:00 WIB</strong>
            </span>
          </div>
          <div className="web-topbar-loc">
            <span className="web-topbar-addr">
              <Icon name="map-pin" size={14} className="web-ico-amber" />
              Jl. Raya Ciperna (Dekat Tol Ciperna), Cirebon
            </span>
            <a
              className="web-topbar-link"
              href={MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Maps <Icon name="external-link" size={12} />
            </a>
          </div>
        </div>
      </div>

      {/* Sticky navigation */}
      <header className="web-navbar">
        <div className="web-shell web-navbar-inner">
          <a className="web-brand" href="#home">
            <span className="web-brand-mark">
              <img src="/logo.png" alt="Logo Tepi Sawah" loading="eager" />
            </span>
            <span className="web-brand-text">
              <span className="web-brand-name">TEPI SAWAH</span>
              <span className="web-brand-tag">Restaurant &amp; Coffee • Ciperna</span>
            </span>
          </a>

          <nav className="web-nav-desktop" aria-label="Navigasi utama">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="web-nav-link">
                {link.label}
              </a>
            ))}
          </nav>

          <div className="web-nav-actions">
            <a
              href="#reservasi"
              className="web-btn web-btn-gold web-btn-pill"
            >
              <Icon name="calendar" size={16} />
              <span>Reservasi Meja &amp; Acara</span>
            </a>
          </div>

          <div className="web-nav-mobile">
            <a
              href="#reservasi"
              className="web-btn web-btn-gold web-btn-pill web-btn-xs"
            >
              <Icon name="calendar" size={14} />
              <span>Reservasi</span>
            </a>
            <button
              type="button"
              className="web-burger"
              aria-label={drawerOpen ? "Tutup Menu Navigasi" : "Buka Menu Navigasi"}
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen((open) => !open)}
            >
              <Icon name={drawerOpen ? "x" : "menu"} size={24} />
            </button>
          </div>
        </div>

        {drawerOpen ? (
          <div className="web-drawer">
            <nav className="web-drawer-nav" aria-label="Navigasi seluler">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setDrawerOpen(false)}
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <div className="web-drawer-actions">
              <a
                href="#reservasi"
                className="web-btn web-btn-gold"
                onClick={() => setDrawerOpen(false)}
              >
                <Icon name="calendar" size={16} />
                <span>Reservasi Meja &amp; Acara</span>
              </a>
            </div>
          </div>
        ) : null}
      </header>
    </>
  );
}
