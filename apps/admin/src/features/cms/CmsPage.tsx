/**
 * @tepisawah/admin - Website Content Management System (CMS) for All Sections, Showcase Photos & Themes.
 *
 * Allows owners and managers to customize texts, upload images (auto-compressed to WebP <80 KB),
 * toggle visibility for all sections, manage up to 6 gallery photos, embed real Google Maps,
 * and customize the website theme colors and background.
 */
import { useEffect, useState, useRef, type ReactNode, type ChangeEvent } from "react";
import { getSupabaseClient } from "../../lib/supabase.js";
import { isDemoMode } from "../../lib/demo-mode.js";
import { compressImageToWebP } from "@tepisawah/ui";

export interface HeroConfig {
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

export interface MenuConfig {
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

export interface PromoConfig {
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

export interface AboutConfig {
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

export interface QrOrderConfig {
  isActive: boolean;
  eyebrow: string;
  title: string;
  description: string;
  guideImage: string;
}

export interface GalleryItemConfig {
  id: string;
  imageUrl: string;
  kicker: string;
  title: string;
  desc: string;
  tall?: boolean;
}

export interface GalleryConfig {
  isActive: boolean;
  eyebrow: string;
  title: string;
  description: string;
  heroImage: string;
  items: GalleryItemConfig[];
}

export interface ReservationConfig {
  isActive: boolean;
  eyebrow: string;
  title: string;
  description: string;
  whatsappNumber: string;
  roomImage: string;
}

export interface LocationConfig {
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

export interface CmsState {
  hero: HeroConfig;
  menu: MenuConfig;
  promo: PromoConfig;
  about: AboutConfig;
  qr_order: QrOrderConfig;
  gallery: GalleryConfig;
  reservation: ReservationConfig;
  location: LocationConfig;
  theme: ThemeConfig;
}

const DEFAULT_GALLERY_ITEMS: GalleryItemConfig[] = [
  {
    id: "gal-1",
    imageUrl: "/gallery/saung-lesehan.webp",
    kicker: "Suasana Luar Ruang",
    title: "Saung Lesehan Sisi Pematang",
    desc: "Santap santai beratap rumbia alami tepat di sisi hamparan sawah hijau yang asri dan sejuk.",
    tall: true,
  },
  {
    id: "gal-2",
    imageUrl: "/gallery/ayam-roaster.webp",
    kicker: "Signature Dish",
    title: "Chicken Roaster Rempah",
    desc: "Ayam panggang oven empuk berbumbu rempah rahasia Nusantara, disajikan dengan sambal terasi segar.",
    tall: false,
  },
  {
    id: "gal-3",
    imageUrl: "/gallery/gurame-bakar.webp",
    kicker: "Favorit Keluarga",
    title: "Gurame Bakar Madu Pedas Manis",
    desc: "Gurame segar berlapis kecap madu karamel dengan lalapan segar dan sambal kecap cabai rawit.",
    tall: false,
  },
  {
    id: "gal-4",
    imageUrl: "/gallery/kopi-senja.webp",
    kicker: "Coffee & Beverage",
    title: "Kopi Senja Sawah & Kudapan",
    desc: "Racikan kopi Nusantara hangat berdampingan dengan kudapan singkong goreng bertabur keju.",
    tall: false,
  },
  {
    id: "gal-5",
    imageUrl: "/gallery/rombongan-gathering.webp",
    kicker: "Ruang Acara & Rombongan",
    title: "Gazebo Keluarga & Acara",
    desc: "Area makan luas dan nyaman untuk gathering keluarga besar, reuni, dan rombongan wisata.",
    tall: false,
  },
  {
    id: "gal-6",
    imageUrl: "/gallery/rooftop-senja.webp",
    kicker: "Panorama 360°",
    title: "Dek Rooftop Senja Ciperna",
    desc: "Pemandangan matahari terbenam spektakuler di atas bentangan persawahan hijau Ciperna.",
    tall: true,
  },
];

const DEFAULT_THEME: ThemeConfig = {
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

const THEME_PRESETS = [
  {
    id: "default",
    name: "Pedesaan Asri",
    desc: "Hijau alami khas Tepi Sawah Ciperna",
    primary: "#183a1d",
    secondary: "#2e6b34",
    accent: "#dda15e",
    amber: "#f3c644",
    bg: "#fefae0",
    panel: "#f8f4db",
    text: "#3d1f10",
  },
  {
    id: "sunset",
    name: "Senja Keemasan",
    desc: "Nuansa hangat temaram matahari terbenam",
    primary: "#2b1810",
    secondary: "#5c3a21",
    accent: "#e07a5f",
    amber: "#f4a261",
    bg: "#fdf0d5",
    panel: "#f7e1be",
    text: "#26130b",
  },
  {
    id: "fresh_emerald",
    name: "Zamrud Segar",
    desc: "Hijau zamrud modern dan bersih",
    primary: "#0f382c",
    secondary: "#1d664e",
    accent: "#e9c46a",
    amber: "#f4d06f",
    bg: "#f6faf7",
    panel: "#e8f3ec",
    text: "#132a22",
  },
  {
    id: "dark_moss",
    name: "Malam Elegan",
    desc: "Gelap mewah dengan sentuhan kayu & emas",
    primary: "#0b1a0d",
    secondary: "#19361c",
    accent: "#d4a373",
    amber: "#f3c644",
    bg: "#111812",
    panel: "#1a241c",
    text: "#f4ebd9",
  },
];

const DEFAULT_CMS_CONTENT: CmsState = {
  hero: {
    isActive: true,
    badge: "SUDAH BUKA & SIAP MELAYANI",
    title: "TEPI SAWAH",
    subtitle: "Restaurant & Coffee",
    description:
      "Nikmati kuliner Nusantara otentik, racikan kopi segar, dan hembusan semilir angin pedesaan di tengah hamparan sawah hijau Ciperna, Cirebon.",
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
    items: [
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
    ],
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
  qr_order: {
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
  theme: DEFAULT_THEME,
};

const STORAGE_KEY_CMS = "tepisawah_landing_content_cache";

export type CmsSectionKey =
  | "hero"
  | "menu"
  | "promo"
  | "about"
  | "qr_order"
  | "gallery"
  | "reservation"
  | "location"
  | "theme";

interface TabMeta {
  key: CmsSectionKey;
  label: string;
  icon: string;
}

const TABS: TabMeta[] = [
  { key: "hero", label: "Beranda", icon: "🌾" },
  { key: "menu", label: "Menu Pilihan", icon: "🍲" },
  { key: "promo", label: "Promo & Paket", icon: "🎉" },
  { key: "about", label: "Tentang Kami", icon: "🏡" },
  { key: "qr_order", label: "Cara Pesan", icon: "📱" },
  { key: "gallery", label: "Galeri Suasana", icon: "📷" },
  { key: "reservation", label: "Reservasi", icon: "📅" },
  { key: "location", label: "Lokasi & Kontak", icon: "📍" },
  { key: "theme", label: "Tema & Tampilan", icon: "🎨" },
];

export function CmsPage(): ReactNode {
  const [activeTab, setActiveTab] = useState<CmsSectionKey>("hero");
  const [content, setContent] = useState<CmsState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CMS);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          hero: { ...DEFAULT_CMS_CONTENT.hero, ...(parsed.hero || {}) },
          menu: {
            ...DEFAULT_CMS_CONTENT.menu,
            ...(parsed.menu || {}),
            items:
              Array.isArray(parsed.menu?.items) && parsed.menu.items.length > 0
                ? DEFAULT_MENU_ITEMS.map((def, idx) => ({ ...def, ...(parsed.menu.items[idx] || {}) }))
                : DEFAULT_MENU_ITEMS,
          },
          promo: {
            ...DEFAULT_CMS_CONTENT.promo,
            ...(parsed.promo || {}),
            items:
              Array.isArray(parsed.promo?.items) && parsed.promo.items.length > 0
                ? DEFAULT_CMS_CONTENT.promo.items.map((def, idx) => ({ ...def, ...(parsed.promo.items[idx] || {}) }))
                : DEFAULT_CMS_CONTENT.promo.items,
          },
          about: { ...DEFAULT_CMS_CONTENT.about, ...(parsed.about || {}) },
          qr_order: { ...DEFAULT_CMS_CONTENT.qr_order, ...(parsed.qr_order || parsed.qrOrder || {}) },
          gallery: {
            ...DEFAULT_CMS_CONTENT.gallery,
            ...(parsed.gallery || {}),
            items:
              Array.isArray(parsed.gallery?.items) && parsed.gallery.items.length > 0
                ? DEFAULT_GALLERY_ITEMS.map((def, idx) => ({ ...def, ...(parsed.gallery.items[idx] || {}) }))
                : DEFAULT_GALLERY_ITEMS,
          },
          reservation: { ...DEFAULT_CMS_CONTENT.reservation, ...(parsed.reservation || {}) },
          location: { ...DEFAULT_CMS_CONTENT.location, ...(parsed.location || {}) },
          theme: { ...DEFAULT_CMS_CONTENT.theme, ...(parsed.theme || {}) },
        };
      }
    } catch {
      // fallback
    }
    return DEFAULT_CMS_CONTENT;
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [imageSizes, setImageSizes] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [targetImageField, setTargetImageField] = useState<string | null>(null);

