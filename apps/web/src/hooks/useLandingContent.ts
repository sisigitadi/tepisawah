/**
 * @tepisawah/web - Hook to fetch and synchronize dynamic landing page content
 * configured via the Staff Portal CMS for all 8 website sections.
 *
 * Provides real-time synchronization across browser tabs using Supabase
 * with a high-performance local cache fallback.
 */
import { useEffect, useState } from "react";
import { getSupabaseClient } from "../lib/supabase.js";
import { DEFAULT_GALLERY_ITEMS, type GalleryItem } from "../data/gallery.js";

export type GalleryItemConfig = GalleryItem;

export interface HeroContent {
  isActive: boolean;
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  hours: string;
  bgImage: string;
}

export interface MenuItemConfig {
  id: string;
  isActive: boolean;
  name: string;
  category: string;
  price: string;
  desc: string;
  imageUrl: string;
  badge?: string;
}

export const DEFAULT_MENU_ITEMS: MenuItemConfig[] = [
  {
    id: "menu-1",
    isActive: true,
    name: "Nasi Liwet Sawah Komplit",
    category: "Makanan Utama",
    price: "Rp 45.000",
    desc: "Nasi gurih santan rempah kastrol hangat dengan ayam ungkep bumbu kuning, teri medan, petai bakar, telur asin, dan sambal terasi.",
    imageUrl: "/gallery/saung-lesehan.webp",
    badge: "Favorit Santap",
  },
  {
    id: "menu-2",
    isActive: true,
    name: "Chicken Roaster Rempah",
    category: "Makanan Utama",
    price: "Rp 85.000",
    desc: "Ayam utuh panggang oven dengan baluran rempah rahasia Nusantara, daging empuk juicy meresap sempurna, disajikan dengan lalapan segar.",
    imageUrl: "/gallery/ayam-roaster.webp",
    badge: "Pilihan Koki",
  },
  {
    id: "menu-3",
    isActive: true,
    name: "Gurame Bakar Madu Pedas Manis",
    category: "Makanan Utama",
    price: "Rp 65.000",
    desc: "Ikan gurame segar kolam air tawar dibakar arang dengan olesan madu hutan alami dan bumbu kecap manis pedas gurih.",
    imageUrl: "/gallery/gurame-bakar.webp",
    badge: "Spesial Rempah",
  },
  {
    id: "menu-4",
    isActive: true,
    name: "Kopi Senja Sawah & Kudapan",
    category: "Minuman",
    price: "Rp 25.000",
    desc: "Racikan espresso house blend dengan gula aren kelapa organik, susu segar creamy, cocok dinikmati bersama pisang goreng senja.",
    imageUrl: "/gallery/kopi-senja.webp",
    badge: "Signature Drink",
  },
  {
    id: "menu-5",
    isActive: true,
    name: "Paket Bancakan Rombongan",
    category: "Paket Santap",
    price: "Rp 185.000",
    desc: "Sajian beralas daun pisang khas Sunda untuk santap bersama keluarga atau rekan kerja dengan lauk pauk komplit dan sambal dadak.",
    imageUrl: "/gallery/rombongan-gathering.webp",
    badge: "Porsi Keluarga",
  },
  {
    id: "menu-6",
    isActive: true,
    name: "Es Kelapa Muda Batok Segar",
    category: "Minuman",
    price: "Rp 18.000",
    desc: "Air kelapa murni langsung dari batok kelapa segar pilihan dengan kerukan daging kelapa lembut dan sirup gula aren / jeruk nipis.",
    imageUrl: "/gallery/rooftop-senja.webp",
    badge: "Segar Alami",
  },
];

export interface MenuContent {
  isActive: boolean;
  eyebrow: string;
  title: string;
  description: string;
  bannerImage: string;
  items: MenuItemConfig[];
}

