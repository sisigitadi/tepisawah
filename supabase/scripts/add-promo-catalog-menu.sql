-- =============================================================================
-- Tepi Sawah — Skrip Penambahan Kategori & Menu Promo ke Katalog
--
-- Menambahkan:
-- 1. Kategori "Promo & Paket" (sort_order = 5 agar tampil di urutan paling awal)
-- 2. Enam (6) menu promo & paket hemat dengan harga, deskripsi porsi, dan foto
-- 3. Menghubungkan modifier (Level Pedas, Tambah Nasi, Tanpa Es, Extra Telur)
-- =============================================================================

-- 1. Kategori Promo & Paket
INSERT INTO public.categories (id, name, description, sort_order, is_active)
VALUES (
  '00000000-0000-4000-8000-100000000004',
  'Promo & Paket',
  'Paket hemat santap bersama, keluarga, dan hidangan komplit spesial Tepi Sawah',
  5,
  true
)
ON CONFLICT (id) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  sort_order  = EXCLUDED.sort_order,
  is_active   = EXCLUDED.is_active;

-- 2. Produk Menu Promo
INSERT INTO public.products (id, category_id, name, description, image_url, price, is_active, is_available, sort_order)
VALUES
  (
    '00000000-0000-4000-8000-200000000010',
    '00000000-0000-4000-8000-100000000004',
    'Paket Nasi Liwet Komplit (4 Orang)',
    'Nasi liwet kastrol harum (4 porsi), 4 potong ayam bakar/goreng, sambal terasi cobek daun pisang, tahu, tempe, lalapan segar sawah, dan 4 es teh manis.',
    '/gallery/saung-lesehan.webp',
    145000,
    true,
    true,
    10
  ),
  (
    '00000000-0000-4000-8000-200000000011',
    '00000000-0000-4000-8000-100000000004',
    'Paket Gurame Bakar Madu Spesial',
    '1 ekor gurame bakar bumbu madu karamel ukuran besar, 2 porsi nasi putih hangat, tahu tempe, lalapan segar, sambal kecap pedas, dan 2 es teh manis.',
    '/gallery/gurame-bakar.webp',
    89000,
    true,
    true,
    20
  ),
  (
    '00000000-0000-4000-8000-200000000012',
    '00000000-0000-4000-8000-100000000004',
    'Paket Roaster Rempah Sawah (Ayam Utuh)',
    'Ayam utuh panggang oven bumbu rempah Nusantara gurih meresap, 3 porsi nasi liwet pulen, sambal terasi, lalapan sawah, dan sayur asem segar.',
    '/gallery/ayam-roaster.webp',
    115000,
    true,
    true,
    30
  ),
  (
    '00000000-0000-4000-8000-200000000013',
    '00000000-0000-4000-8000-100000000004',
    'Paket Ngopi Sunset & Kudapan Sawah (2 Orang)',
    '2 cangkir Kopi Senja Sawah atau Teh Poci Gula Batu, 1 porsi pisang goreng keju gula aren, dan 1 porsi cireng bumbu rujak pedas manis.',
    '/gallery/kopi-senja.webp',
    42000,
    true,
    true,
    40
  ),
  (
    '00000000-0000-4000-8000-200000000014',
    '00000000-0000-4000-8000-100000000004',
    'Paket Rombongan Liwet Saung (8-10 Orang)',
    'Paket gathering saung lesehan: 2 kastrol nasi liwet besar, 10 potong ayam bakar madu, 2 ekor gurame goreng kipas, 2 sayur asem mangkok besar, tahu tempe, lalap sambal, dan 10 es teh manis.',
    '/gallery/rombongan-gathering.webp',
    385000,
    true,
    true,
    50
  ),
  (
    '00000000-0000-4000-8000-200000000015',
    '00000000-0000-4000-8000-100000000004',
    'Paket Hemat Ayam Bakar + Es Kelapa Muda (Single)',
    '1 porsi nasi liwet hangat, 1 potong ayam bakar madu gurih, tahu tempe goreng, lalapan segar, sambal dadak pedas, dan 1 gelas es kelapa muda segar.',
    'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80',
    48000,
    true,
    true,
    60
  )
ON CONFLICT (id) DO UPDATE SET
  category_id  = EXCLUDED.category_id,
  name         = EXCLUDED.name,
  description  = EXCLUDED.description,
  image_url    = EXCLUDED.image_url,
  price        = EXCLUDED.price,
  is_active    = EXCLUDED.is_active,
  is_available = EXCLUDED.is_available,
  sort_order   = EXCLUDED.sort_order;

