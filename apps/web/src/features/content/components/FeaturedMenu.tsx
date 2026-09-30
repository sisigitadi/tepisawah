/**
 * @tepisawah/web — featured menu + category preview cards.
 *
 * The dish grid renders the LIVE customer catalog: the anonymous
 * `public_catalog()` projection (migration 005 part 5) through
 * `@tepisawah/database`, so a menu change saved in the admin console appears
 * here on the next visit — archived items and out-of-stock dishes never
 * surface. The read fails closed with a retry; the marketing category cards
 * below stay static copy.
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Icon, type IconName } from "../../../components/icons.js";
import { formatPrice } from "../../../data/menu.js";
import {
  fetchPublicCatalog,
  groupCatalogByCategory,
  type PublicCatalogProduct,
} from "@tepisawah/database";

import { getSupabaseClient } from "../../../lib/supabase.js";

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

interface CategoryPill {
  id: string;
  name: string;
}

export function FeaturedMenu(): ReactNode {
  const [products, setProducts] = useState<PublicCatalogProduct[] | null>(null);
  const [categories, setCategories] = useState<CategoryPill[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<string>("SEMUA");

  const load = useCallback(async () => {
    setError(null);
    const result = await fetchPublicCatalog(getSupabaseClient());
    if (result.error) {
      setProducts(null);
      setError(result.error.message);
      return;
    }
    const rows = result.data ?? [];
    const grouped = groupCatalogByCategory(rows);
    setProducts(rows);
    setCategories(grouped.map((group) => ({ id: group.id, name: group.name })));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const items =
    products === null
      ? []
      : active === "SEMUA"
        ? products
        : products.filter((item) => item.categoryId === active);

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
          {products !== null && categories.length > 0 ? (
            <div className="web-filter" role="group" aria-label="Filter menu">
              <button
                type="button"
                className="web-filter-btn"
                data-active={active === "SEMUA"}
                onClick={() => setActive("SEMUA")}
              >
                Semua
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className="web-filter-btn"
                  data-active={active === category.id}
                  onClick={() => setActive(category.id)}
                >
                  {category.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {error !== null ? (
          <div className="web-menu-grid" role="alert">
            <article className="web-dish">
              <div className="web-dish-body">
                <h3 className="web-dish-name">Tidak dapat memuat menu</h3>
                <p className="web-dish-desc">{error}</p>
                <div className="web-dish-foot">
                  <button
                    type="button"
                    className="web-filter-btn"
                    onClick={() => void load()}
                  >
                    Coba lagi
                  </button>
                </div>
              </div>
            </article>
          </div>
        ) : products === null ? (
          <p aria-live="polite">Memuat menu…</p>
        ) : (
          <div className="web-menu-grid">
            {items.map((item) => (
              <article key={item.productId} className="web-dish">
                <div className="web-dish-photo">
                  {item.imageUrl ? (
                    <img
                      className="web-dish-art"
                      src={item.imageUrl}
                      alt={`Foto ${item.name}`}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="web-dish-art web-dish-art--fallback" aria-hidden="true" />
                  )}
                  <div className="web-dish-veil" />
                  <span className="web-dish-cat">{item.categoryName}</span>
                  {item.isAvailable ? null : (
                    <span className="web-dish-badge">Habis</span>
                  )}
                </div>
                <div className="web-dish-body">
                  <div className="web-dish-top">
                    <h3 className="web-dish-name">{item.name}</h3>
                    <span className="web-dish-price">
                      {formatPrice(item.price)}
                    </span>
                  </div>
                  <p className="web-dish-desc">{item.description}</p>
                </div>
                <div className="web-dish-foot">
                  <span className="web-dish-avail">
                    <Icon name="check" size={14} />
                    {item.isAvailable ? "Tersedia Hari Ini" : "Habis hari ini"}
                  </span>
                  <span className="web-dish-order">
                    <Icon name="info" size={14} />
                    Pesan di tempat (QR / kasir)
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}

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
