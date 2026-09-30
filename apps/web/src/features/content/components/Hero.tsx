/**
 * @tepisawah/web — hero + quick actions.
 *
 * Split hero with a local panorama backdrop (reference CDN is unreachable),
 * operational pills, schedule card, and the 4 primary quick-action cards.
 */
import type { ReactNode } from "react";
import { Icon } from "../../../components/icons.js";
import { useReservation } from "../reservation.js";
import { MAPS_URL } from "./SiteHeader.js";

const QUICK_ACTIONS: ReadonlyArray<{
  href: string;
  icon: "qr-code" | "book-open" | "calendar-check" | "map-pin";
  iconClass: string;
  title: string;
  desc: string;
}> = [
  {
    href: "#qr-order",
    icon: "qr-code",
    iconClass: "web-qicon-amber",
    title: "Cara Pesan",
    desc: "Pemesanan hanya tersedia di tempat: scan QR di meja, langsung di kasir, atau melalui pramusaji.",
  },
  {
    href: "#menu-pilihan",
    icon: "book-open",
    iconClass: "web-qicon-forest",
    title: "Lihat Menu",
    desc: "Jelajahi ayam roaster, gurame bakar madu, sayur asem, serta racikan kopi senja.",
  },
  {
    href: "#reservasi",
    icon: "calendar-check",
    iconClass: "web-qicon-gold",
    title: "Reservasi Meja",
    desc: "Booking tempat untuk rombongan keluarga, gathering, reuni, maupun acara spesial.",
  },
  {
    href: "#lokasi",
    icon: "map-pin",
    iconClass: "web-qicon-coffee",
    title: "Lokasi & Rute",
    desc: "Petunjuk arah Google Maps akurat hanya 3 menit dari Pintu Tol Ciperna Cirebon.",
  },
];

export function Hero(): ReactNode {
  const { openReservation } = useReservation();

  return (
    <>
      <section id="home" className="web-hero">
        <div className="web-hero-bg" aria-hidden="true">
          <img
            src="/sawah-panorama.png"
            alt="Panorama hamparan sawah Tepi Sawah Ciperna Cirebon"
            loading="eager"
          />
          <div className="web-hero-veil" />
        </div>

        <div className="web-shell web-hero-grid">
          <div className="web-hero-copy">
            <div className="web-hero-pills">
              <span className="web-pill-live">
                <span className="web-pill-dot" />
                <span>SUDAH BUKA &amp; SIAP MELAYANI</span>
              </span>
              <span className="web-pill-place">
                <Icon name="map-pin" size={14} className="web-ico-amber" />{" "}
                Ciperna, Cirebon
              </span>
            </div>

            <div className="web-hero-heading">
              <span className="web-hero-eyebrow">
                Authentic Rural Dining Destination
              </span>
              <h1 className="web-hero-title">
                TEPI SAWAH
                <br />
                <span className="web-hero-title-sub">
                  Restaurant &amp; Coffee
                </span>
              </h1>
            </div>

            <p className="web-hero-desc">
              Nikmati kuliner Nusantara otentik, racikan kopi segar, dan
              hembusan semilir angin pedesaan di tengah hamparan sawah hijau
              Ciperna, Cirebon. Hadir dengan saung lesehan asri, dek rooftop
              360°, serta suasana hangat ramah keluarga.
            </p>

            <div className="web-hero-schedule">
              <span className="web-hero-schedule-ico">
                <Icon name="clock" size={16} />
              </span>
              <span>
                <span className="web-hero-schedule-label">Jadwal Kunjungan</span>
                <span className="web-hero-schedule-value">
                  Buka Setiap Hari: 09:00 – 22:00 WIB
                </span>
              </span>
            </div>

            <div className="web-hero-actions">
              <a className="web-btn web-btn-gold" href="#menu-pilihan">
                <Icon name="utensils" size={16} />
                <span>Lihat Menu Pilihan</span>
              </a>
              <button
                type="button"
                className="web-btn web-btn-ghost-light"
                onClick={() => openReservation()}
              >
                <Icon name="calendar" size={16} />
                <span>Reservasi Meja</span>
              </button>
            </div>
          </div>

          <div className="web-hero-aside">
            <div className="web-snapshot">
              <div className="web-snapshot-photo">
                <img
                  src="/sawah-panorama.png"
                  alt="Tampak Atas Area Saung dan Rooftop Tepi Sawah"
                  loading="lazy"
                />
                <div className="web-snapshot-veil" />
                <div className="web-snapshot-cap">
                  <span className="web-snapshot-name">
                    Saung Lesehan &amp; Rooftop Deck
                  </span>
                  <span className="web-snapshot-sub">
                    Pemandangan 360° Sawah Hijau
                  </span>
                </div>
                <span className="web-snapshot-badge">Buka Sekarang</span>
              </div>

              <div className="web-snapshot-grid">
                {(
                  [
                    ["utensils", "Kuliner Nusantara", "Rempah Tradisional"],
                    ["coffee", "Coffee & Beverage", "Kopi Senja Sawah"],
                    ["sun", "Saung & Rooftop", "Sunset Panorama"],
                    ["users", "Family Friendly", "Parkir Bus & Mobil"],
                  ] as const
                ).map(([icon, title, sub]) => (
                  <div key={title} className="web-snapshot-cell">
                    <span className="web-snapshot-ico">
                      <Icon name={icon} size={16} />
                    </span>
                    <span>
                      <strong className="web-snapshot-cell-title">
                        {title}
                      </strong>
                      <span className="web-snapshot-cell-sub">{sub}</span>
                    </span>
                  </div>
                ))}
              </div>

              <div className="web-snapshot-loc">
                <p className="web-snapshot-addr">
                  <Icon name="navigation" size={14} className="web-ico-amber" />
                  Jl. Raya Ciperna (Hanya 3 Menit dari Gerbang Tol Ciperna),
                  Kec. Talun, Kab. Cirebon
                </p>
                <a
                  className="web-btn web-btn-forest web-btn-sm"
                  href={MAPS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon name="map" size={14} />
                  <span>Buka Petunjuk Arah Google Maps</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="web-shell web-quick">
        {QUICK_ACTIONS.map((action) => (
          <a
            key={action.title}
            className="web-qcard"
            data-accent="paper"
            href={action.href}
          >
            <span className={`web-qicon ${action.iconClass}`}>
              <Icon name={action.icon} size={24} />
            </span>
            <span className="web-qcard-body">
              <span className="web-qcard-title">{action.title}</span>
              <span className="web-qcard-desc">{action.desc}</span>
            </span>
          </a>
        ))}
      </section>
    </>
  );
}
