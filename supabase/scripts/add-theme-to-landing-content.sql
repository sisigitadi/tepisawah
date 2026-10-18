-- =============================================================================
-- Tepi Sawah — Add 'theme' support to landing_content and enable Realtime
--
-- Self-healing script:
-- 1. Creates public.landing_content table if missing (with RLS & permissions)
-- 2. Updates landing_content_key_check constraint to include 'theme'
-- 3. Seeds initial default sections & theme record if not already present
-- 4. Enables Supabase Realtime for landing_content so changes in CMS
--    sync instantaneously to the public website without page refresh.
-- =============================================================================

-- 1. Create table if not exists (with check constraint that includes 'theme')
CREATE TABLE IF NOT EXISTS public.landing_content (
  section_key TEXT PRIMARY KEY,
  content     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT landing_content_key_check
    CHECK (section_key IN ('hero', 'menu', 'promo', 'about', 'qr_order', 'gallery', 'reservation', 'location', 'theme'))
);

COMMENT ON TABLE public.landing_content IS
  'Dynamic text, banner images, theme colors, and section visibility controls for website sections.';

-- 2. Ensure Row Level Security & Access Policies
ALTER TABLE public.landing_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "landing_content_select_public" ON public.landing_content;
CREATE POLICY "landing_content_select_public"
  ON public.landing_content
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "landing_content_write_staff" ON public.landing_content;
CREATE POLICY "landing_content_write_staff"
  ON public.landing_content
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT ON public.landing_content TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.landing_content TO authenticated;

-- 3. If table already existed with older constraint, update it safely
ALTER TABLE public.landing_content DROP CONSTRAINT IF EXISTS landing_content_key_check;
ALTER TABLE public.landing_content ADD CONSTRAINT landing_content_key_check
  CHECK (section_key IN ('hero', 'menu', 'promo', 'about', 'qr_order', 'gallery', 'reservation', 'location', 'theme'));

-- 4. Seed default sections & theme
INSERT INTO public.landing_content (section_key, content)
VALUES
  (
    'theme',
    '{
      "preset": "emerald",
      "primaryColor": "#183a1d",
      "secondaryColor": "#2d6a4f",
      "accentColor": "#e07a5f",
      "amberColor": "#d4a373",
      "backgroundColor": "#fefae0",
      "panelBgColor": "#ffffff",
      "textColor": "#283618",
      "fontFamily": "Plus Jakarta Sans",
      "borderRadius": "12px"
    }'::jsonb
  ),
  (
    'hero',
    '{
      "isActive": true,
      "badge": "SUDAH BUKA & SIAP MELAYANI",
      "title": "TEPI SAWAH",
      "subtitle": "Restaurant & Coffee",
      "description": "Nikmati kuliner Nusantara otentik, racikan kopi segar, dan hembusan semilir angin pedesaan di tengah hamparan sawah hijau Ciperna, Cirebon.",
      "hours": "Buka Setiap Hari: 09:00 - 22:00 WIB",
      "bgImage": "/sawah-panorama.webp"
    }'::jsonb
  ),
  (
    'menu',
    '{
      "isActive": true,
      "eyebrow": "Katalog Kuliner Otentik",
      "title": "Menu Pilihan",
      "description": "Hidangan favorit untuk menemani waktu berkualitas Anda di Tepi Sawah.",
      "bannerImage": "/menu-banner.webp"
    }'::jsonb
  ),
  (
    'promo',
    '{
      "isActive": true,
      "badge": "PROMO AKTIF RESTORAN",
      "eyebrow": "Penawaran Spesial",
      "title": "Promo & Paket Hemat",
      "subtitle": "Temukan promo santap dan paket rombongan terbaik.",
      "description": "Informasi promo harian, paket musiman, dan ketersediaan porsi selalu diperbarui secara real-time.",
      "bannerCtaText": "Jelajahi Menu Pilihan",
      "bannerCtaLink": "#menu-pilihan",
      "promoImage": "/gallery/rombongan-gathering.webp"
    }'::jsonb
  ),
  (
    'about',
    '{
      "isActive": true,
      "kicker": "Nuansa Pedesaan Asri",
      "title": "Sebuah Ruang Kebersamaan",
      "story": "Tepi Sawah menghadirkan pengalaman bersantap dengan suasana pedesaan yang nyaman di Ciperna, Cirebon. Nikmati hidangan Nusantara beraroma rempah segar, kopi nikmat, udara terbuka, dan waktu berkualitas bersama keluarga.",
      "photo": "/about-saung.webp",
      "highlight1Title": "Saung Lesehan",
      "highlight1Desc": "Santap lesehan privat beratap rumbia alami tepat di sisi pematang sawah.",
      "highlight2Title": "Dek Rooftop 360°",
      "highlight2Desc": "Spot senja terbaik menikmati siluet matahari terbenam dengan secangkir kopi hangat."
    }'::jsonb
  ),
  (
    'qr_order',
    '{
      "isActive": true,
      "eyebrow": "Digital Dining Experience",
      "title": "Pesan Langsung dari Meja Anda",
      "description": "Cukup scan kode QR yang tertera di meja Anda, pilih hidangan Nusantara dan minuman favorit, lalu kirim pesanan langsung dari smartphone.",
      "guideImage": "/qr-guide.webp"
    }'::jsonb
  ),
  (
    'gallery',
    '{
      "isActive": true,
      "eyebrow": "Dokumentasi Restoran",
      "title": "Galeri Suasana Tepi Sawah",
      "description": "Potret sudut asri, panorama persawahan hijau Ciperna, dan hidangan favorit otentik.",
      "heroImage": "/gallery/saung-sore.webp"
    }'::jsonb
  ),
  (
    'reservation',
    '{
      "isActive": true,
      "eyebrow": "Booking Tempat & Acara",
      "title": "Reservasi Meja & Saung",
      "description": "Pastikan ketersediaan meja atau saung lesehan favorit Anda untuk acara keluarga, arisan, reuni, atau gathering rombongan.",
      "whatsappNumber": "081234567890",
      "roomImage": "/about-saung.webp"
    }'::jsonb
  ),
  (
    'location',
    '{
      "isActive": true,
      "address": "Jl. Raya Ciperna, Kec. Talun, Kab. Cirebon, Jawa Barat 45171.",
      "directions": "Tepat di tepi hamparan persawahan asri, 3 menit dari Exit Tol Ciperna.",
      "mapsEmbedUrl": "https://maps.google.com/maps?q=-6.771185,108.512599&hl=id&z=17&output=embed",
      "mapsUrl": "https://maps.google.com/?q=-6.771185,108.512599",
      "phoneWhatsapp": "081234567890",
      "instagram": "@tepisawah.resto",
      "facadeImage": "/sawah-panorama.webp"
    }'::jsonb
  )
ON CONFLICT (section_key) DO NOTHING;

-- 5. Enable Realtime publication safely
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'landing_content'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.landing_content;
    END IF;
  END IF;
END $$;