export interface PromoItemConfig {
  id: string;
  isActive: boolean;
  accent: "golden" | "forest";
  pillClass?: string;
  pill: string;
  title: string;
  sub: string;
  desc: string;
  foot: string;
  ctaText: string;
  ctaLink: string;
  imageUrl: string;
}

export const DEFAULT_PROMO_ITEMS: PromoItemConfig[] = [
  {
    id: "promo-1",
    isActive: true,
    accent: "golden",
    pillClass: "web-promo-pill-forest",
    pill: "Paket Santap",
    title: "Paket Nasi Liwet Komplit",
    sub: "Porsi Keluarga (4 Orang)",
    desc: "Kombinasi nasi liwet kastrol harum, ayam goreng bumbu kuning, sambal terasi daun pisang, tahu, tempe, lalapan segar sawah, dan teh manis hangat.",
    foot: "Paket Hemat Meja",
    ctaText: "Lihat Menu Pilihan",
    ctaLink: "#menu-pilihan",
    imageUrl: "/gallery/saung-lesehan.webp",
  },
  {
    id: "promo-2",
    isActive: true,
    accent: "forest",
    pillClass: "web-promo-pill-amber",
    pill: "Sore & Senja",
    title: "Paket Ngopi Sunset Sawah",
    sub: "Mulai Pukul 15:30 WIB",
    desc: "Nikmati hembusan angin senja di dek rooftop dengan racikan Kopi Senja Sawah atau teh poci gula batu berpadu aneka kudapan hangat pedesaan.",
    foot: "Spot Rooftop 360°",
    ctaText: "Lihat Menu Pilihan",
    ctaLink: "#menu-pilihan",
    imageUrl: "/gallery/kopi-senja.webp",
  },
  {
    id: "promo-3",
    isActive: true,
    accent: "golden",
    pillClass: "web-promo-pill-deep",
    pill: "Rombongan & Gathering",
    title: "Paket Reservasi Rombongan",
    sub: "Keluarga & Acara Khusus",
    desc: "Alokasi area saung lesehan prioritas untuk gathering kantor, arisan keluarga, maupun rombongan wisata tanpa biaya reservasi tambahan.",
    foot: "Kapasitas Fleksibel",
    ctaText: "Layanan Meja & Acara",
    ctaLink: "#reservasi",
    imageUrl: "/gallery/rombongan-gathering.webp",
  },
  {
    id: "promo-4",
    isActive: true,
    accent: "forest",
    pillClass: "web-promo-pill-forest",
    pill: "Spesial Panggang",
    title: "Paket Roaster Rempah Sawah",
    sub: "Ayam Utuh Oven Empuk",
    desc: "Ayam panggang oven empuk berbumbu rempah rahasia Nusantara, disajikan dengan sambal terasi segar, lalapan, dan nasi hangat pulen.",
    foot: "Menu Favorit Tamu",
    ctaText: "Lihat Menu Pilihan",
    ctaLink: "#menu-pilihan",
    imageUrl: "/gallery/ayam-roaster.webp",
  },
  {
    id: "promo-5",
    isActive: true,
    accent: "golden",
    pillClass: "web-promo-pill-amber",
    pill: "Sensasi Bakar",
    title: "Paket Gurame Bakar Madu",
    sub: "Ikan Segar Bakar Karamel",
    desc: "Gurame segar berlapis kecap madu karamel dengan lalapan segar, tahu tempe, dan sambal kecap cabai rawit pedas mantap.",
    foot: "Pilihan Favorit Keluarga",
    ctaText: "Lihat Menu Pilihan",
    ctaLink: "#menu-pilihan",
    imageUrl: "/gallery/gurame-bakar.webp",
  },
  {
    id: "promo-6",
    isActive: true,
    accent: "forest",
    pillClass: "web-promo-pill-deep",
    pill: "Santai Dek Atas",
    title: "Paket Senja Rooftop & Camilan",
    sub: "Pemandangan 360 Derajat",
    desc: "Paket santai sore di ketinggian lantai atas dengan panorama matahari terbenam sawah Ciperna, pisang goreng keju, dan es kelapa muda.",
    foot: "Panorama Senja Ciperna",
    ctaText: "Layanan Meja & Acara",
    ctaLink: "#reservasi",
    imageUrl: "/gallery/rooftop-senja.webp",
  },
];

