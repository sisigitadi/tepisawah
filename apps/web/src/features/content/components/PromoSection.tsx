/**
 * @tepisawah/web — promo & paket section.
 *
 * Three package cards with a live promo notice banner; the rombongan card
 * opens the reservation modal with a seeded note.
 */
import type { ReactNode } from "react";
import { Icon } from "../../../components/icons.js";

const PROMOS: ReadonlyArray<{
  accent: string;
  pillClass: string;
  pill: string;
  title: string;
  sub: string;
  desc: string;
  foot: string;
  cta: "menu" | "reserve";
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
  },
];

export function PromoSection(): ReactNode {
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
                <a
                  className="web-btn web-btn-forest web-btn-sm"
                  href="#reservasi"
                >
                  Layanan Meja &amp; Acara
                </a>
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
            diperbarui secara real-time di etalase menu kami — cek kapan saja
            sebelum berkunjung.
          </p>
        </div>
        <a
          className="web-btn web-btn-amber web-btn-lg"
          href="#menu-pilihan"
        >
          <Icon name="utensils" size={16} />
          <span>Jelajahi Menu Pilihan</span>
        </a>
      </div>
    </section>
  );
}
