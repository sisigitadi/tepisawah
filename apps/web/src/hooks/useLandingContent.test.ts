import { describe, it, expect } from "vitest";
import {
  DEFAULT_LANDING_CONTENT,
  DEFAULT_THEME_CONFIG,
  extractIframeSrc,
  normalizeSectionContent,
} from "./useLandingContent";

describe("useLandingContent - CMS Comprehensive Features", () => {
  it("provides complete default configurations for all sections, 6 gallery items & theme", () => {
    const sections = [
      "hero",
      "menu",
      "promo",
      "about",
      "qrOrder",
      "gallery",
      "reservation",
      "location",
    ] as const;

    for (const sec of sections) {
      expect(DEFAULT_LANDING_CONTENT[sec]).toBeDefined();
      expect(DEFAULT_LANDING_CONTENT[sec].isActive).toBe(true);
    }

    // Check 6 gallery items
    expect(DEFAULT_LANDING_CONTENT.gallery.items).toHaveLength(6);
    expect(DEFAULT_LANDING_CONTENT.gallery.items?.[0]?.title).toBe("Saung Lesehan Sisi Pematang");
    expect(DEFAULT_LANDING_CONTENT.gallery.items?.[5]?.title).toBe("Dek Rooftop Senja Ciperna");

    // Check theme defaults
    expect(DEFAULT_LANDING_CONTENT.theme).toBeDefined();
    expect(DEFAULT_LANDING_CONTENT.theme.preset).toBe("default");
    expect(DEFAULT_LANDING_CONTENT.theme.primaryColor).toBe("#183a1d");
    expect(DEFAULT_LANDING_CONTENT.theme.accentColor).toBe("#dda15e");
  });

  it("normalizes customized 6 gallery items accurately", () => {
    const customData = {
      gallery: {
        items: [
          {
            id: "gal-1",
            title: "Saung Senja Eksklusif",
            kicker: "Spot Romantis",
            imageUrl: "data:image/webp;base64,customPhotoData",
            desc: "Pemandangan sawah saat matahari terbenam.",
            tall: false,
          },
        ],
      },
    };

    const normalized = normalizeSectionContent(customData);
    expect(normalized.gallery.items).toHaveLength(6);
    expect(normalized.gallery.items?.[0]?.title).toBe("Saung Senja Eksklusif");
    expect(normalized.gallery.items?.[0]?.kicker).toBe("Spot Romantis");
    expect(normalized.gallery.items?.[0]?.imageUrl).toBe("data:image/webp;base64,customPhotoData");
    // Other items retain fallback defaults
    expect(normalized.gallery.items?.[1]?.title).toBe("Chicken Roaster Rempah");
  });

  it("extracts iframe src from raw Google Maps iframe embed tags", () => {
    const rawIframe = '<iframe src="https://www.google.com/maps/embed?pb=test_coords" width="600" height="450" style="border:0;" allowfullscreen="" loading="lazy"></iframe>';
    expect(extractIframeSrc(rawIframe)).toBe("https://www.google.com/maps/embed?pb=test_coords");

    const plainUrl = "https://maps.google.com/maps?q=-6.771185,108.512599&hl=id&z=17&output=embed";
    expect(extractIframeSrc(plainUrl)).toBe(plainUrl);
  });

  it("normalizes theme and color customization", () => {
    const customData = {
      theme: {
        preset: "sunset",
        primaryColor: "#2b1810",
        accentColor: "#e07a5f",
        bgType: "texture",
        bgOpacity: 0.25,
      },
    };

    const normalized = normalizeSectionContent(customData);
    expect(normalized.theme.preset).toBe("sunset");
    expect(normalized.theme.primaryColor).toBe("#2b1810");
    expect(normalized.theme.accentColor).toBe("#e07a5f");
    expect(normalized.theme.bgType).toBe("texture");
    expect(normalized.theme.bgOpacity).toBe(0.25);
    // Unspecified colors fallback to default theme tokens
    expect(normalized.theme.amberColor).toBe(DEFAULT_THEME_CONFIG.amberColor);
  });

  it("provides 6 default promo package items with full fields", () => {
    expect(DEFAULT_LANDING_CONTENT.promo.items).toHaveLength(6);
    expect(DEFAULT_LANDING_CONTENT.promo.items?.[0]?.title).toBe("Paket Nasi Liwet Komplit");
    expect(DEFAULT_LANDING_CONTENT.promo.items?.[1]?.title).toBe("Paket Ngopi Sunset Sawah");
    expect(DEFAULT_LANDING_CONTENT.promo.items?.[5]?.title).toBe("Paket Senja Rooftop & Camilan");
    expect(DEFAULT_LANDING_CONTENT.promo.eyebrow).toBe("Penawaran Spesial");
    expect(DEFAULT_LANDING_CONTENT.promo.title).toBe("Promo & Paket");
  });

  it("normalizes customized promo items and preserves fallbacks accurately", () => {
    const customData = {
      promo: {
        eyebrow: "Spesial Opening",
        title: "Paket Grand Opening",
        subtitle: "Promo spesial bulan ini untuk Anda dan keluarga.",
        items: [
          {
            id: "promo-1",
            title: "Paket Liwet Sultan Ciperna",
            sub: "Porsi Jumbo (6-8 Orang)",
            pill: "Super Hemat",
            desc: "Nasi liwet dengan lauk komplit ayam bakar & gurame goreng.",
            imageUrl: "data:image/webp;base64,customPromoImg",
            foot: "Diskon 20%",
            ctaText: "Klaim Paket Ini",
            ctaLink: "#reservasi",
          },
        ],
      },
    };

    const normalized = normalizeSectionContent(customData);
    expect(normalized.promo.eyebrow).toBe("Spesial Opening");
    expect(normalized.promo.title).toBe("Paket Grand Opening");
    expect(normalized.promo.subtitle).toBe("Promo spesial bulan ini untuk Anda dan keluarga.");
    expect(normalized.promo.items).toHaveLength(6);
    expect(normalized.promo.items?.[0]?.title).toBe("Paket Liwet Sultan Ciperna");
    expect(normalized.promo.items?.[0]?.pill).toBe("Super Hemat");
    expect(normalized.promo.items?.[0]?.imageUrl).toBe("data:image/webp;base64,customPromoImg");
    expect(normalized.promo.items?.[0]?.foot).toBe("Diskon 20%");
    expect(normalized.promo.items?.[0]?.ctaText).toBe("Klaim Paket Ini");
    // Fallback checks on unedited items
    expect(normalized.promo.items?.[1]?.title).toBe("Paket Ngopi Sunset Sawah");
  });

  it("provides 6 default featured menu items with full fields", () => {
    expect(DEFAULT_LANDING_CONTENT.menu.items).toHaveLength(6);
    expect(DEFAULT_LANDING_CONTENT.menu.items?.[0]?.name).toBe("Nasi Liwet Sawah Komplit");
    expect(DEFAULT_LANDING_CONTENT.menu.items?.[0]?.category).toBe("Makanan Utama");
    expect(DEFAULT_LANDING_CONTENT.menu.items?.[0]?.price).toBe("Rp 45.000");
    expect(DEFAULT_LANDING_CONTENT.menu.items?.[1]?.name).toBe("Chicken Roaster Rempah");
    expect(DEFAULT_LANDING_CONTENT.menu.items?.[5]?.name).toBe("Es Kelapa Muda Batok Segar");
    expect(DEFAULT_LANDING_CONTENT.menu.eyebrow).toBe("Katalog Kuliner Otentik");
    expect(DEFAULT_LANDING_CONTENT.menu.title).toBe("Menu Pilihan");
  });

  it("normalizes customized menu items and preserves fallbacks accurately", () => {
    const customData = {
      menu: {
        eyebrow: "Sajian Favorit Koki",
        title: "Menu Spesial Tepi Sawah",
        description: "Ragam hidangan pilihan terbaik keluarga.",
        items: [
          {
            id: "menu-1",
            name: "Nasi Liwet Kastrol Spesial",
            category: "Menu Utama",
            price: "Rp 50.000",
            desc: "Nasi liwet dengan potongan ayam bakar madu empuk.",
            imageUrl: "data:image/webp;base64,customMenuImg",
            badge: "Pilihan Juara",
            isActive: true,
          },
        ],
      },
    };

    const normalized = normalizeSectionContent(customData);
    expect(normalized.menu.eyebrow).toBe("Sajian Favorit Koki");
    expect(normalized.menu.title).toBe("Menu Spesial Tepi Sawah");
    expect(normalized.menu.items).toHaveLength(6);
    expect(normalized.menu.items?.[0]?.name).toBe("Nasi Liwet Kastrol Spesial");
    expect(normalized.menu.items?.[0]?.category).toBe("Menu Utama");
    expect(normalized.menu.items?.[0]?.price).toBe("Rp 50.000");
    expect(normalized.menu.items?.[0]?.badge).toBe("Pilihan Juara");
    expect(normalized.menu.items?.[0]?.imageUrl).toBe("data:image/webp;base64,customMenuImg");
    // Fallback checks on unedited items
    expect(normalized.menu.items?.[1]?.name).toBe("Chicken Roaster Rempah");
    expect(normalized.menu.items?.[1]?.category).toBe("Makanan Utama");
  });
});