export interface PromoContent {
  isActive: boolean;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  badge: string;
  bannerTitle?: string;
  bannerDesc?: string;
  description: string;
  bannerCtaText: string;
  bannerCtaLink?: string;
  promoImage: string;
  items: PromoItemConfig[];
}

export interface AboutContent {
  isActive: boolean;
  kicker: string;
  title: string;
  story: string;
  photo: string;
  highlight1Title: string;
  highlight1Desc: string;
  highlight2Title: string;
  highlight2Desc: string;
}

export interface QrOrderContent {
  isActive: boolean;
  eyebrow: string;
  title: string;
  description: string;
  guideImage: string;
}

export interface GalleryContent {
  isActive: boolean;
  eyebrow: string;
  title: string;
  description: string;
  heroImage: string;
  items: GalleryItemConfig[];
}

export interface ReservationContent {
  isActive: boolean;
  eyebrow: string;
  title: string;
  description: string;
  whatsappNumber: string;
  roomImage: string;
}

export interface LocationContent {
  isActive: boolean;
  address: string;
  directions: string;
  mapsEmbedUrl: string;
  mapsUrl: string;
  phoneWhatsapp: string;
  instagram: string;
  facadeImage: string;
}

export interface ThemeConfig {
  preset: "default" | "sunset" | "fresh_emerald" | "dark_moss" | "custom";
  primaryColor: string;    // --c-deepmoss (#183a1d)
  secondaryColor: string;  // --c-forest (#2e6b34)
  accentColor: string;     // --c-golden (#dda15e)
  amberColor: string;      // --c-amberwarm (#f3c644)
  backgroundColor: string; // --c-warmcream (#fefae0)
  panelBgColor: string;    // --c-ricepaper (#f8f4db)
  textColor: string;       // --c-roastedearth (#3d1f10)
  bgType: "clean" | "texture" | "custom_image";
  bgImageUrl?: string;
  bgOpacity: number;
}

export interface LandingContentState {
  hero: HeroContent;
  menu: MenuContent;
  promo: PromoContent;
  about: AboutContent;
  qrOrder: QrOrderContent;
  gallery: GalleryContent;
  reservation: ReservationContent;
  location: LocationContent;
  theme: ThemeConfig;
}

export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  preset: "default",
  primaryColor: "#183a1d",
  secondaryColor: "#2e6b34",
  accentColor: "#dda15e",
  amberColor: "#f3c644",
  backgroundColor: "#fefae0",
  panelBgColor: "#f8f4db",
  textColor: "#3d1f10",
  bgType: "clean",
  bgImageUrl: "",
  bgOpacity: 0.15,
};

