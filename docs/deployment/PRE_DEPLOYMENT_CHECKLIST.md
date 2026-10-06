# Checklist Pra-Deployment (Pre-Deployment Checklist)

Dokumen ini adalah panduan kontrol mutu wajib yang harus dijalankan dan ditandatangani sebelum setiap deployment ke lingkungan rilis (**Vercel & Supabase**).

---

## 1. Verifikasi Kode & Pengujian Lokal (Local Quality Gates)

Jalankan perintah berikut di root repositori dan pastikan seluruh langkah berhasil tanpa error:

- [ ] **Typecheck Monorepo**:
  ```bash
  pnpm -r run typecheck
  ```
  *Status:* 0 error TypeScript.

- [ ] **Unit & Integration Tests**:
  ```bash
  pnpm run test
  ```
  *Status:* 100% tes lulus (Database, Auth, Order, POS, Waiter, Admin, Staff).

- [ ] **Production Build Check**:
  ```bash
  pnpm run build
  ```
  *Status:* Seluruh aset bundle ter-kompilasi tanpa peringatan pemutusan bundle.

---

## 2. Verifikasi Aset Visual, Branding & SEO/OG

- [ ] **Logo & Favicon**:
  - `logo.png` tersedia di `apps/web/public/`, `apps/order/public/`, `apps/staff/public/`.
  - `favicon.svg`, `favicon.png`, `apple-touch-icon.png` terkonfigurasi di `index.html`.
- [ ] **Open Graph (Social Media Preview)**:
  - `og-image.jpg` beresolusi 1200×630 piksel (< 300KB untuk WhatsApp compatibility).
  - Tag meta lengkap di `index.html`:
    - `<meta property="og:title" ...>`
    - `<meta property="og:description" ...>`
    - `<meta property="og:image" content="https://<domain>/og-image.jpg">`
    - `<meta property="og:image:width" content="1200">`
    - `<meta property="og:image:height" content="630">`
    - `<meta name="twitter:card" content="summary_large_image">`
    - `<meta name="theme-color" content="#2c5e3b">`
- [ ] **Simulasi Tampilan WhatsApp/Telegram**:
  - Judul ringkas, deskripsi persuasif, dan gambar latar sawah + logo emas terlihat proporsional tanpa terpotong.

---

## 3. Verifikasi Responsivitas Multi-Device Display

Buka DevTools Responsive Mode dan uji aplikasi pada:

- [ ] **Mobile (360px – 414px)**:
  - Tidak ada scroll horizontal tak disengaja (`overflow-x: hidden` aktif).
  - Teks judul tidak terpotong atau keluar batas box/card.
  - Sub-navigasi staff portal dapat digeser (*swipeable pills*).
  - Tombol order & tombol aksi POS memiliki ukuran sentuh nyaman (≥ 44px).
- [ ] **Tablet (768px – 1024px)**:
  - Grid menu produk berbaris rapi (2 atau 3 kolom).
  - Drawer keranjang belanja tidak menutupi seluruh layar secara kaku.
- [ ] **Desktop (1280px+)**:
  - Container berpusat rapi (*max-width centered layout*).

---

## 4. Verifikasi Database & Akun Demo Supabase

- [ ] **Skema Database & RLS**:
  - Tabel `orders`, `order_items`, `tables`, `table_qr_tokens`, `products`, `categories` memiliki RLS aktif.
  - Urutan nomor pesanan (`orders_order_number_seq`) telah disetel aman (`setval('orders_order_number_seq', 100)`).
- [ ] **Kredensial 3 Akun Demo Kanonikal**:
  - `owner@demo.tepisawah.id` (Sandi: `demo1234`)
  - `kasir@demo.tepisawah.id` (Sandi: `demo1234`)
  - `dapur@demo.tepisawah.id` (Sandi: `demo1234`)
  - Pastikan user telah terdaftar di Supabase Auth (`auth.users`) dan tabel `profiles` & `user_roles`.

---

## 5. Verifikasi Variabel Lingkungan Vercel

Pastikan ketiga proyek Vercel memiliki variabel lingkungan yang benar:

| Proyek Vercel | Domain | Variabel Wajib |
|---|---|---|
| `tepisawah-web` | `tepisawah.id` | `VITE_SUPABASE_URL`<br>`VITE_SUPABASE_ANON_KEY`<br>`VITE_ORDER_APP_URL=https://order.tepisawah.id` |
| `tepisawah-order` | `order.tepisawah.id` | `VITE_SUPABASE_URL`<br>`VITE_SUPABASE_ANON_KEY`<br>`VITE_SITE_URL=https://order.tepisawah.id` |
| `tepisawah-staff` | `staff.tepisawah.id` | `VITE_SUPABASE_URL`<br>`VITE_SUPABASE_ANON_KEY`<br>`VITE_DEMO_MODE=true` |

---

## 6. Smoke Test Pasca-Deployment (Post-Deploy Smoke Test)

Setelah Vercel menyelesaikan proses build & deploy:

- [ ] Buka `https://tepisawah.id`: Navigasi halaman profil, tombol "Pesan Sekarang" mengarah ke panduan QR meja.
- [ ] Buka `https://order.tepisawah.id`: Muncul halaman proteksi scan QR ("Pindai QR di Meja Anda").
- [ ] Buka URL meja dengan token: Menu katalog 6 produk muncul, penambahan ke keranjang berfungsi, kirim pesanan berhasil.
- [ ] Buka `https://staff.tepisawah.id`: Login dengan salah satu dari 3 akun demo berhasil, tidak muncul "Email atau kata sandi salah".
- [ ] Konfirmasi pesanan di kasir → muncul di KDS dapur → ubah status siap saji → muncul di layanan meja kasir.
