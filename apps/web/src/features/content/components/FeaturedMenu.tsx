/**
 * @tepisawah/web — featured menu + category preview cards.
 *
 * Renders from the shared menu source of truth (`data/menu.ts`); the category
 * filter is pure UI state. Reference photos are CDN-blocked, so each card uses
 * an illustrated gradient thumbnail with the category icon.
 */
import { useState, type ReactNode } from "react";
import { Icon, type IconName } from "../../../components/icons.js";
import {
  formatPrice,
  filterMenuItems,
  MENU_CATEGORIES,
  MENU_CATEGORY_LABEL,
  type MenuCategory,
} from "../../../data/menu.js";
import { MenuImage } from "@tepisawah/ui";

const CATEGORY_ICON: Record<MenuCategory, IconName> = {
  SEMUA: "sparkles",
  MAKANAN: "utensils",
  SAYUR: "leaf",
  MINUMAN: "coffee",
};

const CATEGORIES: ReadonlyArray<{ label: string; value: MenuCategory }> = [
  { label: "Semua", value: "SEMUA" },
  { label: "Makanan Utama", value: "MAKANAN" },
  { label: "Sayur & Sup", value: "SAYUR" },
  { label: "Minuman & Kopi", value: "MINUMAN" },
];

const CATEGORY_CARDS: ReadonlyArray<{
  icon: IconName;
  title: string;
  desc: string;
  foot: string;
}> = [
  {
    icon: "utensils",
    title: "Makanan Utama",
    desc: "Kuliner Nusantara, olahan ayam roaster rempah, nasi liwet hangat, dan aneka hidangan bakar istimewa.",
    foot: "Tersedia Setiap Hari",
  },
  {
    icon: "users",
    title: "Paket Santap Keluarga",
    desc: "Pilihan paket santap lengkap untuk 4 hingga 10 orang dengan porsi sharing hemat dan memuaskan.",
    foot: "Porsi Hemat Sharing",
  },
  {
    icon: "coffee",
    title: "Kopi & Minuman Segar",
    desc: "Espresso aren Kopi Senja Sawah, kelapa jeruk muda berbulir, teh poci tradisional, dan racikan non-coffee.",
    foot: "Signature Coffee & Tea",
  },
  {
    icon: "sparkles",
    title: "Camilan Tradisional",
    desc: "Teman santai ngopi di saung dengan aneka gorengan hangat, pisang goreng, dan kudapan khas pedesaan.",
    foot: "Teman Santai Senja",
  },
];

export function FeaturedMenu(): ReactNode {
  const [active, setActive] = useState<MenuCategory>("SEMUA");
  const items = filterMenuItems(active);

  return (
    <>
      <section id="menu-pilihan" className="web-shell web-section">
        <div className="web-menu-head">
          <div>
            <span className="web-eyebrow">Katalog Kuliner Otentik</span>
            <h2 className="web-section-title">Menu Pilihan</h2>
            <p className="web-menu-head-sub">
              Hidangan favorit untuk menemani waktu Anda di Tepi Sawah.
            </p>
          </div>
          <div className="web-filter" role="group" aria-label="Filter menu">
            {CATEGORIES.map((category) => (
              <button
                key={category.value}
                type="button"
                className="web-filter-btn"
                data-active={active === category.value}
                onClick={() => setActive(category.value)}
              >
                {category.label}
              </button>
            ))}
          </div>
        </div>

        <div className="web-menu-grid">
          {items.map((item) => (
            <article key={item.id} className="web-dish">
              <div className="web-dish-photo">
                <MenuImage id={item.id} className="web-dish-art" />
                <div className="web-dish-veil" />
                <span className="web-dish-cat">
                  {MENU_CATEGORY_LABEL[item.category]}
                </span>
                <span className="web-dish-badge">{item.badge}</span>
              </div>
              <div className="web-dish-body">
                <div className="web-dish-top">
                  <h3 className="web-dish-name">{item.name}</h3>
                  <span className="web-dish-price">
                    {formatPrice(item.price)}
                  </span>
                </div>
                <p className="web-dish-desc">{item.desc}</p>
              </div>
              <div className="web-dish-foot">
                <span className="web-dish-avail">
                  <Icon name="check" size={14} /> Tersedia Hari Ini
                </span>
                <span className="web-dish-order">
                  <Icon name="info" size={14} />
                  Pesan di tempat (QR / kasir)
                </span>
              </div>
            </article>
          ))}
        </div>

        <div className="web-menu-cta web-menu-notice">
          <span className="web-menu-notice-ico">
            <Icon name="info" size={18} />
          </span>
          <span className="web-menu-notice-text">
            <strong>Pemesanan hanya tersedia di tempat.</strong> Menu disajikan
            sebagai informasi: pesan melalui scan QR di meja Anda, langsung di
            kasir, atau dibantu oleh pramusaji kami.
          </span>
        </div>
      </section>

      <section className="web-shell web-section">
        <div className="web-head-center">
          <span className="web-eyebrow">Kategori Menu Lengkap</span>
          <h2 className="web-section-title web-section-title-lg">
            Pilihan Sajian Nusantara &amp; Racikan Kopi
          </h2>
          <p className="web-head-center-sub">
            Tersedia ragam pilihan hidangan hangat, olahan bakar, dan minuman
            pelepas dahaga.
          </p>
        </div>
        <div className="web-cat-grid">
          {CATEGORY_CARDS.map((card) => (
            <article key={card.title} className="web-catcard">
              <div>
                <span className="web-cat-ico">
                  <Icon name={card.icon} size={20} />
                </span>
                <h3 className="web-cat-title">{card.title}</h3>
                <p className="web-cat-desc">{card.desc}</p>
              </div>
              <span className="web-cat-foot">
                {card.foot} <Icon name="chevron-right" size={14} />
              </span>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
