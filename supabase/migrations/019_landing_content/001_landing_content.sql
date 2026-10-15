-- =============================================================================
-- Tepi Sawah - Migration 019: Landing Page Comprehensive CMS Content (8 Sections).
--
-- Enables restaurant owners and managers to customize texts, banners,
-- promotional notices, atmosphere galleries, table bookings, and contact info
-- across all 8 public website sections, with section toggle controls.
-- =============================================================================

create table if not exists public.landing_content (
  section_key text primary key,
  content     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint landing_content_key_check
    check (section_key in ('hero', 'menu', 'promo', 'about', 'qr_order', 'gallery', 'reservation', 'location'))
);

comment on table public.landing_content is
  'Dynamic text, banner images, and section visibility controls for all 8 website sections.';

-- Enable Row Level Security
alter table public.landing_content enable row level security;

-- Policies:
-- 1. Public can read landing page content without login
drop policy if exists "landing_content_select_public" on public.landing_content;
create policy "landing_content_select_public"
  on public.landing_content
  for select
  to anon, authenticated
  using (true);

-- 2. Authenticated staff can insert/update landing content
drop policy if exists "landing_content_write_staff" on public.landing_content;
create policy "landing_content_write_staff"
  on public.landing_content
  for all
  to authenticated
  using (true)
  with check (true);

-- Grants
grant select on public.landing_content to anon;
grant select, insert, update on public.landing_content to authenticated;

-- Seed default initial content for all 8 sections
insert into public.landing_content (section_key, content)
values
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
      "title": "Informasi Menu & Promo Selalu Terkini",
      "description": "Informasi promo harian, paket musiman, dan ketersediaan porsi selalu diperbarui secara real-time di etalase menu kami: cek kapan saja sebelum berkunjung.",
      "bannerCtaText": "Jelajahi Menu Pilihan",
      "promoImage": "/gallery/rombongan-gathering.webp"
    }'::jsonb
  ),
  (
    'about',
    '{
      "isActive": true,
      "kicker": "Nuansa Pedesaan Asri",
      "title": "Sebuah Ruang Kebersamaan",
      "story": "Tepi Sawah menghadirkan pengalaman bersantap dengan suasana pedesaan yang nyaman di Ciperna, Cirebon. Nikmati hidangan Nusantara beraroma rempah segar, kopi nikmat, udara terbuka, dan waktu berkualitas bersama keluarga, rekan, atau teman tersayang.",
      "photo": "/about-saung.webp",
      "highlight1Title": "Saung Lesehan",
      "highlight1Desc": "Santap lesehan privat beratap rumbia alami tepat di sisi pematang.",
      "highlight2Title": "Dek Rooftop 360°",
      "highlight2Desc": "Spot senja terbaik menikmati siluet matahari terbenam dengan secangkir kopi."
    }'::jsonb
  ),
  (
    'qr_order',
    '{
      "isActive": true,
      "eyebrow": "Digital Dining Experience",
      "title": "Pesan Langsung dari Meja Anda",
      "description": "Pemesanan online tidak tersedia. Saat berkunjung, cukup scan kode QR yang tertera di meja Anda, pilih hidangan Nusantara dan minuman favorit, lalu kirim pesanan langsung dari smartphone.",
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
on conflict (section_key) do nothing;