export const DEFAULT_LANDING_CONTENT: LandingContentState = {
  hero: {
    isActive: true,
    badge: "SUDAH BUKA & SIAP MELAYANI",
    title: "TEPI SAWAH",
    subtitle: "Restaurant & Coffee",
    description:
      "Nikmati kuliner Nusantara otentik, racikan kopi segar, dan hembusan semilir angin pedesaan di tengah hamparan sawah hijau Ciperna, Cirebon. Hadir dengan saung lesehan asri, dek rooftop 360°, serta suasana hangat ramah keluarga.",
    hours: "Buka Setiap Hari: 09:00 - 22:00 WIB",
    bgImage: "/sawah-panorama.webp",
  },
  menu: {
    isActive: true,
    eyebrow: "Katalog Kuliner Otentik",
    title: "Menu Pilihan",
    description: "Hidangan favorit untuk menemani waktu berkualitas Anda di Tepi Sawah.",
    bannerImage: "/menu-banner.webp",
    items: DEFAULT_MENU_ITEMS,
  },
  promo: {
    isActive: true,
    eyebrow: "Penawaran Spesial",
    title: "Promo & Paket",
    subtitle: "Temukan promo dan paket yang sedang tersedia di Tepi Sawah Ciperna.",
    badge: "PROMO AKTIF RESTORAN",
    bannerTitle: "Informasi Menu & Promo Selalu Terkini",
    bannerDesc:
      "Informasi promo harian, paket musiman, dan ketersediaan porsi selalu diperbarui secara real-time di etalase menu kami: cek kapan saja sebelum berkunjung.",
    description:
      "Informasi promo harian, paket musiman, dan ketersediaan porsi selalu diperbarui secara real-time di etalase menu kami: cek kapan saja sebelum berkunjung.",
    bannerCtaText: "Jelajahi Menu Pilihan",
    bannerCtaLink: "#menu-pilihan",
    promoImage: "/gallery/rombongan-gathering.webp",
    items: DEFAULT_PROMO_ITEMS,
  },
  about: {
    isActive: true,
    kicker: "Nuansa Pedesaan Asri",
    title: "Sebuah Ruang Kebersamaan",
    story:
      "Tepi Sawah menghadirkan pengalaman bersantap dengan suasana pedesaan yang nyaman di Ciperna, Cirebon. Nikmati hidangan Nusantara beraroma rempah segar, kopi nikmat, udara terbuka, dan waktu berkualitas bersama keluarga, rekan, atau teman tersayang.",
    photo: "/about-saung.webp",
    highlight1Title: "Saung Lesehan",
    highlight1Desc: "Santap lesehan privat beratap rumbia alami tepat di sisi pematang.",
    highlight2Title: "Dek Rooftop 360°",
    highlight2Desc: "Spot senja terbaik menikmati siluet matahari terbenam dengan secangkir kopi.",
  },
  qrOrder: {
    isActive: true,
    eyebrow: "Digital Dining Experience",
    title: "Pesan Langsung dari Meja Anda",
    description:
      "Pemesanan online tidak tersedia. Saat berkunjung, cukup scan kode QR yang tertera di meja Anda, pilih hidangan Nusantara dan minuman favorit, lalu kirim pesanan langsung dari smartphone.",
    guideImage: "/qr-guide.webp",
  },
  gallery: {
    isActive: true,
    eyebrow: "Dokumentasi Restoran",
    title: "Galeri Suasana Tepi Sawah",
    description: "Potret sudut asri, panorama persawahan hijau Ciperna, dan hidangan favorit otentik.",
    heroImage: "/gallery/saung-sore.webp",
    items: DEFAULT_GALLERY_ITEMS,
  },
  reservation: {
    isActive: true,
    eyebrow: "Booking Tempat & Acara",
    title: "Reservasi Meja & Saung",
    description:
      "Pastikan ketersediaan meja atau saung lesehan favorit Anda untuk acara keluarga, arisan, reuni, atau gathering rombongan.",
    whatsappNumber: "081234567890",
    roomImage: "/about-saung.webp",
  },
  location: {
    isActive: true,
    address: "Jl. Raya Ciperna, Kec. Talun, Kab. Cirebon, Jawa Barat 45171.",
    directions: "Tepat di tepi hamparan persawahan asri, 3 menit dari Exit Tol Ciperna.",
    mapsEmbedUrl: "https://maps.google.com/maps?q=-6.771185,108.512599&hl=id&z=17&output=embed",
    mapsUrl: "https://maps.google.com/?q=-6.771185,108.512599",
    phoneWhatsapp: "081234567890",
    instagram: "@tepisawah.resto",
    facadeImage: "/sawah-panorama.webp",
  },
  theme: DEFAULT_THEME_CONFIG,
};

const CACHE_KEY = "tepisawah_landing_content_cache";

