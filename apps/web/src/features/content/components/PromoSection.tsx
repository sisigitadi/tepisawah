/**
 * @tepisawah/web — promo & paket section.
 *
 * Three package cards with a live promo notice banner; the rombongan card
 * opens the reservation modal with a seeded note.
 */
import type { ReactNode } from "react";
import { Icon } from "../../../components/icons.js";
import { useReservation } from "../reservation.js";

const PROMOS: ReadonlyArray<{
  accent: string;
  pillClass: string;
  pill: string;
  title: string;
  sub: string;
  desc: string;
  foot: string;
  cta: "menu" | "reserve";
  reserveNote?: string;
}> = [
  {
    accent: "golden",
    pillClass: "web-promo-pill-forest",
    pill: "Paket Santap",
    title: "Paket Nasi Liwet Komplit",
    sub: "Porsi Keluarga (4 Orang)",
    desc: "Kombinasi nasi liwet kastrol harum, ayam goreng bumbu kuning, sambal terasi daun pisang, tahu, tempe, lalapan segar sawah, dan teh manis hangat.",
    foot: "Paket Hemat Meja",
    cta: "menu",
  },
  {
    accent: "forest",
    pillClass: "web-promo-pill-amber",
    pill: "Sore & Senja",
    title: "Paket Ngopi Sunset Sawah",
    sub: "Mulai Pukul 15:30 WIB",
    desc: "Nikmati hembusan angin senja di dek rooftop dengan racikan Kopi Senja Sawah atau teh poci gula batu berpadu aneka kudapan hangat pedesaan.",
    foot: "Spot Rooftop 360°",
    cta: "menu",
  },
  {
    accent: "golden",
    pillClass: "web-promo-pill-deep",
    pill: "Rombongan & Gathering",
    title: "Paket Reservasi Rombongan",
    sub: "Keluarga & Acara Khusus",
    desc: "Alokasi area saung lesehan prioritas untuk gathering kantor, arisan keluarga, maupun rombongan wisata tanpa biaya reservasi tambahan.",
    foot: "Kapasitas Fleksibel",
    cta: "reserve",
    reserveNote: "Paket Reservasi Rombongan",
  },
];

export function PromoSection(): ReactNode {
  const { openReservation } = useReservation();

  return (
    <section id="promo-paket" className="web-shell web-section">
      <div className="web-head-center">
        <span className="web-eyebrow">Penawaran Spesial</span>
        <h2 className="web-section-title web-section-title-lg">Promo &amp; Paket</h2>
        <p className="web-head-center-sub">
          Temukan promo dan paket yang sedang tersedia di Tepi Sawah Ciperna.
        </p>
      </div>

      <div className="web-promo-grid">
        {PROMOS.map((promo) => (
          <article
            key={promo.title}
            className="web-promo-card"
            data-accent={promo.accent}
          >
            <span className={`web-promo-pill ${promo.pillClass}`}>
              {promo.pill}
            </span>
            <div className="web-promo-head">
              <h3 className="web-promo-title">{promo.title}</h3>
              <p className="web-promo-sub">{promo.sub}</p>
            </div>
            <p className="web-promo-desc">{promo.desc}</p>
            <div className="web-promo-foot">
              <span className="web-promo-foot-label">{promo.foot}</span>
              {promo.cta === "menu" ? (
                <a
                  className="web-btn web-btn-forest web-btn-sm"
                  href="#menu-pilihan"
                >
                  Lihat Menu Pilihan
                </a>
              ) : (
                <button
                  type="button"
                  className="web-btn web-btn-forest web-btn-sm"
                  onClick={() => openReservation(promo.reserveNote)}
                >
                  Reservasi Meja
                </button>
              )}
            </div>
          </article>
        ))}
      </div>

      <div className="web-promo-banner">
        <div className="web-promo-banner-copy">
          <span className="web-promo-banner-kicker">
            <Icon name="tag" size={14} />
            PROMO AKTIF RESTORAN
          </span>
          <h3 className="web-promo-banner-title">
            Informasi Menu &amp; Promo Selalu Terkini
          </h3>
          <p className="web-promo-banner-desc">
            Informasi promo harian, paket musiman, dan ketersediaan porsi selalu
            diperbarui secara real-time pada sistem pemesanan online kami.
          </p>
        </div>
        <button
          type="button"
          className="web-btn web-btn-amber web-btn-lg"
          onClick={() => openReservation()}
        >
          <Icon name="calendar" size={16} />
          <span>Reservasi Meja Sekarang</span>
        </button>
      </div>
    </section>
  );
}
