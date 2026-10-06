# Checklist Pra-Deployment (Pre-Deployment Checklist)

Dokumen ini adalah panduan kontrol mutu wajib yang harus dijalankan dan ditandatangani sebelum setiap deployment ke lingkungan rilis (**Vercel & Supabase**).

---

## 1. Verifikasi Kode & Pengujian Lokal (Local Quality Gates)

Jalankan perintah berikut di root repositori dan pastikan seluruh langkah berhasil tanpa error:

- [ ] **Typecheck Monorepo**:
  ```bash
  pnpm -r run typecheck
  ```
  *Status:* 0 error TypeScript di seluruh 17 paket workspace.

- [ ] **Unit & Integration Tests**:
  ```bash
  pnpm run test
  ```
  *Status:* 100% tes lulus (474 tes lulus, 0 gagal: Database, Auth, Order, POS, Waiter, Admin, Staff).

- [ ] **Production Build Check**:
  ```bash
  pnpm run build
  ```
  *Status:* Seluruh aset bundle terkompilasi tanpa peringatan pemutusan bundle.

---

## 2. Verifikasi Aset Visual, Branding & SEO/OG

- [ ] **Logo & Favicon**:
  - `logo.png` tersedia di `apps/web/public/`, `apps/order/public/`, `apps/staff/public/`.
  - Aplikasi order menggunakan `logo.png` di header dan gerbang validasi QR meja (bukan emoji generik).
  - `favicon.svg`, `favicon.png`, `apple-touch-icon.png` terkonfigurasi di `index.html`.
- [ ] **Open Graph (Social Media Preview)**:
  - `og-image.jpg` beresolusi 1200×630 piksel (< 300KB untuk kompatibilitas WhatsApp).
  - Tag meta lengkap di `apps/web/index.html`:
    - `<link rel="canonical" href="https://www.tepisawah.id/" />`
    - `<meta property="og:title" content="Tepi Sawah — Resto & Cafe | Ciperna, Cirebon">`
    - `<meta property="og:description" ...>`
    - `<meta property="og:image" content="https://www.tepisawah.id/og-image.jpg">`
    - `<meta property="og:image:width" content="1200">`
    - `<meta property="og:image:height" content="630">`
    - `<meta name="twitter:card" content="summary_large_image">`
    - `<meta name="theme-color" content="#183a1d">`
- [ ] **Simulasi Tampilan WhatsApp/Telegram**:
  - Judul ringkas, deskripsi persuasif, dan gambar pratinjau terunduh langsung (HTTP status 200 tanpa redirect loop).

---

## 3. Verifikasi Konsistensi Bahasa & Tema Visual

- [ ] **Bahasa Indonesia 100%**:
  - Tidak ada istilah bahasa Inggris pada antarmuka publik maupun staf (misal: "Staff Portal", "KDS", "Dashboard Overview", "Payment Terminal", "Tendered", dll.).
  - Formulir login menampilkan label Bahasa Indonesia ("Portal Staf — Masuk", "Email", "Kata sandi").
- [ ] **Penyelarasan Tema Warna**:
  - Warna latar belakang menggunakan *Warm Cream* (`#faf7ee`) dan *Rice Paper* (`#f8f4db`).
  - Elemen navigasi menggunakan hijau lumut sawah (`#183a1d`) dan emas bulir padi (`#dda15e`).
  - Tidak ada halaman yang menggunakan abu-abu dingin steril tak selaras.

---

## 4. Verifikasi Navigasi Staf & Pergantian Peran (Zero Stale View)

- [ ] **Pergantian Peran Seketika**:
  - Saat staf beralih peran (misal dari Owner ke Kasir), antarmuka seketika me-redirect ke `"portal"` (`/`) tanpa menampilkan halaman peran sebelumnya.
  - Tombol "Keluar" seketika mereset URL ke `/` sebelum menghapus sesi.
  - Ruangan yang tidak diizinkan untuk peran aktif dilindungi oleh `PermissionRoute`.

---

## 5. Verifikasi Responsivitas Multi-Device Display

Buka DevTools Responsive Mode dan uji aplikasi pada:

- [ ] **Mobile (360px – 414px)**:
  - Tidak ada scroll horizontal tak disengaja (`overflow-x: hidden` aktif).
  - Teks judul tidak terpotong atau keluar batas kartu.
  - Sub-navigasi staff portal dapat digeser (*swipeable pills*).
  - Tombol order & tombol aksi POS memiliki ukuran sentuh nyaman (≥ 44px).
- [ ] **Tablet (768px – 1024px)**:
  - Grid menu produk berbaris rapi (2 atau 3 kolom).
  - Drawer keranjang belanja tidak menutupi seluruh layar secara kaku.
- [ ] **Desktop (1280px+)**:
  - Container berpusat rapi (*max-width centered layout*).

---

## 6. Verifikasi Database & Akun Demo Supabase

- [ ] **Skema Database & RLS**:
  - Tabel `orders`, `order_items`, `tables`, `table_qr_tokens`, `products`, `categories` memiliki RLS aktif.
  - Urutan nomor pesanan (`orders_order_number_seq`) telah disetel aman (`setval('orders_order_number_seq', 100)`).
- [ ] **Kredensial 3 Akun Demo Kanonikal**:
  - `owner@demo.tepisawah.id` (Sandi: `demo1234`)
  - `kasir@demo.tepisawah.id` (Sandi: `demo1234`)
  - `dapur@demo.tepisawah.id` (Sandi: `demo1234`)
  - Pastikan user telah terdaftar di Supabase Auth (`auth.users`) dan tabel `profiles` & `user_roles`.

---

## 7. Verifikasi Variabel Lingkungan Vercel

Pastikan ketiga proyek Vercel memiliki variabel lingkungan yang benar:

| Proyek Vercel | Domain | Variabel Wajib |
|---|---|---|
| `tepisawah` | `tepisawah.id`<br>`www.tepisawah.id` | `VITE_SUPABASE_URL`<br>`VITE_SUPABASE_ANON_KEY`<br>`VITE_ORDER_APP_URL=https://order.tepisawah.id` |
| `tepisawah-order` | `order.tepisawah.id` | `VITE_SUPABASE_URL`<br>`VITE_SUPABASE_ANON_KEY`<br>`VITE_SITE_URL=https://order.tepisawah.id` |
| `tepisawah-staff` | `staff.tepisawah.id` | `VITE_SUPABASE_URL`<br>`VITE_SUPABASE_ANON_KEY`<br>`VITE_DEMO_MODE=true` |

---

## 8. Smoke Test Pasca-Deployment (Post-Deploy Smoke Test)

Setelah Vercel menyelesaikan proses build & deploy:

- [ ] Buka `https://tepisawah.id` (mengembalikan HTTP 200): Tombol "Pesan Sekarang" mengarah ke panduan QR meja.
- [ ] Buka `https://order.tepisawah.id`: Muncul halaman proteksi scan QR ("Pindai QR di Meja Anda") dengan emblem logo resmi Tepi Sawah.
- [ ] Buka URL meja dengan token: Menu katalog 6 produk muncul, penambahan ke keranjang berfungsi, kirim pesanan berhasil.
- [ ] Buka `https://staff.tepisawah.id`: Login dengan akun demo berhasil, peralihan peran berlangsung seketika tanpa stale view.