export function extractIframeSrc(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== "string") return "";
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith("<iframe")) {
    const match = trimmed.match(/src=["']([^"']+)["']/i);
    if (match && match[1]) return match[1];
  }
  return trimmed;
}

export function normalizeSectionContent(parsed: any): LandingContentState {
  if (!parsed) return DEFAULT_LANDING_CONTENT;
  const heroRaw = parsed.hero || {};
  const menuRaw = parsed.menu || {};
  const promoRaw = parsed.promo || {};
  const aboutRaw = parsed.about || {};
  const qrRaw = parsed.qrOrder || parsed.qr_order || {};
  const galRaw = parsed.gallery || {};
  const resRaw = parsed.reservation || {};
  const locRaw = parsed.location || {};
  const themeRaw = parsed.theme || {};

  const rawItems = Array.isArray(galRaw.items) ? galRaw.items : [];
  const normalizedGalleryItems: GalleryItemConfig[] = DEFAULT_GALLERY_ITEMS.map((defaultItem, index) => {
    const customItem = rawItems[index] || {};
    return {
      id: customItem.id || defaultItem.id,
      imageUrl: customItem.imageUrl || customItem.image || defaultItem.imageUrl,
      kicker: customItem.kicker || customItem.category || defaultItem.kicker,
      title: customItem.title || defaultItem.title,
      desc: customItem.desc || customItem.description || defaultItem.desc,
      tall: customItem.tall !== undefined ? Boolean(customItem.tall) : defaultItem.tall,
    };
  });

  const rawPromoItems = Array.isArray(promoRaw.items) ? promoRaw.items : [];
  const normalizedPromoItems: PromoItemConfig[] = DEFAULT_PROMO_ITEMS.map((defaultItem, index) => {
    const customItem = rawPromoItems[index] || {};
    return {
      id: customItem.id || defaultItem.id,
      isActive: customItem.isActive !== undefined ? Boolean(customItem.isActive) : defaultItem.isActive,
      accent: customItem.accent === "forest" ? "forest" : "golden",
      pillClass: customItem.pillClass || defaultItem.pillClass,
      pill: customItem.pill || customItem.badge || defaultItem.pill,
      title: customItem.title || defaultItem.title,
      sub: customItem.sub || customItem.subtitle || defaultItem.sub,
      desc: customItem.desc || customItem.description || defaultItem.desc,
      foot: customItem.foot || customItem.footer || defaultItem.foot,
      ctaText: customItem.ctaText || defaultItem.ctaText,
      ctaLink: customItem.ctaLink || defaultItem.ctaLink,
      imageUrl: customItem.imageUrl || customItem.image || defaultItem.imageUrl,
    };
  });

  const rawMenuItems = Array.isArray(menuRaw.items) ? menuRaw.items : [];
  const normalizedMenuItems: MenuItemConfig[] = DEFAULT_MENU_ITEMS.map((defaultItem, index) => {
    const customItem = rawMenuItems[index] || {};
    return {
      id: customItem.id || defaultItem.id,
      isActive: customItem.isActive !== undefined ? Boolean(customItem.isActive) : defaultItem.isActive,
      name: customItem.name || defaultItem.name,
      category: customItem.category || customItem.categoryName || defaultItem.category,
      price: customItem.price !== undefined && customItem.price !== "" ? String(customItem.price) : defaultItem.price,
      desc: customItem.desc || customItem.description || defaultItem.desc,
      imageUrl: customItem.imageUrl || customItem.image || defaultItem.imageUrl,
      badge: customItem.badge !== undefined ? customItem.badge : defaultItem.badge,
    };
  });

  const rawEmbedUrl = locRaw.mapsEmbedUrl || locRaw.mapsEmbed || DEFAULT_LANDING_CONTENT.location.mapsEmbedUrl;
  const cleanEmbedUrl = extractIframeSrc(rawEmbedUrl);

  return {
    hero: {
      isActive: heroRaw.isActive !== undefined ? heroRaw.isActive : DEFAULT_LANDING_CONTENT.hero.isActive,
      badge: heroRaw.badge || heroRaw.eyebrow || DEFAULT_LANDING_CONTENT.hero.badge,
      title: heroRaw.title || DEFAULT_LANDING_CONTENT.hero.title,
      subtitle:
        heroRaw.subtitle && heroRaw.subtitle.length < 50
          ? heroRaw.subtitle
          : DEFAULT_LANDING_CONTENT.hero.subtitle,
      description:
        heroRaw.description ||
        (heroRaw.subtitle && heroRaw.subtitle.length >= 50
          ? heroRaw.subtitle
          : DEFAULT_LANDING_CONTENT.hero.description),
      hours: heroRaw.hours || DEFAULT_LANDING_CONTENT.hero.hours,
      bgImage: heroRaw.bgImage || heroRaw.imageUrl || DEFAULT_LANDING_CONTENT.hero.bgImage,
    },
    menu: {
      isActive: menuRaw.isActive !== undefined ? menuRaw.isActive : DEFAULT_LANDING_CONTENT.menu.isActive,
      eyebrow: menuRaw.eyebrow || DEFAULT_LANDING_CONTENT.menu.eyebrow,
      title: menuRaw.title || DEFAULT_LANDING_CONTENT.menu.title,
      description: menuRaw.description || DEFAULT_LANDING_CONTENT.menu.description,
      bannerImage: menuRaw.bannerImage || menuRaw.imageUrl || DEFAULT_LANDING_CONTENT.menu.bannerImage,
      items: normalizedMenuItems,
    },
    promo: {
      isActive:
        promoRaw.isActive !== undefined ? promoRaw.isActive : DEFAULT_LANDING_CONTENT.promo.isActive,
      eyebrow: promoRaw.eyebrow || DEFAULT_LANDING_CONTENT.promo.eyebrow || "Penawaran Spesial",
      title: promoRaw.title || DEFAULT_LANDING_CONTENT.promo.title,
      subtitle:
        promoRaw.subtitle ||
        promoRaw.sub ||
        DEFAULT_LANDING_CONTENT.promo.subtitle ||
        "Temukan promo dan paket yang sedang tersedia di Tepi Sawah Ciperna.",
      badge: promoRaw.badge || DEFAULT_LANDING_CONTENT.promo.badge,
      bannerTitle:
        promoRaw.bannerTitle ||
        promoRaw.title ||
        DEFAULT_LANDING_CONTENT.promo.bannerTitle ||
        "Informasi Menu & Promo Selalu Terkini",
      bannerDesc:
        promoRaw.bannerDesc ||
        promoRaw.description ||
        DEFAULT_LANDING_CONTENT.promo.bannerDesc ||
        "Informasi promo harian, paket musiman, dan ketersediaan porsi selalu diperbarui secara real-time di etalase menu kami: cek kapan saja sebelum berkunjung.",
      description:
        promoRaw.description ||
        promoRaw.bannerDesc ||
        DEFAULT_LANDING_CONTENT.promo.description,
      bannerCtaText:
        promoRaw.bannerCtaText || promoRaw.ctaText || DEFAULT_LANDING_CONTENT.promo.bannerCtaText,
      bannerCtaLink:
        promoRaw.bannerCtaLink || DEFAULT_LANDING_CONTENT.promo.bannerCtaLink || "#menu-pilihan",
      promoImage: promoRaw.promoImage || promoRaw.imageUrl || DEFAULT_LANDING_CONTENT.promo.promoImage,
      items: normalizedPromoItems,
    },
    about: {
      isActive:
        aboutRaw.isActive !== undefined ? aboutRaw.isActive : DEFAULT_LANDING_CONTENT.about.isActive,
      kicker: aboutRaw.kicker || aboutRaw.eyebrow || DEFAULT_LANDING_CONTENT.about.kicker,
      title: aboutRaw.title || DEFAULT_LANDING_CONTENT.about.title,
      story:
        aboutRaw.story ||
        aboutRaw.paragraph1 ||
        DEFAULT_LANDING_CONTENT.about.story,
      photo: aboutRaw.photo || aboutRaw.imageUrl || DEFAULT_LANDING_CONTENT.about.photo,
      highlight1Title:
        aboutRaw.highlight1Title || aboutRaw.highlight1 || DEFAULT_LANDING_CONTENT.about.highlight1Title,
      highlight1Desc: aboutRaw.highlight1Desc || DEFAULT_LANDING_CONTENT.about.highlight1Desc,
      highlight2Title:
        aboutRaw.highlight2Title || aboutRaw.highlight2 || DEFAULT_LANDING_CONTENT.about.highlight2Title,
      highlight2Desc: aboutRaw.highlight2Desc || DEFAULT_LANDING_CONTENT.about.highlight2Desc,
    },
    qrOrder: {
      isActive: qrRaw.isActive !== undefined ? qrRaw.isActive : DEFAULT_LANDING_CONTENT.qrOrder.isActive,
      eyebrow: qrRaw.eyebrow || DEFAULT_LANDING_CONTENT.qrOrder.eyebrow,
      title: qrRaw.title || DEFAULT_LANDING_CONTENT.qrOrder.title,
      description: qrRaw.description || DEFAULT_LANDING_CONTENT.qrOrder.description,
      guideImage: qrRaw.guideImage || qrRaw.imageUrl || DEFAULT_LANDING_CONTENT.qrOrder.guideImage,
    },
    gallery: {
      isActive: galRaw.isActive !== undefined ? galRaw.isActive : DEFAULT_LANDING_CONTENT.gallery.isActive,
      eyebrow: galRaw.eyebrow || DEFAULT_LANDING_CONTENT.gallery.eyebrow,
      title: galRaw.title || DEFAULT_LANDING_CONTENT.gallery.title,
      description: galRaw.description || DEFAULT_LANDING_CONTENT.gallery.description,
      heroImage: galRaw.heroImage || galRaw.imageUrl || DEFAULT_LANDING_CONTENT.gallery.heroImage,
      items: normalizedGalleryItems,
    },
    reservation: {
      isActive:
        resRaw.isActive !== undefined ? resRaw.isActive : DEFAULT_LANDING_CONTENT.reservation.isActive,
      eyebrow: resRaw.eyebrow || DEFAULT_LANDING_CONTENT.reservation.eyebrow,
      title: resRaw.title || DEFAULT_LANDING_CONTENT.reservation.title,
      description: resRaw.description || DEFAULT_LANDING_CONTENT.reservation.description,
      whatsappNumber:
        resRaw.whatsappNumber || resRaw.whatsapp || DEFAULT_LANDING_CONTENT.reservation.whatsappNumber,
      roomImage: resRaw.roomImage || resRaw.imageUrl || DEFAULT_LANDING_CONTENT.reservation.roomImage,
    },
    location: {
      isActive:
        locRaw.isActive !== undefined ? locRaw.isActive : DEFAULT_LANDING_CONTENT.location.isActive,
      address: locRaw.address || DEFAULT_LANDING_CONTENT.location.address,
      directions: locRaw.directions || DEFAULT_LANDING_CONTENT.location.directions,
      mapsEmbedUrl: cleanEmbedUrl,
      mapsUrl: locRaw.mapsUrl || DEFAULT_LANDING_CONTENT.location.mapsUrl,
      phoneWhatsapp:
        locRaw.phoneWhatsapp || locRaw.whatsapp || DEFAULT_LANDING_CONTENT.location.phoneWhatsapp,
      instagram: locRaw.instagram || DEFAULT_LANDING_CONTENT.location.instagram,
      facadeImage: locRaw.facadeImage || locRaw.imageUrl || DEFAULT_LANDING_CONTENT.location.facadeImage,
    },
    theme: {
      preset: themeRaw.preset || DEFAULT_THEME_CONFIG.preset,
      primaryColor: themeRaw.primaryColor || DEFAULT_THEME_CONFIG.primaryColor,
      secondaryColor: themeRaw.secondaryColor || DEFAULT_THEME_CONFIG.secondaryColor,
      accentColor: themeRaw.accentColor || DEFAULT_THEME_CONFIG.accentColor,
      amberColor: themeRaw.amberColor || DEFAULT_THEME_CONFIG.amberColor,
      backgroundColor: themeRaw.backgroundColor || DEFAULT_THEME_CONFIG.backgroundColor,
      panelBgColor: themeRaw.panelBgColor || DEFAULT_THEME_CONFIG.panelBgColor,
      textColor: themeRaw.textColor || DEFAULT_THEME_CONFIG.textColor,
      bgType: themeRaw.bgType || DEFAULT_THEME_CONFIG.bgType,
      bgImageUrl: themeRaw.bgImageUrl || DEFAULT_THEME_CONFIG.bgImageUrl,
      bgOpacity: themeRaw.bgOpacity !== undefined ? Number(themeRaw.bgOpacity) : DEFAULT_THEME_CONFIG.bgOpacity,
    },
  };
}

