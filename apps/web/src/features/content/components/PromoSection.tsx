/**
 * @tepisawah/web — promo & paket section.
 *
 * Three package cards with a live promo notice banner; the rombongan card
 * opens the reservation modal with a seeded note.
 */
import type { ReactNode } from "react";
import { Icon } from "../../../components/icons.js";
import { useLandingContent, DEFAULT_PROMO_ITEMS } from "../../../hooks/index.js";

export function PromoSection(): ReactNode {
  const { content } = useLandingContent();
  const promo = content.promo;

  if (promo.isActive === false) {
    return null;
  }

  const items = (promo.items && promo.items.length > 0 ? promo.items : DEFAULT_PROMO_ITEMS).filter(
    (item) => item.isActive !== false
  );

  return (
    <section id="promo-paket" className="web-shell web-section">
      <div className="web-head-center">
        <span className="web-eyebrow">{promo.eyebrow || "Penawaran Spesial"}</span>
        <h2 className="web-section-title web-section-title-lg">{promo.title || "Promo & Paket"}</h2>
        <p className="web-head-center-sub">
          {promo.subtitle || "Temukan promo dan paket yang sedang tersedia di Tepi Sawah Ciperna."}
        </p>
      </div>

      <div className="web-promo-grid">
        {items.map((item) => (
          <article
            key={item.id || item.title}
            className="web-promo-card"
            data-accent={item.accent || "golden"}
          >
            {item.imageUrl ? (
              <div className="web-promo-media">
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="web-promo-img"
                  loading="lazy"
                />
                <span className={`web-promo-pill ${item.pillClass || "web-promo-pill-forest"}`}>
                  {item.pill}
                </span>
              </div>
            ) : (
              <span className={`web-promo-pill ${item.pillClass || "web-promo-pill-forest"}`}>
                {item.pill}
              </span>
            )}
            <div className="web-promo-head">
              <h3 className="web-promo-title">{item.title}</h3>
              <p className="web-promo-sub">{item.sub}</p>
            </div>
            <p className="web-promo-desc">{item.desc}</p>
            <div className="web-promo-foot">
              <span className="web-promo-foot-label">{item.foot}</span>
              <a
                className="web-btn web-btn-forest web-btn-sm"
                href={item.ctaLink || "#menu-pilihan"}
              >
                {item.ctaText || "Lihat Menu Pilihan"}
              </a>
            </div>
          </article>
        ))}
      </div>

      <div className="web-promo-banner">
        <div className="web-promo-banner-copy">
          <span className="web-promo-banner-kicker">
            <Icon name="tag" size={14} />
            {promo.badge || "PROMO AKTIF RESTORAN"}
          </span>
          <h3 className="web-promo-banner-title">
            {promo.bannerTitle || promo.title || "Informasi Menu & Promo Selalu Terkini"}
          </h3>
          <p className="web-promo-banner-desc">
            {promo.bannerDesc ||
              promo.description ||
              "Informasi promo harian, paket musiman, dan ketersediaan porsi selalu diperbarui secara real-time di etalase menu kami: cek kapan saja sebelum berkunjung."}
          </p>
        </div>
        <a
          className="web-btn web-btn-amber web-btn-lg"
          href={promo.bannerCtaLink || "#menu-pilihan"}
        >
          <Icon name="utensils" size={16} />
          <span>{promo.bannerCtaText || "Jelajahi Menu Pilihan"}</span>
        </a>
      </div>
    </section>
  );
}