-- 3. Pastikan Modifier Standar Tersedia di Tabel modifiers
-- (Jika belum ada atau baru saja dihapus oleh clear-catalog, buat ulang dengan UUID & nama standar)
INSERT INTO public.modifiers (id, name, description, price_delta, is_active)
SELECT m.id, m.name, m.description, m.price_delta, m.is_active
FROM (
  VALUES
    ('00000000-0000-4000-8000-300000000001'::uuid, 'Level Pedas',  'Tingkat kepedasan',     0::numeric,    true),
    ('00000000-0000-4000-8000-300000000002'::uuid, 'Tambah Nasi',  'Porsi nasi tambahan',   5000::numeric, true),
    ('00000000-0000-4000-8000-300000000003'::uuid, 'Tanpa Es',     'Minuman tanpa es',      0::numeric,    true),
    ('00000000-0000-4000-8000-300000000004'::uuid, 'Extra Telur',  'Telur tambahan',        6000::numeric, true)
) AS m(id, name, description, price_delta, is_active)
WHERE NOT EXISTS (
  SELECT 1 FROM public.modifiers existing
  WHERE lower(btrim(existing.name)) = lower(btrim(m.name))
)
ON CONFLICT (id) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  price_delta = EXCLUDED.price_delta,
  is_active   = EXCLUDED.is_active;

-- 4. Sambungkan Modifier ke Produk Promo Secara Dinamis & Aman
-- Menghubungkan produk promo ke modifier yang sesuai berdasarkan nama modifier
WITH target_links AS (
  SELECT
    p.id AS product_id,
    m.id AS modifier_id,
    l.is_required,
    l.min_select,
    l.max_select,
    l.sort_order
  FROM (
    VALUES
      -- Paket Nasi Liwet Komplit (Level Pedas, Tambah Nasi, Extra Telur)
      ('00000000-0000-4000-8000-200000000010'::uuid, 'Level Pedas',  true,  1, 1, 10),
      ('00000000-0000-4000-8000-200000000010'::uuid, 'Tambah Nasi',  false, 0, 2, 20),
      ('00000000-0000-4000-8000-200000000010'::uuid, 'Extra Telur',  false, 0, 4, 30),

      -- Paket Gurame Bakar Madu (Level Pedas, Tambah Nasi)
      ('00000000-0000-4000-8000-200000000011'::uuid, 'Level Pedas',  true,  1, 1, 10),
      ('00000000-0000-4000-8000-200000000011'::uuid, 'Tambah Nasi',  false, 0, 2, 20),

      -- Paket Roaster Rempah Sawah (Level Pedas, Tambah Nasi)
      ('00000000-0000-4000-8000-200000000012'::uuid, 'Level Pedas',  true,  1, 1, 10),
      ('00000000-0000-4000-8000-200000000012'::uuid, 'Tambah Nasi',  false, 0, 2, 20),

      -- Paket Ngopi Sunset (Tanpa Es)
      ('00000000-0000-4000-8000-200000000013'::uuid, 'Tanpa Es',     false, 0, 1, 10),

      -- Paket Rombongan Liwet Saung (Level Pedas, Tambah Nasi)
      ('00000000-0000-4000-8000-200000000014'::uuid, 'Level Pedas',  true,  1, 1, 10),
      ('00000000-0000-4000-8000-200000000014'::uuid, 'Tambah Nasi',  false, 0, 4, 20),

      -- Paket Hemat Single (Level Pedas, Tanpa Es)
      ('00000000-0000-4000-8000-200000000015'::uuid, 'Level Pedas',  true,  1, 1, 10),
      ('00000000-0000-4000-8000-200000000015'::uuid, 'Tanpa Es',     false, 0, 1, 20)
  ) AS l(product_id, modifier_name, is_required, min_select, max_select, sort_order)
  JOIN public.products p ON p.id = l.product_id
  JOIN public.modifiers m ON lower(btrim(m.name)) = lower(btrim(l.modifier_name))
)
INSERT INTO public.product_modifiers (product_id, modifier_id, is_required, min_select, max_select, sort_order)
SELECT product_id, modifier_id, is_required, min_select, max_select, sort_order
FROM target_links
ON CONFLICT (product_id, modifier_id) DO UPDATE SET
  is_required = EXCLUDED.is_required,
  min_select  = EXCLUDED.min_select,
  max_select  = EXCLUDED.max_select,
  sort_order  = EXCLUDED.sort_order;

-- Ringkasan status verifikasi promo setelah eksekusi
SELECT
  p.name AS nama_produk_promo,
  p.price AS harga,
  c.name AS nama_kategori,
  count(pm.modifier_id) AS total_modifier_terhubung
FROM public.products p
JOIN public.categories c ON c.id = p.category_id
LEFT JOIN public.product_modifiers pm ON pm.product_id = p.id
WHERE c.id = '00000000-0000-4000-8000-100000000004'
GROUP BY p.id, p.name, p.price, c.name, p.sort_order
ORDER BY p.sort_order;