function getCachedOrDefault(): LandingContentState {
  if (typeof window === "undefined") return DEFAULT_LANDING_CONTENT;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return DEFAULT_LANDING_CONTENT;
    const parsed = JSON.parse(raw);
    return normalizeSectionContent(parsed);
  } catch {
    return DEFAULT_LANDING_CONTENT;
  }
}

export function useLandingContent(): {
  content: LandingContentState;
  loading: boolean;
  refetch: () => Promise<void>;
} {
  const [content, setContent] = useState<LandingContentState>(getCachedOrDefault);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchContent = async () => {
    // 1. Try local dev endpoint / public json asset
    try {
      const localRes = await fetch("/api/landing-content");
      if (localRes.ok) {
        const localData = await localRes.json();
        if (localData && typeof localData === "object" && Object.keys(localData).length > 0) {
          const next = normalizeSectionContent(localData);
          setContent(next);
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(next));
          } catch {
            // Ignore quota errors
          }
        }
      }
    } catch {
      // Fallback to Supabase or cached content
    }

    // 2. Try Supabase
    try {
      const client = getSupabaseClient() as any;
      const { data, error } = await client.from("landing_content").select("section_key, content");
      if (!error && Array.isArray(data) && data.length > 0) {
        const rawMap: Record<string, any> = {};
        for (const item of data) {
          if (item.section_key && item.content) {
            rawMap[item.section_key] = item.content;
          }
        }
        const next = normalizeSectionContent(rawMap);
        setContent(next);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(next));
        } catch {
          // Ignore quota errors
        }
      }
    } catch {
      // Gracefully maintain cached or default content
    }
  };

  useEffect(() => {
    void fetchContent();

    const handleUpdate = () => {
      void fetchContent();
    };

    window.addEventListener("tepisawah_landing_content_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    window.addEventListener("focus", handleUpdate);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void fetchContent();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    let realtimeChannel: any = null;
    try {
      const client = getSupabaseClient() as any;
      if (client?.channel) {
        realtimeChannel = client
          .channel("public:landing_content_sync")
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "landing_content" },
            () => {
              void fetchContent();
            },
          )
          .subscribe();
      }
    } catch {
      // Ignore if supabase client or realtime is unavailable
    }

    return () => {
      window.removeEventListener("tepisawah_landing_content_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
      window.removeEventListener("focus", handleUpdate);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (realtimeChannel) {
        try {
          const client = getSupabaseClient() as any;
          void client?.removeChannel?.(realtimeChannel);
        } catch {
          // ignore
        }
      }
    };
  }, []);

  return {
    content,
    loading,
    refetch: fetchContent,
  };
}
