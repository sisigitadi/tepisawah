/**
 * @tepisawah/ui — canonical menu catalog.
 *
 * Single source of truth for the demo menu shown across the public website
 * (read-only), the customer QR order app, POS, kitchen and waiter screens.
 * Every app renders the same ids, names, prices and illustrations so the
 * catalog stays in sync everywhere. In production this seed is replaced by
 * the `public_catalog()` API projection (@tepisawah/catalog).
 */

export const MENU_CATEGORIES = [
  "SEMUA",
  "MAKANAN",
  "SAYUR",
  "MINUMAN",
] as const;

export type MenuCategory = (typeof MENU_CATEGORIES)[number];

export interface MenuItem {
  readonly id: string;
  readonly name: string;
  readonly category: Exclude<MenuCategory, "SEMUA">;
  readonly price: number;
  readonly desc: string;
  readonly badge: string;
  /** Illustration asset, resolved by the bundler per app. */
  readonly image: string;
  /** Real food/drink photograph (Unsplash CDN), shown when reachable. */
  readonly photo: string;
  /** Photographer credit for the photograph (Unsplash attribution). */
  readonly photoCredit: string;
  /** Two-stop brand gradient used for backdrops and glows. */
  readonly hue: string;
}

export const MENU_ITEMS: readonly MenuItem[] = [
  {
    id: "chicken-roaster",
    name: "Chicken Roaster Rempah",
    category: "MAKANAN",
    price: 85000,
    desc: "Ayam panggang oven rempah spesial Tepi Sawah, empuk juicy beraroma rosemary, disajikan sambal terasi pedesaan.",
    badge: "Pilihan Koki",
    image: "chicken-roaster",
    photo:
      "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80",
    photoCredit: "Unsplash",
    hue: "linear-gradient(140deg,#8C5A2B,#3D1F10)",
  },
  {
    id: "gurame-bakar",
    name: "Gurame Bakar Madu",
    category: "MAKANAN",
    price: 95000,
    desc: "Ikan gurame segar kolam air tawar dibakar dengan polesan madu hutan alami dan kecap rempah pedas manis.",
    badge: "Spesial Rempah",
    image: "gurame-bakar",
    photo:
      "https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?auto=format&fit=crop&w=800&q=80",
    photoCredit: "Unsplash",
    hue: "linear-gradient(140deg,#B4531F,#7A2E12)",
  },
  {
    id: "nasi-liwet",
    name: "Nasi Liwet Sawah Komplit",
    category: "MAKANAN",
    price: 45000,
    desc: "Nasi gurih santan rempah dilengkapi teri medan renyah, petai bakar, telur asin, ayam bumbu kuning, dan sambal terasi.",
    badge: "Favorit Santap",
    image: "nasi-liwet",
    photo:
      "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=800&q=80",
    photoCredit: "Unsplash",
    hue: "linear-gradient(140deg,#C9A227,#2E6B34)",
  },
  {
    id: "ayam-goreng-lengkuas",
    name: "Ayam Goreng Lengkuas",
    category: "MAKANAN",
    price: 38000,
    desc: "Ayam kampung ungkep empuk ditaburi parutan lengkuas garing harum khas Parahyangan, disajikan hangat.",
    badge: "Gurih Pedesaan",
    image: "ayam-goreng-lengkuas",
    photo:
      "https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=800&q=80",
    photoCredit: "Unsplash",
    hue: "linear-gradient(140deg,#D9A05B,#6F3F24)",
  },
  {
    id: "sayur-asem",
    name: "Sayur Asem Klaten",
    category: "SAYUR",
    price: 25000,
    desc: "Kuah asam jawa segar kaya cita rasa dengan labu siam, kacang panjang melinjo, jagung manis, dan kacang tanah gurih.",
    badge: "Segar Alami",
    image: "sayur-asem",
    photo:
      "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=800&q=80",
    photoCredit: "Unsplash",
    hue: "linear-gradient(140deg,#5C9A4B,#183A1D)",
  },
  {
    id: "karedok-leunca",
    name: "Karedok Leunca Segar",
    category: "SAYUR",
    price: 25000,
    desc: "Sayuran mentah segar dengan bumbu kacang kencur khas Sunda otentik, leunca pilihan, dan kerupuk kanji.",
    badge: "Sehat & Segar",
    image: "karedok-leunca",
    photo:
      "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80",
    photoCredit: "Unsplash",
    hue: "linear-gradient(140deg,#6BAE4E,#1F4A24)",
  },
  {
    id: "es-kelapa",
    name: "Es Kelapa Jeruk Segar",
    category: "MINUMAN",
    price: 18000,
    desc: "Kelapa muda keruk murni dipadu perasan jeruk manis alami berbulir, disajikan dingin penyejuk dahaga.",
    badge: "Pelepas Dahaga",
    image: "es-kelapa",
    photo:
      "https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=800&q=80",
    photoCredit: "Unsplash",
    hue: "linear-gradient(140deg,#5DADE2,#1B6E8C)",
  },
  {
    id: "kopi-senja",
    name: "Kopi Senja Sawah",
    category: "MINUMAN",
    price: 28000,
    desc: "Espresso robusta lokal dipadu susu aren kental creamy berlapis es batu segar dengan aroma biji sangrai pedesaan.",
    badge: "Signature Coffee",
    image: "kopi-senja",
    photo:
      "https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=800&q=80",
    photoCredit: "Unsplash",
    hue: "linear-gradient(140deg,#8B5E3C,#3D1F10)",
  },
] as const;

export const MENU_CATEGORY_LABEL: Record<
  Exclude<MenuCategory, "SEMUA">,
  string
> = {
  MAKANAN: "Makanan Utama",
  SAYUR: "Sayur & Sup",
  MINUMAN: "Minuman & Kopi",
};

export function formatPrice(value: number): string {
  return `Rp ${value.toLocaleString("id-ID")}`;
}

export function filterMenuItems(category: MenuCategory): readonly MenuItem[] {
  if (category === "SEMUA") return MENU_ITEMS;
  return MENU_ITEMS.filter((item) => item.category === category);
}

export function getMenuItem(id: string): MenuItem | undefined {
  return MENU_ITEMS.find((item) => item.id === id);
}