  useEffect(() => {
    async function loadFromDb() {
      try {
        if (isDemoMode()) return;
        const client = getSupabaseClient() as any;
        const { data, error } = await client.from("landing_content").select("*");
        if (!error && Array.isArray(data) && data.length > 0) {
          const loaded: Partial<CmsState> = {};
          for (const row of data) {
            if (row.section_key && row.content) {
              const k = row.section_key === "qrOrder" ? "qr_order" : row.section_key;
              (loaded as any)[k] = row.content;
            }
          }
          setContent((prev) => ({
            ...prev,
            ...loaded,
            menu: {
              ...prev.menu,
              ...(loaded.menu || {}),
              items:
                Array.isArray(loaded.menu?.items) && loaded.menu.items.length > 0
                  ? DEFAULT_MENU_ITEMS.map((def, idx) => ({ ...def, ...(loaded.menu!.items[idx] || {}) }))
                  : prev.menu.items,
            },
            promo: {
              ...prev.promo,
              ...(loaded.promo || {}),
              items:
                Array.isArray(loaded.promo?.items) && loaded.promo.items.length > 0
                  ? DEFAULT_CMS_CONTENT.promo.items.map((def, idx) => ({ ...def, ...(loaded.promo!.items[idx] || {}) }))
                  : prev.promo.items,
            },
            gallery: {
              ...prev.gallery,
              ...(loaded.gallery || {}),
              items:
                Array.isArray(loaded.gallery?.items) && loaded.gallery.items.length > 0
                  ? DEFAULT_GALLERY_ITEMS.map((def, idx) => ({ ...def, ...(loaded.gallery!.items[idx] || {}) }))
                  : prev.gallery.items,
            },
            theme: {
              ...prev.theme,
              ...(loaded.theme || {}),
            },
          }));
        }
      } catch {
        // use local cache
      }
    }
    void loadFromDb();
  }, []);

  function handleFieldChange(section: CmsSectionKey, field: string, value: any) {
    setContent((prev) => ({
      ...prev,
      [section]: {
        ...(prev as any)[section],
        [field]: value,
      },
    }));
  }

  function handleToggleActive(section: CmsSectionKey) {
    if (section === "theme") return;
    setContent((prev) => ({
      ...prev,
      [section]: {
        ...(prev as any)[section],
        isActive: !(prev as any)[section].isActive,
      },
    }));
  }

  function handleGalleryItemChange(index: number, field: keyof GalleryItemConfig, value: any) {
    setContent((prev) => {
      const nextItems = [...prev.gallery.items];
      if (nextItems[index]) {
        nextItems[index] = { ...nextItems[index], [field]: value };
      }
      return {
        ...prev,
        gallery: {
          ...prev.gallery,
          items: nextItems,
        },
      };
    });
  }

  function handleResetGalleryItem(index: number) {
    const defaultItem = DEFAULT_GALLERY_ITEMS[index];
    if (!defaultItem) return;
    setContent((prev) => {
      const nextItems = [...prev.gallery.items];
      nextItems[index] = { ...defaultItem };
      return {
        ...prev,
        gallery: {
          ...prev.gallery,
          items: nextItems,
        },
      };
    });
  }

  function handlePromoItemChange(index: number, field: keyof PromoItemConfig, value: any) {
    setContent((prev) => {
      const nextItems = [...prev.promo.items];
      if (nextItems[index]) {
        nextItems[index] = { ...nextItems[index], [field]: value };
      }
      return {
        ...prev,
        promo: {
          ...prev.promo,
          items: nextItems,
        },
      };
    });
  }

  function handleResetPromoItem(index: number) {
    const defaultItem = DEFAULT_CMS_CONTENT.promo.items[index];
    if (!defaultItem) return;
    setContent((prev) => {
      const nextItems = [...prev.promo.items];
      nextItems[index] = { ...defaultItem };
      return {
        ...prev,
        promo: {
          ...prev.promo,
          items: nextItems,
        },
      };
    });
  }

  function handleMenuItemChange(index: number, field: keyof MenuItemConfig, value: any) {
    setContent((prev) => {
      const nextItems = [...prev.menu.items];
      if (nextItems[index]) {
        nextItems[index] = { ...nextItems[index], [field]: value };
      }
      return {
        ...prev,
        menu: {
          ...prev.menu,
          items: nextItems,
        },
      };
    });
  }

  function handleResetMenuItem(index: number) {
    const defaultItem = DEFAULT_MENU_ITEMS[index];
    if (!defaultItem) return;
    setContent((prev) => {
      const nextItems = [...prev.menu.items];
      nextItems[index] = { ...defaultItem };
      return {
        ...prev,
        menu: {
          ...prev.menu,
          items: nextItems,
        },
      };
    });
  }

  function handleThemeChange(field: keyof ThemeConfig, value: any) {
    setContent((prev) => ({
      ...prev,
      theme: {
        ...prev.theme,
        [field]: value,
        preset: "custom",
      },
    }));
  }

  function handleApplyPreset(presetId: string) {
    const preset = THEME_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setContent((prev) => ({
      ...prev,
      theme: {
        ...prev.theme,
        preset: preset.id as any,
        primaryColor: preset.primary,
        secondaryColor: preset.secondary,
        accentColor: preset.accent,
        amberColor: preset.amber,
        backgroundColor: preset.bg,
        panelBgColor: preset.panel,
        textColor: preset.text,
      },
    }));
  }

  function handleMapUrlChange(val: string) {
    const clean = val.includes("<iframe")
      ? (val.match(/src=["']([^"']+)["']/i)?.[1] || val)
      : val;
    handleFieldChange("location", "mapsEmbedUrl", clean.trim());
  }

  function triggerImageUpload(fieldKey: string) {
    setTargetImageField(fieldKey);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  }

  async function handleFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !targetImageField) return;

    try {
      const compressed = await compressImageToWebP(file, {
        maxDimension: 1200,
        quality: 0.82,
      });

      const kb = Math.round(compressed.compressedSize / 1024);
      setImageSizes((prev) => ({ ...prev, [targetImageField]: `${kb} KB (WebP)` }));

      const parts = targetImageField.split(".");
      if (parts.length === 2) {
        const sec = parts[0];
        const field = parts[1];
        if (!sec || !field) return;

        setContent((prev: any) => ({
          ...prev,
          [sec]: {
            ...prev[sec],
            [field]: compressed.dataUrl,
          },
        }));
      } else if (parts.length === 4 && (parts[0] === "gallery" || parts[0] === "promo" || parts[0] === "menu") && parts[1] === "items") {
        const sec = parts[0] as "gallery" | "promo" | "menu";
        const index = parseInt(parts[2] || "0", 10);
        const field = parts[3];
        if (isNaN(index) || !field) return;

        setContent((prev: any) => {
          const currentSec = prev[sec] || {};
          const newItems = [...(currentSec.items || [])];
          if (newItems[index]) {
            newItems[index] = { ...newItems[index], [field]: compressed.dataUrl };
          }
          return {
            ...prev,
            [sec]: {
              ...currentSec,
              items: newItems,
            },
          };
        });
      }
    } catch (err) {
      console.error("Gagal mengompresi gambar:", err);
      alert("Gagal memproses gambar. Pastikan format file sesuai (JPG, PNG, WebP).");
    }
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    try {
      // 1. Save to local storage for instant sync across tabs
      localStorage.setItem(STORAGE_KEY_CMS, JSON.stringify(content));
      window.dispatchEvent(new CustomEvent("tepisawah_landing_content_updated", { detail: content }));
      window.dispatchEvent(new CustomEvent("tepisawah:cms-updated", { detail: content }));

      // 2. Synchronize to public web endpoint (cross-port local dev sync & static fallback)
      try {
        const endpoints = ["http://localhost:5180/api/landing-content", "/api/landing-content"];
        for (const ep of endpoints) {
          try {
            await fetch(ep, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(content),
            });
          } catch {
            // Next endpoint fallback
          }
        }
      } catch {
        // Dev endpoint optional
      }

      // 3. Save to Supabase if not demo
      if (!isDemoMode()) {
        const client = getSupabaseClient() as any;
        const sections: CmsSectionKey[] = [
          "hero",
          "menu",
          "promo",
          "about",
          "qr_order",
          "gallery",
          "reservation",
          "location",
          "theme",
        ];

        for (const sec of sections) {
          await client.from("landing_content").upsert({
            section_key: sec,
            content: (content as any)[sec],
            updated_at: new Date().toISOString(),
          });
        }
      }

      setMessage("Perubahan konten, 6 foto galeri & tema berhasil disimpan dan tersinkronkan ke website publik!");
    } catch (err) {
      console.error("Gagal menyimpan ke database:", err);
      setMessage("Konten tersimpan di memori browser.");
    } finally {
      setSaving(false);
    }
  }

  function handleResetDefault() {
    if (confirm("Kembalikan seluruh konten, susunan 6 foto galeri & tema warna ke nilai bawaan resmi?")) {
      setContent(DEFAULT_CMS_CONTENT);
      localStorage.setItem(STORAGE_KEY_CMS, JSON.stringify(DEFAULT_CMS_CONTENT));
      window.dispatchEvent(new CustomEvent("tepisawah_landing_content_updated", { detail: DEFAULT_CMS_CONTENT }));
      void fetch("http://localhost:5180/api/landing-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(DEFAULT_CMS_CONTENT),
      }).catch(() => {});
      setMessage("Konten & tema berhasil di-reset ke nilai default.");
    }
  }

  const currentSection = (content as any)[activeTab];
  const isSectionActive = activeTab === "theme" ? true : currentSection?.isActive !== false;

  return (
    <div style={{ padding: "1.5rem", maxWidth: "1420px", margin: "0 auto" }}>
      {/* Hidden File Input for Image Uploading */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => void handleFileSelected(e)}
      />

      {/* Header */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "1.25rem",
          gap: "1rem",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#1e293b", margin: 0 }}>
            Pengelola Konten Website Publik (CMS)
          </h1>
          <p style={{ color: "#64748b", margin: "0.25rem 0 0", fontSize: "0.92rem" }}>
            Kelola teks, 6 foto galeri suasana, peta Google Maps presisi, serta kustomisasi tema warna &amp; latar belakang.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            type="button"
            onClick={handleResetDefault}
            disabled={saving}
            style={{
              padding: "0.6rem 1.1rem",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#475569",
              fontWeight: 600,
              fontSize: "0.88rem",
              cursor: "pointer",
            }}
          >
            Reset Bawaan
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            style={{
              padding: "0.6rem 1.25rem",
              borderRadius: "8px",
              border: "none",
              background: "#166534",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: "0.88rem",
              cursor: saving ? "not-allowed" : "pointer",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            }}
          >
            {saving ? "Menyimpan..." : "✓ Simpan Semua Perubahan"}
          </button>
        </div>
      </header>

      {/* Notification Banner */}
      {message && (
        <div
          style={{
            padding: "0.85rem 1.25rem",
            marginBottom: "1.25rem",
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: "8px",
            color: "#166534",
            fontSize: "0.9rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{message}</span>
          <button
            type="button"
            onClick={() => setMessage(null)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#166534", fontWeight: "bold" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* 9 Sub-Tabs Navigation */}
      <div
        style={{
          display: "flex",
          gap: "0.4rem",
          overflowX: "auto",
          paddingBottom: "0.5rem",
          marginBottom: "1.25rem",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        {TABS.map((tab) => {
          const isTabActive = activeTab === tab.key;
          const sectionConfig = (content as any)[tab.key];
          const isItemActive = tab.key === "theme" ? true : sectionConfig?.isActive !== false;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.6rem 1rem",
                borderRadius: "8px",
                border: isTabActive ? "1px solid #166534" : "1px solid #e2e8f0",
                background: isTabActive ? "#166534" : "#ffffff",
                color: isTabActive ? "#ffffff" : "#475569",
                fontWeight: isTabActive ? 700 : 500,
                fontSize: "0.88rem",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s ease",
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: isItemActive ? (isTabActive ? "#86efac" : "#22c55e") : "#94a3b8",
                  marginLeft: "0.25rem",
                }}
                title={isItemActive ? "Seksi Aktif" : "Seksi Nonaktif"}
              />
            </button>
          );
        })}
      </div>

      {/* Main Grid: Editor on Left, Live Preview on Right */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.8fr) minmax(360px, 1.2fr)",
          gap: "1.5rem",
          alignItems: "flex-start",
        }}
      >
        {/* Editor Form Column */}
        <div
          style={{
            background: "#ffffff",
            padding: "1.5rem",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
          }}
        >
          {/* Section Visibility Card (for sections other than theme) */}
          {activeTab !== "theme" && (
            <div
              style={{
                padding: "1rem",
                borderRadius: "8px",
                background: isSectionActive ? "#f0fdf4" : "#f8fafc",
                border: isSectionActive ? "1px solid #bbf7d0" : "1px solid #e2e8f0",
                marginBottom: "1.5rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <strong style={{ fontSize: "0.95rem", color: isSectionActive ? "#166534" : "#475569" }}>
                  Status Tampilan di Website
                </strong>
                <p style={{ margin: "0.2rem 0 0", fontSize: "0.82rem", color: isSectionActive ? "#15803d" : "#64748b" }}>
                  {isSectionActive
                    ? "● Ditampilkan aktif pada halaman web publik dan menu navigasi"
                    : "○ Disembunyikan (seksi dan tautan navigasi otomatis dinonaktifkan)"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleToggleActive(activeTab)}
                style={{
                  padding: "0.45rem 1rem",
                  borderRadius: "6px",
                  border: isSectionActive ? "1px solid #16a34a" : "1px solid #94a3b8",
                  background: isSectionActive ? "#16a34a" : "#f1f5f9",
                  color: isSectionActive ? "#ffffff" : "#475569",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                {isSectionActive ? "Nonaktifkan" : "Aktifkan"}
              </button>
            </div>
          )}

          {/* Form Content by Section */}
          {activeTab === "hero" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.88rem", fontWeight: 600 }}>
                Badge Status Pembukaan
                <input
                  type="text"
                  value={content.hero.badge}
                  onChange={(e) => handleFieldChange("hero", "badge", e.target.value)}
                  style={{ padding: "0.6rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.88rem", fontWeight: 600 }}>
                Judul Utama Restoran
                <input
                  type="text"
                  value={content.hero.title}
                  onChange={(e) => handleFieldChange("hero", "title", e.target.value)}
                  style={{ padding: "0.6rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.88rem", fontWeight: 600 }}>
                Subjudul
                <input
                  type="text"
                  value={content.hero.subtitle}
                  onChange={(e) => handleFieldChange("hero", "subtitle", e.target.value)}
                  style={{ padding: "0.6rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.88rem", fontWeight: 600 }}>
                Deskripsi Suasana
                <textarea
                  rows={3}
                  value={content.hero.description}
                  onChange={(e) => handleFieldChange("hero", "description", e.target.value)}
                  style={{ padding: "0.6rem", borderRadius: "6px", border: "1px solid #cbd5e1", resize: "vertical" }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.88rem", fontWeight: 600 }}>
                Jam Operasional
                <input
                  type="text"
                  value={content.hero.hours}
                  onChange={(e) => handleFieldChange("hero", "hours", e.target.value)}
                  style={{ padding: "0.6rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </label>

              <div>
                <span style={{ display: "block", fontSize: "0.88rem", fontWeight: 600, marginBottom: "0.4rem" }}>
                  Foto Latar Belakang Hero
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <img
                    src={content.hero.bgImage}
                    alt="Preview Hero"
                    style={{ width: "90px", height: "60px", objectFit: "cover", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  />
                  <div>
                    <button
                      type="button"
                      onClick={() => triggerImageUpload("hero.bgImage")}
                      style={{
                        padding: "0.45rem 0.9rem",
                        borderRadius: "6px",
                        border: "1px solid #0369a1",
                        background: "#f0f9ff",
                        color: "#0369a1",
                        fontWeight: 600,
                        fontSize: "0.85rem",
                        cursor: "pointer",
                      }}
                    >
                      Unggah &amp; Ganti Foto (WebP)
                    </button>
                    {imageSizes["hero.bgImage"] && (
                      <span style={{ display: "block", fontSize: "0.75rem", color: "#166534", marginTop: "0.25rem" }}>
                        Terkonversi: {imageSizes["hero.bgImage"]}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "menu" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {/* Seksi Header Menu */}
              <div
                style={{
                  padding: "1rem",
                  background: "#f8fafc",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.85rem",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#1e293b", borderBottom: "1px solid #e2e8f0", paddingBottom: "0.4rem" }}>
                  Judul &amp; Informasi Seksi Menu
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: "0.3rem", fontSize: "0.82rem", fontWeight: 600 }}>
                    Label Kicker (Eyebrow)
                    <input
                      type="text"
                      value={content.menu.eyebrow}
                      onChange={(e) => handleFieldChange("menu", "eyebrow", e.target.value)}
                      style={{ padding: "0.55rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: "0.3rem", fontSize: "0.82rem", fontWeight: 600 }}>
                    Judul Seksi Menu
                    <input
                      type="text"
                      value={content.menu.title}
                      onChange={(e) => handleFieldChange("menu", "title", e.target.value)}
                      style={{ padding: "0.55rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                    />
                  </label>
                </div>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.3rem", fontSize: "0.82rem", fontWeight: 600 }}>
                  Deskripsi Pengantar Menu
                  <textarea
                    rows={2}
                    value={content.menu.description}
                    onChange={(e) => handleFieldChange("menu", "description", e.target.value)}
                    style={{ padding: "0.55rem", borderRadius: "6px", border: "1px solid #cbd5e1", resize: "vertical" }}
                  />
                </label>
              </div>

              {/* Showcase 6 Kartu Menu Pilihan */}
              <div
                style={{
                  padding: "1rem",
                  background: "#ffffff",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#1e293b" }}>
                      Showcase 6 Kartu Menu Pilihan (Hidangan Favorit)
                    </h3>
                    <p style={{ margin: "0.2rem 0 0 0", fontSize: "0.78rem", color: "#64748b" }}>
                      Semua teks dapat diedit dan setiap slot foto dikompresi otomatis ke format WebP (&lt;80 KB).
                    </p>
                  </div>
                  <span
                    style={{
                      background: "#dcfce7",
                      color: "#166534",
                      padding: "0.25rem 0.65rem",
                      borderRadius: "9999px",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                    }}
                  >
                    6 Slot Hidangan
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: "1rem" }}>
                  {content.menu.items.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      style={{
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        padding: "0.85rem",
                        background: "#fafaf9",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.65rem",
                      }}
                    >
                      {/* Slot Header */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #e2e8f0", paddingBottom: "0.4rem" }}>
                        <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "#0f172a" }}>
                          Slot #{idx + 1}: {item.name || `Menu ${idx + 1}`}
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer" }}>
                            <input
                              type="checkbox"
                              checked={item.isActive !== false}
                              onChange={(e) => handleMenuItemChange(idx, "isActive", e.target.checked)}
                            />
                            Aktif di Web
                          </label>
                          <button
                            type="button"
                            onClick={() => handleResetMenuItem(idx)}
                            style={{
                              fontSize: "0.7rem",
                              color: "#dc2626",
                              background: "transparent",
                              border: "none",
                              cursor: "pointer",
                              padding: "0 0.2rem",
                            }}
                          >
                            Reset
                          </button>
                        </div>
                      </div>

                      {/* Photo Upload Row */}
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          style={{
                            width: "80px",
                            height: "55px",
                            objectFit: "cover",
                            borderRadius: "6px",
                            border: "1px solid #cbd5e1",
                            background: "#e2e8f0",
                          }}
                        />
                        <div style={{ flex: 1 }}>
                          <button
                            type="button"
                            onClick={() => triggerImageUpload(`menu.items.${idx}.imageUrl`)}
                            style={{
                              width: "100%",
                              padding: "0.4rem 0.6rem",
                              borderRadius: "6px",
                              border: "1px solid #0284c7",
                              background: "#f0f9ff",
                              color: "#0284c7",
                              fontWeight: 600,
                              fontSize: "0.75rem",
                              cursor: "pointer",
                            }}
                          >
                            Unggah Foto #{idx + 1} (WebP)
                          </button>
                          {imageSizes[`menu.items.${idx}.imageUrl`] && (
                            <span style={{ display: "block", fontSize: "0.7rem", color: "#166534", marginTop: "0.2rem" }}>
                              Terkonversi: {imageSizes[`menu.items.${idx}.imageUrl`]}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Form Fields */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.78rem", fontWeight: 600 }}>
                          Nama Menu
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => handleMenuItemChange(idx, "name", e.target.value)}
                            style={{ padding: "0.45rem", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.8rem" }}
                          />
                        </label>
                        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.78rem", fontWeight: 600 }}>
                          Kategori
                          <input
                            type="text"
                            value={item.category}
                            onChange={(e) => handleMenuItemChange(idx, "category", e.target.value)}
                            style={{ padding: "0.45rem", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.8rem" }}
                          />
                        </label>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.78rem", fontWeight: 600 }}>
                          Harga
                          <input
                            type="text"
                            value={item.price}
                            onChange={(e) => handleMenuItemChange(idx, "price", e.target.value)}
                            style={{ padding: "0.45rem", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.8rem" }}
                          />
                        </label>
                        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.78rem", fontWeight: 600 }}>
                          Badge / Label (Opsional)
                          <input
                            type="text"
                            value={item.badge || ""}
                            onChange={(e) => handleMenuItemChange(idx, "badge", e.target.value)}
                            placeholder="Contoh: Pilihan Koki"
                            style={{ padding: "0.45rem", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.8rem" }}
                          />
                        </label>
                      </div>

                      <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.78rem", fontWeight: 600 }}>
                        Deskripsi Menu
                        <textarea
                          rows={2}
                          value={item.desc}
                          onChange={(e) => handleMenuItemChange(idx, "desc", e.target.value)}
                          style={{ padding: "0.45rem", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.8rem", resize: "vertical" }}
                        />
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Banner Menu Opsional */}
              <div
                style={{
                  padding: "1rem",
                  background: "#f8fafc",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                }}
              >
                <span style={{ display: "block", fontSize: "0.88rem", fontWeight: 600, marginBottom: "0.4rem" }}>
                  Banner Gambar Menu (Opsional)
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <img
                    src={content.menu.bannerImage}
                    alt="Preview Banner Menu"
                    style={{ width: "90px", height: "60px", objectFit: "cover", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  />
                  <div>
                    <button
                      type="button"
                      onClick={() => triggerImageUpload("menu.bannerImage")}
                      style={{
                        padding: "0.45rem 0.9rem",
                        borderRadius: "6px",
                        border: "1px solid #0369a1",
                        background: "#f0f9ff",
                        color: "#0369a1",
                        fontWeight: 600,
                        fontSize: "0.85rem",
                        cursor: "pointer",
                      }}
                    >
                      Unggah &amp; Ganti Banner (WebP)
                    </button>
                    {imageSizes["menu.bannerImage"] && (
                      <span style={{ display: "block", fontSize: "0.75rem", color: "#166534", marginTop: "0.25rem" }}>
                        Terkonversi: {imageSizes["menu.bannerImage"]}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "promo" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {/* Seksi Header Promo */}
              <div
                style={{
                  padding: "1rem",
                  background: "#f8fafc",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.85rem",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#1e293b", borderBottom: "1px solid #e2e8f0", paddingBottom: "0.4rem" }}>
                  Judul &amp; Informasi Seksi Promo
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: "0.3rem", fontSize: "0.82rem", fontWeight: 600 }}>
                    Label Eyebrow (Teks Kecil Atas)
                    <input
                      type="text"
                      value={content.promo.eyebrow || "Penawaran Spesial"}
                      onChange={(e) => handleFieldChange("promo", "eyebrow", e.target.value)}
                      style={{ padding: "0.55rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: "0.3rem", fontSize: "0.82rem", fontWeight: 600 }}>
                    Judul Utama Seksi
                    <input
                      type="text"
                      value={content.promo.title || "Promo & Paket"}
                      onChange={(e) => handleFieldChange("promo", "title", e.target.value)}
                      style={{ padding: "0.55rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                    />
                  </label>
                </div>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.3rem", fontSize: "0.82rem", fontWeight: 600 }}>
                  Subjudul / Deskripsi Seksi
                  <input
                    type="text"
                    value={content.promo.subtitle || "Temukan promo dan paket yang sedang tersedia di Tepi Sawah Ciperna."}
                    onChange={(e) => handleFieldChange("promo", "subtitle", e.target.value)}
                    style={{ padding: "0.55rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  />
                </label>
              </div>

              {/* Showcase 6 Kartu Promo */}
              <div
                style={{
                  padding: "1rem",
                  background: "#ffffff",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#1e293b" }}>
                      Showcase 6 Kartu Promo &amp; Paket
                    </h3>
                    <p style={{ margin: "0.2rem 0 0 0", fontSize: "0.78rem", color: "#64748b" }}>
                      Semua teks dapat diedit dan setiap slot foto dikompresi otomatis ke format WebP (&lt;80 KB).
                    </p>
                  </div>
                  <span
                    style={{
                      background: "#dcfce7",
                      color: "#166534",
                      padding: "0.25rem 0.65rem",
                      borderRadius: "9999px",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                    }}
                  >
                    6 Slot Kartu
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: "1rem" }}>
                  {content.promo.items.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      style={{
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        padding: "0.85rem",
                        background: "#fafaf9",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.65rem",
                      }}
                    >
                      {/* Slot Header */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #e2e8f0", paddingBottom: "0.4rem" }}>
                        <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "#0f172a" }}>
                          Slot #{idx + 1}: {item.title || `Paket ${idx + 1}`}
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer" }}>
                            <input
                              type="checkbox"
                              checked={item.isActive !== false}
                              onChange={(e) => handlePromoItemChange(idx, "isActive", e.target.checked)}
                            />
                            Aktif di Web
                          </label>
                          <button
                            type="button"
                            onClick={() => handleResetPromoItem(idx)}
                            style={{
                              fontSize: "0.7rem",
                              color: "#dc2626",
                              background: "transparent",
                              border: "none",
                              cursor: "pointer",
                              padding: "0 0.2rem",
                            }}
                          >
                            Reset
                          </button>
                        </div>
                      </div>

                      {/* Photo Upload Row */}
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          style={{
                            width: "80px",
                            height: "55px",
                            objectFit: "cover",
                            borderRadius: "6px",
                            border: "1px solid #cbd5e1",
                            background: "#e2e8f0",
                          }}
                        />
                        <div style={{ flex: 1 }}>
                          <button
                            type="button"
                            onClick={() => triggerImageUpload(`promo.items.${idx}.imageUrl`)}
                            style={{
                              width: "100%",
                              padding: "0.4rem 0.6rem",
                              borderRadius: "6px",
                              border: "1px solid #0284c7",
                              background: "#f0f9ff",
                              color: "#0284c7",
                              fontWeight: 600,
                              fontSize: "0.75rem",
                              cursor: "pointer",
                            }}
                          >
                            Unggah Foto #{idx + 1} (WebP)
                          </button>
                          {imageSizes[`promo.items.${idx}.imageUrl`] && (
                            <span style={{ display: "block", fontSize: "0.7rem", color: "#166534", marginTop: "0.2rem" }}>
                              Terkonversi: {imageSizes[`promo.items.${idx}.imageUrl`]}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Pill & Judul */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "0.5rem" }}>
                        <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem", fontSize: "0.75rem", fontWeight: 600 }}>
                          Kategori / Pill
                          <input
                            type="text"
                            value={item.pill}
                            onChange={(e) => handlePromoItemChange(idx, "pill", e.target.value)}
                            style={{ padding: "0.45rem", borderRadius: "5px", border: "1px solid #cbd5e1", fontSize: "0.8rem" }}
                          />
                        </label>
                        <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem", fontSize: "0.75rem", fontWeight: 600 }}>
                          Judul Paket
                          <input
                            type="text"
                            value={item.title}
                            onChange={(e) => handlePromoItemChange(idx, "title", e.target.value)}
                            style={{ padding: "0.45rem", borderRadius: "5px", border: "1px solid #cbd5e1", fontSize: "0.8rem" }}
                          />
                        </label>
                      </div>

                      {/* Sub / Porsi & Aksen */}
                      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "0.5rem" }}>
                        <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem", fontSize: "0.75rem", fontWeight: 600 }}>
                          Subjudul / Porsi
                          <input
                            type="text"
                            value={item.sub}
                            onChange={(e) => handlePromoItemChange(idx, "sub", e.target.value)}
                            style={{ padding: "0.45rem", borderRadius: "5px", border: "1px solid #cbd5e1", fontSize: "0.8rem" }}
                          />
                        </label>
                        <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem", fontSize: "0.75rem", fontWeight: 600 }}>
                          Aksen Garis Kartu
                          <select
                            value={item.accent || "golden"}
                            onChange={(e) => handlePromoItemChange(idx, "accent", e.target.value)}
                            style={{ padding: "0.45rem", borderRadius: "5px", border: "1px solid #cbd5e1", fontSize: "0.8rem" }}
                          >
                            <option value="golden">Emas (Golden)</option>
                            <option value="forest">Hijau (Forest)</option>
                          </select>
                        </label>
                      </div>

                      {/* Deskripsi */}
                      <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem", fontSize: "0.75rem", fontWeight: 600 }}>
                        Deskripsi Paket
                        <textarea
                          rows={2}
                          value={item.desc}
                          onChange={(e) => handlePromoItemChange(idx, "desc", e.target.value)}
                          style={{ padding: "0.45rem", borderRadius: "5px", border: "1px solid #cbd5e1", fontSize: "0.78rem", resize: "vertical" }}
                        />
                      </label>

                      {/* Footer, Tombol CTA & Link */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.4rem" }}>
                        <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem", fontSize: "0.72rem", fontWeight: 600 }}>
                          Label Footer
                          <input
                            type="text"
                            value={item.foot}
                            onChange={(e) => handlePromoItemChange(idx, "foot", e.target.value)}
                            style={{ padding: "0.4rem", borderRadius: "5px", border: "1px solid #cbd5e1", fontSize: "0.75rem" }}
                          />
                        </label>
                        <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem", fontSize: "0.72rem", fontWeight: 600 }}>
                          Teks Tombol
                          <input
                            type="text"
                            value={item.ctaText}
                            onChange={(e) => handlePromoItemChange(idx, "ctaText", e.target.value)}
                            style={{ padding: "0.4rem", borderRadius: "5px", border: "1px solid #cbd5e1", fontSize: "0.75rem" }}
                          />
                        </label>
                        <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem", fontSize: "0.72rem", fontWeight: 600 }}>
                          Link Tujuan
                          <input
                            type="text"
                            value={item.ctaLink}
                            onChange={(e) => handlePromoItemChange(idx, "ctaLink", e.target.value)}
                            style={{ padding: "0.4rem", borderRadius: "5px", border: "1px solid #cbd5e1", fontSize: "0.75rem" }}
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Banner Promo Restoran Bawah */}
              <div
                style={{
                  padding: "1rem",
                  background: "#f8fafc",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.85rem",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#1e293b", borderBottom: "1px solid #e2e8f0", paddingBottom: "0.4rem" }}>
                  Banner Promo Restoran (Bagian Bawah Seksi Promo)
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: "0.3rem", fontSize: "0.82rem", fontWeight: 600 }}>
                    Badge Kicker Banner
                    <input
                      type="text"
                      value={content.promo.badge}
                      onChange={(e) => handleFieldChange("promo", "badge", e.target.value)}
                      style={{ padding: "0.55rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: "0.3rem", fontSize: "0.82rem", fontWeight: 600 }}>
                    Judul Banner Promo
                    <input
                      type="text"
                      value={content.promo.bannerTitle || content.promo.title}
                      onChange={(e) => {
                        handleFieldChange("promo", "bannerTitle", e.target.value);
                        handleFieldChange("promo", "title", e.target.value);
                      }}
                      style={{ padding: "0.55rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                    />
                  </label>
                </div>

                <label style={{ display: "flex", flexDirection: "column", gap: "0.3rem", fontSize: "0.82rem", fontWeight: 600 }}>
                  Deskripsi Banner Promo
                  <textarea
                    rows={2}
                    value={content.promo.bannerDesc || content.promo.description}
                    onChange={(e) => {
                      handleFieldChange("promo", "bannerDesc", e.target.value);
                      handleFieldChange("promo", "description", e.target.value);
                    }}
                    style={{ padding: "0.55rem", borderRadius: "6px", border: "1px solid #cbd5e1", resize: "vertical" }}
                  />
                </label>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: "0.3rem", fontSize: "0.82rem", fontWeight: 600 }}>
                    Teks Tombol CTA Banner
                    <input
                      type="text"
                      value={content.promo.bannerCtaText}
                      onChange={(e) => handleFieldChange("promo", "bannerCtaText", e.target.value)}
                      style={{ padding: "0.55rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: "0.3rem", fontSize: "0.82rem", fontWeight: 600 }}>
                    Link Tujuan Tombol Banner
                    <input
                      type="text"
                      value={content.promo.bannerCtaLink || "#menu-pilihan"}
                      onChange={(e) => handleFieldChange("promo", "bannerCtaLink", e.target.value)}
                      style={{ padding: "0.55rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                    />
                  </label>
                </div>

                <div>
                  <span style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                    Foto Banner Promo (WebP)
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <img
                      src={content.promo.promoImage}
                      alt="Preview Banner Promo"
                      style={{ width: "90px", height: "55px", objectFit: "cover", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                    />
                    <div>
                      <button
                        type="button"
                        onClick={() => triggerImageUpload("promo.promoImage")}
                        style={{
                          padding: "0.45rem 0.9rem",
                          borderRadius: "6px",
                          border: "1px solid #0369a1",
                          background: "#f0f9ff",
                          color: "#0369a1",
                          fontWeight: 600,
                          fontSize: "0.82rem",
                          cursor: "pointer",
                        }}
                      >
                        Unggah &amp; Ganti Banner Promo (WebP)
                      </button>
                      {imageSizes["promo.promoImage"] && (
                        <span style={{ display: "block", fontSize: "0.75rem", color: "#166534", marginTop: "0.25rem" }}>
                          Terkonversi: {imageSizes["promo.promoImage"]}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "about" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.88rem", fontWeight: 600 }}>
                Label Kicker
                <input
                  type="text"
                  value={content.about.kicker}
                  onChange={(e) => handleFieldChange("about", "kicker", e.target.value)}
                  style={{ padding: "0.6rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.88rem", fontWeight: 600 }}>
                Judul Seksi Tentang Kami
                <input
                  type="text"
                  value={content.about.title}
                  onChange={(e) => handleFieldChange("about", "title", e.target.value)}
                  style={{ padding: "0.6rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.88rem", fontWeight: 600 }}>
                Cerita / Narasi Restoran
                <textarea
                  rows={4}
                  value={content.about.story}
                  onChange={(e) => handleFieldChange("about", "story", e.target.value)}
                  style={{ padding: "0.6rem", borderRadius: "6px", border: "1px solid #cbd5e1", resize: "vertical" }}
                />
              </label>

              <div>
                <span style={{ display: "block", fontSize: "0.88rem", fontWeight: 600, marginBottom: "0.4rem" }}>
                  Foto Saung Lesehan
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <img
                    src={content.about.photo}
                    alt="Preview Saung"
                    style={{ width: "90px", height: "60px", objectFit: "cover", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  />
                  <div>
                    <button
                      type="button"
                      onClick={() => triggerImageUpload("about.photo")}
                      style={{
                        padding: "0.45rem 0.9rem",
                        borderRadius: "6px",
                        border: "1px solid #0369a1",
                        background: "#f0f9ff",
                        color: "#0369a1",
                        fontWeight: 600,
                        fontSize: "0.85rem",
                        cursor: "pointer",
                      }}
                    >
                      Unggah &amp; Ganti Foto Saung (WebP)
                    </button>
                    {imageSizes["about.photo"] && (
                      <span style={{ display: "block", fontSize: "0.75rem", color: "#166534", marginTop: "0.25rem" }}>
                        Terkonversi: {imageSizes["about.photo"]}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "qr_order" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.88rem", fontWeight: 600 }}>
                Label Kicker
                <input
                  type="text"
                  value={content.qr_order.eyebrow}
                  onChange={(e) => handleFieldChange("qr_order", "eyebrow", e.target.value)}
                  style={{ padding: "0.6rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.88rem", fontWeight: 600 }}>
                Judul Cara Pesan
                <input
                  type="text"
                  value={content.qr_order.title}
                  onChange={(e) => handleFieldChange("qr_order", "title", e.target.value)}
                  style={{ padding: "0.6rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.88rem", fontWeight: 600 }}>
                Deskripsi Panduan Pesan
                <textarea
                  rows={4}
                  value={content.qr_order.description}
                  onChange={(e) => handleFieldChange("qr_order", "description", e.target.value)}
                  style={{ padding: "0.6rem", borderRadius: "6px", border: "1px solid #cbd5e1", resize: "vertical" }}
                />
              </label>

              <div>
                <span style={{ display: "block", fontSize: "0.88rem", fontWeight: 600, marginBottom: "0.4rem" }}>
                  Foto Panduan / Mockup Layanan Meja
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <img
                    src={content.qr_order.guideImage || "/logo.png"}
                    alt="Preview Panduan"
                    style={{ width: "90px", height: "60px", objectFit: "contain", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  />
                  <div>
                    <button
                      type="button"
                      onClick={() => triggerImageUpload("qr_order.guideImage")}
                      style={{
                        padding: "0.45rem 0.9rem",
                        borderRadius: "6px",
                        border: "1px solid #0369a1",
                        background: "#f0f9ff",
                        color: "#0369a1",
                        fontWeight: 600,
                        fontSize: "0.85rem",
                        cursor: "pointer",
                      }}
                    >
                      Unggah &amp; Ganti Foto (WebP)
                    </button>
                    {imageSizes["qr_order.guideImage"] && (
                      <span style={{ display: "block", fontSize: "0.75rem", color: "#166534", marginTop: "0.25rem" }}>
                        Terkonversi: {imageSizes["qr_order.guideImage"]}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "gallery" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1rem" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.88rem", fontWeight: 600 }}>
                  Label Kicker
                  <input
                    type="text"
                    value={content.gallery.eyebrow}
                    onChange={(e) => handleFieldChange("gallery", "eyebrow", e.target.value)}
                    style={{ padding: "0.6rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.88rem", fontWeight: 600 }}>
                  Judul Seksi Galeri
                  <input
                    type="text"
                    value={content.gallery.title}
                    onChange={(e) => handleFieldChange("gallery", "title", e.target.value)}
                    style={{ padding: "0.6rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  />
                </label>
              </div>

              <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.88rem", fontWeight: 600 }}>
                Deskripsi Seksi Galeri
                <textarea
                  rows={2}
                  value={content.gallery.description}
                  onChange={(e) => handleFieldChange("gallery", "description", e.target.value)}
                  style={{ padding: "0.6rem", borderRadius: "6px", border: "1px solid #cbd5e1", resize: "vertical" }}
                />
              </label>

              {/* 6 Showcase Photo Slots Manager */}
              <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "1.25rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#0f172a" }}>
                      Showcase 6 Kartu Foto Galeri Suasana
                    </h3>
                    <p style={{ margin: "0.2rem 0 0", fontSize: "0.82rem", color: "#64748b" }}>
                      Setiap kartu dapat dikustomisasi teks judul, kategori, deskripsi, dan foto WebP (<span style={{ color: "#166534", fontWeight: 600 }}>&lt;80 KB otomatis</span>).
                    </p>
                  </div>
                  <span style={{ fontSize: "0.8rem", padding: "0.25rem 0.6rem", background: "#f0fdf4", color: "#166534", borderRadius: "6px", fontWeight: 600 }}>
                    6 Slot Aktif
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  {content.gallery.items.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      style={{
                        padding: "1rem",
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                        background: "#f8fafc",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.75rem",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "#0f172a" }}>
                          Slot #{idx + 1}: {item.title || `Foto ${idx + 1}`}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleResetGalleryItem(idx)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#dc2626",
                            fontSize: "0.75rem",
                            cursor: "pointer",
                            padding: 0,
                            textDecoration: "underline",
                          }}
                        >
                          Reset Slot
                        </button>
                      </div>

                      {/* Photo preview + upload button */}
                      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          style={{
                            width: "70px",
                            height: "70px",
                            objectFit: "cover",
                            borderRadius: "6px",
                            border: "1px solid #cbd5e1",
                            background: "#e2e8f0",
                          }}
                        />
                        <div style={{ flex: 1 }}>
                          <button
                            type="button"
                            onClick={() => triggerImageUpload(`gallery.items.${idx}.imageUrl`)}
                            style={{
                              padding: "0.35rem 0.75rem",
                              borderRadius: "6px",
                              border: "1px solid #0369a1",
                              background: "#f0f9ff",
                              color: "#0369a1",
                              fontSize: "0.78rem",
                              fontWeight: 600,
                              cursor: "pointer",
                              width: "100%",
                              textAlign: "center",
                            }}
                          >
                            Unggah Foto #{idx + 1} (WebP)
                          </button>
                          {imageSizes[`gallery.items.${idx}.imageUrl`] && (
                            <span style={{ display: "block", fontSize: "0.7rem", color: "#166534", marginTop: "0.2rem" }}>
                              Terkonversi: {imageSizes[`gallery.items.${idx}.imageUrl`]}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "0.5rem" }}>
                        <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem", fontSize: "0.78rem", fontWeight: 600 }}>
                          Judul Foto
                          <input
                            type="text"
                            value={item.title}
                            onChange={(e) => handleGalleryItemChange(idx, "title", e.target.value)}
                            style={{ padding: "0.4rem", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.82rem" }}
                          />
                        </label>
                        <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem", fontSize: "0.78rem", fontWeight: 600 }}>
                          Kategori / Kicker
                          <input
                            type="text"
                            value={item.kicker}
                            onChange={(e) => handleGalleryItemChange(idx, "kicker", e.target.value)}
                            style={{ padding: "0.4rem", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.82rem" }}
                          />
                        </label>
                      </div>

                      <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem", fontSize: "0.78rem", fontWeight: 600 }}>
                        Deskripsi Kartu
                        <input
                          type="text"
                          value={item.desc}
                          onChange={(e) => handleGalleryItemChange(idx, "desc", e.target.value)}
                          style={{ padding: "0.4rem", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.82rem" }}
                        />
                      </label>

                      <label style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontSize: "0.78rem", color: "#475569" }}>
                        <input
                          type="checkbox"
                          checked={Boolean(item.tall)}
                          onChange={(e) => handleGalleryItemChange(idx, "tall", e.target.checked)}
                        />
                        <span>Format Tampilan Tinggi (Tall Grid Layout)</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "reservation" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.88rem", fontWeight: 600 }}>
                Label Kicker
                <input
                  type="text"
                  value={content.reservation.eyebrow}
                  onChange={(e) => handleFieldChange("reservation", "eyebrow", e.target.value)}
                  style={{ padding: "0.6rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.88rem", fontWeight: 600 }}>
                Judul Seksi Reservasi
                <input
                  type="text"
                  value={content.reservation.title}
                  onChange={(e) => handleFieldChange("reservation", "title", e.target.value)}
                  style={{ padding: "0.6rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.88rem", fontWeight: 600 }}>
                Deskripsi Seksi Reservasi
                <textarea
                  rows={3}
                  value={content.reservation.description}
                  onChange={(e) => handleFieldChange("reservation", "description", e.target.value)}
                  style={{ padding: "0.6rem", borderRadius: "6px", border: "1px solid #cbd5e1", resize: "vertical" }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.88rem", fontWeight: 600 }}>
                Nomor WhatsApp Konfirmasi Booking
                <input
                  type="text"
                  value={content.reservation.whatsappNumber}
                  onChange={(e) => handleFieldChange("reservation", "whatsappNumber", e.target.value)}
                  style={{ padding: "0.6rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </label>

              <div>
                <span style={{ display: "block", fontSize: "0.88rem", fontWeight: 600, marginBottom: "0.4rem" }}>
                  Foto Area Saung / VIP Room
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <img
                    src={content.reservation.roomImage || "/about-saung.webp"}
                    alt="Preview Saung Reservasi"
                    style={{ width: "90px", height: "60px", objectFit: "cover", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  />
                  <div>
                    <button
                      type="button"
                      onClick={() => triggerImageUpload("reservation.roomImage")}
                      style={{
                        padding: "0.45rem 0.9rem",
                        borderRadius: "6px",
                        border: "1px solid #0369a1",
                        background: "#f0f9ff",
                        color: "#0369a1",
                        fontWeight: 600,
                        fontSize: "0.85rem",
                        cursor: "pointer",
                      }}
                    >
                      Unggah &amp; Ganti Foto (WebP)
                    </button>
                    {imageSizes["reservation.roomImage"] && (
                      <span style={{ display: "block", fontSize: "0.75rem", color: "#166534", marginTop: "0.25rem" }}>
                        Terkonversi: {imageSizes["reservation.roomImage"]}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "location" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.88rem", fontWeight: 600 }}>
                Alamat Lengkap Restoran
                <textarea
                  rows={2}
                  value={content.location.address}
                  onChange={(e) => handleFieldChange("location", "address", e.target.value)}
                  style={{ padding: "0.6rem", borderRadius: "6px", border: "1px solid #cbd5e1", resize: "vertical" }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.88rem", fontWeight: 600 }}>
                Petunjuk Akses / Pintu Keluar Tol
                <input
                  type="text"
                  value={content.location.directions}
                  onChange={(e) => handleFieldChange("location", "directions", e.target.value)}
                  style={{ padding: "0.6rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </label>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                  <label style={{ fontSize: "0.88rem", fontWeight: 600 }}>
                    Google Maps Embed URL (Iframe)
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      handleFieldChange(
                        "location",
                        "mapsEmbedUrl",
                        "https://maps.google.com/maps?q=-6.771185,108.512599&hl=id&z=17&output=embed"
                      )
                    }
                    style={{
                      background: "none",
                      border: "none",
                      color: "#166534",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      textDecoration: "underline",
                      padding: 0,
                    }}
                  >
                    Gunakan Koordinat Presisi Tepi Sawah Ciperna
                  </button>
                </div>
                <input
                  type="text"
                  value={content.location.mapsEmbedUrl}
                  onChange={(e) => handleMapUrlChange(e.target.value)}
                  placeholder="https://maps.google.com/maps?q=... atau kode <iframe src='...'>"
                  style={{ width: "100%", padding: "0.6rem", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.82rem" }}
                />
                <span style={{ display: "block", fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>
                  Tip: Jika Anda menempelkan seluruh kode tag &lt;iframe src="..."&gt;, sistem akan secara otomatis mengekstrak URL petanya saja.
                </span>

                {/* Live Real Map Preview */}
                <div style={{ marginTop: "0.75rem", borderRadius: "8px", overflow: "hidden", border: "1px solid #cbd5e1", height: "220px", background: "#f8fafc" }}>
                  <iframe
                    src={content.location.mapsEmbedUrl || "https://maps.google.com/maps?q=-6.771185,108.512599&hl=id&z=17&output=embed"}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    loading="lazy"
                    title="Pratinjau Peta Google Maps"
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.88rem", fontWeight: 600 }}>
                  Nomor WhatsApp Reservasi
                  <input
                    type="text"
                    value={content.location.phoneWhatsapp}
                    onChange={(e) => handleFieldChange("location", "phoneWhatsapp", e.target.value)}
                    style={{ padding: "0.6rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.88rem", fontWeight: 600 }}>
                  Akun Instagram
                  <input
                    type="text"
                    value={content.location.instagram}
                    onChange={(e) => handleFieldChange("location", "instagram", e.target.value)}
                    style={{ padding: "0.6rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  />
                </label>
              </div>

              <div>
                <span style={{ display: "block", fontSize: "0.88rem", fontWeight: 600, marginBottom: "0.4rem" }}>
                  Foto Fasad / Pintu Masuk
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <img
                    src={content.location.facadeImage || "/sawah-panorama.webp"}
                    alt="Preview Fasad"
                    style={{ width: "90px", height: "60px", objectFit: "cover", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  />
                  <div>
                    <button
                      type="button"
                      onClick={() => triggerImageUpload("location.facadeImage")}
                      style={{
                        padding: "0.45rem 0.9rem",
                        borderRadius: "6px",
                        border: "1px solid #0369a1",
                        background: "#f0f9ff",
                        color: "#0369a1",
                        fontWeight: 600,
                        fontSize: "0.85rem",
                        cursor: "pointer",
                      }}
                    >
                      Unggah &amp; Ganti Foto (WebP)
                    </button>
                    {imageSizes["location.facadeImage"] && (
                      <span style={{ display: "block", fontSize: "0.75rem", color: "#166534", marginTop: "0.25rem" }}>
                        Terkonversi: {imageSizes["location.facadeImage"]}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* New Tab 9: Theme & Branding Customizer */}
          {activeTab === "theme" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              {/* Presets Grid */}
              <div>
                <strong style={{ display: "block", fontSize: "0.95rem", color: "#0f172a", marginBottom: "0.5rem" }}>
                  Pilih Preset Tema Cepat (1-Klik Terapkan)
                </strong>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.75rem" }}>
                  {THEME_PRESETS.map((preset) => {
                    const isSelected = content.theme.preset === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleApplyPreset(preset.id)}
                        style={{
                          padding: "0.85rem",
                          borderRadius: "8px",
                          border: isSelected ? "2px solid #166534" : "1px solid #cbd5e1",
                          background: isSelected ? "#f0fdf4" : "#ffffff",
                          textAlign: "left",
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.4rem",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#0f172a" }}>
                            {preset.name}
                          </span>
                          {isSelected && (
                            <span style={{ fontSize: "0.75rem", color: "#166534", fontWeight: 700 }}>
                              ✓ Aktif
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: "0.78rem", color: "#64748b" }}>{preset.desc}</span>
                        {/* Swatches mini preview */}
                        <div style={{ display: "flex", gap: "0.35rem", marginTop: "0.25rem" }}>
                          <span style={{ width: "16px", height: "16px", borderRadius: "50%", background: preset.primary, border: "1px solid rgba(0,0,0,0.1)" }} />
                          <span style={{ width: "16px", height: "16px", borderRadius: "50%", background: preset.secondary, border: "1px solid rgba(0,0,0,0.1)" }} />
                          <span style={{ width: "16px", height: "16px", borderRadius: "50%", background: preset.accent, border: "1px solid rgba(0,0,0,0.1)" }} />
                          <span style={{ width: "16px", height: "16px", borderRadius: "50%", background: preset.bg, border: "1px solid rgba(0,0,0,0.1)" }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Color Swatches Editor */}
              <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "1.25rem" }}>
                <strong style={{ display: "block", fontSize: "0.95rem", color: "#0f172a", marginBottom: "0.75rem" }}>
                  Kustomisasi Palet Warna Presisi
                </strong>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: "0.3rem", fontSize: "0.82rem", fontWeight: 600 }}>
                    Warna Utama / Header &amp; Footer
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <input
                        type="color"
                        value={content.theme.primaryColor}
                        onChange={(e) => handleThemeChange("primaryColor", e.target.value)}
                        style={{ width: "42px", height: "36px", border: "1px solid #cbd5e1", borderRadius: "6px", cursor: "pointer", padding: 0 }}
                      />
                      <input
                        type="text"
                        value={content.theme.primaryColor}
                        onChange={(e) => handleThemeChange("primaryColor", e.target.value)}
                        style={{ flex: 1, padding: "0.5rem", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.82rem" }}
                      />
                    </div>
                  </label>

                  <label style={{ display: "flex", flexDirection: "column", gap: "0.3rem", fontSize: "0.82rem", fontWeight: 600 }}>
                    Warna Sekunder / Aksen Hijau
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <input
                        type="color"
                        value={content.theme.secondaryColor}
                        onChange={(e) => handleThemeChange("secondaryColor", e.target.value)}
                        style={{ width: "42px", height: "36px", border: "1px solid #cbd5e1", borderRadius: "6px", cursor: "pointer", padding: 0 }}
                      />
                      <input
                        type="text"
                        value={content.theme.secondaryColor}
                        onChange={(e) => handleThemeChange("secondaryColor", e.target.value)}
                        style={{ flex: 1, padding: "0.5rem", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.82rem" }}
                      />
                    </div>
                  </label>

                  <label style={{ display: "flex", flexDirection: "column", gap: "0.3rem", fontSize: "0.82rem", fontWeight: 600 }}>
                    Warna Aksen / Emas Tombol CTA
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <input
                        type="color"
                        value={content.theme.accentColor}
                        onChange={(e) => handleThemeChange("accentColor", e.target.value)}
                        style={{ width: "42px", height: "36px", border: "1px solid #cbd5e1", borderRadius: "6px", cursor: "pointer", padding: 0 }}
                      />
                      <input
                        type="text"
                        value={content.theme.accentColor}
                        onChange={(e) => handleThemeChange("accentColor", e.target.value)}
                        style={{ flex: 1, padding: "0.5rem", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.82rem" }}
                      />
                    </div>
                  </label>

                  <label style={{ display: "flex", flexDirection: "column", gap: "0.3rem", fontSize: "0.82rem", fontWeight: 600 }}>
                    Warna Amber / Sorotan Bintang
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <input
                        type="color"
                        value={content.theme.amberColor}
                        onChange={(e) => handleThemeChange("amberColor", e.target.value)}
                        style={{ width: "42px", height: "36px", border: "1px solid #cbd5e1", borderRadius: "6px", cursor: "pointer", padding: 0 }}
                      />
                      <input
                        type="text"
                        value={content.theme.amberColor}
                        onChange={(e) => handleThemeChange("amberColor", e.target.value)}
                        style={{ flex: 1, padding: "0.5rem", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.82rem" }}
                      />
                    </div>
                  </label>

                  <label style={{ display: "flex", flexDirection: "column", gap: "0.3rem", fontSize: "0.82rem", fontWeight: 600 }}>
                    Warna Latar Halaman (Background)
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <input
                        type="color"
                        value={content.theme.backgroundColor}
                        onChange={(e) => handleThemeChange("backgroundColor", e.target.value)}
                        style={{ width: "42px", height: "36px", border: "1px solid #cbd5e1", borderRadius: "6px", cursor: "pointer", padding: 0 }}
                      />
                      <input
                        type="text"
                        value={content.theme.backgroundColor}
                        onChange={(e) => handleThemeChange("backgroundColor", e.target.value)}
                        style={{ flex: 1, padding: "0.5rem", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.82rem" }}
                      />
                    </div>
                  </label>

                  <label style={{ display: "flex", flexDirection: "column", gap: "0.3rem", fontSize: "0.82rem", fontWeight: 600 }}>
                    Warna Latar Panel Kartu
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <input
                        type="color"
                        value={content.theme.panelBgColor}
                        onChange={(e) => handleThemeChange("panelBgColor", e.target.value)}
                        style={{ width: "42px", height: "36px", border: "1px solid #cbd5e1", borderRadius: "6px", cursor: "pointer", padding: 0 }}
                      />
                      <input
                        type="text"
                        value={content.theme.panelBgColor}
                        onChange={(e) => handleThemeChange("panelBgColor", e.target.value)}
                        style={{ flex: 1, padding: "0.5rem", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.82rem" }}
                      />
                    </div>
                  </label>
                </div>
              </div>

              {/* Background Style Customizer */}
              <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "1.25rem" }}>
                <strong style={{ display: "block", fontSize: "0.95rem", color: "#0f172a", marginBottom: "0.75rem" }}>
                  Kustomisasi Gaya Latar Belakang (Background Website)
                </strong>
                <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem" }}>
                  {[
                    { id: "clean", label: "Polos Bersih (Clean Solid)" },
                    { id: "texture", label: "Tekstur Alami (Dot Pattern)" },
                    { id: "custom_image", label: "Gambar Latar Kustom" },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => handleThemeChange("bgType", mode.id)}
                      style={{
                        padding: "0.5rem 0.85rem",
                        borderRadius: "6px",
                        border: content.theme.bgType === mode.id ? "2px solid #166534" : "1px solid #cbd5e1",
                        background: content.theme.bgType === mode.id ? "#f0fdf4" : "#ffffff",
                        color: content.theme.bgType === mode.id ? "#166534" : "#475569",
                        fontWeight: content.theme.bgType === mode.id ? 700 : 500,
                        fontSize: "0.82rem",
                        cursor: "pointer",
                      }}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>

                {content.theme.bgType === "custom_image" && (
                  <div style={{ padding: "1rem", borderRadius: "8px", background: "#f8fafc", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                      {content.theme.bgImageUrl ? (
                        <img
                          src={content.theme.bgImageUrl}
                          alt="Custom BG"
                          style={{ width: "90px", height: "60px", objectFit: "cover", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                        />
                      ) : (
                        <div style={{ width: "90px", height: "60px", background: "#e2e8f0", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", color: "#64748b" }}>
                          Belum Ada
                        </div>
                      )}
                      <div>
                        <button
                          type="button"
                          onClick={() => triggerImageUpload("theme.bgImageUrl")}
                          style={{
                            padding: "0.45rem 0.9rem",
                            borderRadius: "6px",
                            border: "1px solid #0369a1",
                            background: "#f0f9ff",
                            color: "#0369a1",
                            fontWeight: 600,
                            fontSize: "0.85rem",
                            cursor: "pointer",
                          }}
                        >
                          Unggah Gambar Latar (WebP)
                        </button>
                        {imageSizes["theme.bgImageUrl"] && (
                          <span style={{ display: "block", fontSize: "0.75rem", color: "#166534", marginTop: "0.25rem" }}>
                            Terkonversi: {imageSizes["theme.bgImageUrl"]}
                          </span>
                        )}
                      </div>
                    </div>

                    <label style={{ display: "flex", flexDirection: "column", gap: "0.3rem", fontSize: "0.82rem", fontWeight: 600 }}>
                      Transparansi / Opasitas Gambar Latar: {Math.round(content.theme.bgOpacity * 100)}%
                      <input
                        type="range"
                        min="0.05"
                        max="0.8"
                        step="0.05"
                        value={content.theme.bgOpacity}
                        onChange={(e) => handleThemeChange("bgOpacity", parseFloat(e.target.value))}
                        style={{ width: "100%", cursor: "pointer" }}
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Live Preview Column */}
        <div
          style={{
            background: "#ffffff",
            padding: "1.5rem",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
            position: "sticky",
            top: "1rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <strong style={{ fontSize: "1rem", color: "#0f172a" }}>
              👁 Pratinjau Tampilan Web ({TABS.find((t) => t.key === activeTab)?.label.toUpperCase()})
            </strong>
            <span
              style={{
                fontSize: "0.78rem",
                padding: "0.2rem 0.6rem",
                background: isSectionActive ? "#ecfdf5" : "#f1f5f9",
                color: isSectionActive ? "#065f46" : "#64748b",
                borderRadius: "9999px",
                fontWeight: 600,
              }}
            >
              {isSectionActive ? "Live Sync (Aktif)" : "Disembunyikan"}
            </span>
          </div>

          {/* Conditional Preview depending on activeTab */}
          {activeTab === "theme" ? (
            <div
              style={{
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
                overflow: "hidden",
                background: content.theme.backgroundColor,
                boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
              }}
            >
              {/* Mock Header */}
              <div
                style={{
                  background: content.theme.primaryColor,
                  color: "#ffffff",
                  padding: "0.75rem 1rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontSize: "1rem" }}>🌾</span>
                  <span style={{ fontWeight: 800, fontSize: "0.9rem", letterSpacing: "0.05em" }}>TEPI SAWAH</span>
                </div>
                <button
                  type="button"
                  style={{
                    background: content.theme.accentColor,
                    color: content.theme.primaryColor,
                    border: "none",
                    borderRadius: "9999px",
                    padding: "0.3rem 0.75rem",
                    fontWeight: 700,
                    fontSize: "0.75rem",
                  }}
                >
                  Reservasi Meja
                </button>
              </div>

              {/* Mock Content Card */}
              <div style={{ padding: "1.25rem" }}>
                <div
                  style={{
                    background: content.theme.panelBgColor,
                    borderRadius: "8px",
                    padding: "1rem",
                    border: "1px solid rgba(0,0,0,0.06)",
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      color: content.theme.secondaryColor,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      marginBottom: "0.25rem",
                    }}
                  >
                    ★ Nuansa Pedesaan Asri
                  </span>
                  <h4 style={{ margin: "0 0 0.5rem 0", color: content.theme.textColor, fontSize: "1.1rem", fontFamily: "serif" }}>
                    Harmoni Kuliner &amp; Panorama Sawah
                  </h4>
                  <p style={{ margin: "0 0 0.75rem 0", color: content.theme.textColor, fontSize: "0.82rem", lineHeight: 1.5, opacity: 0.85 }}>
                    Contoh pratinjau kombinasi warna primer, sekunder, tombol aksen emas, serta latar belakang kartu.
                  </p>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <span style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem", borderRadius: "4px", background: content.theme.primaryColor, color: "#fff", fontWeight: 600 }}>
                      Tombol Utama
                    </span>
                    <span style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem", borderRadius: "4px", background: content.theme.amberColor, color: "#000", fontWeight: 600 }}>
                      Sorotan Promo
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                background: content.theme.primaryColor || "#122a18",
                color: "#ffffff",
                padding: "1.25rem",
                borderRadius: "10px",
                minHeight: "260px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                opacity: isSectionActive ? 1 : 0.45,
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: content.theme.accentColor || "#d97706",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {(currentSection as any)?.badge || (currentSection as any)?.eyebrow || (currentSection as any)?.kicker || "TEPI SAWAH RESTO"}
                </span>
                <h2
                  style={{
                    fontSize: "1.35rem",
                    margin: "0.4rem 0",
                    fontFamily: "serif",
                    lineHeight: 1.25,
                  }}
                >
                  {(currentSection as any)?.title || "Tepi Sawah Restoran & Coffee"}
                </h2>
                <p style={{ fontSize: "0.85rem", color: "#cbd5e1", lineHeight: 1.5, margin: "0 0 1rem 0" }}>
                  {(currentSection as any)?.description ||
                    (currentSection as any)?.story ||
                    (currentSection as any)?.address ||
                    "Sajian kuliner khas pedesaan di Ciperna, Cirebon."}
                </p>
              </div>

              {/* Thumbnail Preview if applicable */}
              {activeTab === "menu" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.4rem" }}>
                    {content.menu.items.slice(0, 6).map((item, i) => (
                      <div
                        key={item.id || i}
                        style={{
                          background: "rgba(255,255,255,0.06)",
                          borderRadius: "4px",
                          overflow: "hidden",
                          border: "1px solid rgba(255,255,255,0.15)",
                          fontSize: "0.65rem",
                        }}
                      >
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          style={{ width: "100%", height: "45px", objectFit: "cover", display: "block" }}
                        />
                        <div style={{ padding: "0.2rem 0.3rem" }}>
                          <div style={{ color: "#f8fafc", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: 600 }}>
                            {item.name}
                          </div>
                          <div style={{ color: "#fcd34d", fontSize: "0.6rem", fontWeight: 700 }}>
                            {item.price}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: "0.4rem 0.6rem", borderRadius: "6px", background: "rgba(221, 161, 94, 0.15)", border: "1px solid rgba(221, 161, 94, 0.3)", fontSize: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#f8fafc", fontWeight: 600 }}>6 Hidangan Siap Disajikan</span>
                    <span style={{ color: "#fcd34d", fontWeight: 700, fontSize: "0.7rem" }}>Katalog Otentik</span>
                  </div>
                </div>
              ) : activeTab === "promo" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.4rem" }}>
                    {content.promo.items.slice(0, 6).map((item, i) => (
                      <div
                        key={item.id || i}
                        style={{
                          background: "rgba(255,255,255,0.06)",
                          borderRadius: "4px",
                          overflow: "hidden",
                          border: "1px solid rgba(255,255,255,0.15)",
                          fontSize: "0.65rem",
                        }}
                      >
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          style={{ width: "100%", height: "45px", objectFit: "cover", display: "block" }}
                        />
                        <div style={{ padding: "0.2rem 0.3rem", color: "#f8fafc", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: 600 }}>
                          {item.title}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: "0.5rem", borderRadius: "6px", background: "rgba(221, 161, 94, 0.15)", border: "1px solid rgba(221, 161, 94, 0.3)", fontSize: "0.75rem" }}>
                    <div style={{ fontWeight: 700, color: "#fcd34d", fontSize: "0.7rem" }}>{content.promo.badge}</div>
                    <div style={{ color: "#f8fafc", fontWeight: 600, marginTop: "0.15rem" }}>{content.promo.bannerTitle || content.promo.title}</div>
                  </div>
                </div>
              ) : activeTab === "gallery" ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.4rem", marginTop: "0.5rem" }}>
                  {content.gallery.items.slice(0, 6).map((item, i) => (
                    <img
                      key={item.id || i}
                      src={item.imageUrl}
                      alt={item.title}
                      style={{ width: "100%", height: "55px", objectFit: "cover", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.2)" }}
                    />
                  ))}
                </div>
              ) : (
                ((currentSection as any)?.bgImage ||
                  (currentSection as any)?.photo ||
                  (currentSection as any)?.promoImage ||
                  (currentSection as any)?.bannerImage ||
                  (currentSection as any)?.heroImage ||
                  (currentSection as any)?.roomImage ||
                  (currentSection as any)?.facadeImage) && (
                  <div style={{ marginTop: "0.5rem" }}>
                    <img
                      src={
                        (currentSection as any)?.bgImage ||
                        (currentSection as any)?.photo ||
                        (currentSection as any)?.promoImage ||
                        (currentSection as any)?.bannerImage ||
                        (currentSection as any)?.heroImage ||
                        (currentSection as any)?.roomImage ||
                        (currentSection as any)?.facadeImage
                      }
                      alt="Preview"
                      style={{
                        width: "100%",
                        maxHeight: "140px",
                        objectFit: "cover",
                        borderRadius: "6px",
                        border: "1px solid rgba(255,255,255,0.15)",
                      }}
                    />
                  </div>
                )
              )}

              {!isSectionActive && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgba(15, 23, 42, 0.75)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "column",
                    gap: "0.5rem",
                    color: "#f8fafc",
                    fontWeight: 600,
                    fontSize: "0.95rem",
                  }}
                >
                  <span style={{ fontSize: "1.8rem" }}>🚫</span>
                  <span>Seksi Ini Sedang Dinonaktifkan</span>
                  <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                    Tidak akan muncul di beranda dan navigasi website
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
