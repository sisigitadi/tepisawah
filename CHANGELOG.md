# Changelog

Semua perubahan penting pada proyek **Tepi Sawah Resto & POS Platform** didokumentasikan di sini mengikuti pedoman [Keep a Changelog](https://keepachangelog.com/id/1.0.0/) dan [Semantic Versioning](https://semver.org/).

## [0.2.1] - 2026-10-06 (Audit Branding, Role Refresh & Indonesian Localization)

### 🖼️ Open Graph Preview & Media Canonical
- **Resolusi Preview WhatsApp/Telegram pada `tepisawah.id`**:
  - Memperbarui `og:url`, `og:image`, `og:image:secure_url`, dan `twitter:image` pada [`apps/web/index.html`](apps/web/index.html) mengarah langsung ke domain kanonikal `https://www.tepisawah.id` dan `https://www.tepisawah.id/og-image.jpg`.
  - Mengeliminasi *308 Permanent Redirect hop* yang sebelumnya memutus crawler media sosial (WhatsApp/Telegram/Facebook) saat mengunduh gambar pratinjau.
  - Menambahkan tag kanonikal `<link rel="canonical" />` di seluruh aplikasi web, staf, dan order.

### 🌾 Integrasi Logo Resmi pada Customer Ordering (`order.tepisawah.id`)
- **Logo Resmi Menggantikan Emoji Generik**:
  - Mengganti emoji `🌾` pada [`apps/order/src/components/AppHeader.tsx`](apps/order/src/components/AppHeader.tsx) dengan logo resmi otentik Tepi Sawah (`<img src="/logo.png" className="order-brand-logo" />`).
  - Mengganti ikon kamera `📷` pada gerbang pemindai QR meja ([`apps/order/src/features/qr/QrGatekeeperPage.tsx`](apps/order/src/features/qr/QrGatekeeperPage.tsx)) dengan emblem logo resmi Tepi Sawah dengan cincin pulsa animasi.
  - Menambahkan styling lengkap header chrome global dan emblem logo pada [`apps/order/src/styles/index.css`](apps/order/src/styles/index.css).

### 🔄 Penyegaran Peran Staf & Penghapusan Stale View
- **Auto-Redirect & Room Permission Enforcement**:
  - Menambahkan logika proteksi rute di [`apps/staff/src/app/router/index.tsx`](apps/staff/src/app/router/index.tsx): jika staf berganti peran (misal dari Owner ke Kasir), sistem mendeteksi daftar ruangan yang diizinkan dan langsung me-redirect rute ke `"portal"` (`/`) tanpa menampilkan halaman peran sebelumnya.
  - Menambahkan pendeteksian pergantian `user.id` untuk mereset tampilan secara otomatis saat login dengan kredensial berbeda.
  - Membungkus ruangan admin dengan `PermissionRoute` agar peran tanpa izin pengaturan tidak dapat membuka panel pengelola meskipun mengakses URL `/admin`.
- **Reset URL saat Keluar (Sign Out)**:
  - Tombol "Keluar" pada [`apps/staff/src/components/AppHeader.tsx`](apps/staff/src/components/AppHeader.tsx) seketika me-reset rute ke `/` sebelum memanggil `signOut()`, menjamin pengguna berikutnya masuk dari pintu utama portal.
- **Quick Role Switcher Mode Demo**:
  - Menambahkan dropdown ganti peran cepat pada header staf dan kartu beranda portal untuk beralih instan antara **Owner**, **Kasir**, dan **Dapur** tanpa kendala stale view.

### 🇮🇩 Lokalisasi Penuh Bahasa Indonesia yang Natural
- Mengganti seluruh istilah bahasa Inggris pada antarmuka pengguna dengan bahasa Indonesia yang umum dan mudah dipahami:
  - **Portal Staf**: "Staff Portal" → "Portal Staf", "Admin Console" → "Panel Pengelola", "Kitchen Display (KDS)" → "Layar Pesanan Dapur", "Cashier POS" → "Meja Kasir", "Waiter" → "Pelayan".
  - **Panel Pengelola**: "Dashboard Overview" → "Ringkasan Operasional Resto", "Live Operational" → "Operasional Berjalan", "Status Pipeline Pesanan Realtime" → "Alur Proses Pesanan Langsung", "QR Customer" → "QR Pelanggan", "pick-up counter" → "meja pengantaran".
  - **Terminal Kasir**: "Payment Terminal" → "Kasir Pembayaran", "Orders Pipeline" → "Alur Pesanan", "Table Layout" → "Tata Letak Meja", "Dashboard" → "Ringkasan", "Transaction History" → "Riwayat Transaksi", "Daily Reports" → "Laporan Harian", "Shift & Cash" → "Kas & Giliran Kerja", "Single Bill / Split Item / Custom Pax" → "Satu Tagihan / Pisah Menu / Bagi Rata", "Tendered" → "Nominal Uang Tunai Diterima", "Total Unpaid" → "Total Belum Dibayar", "Real-time" → "Langsung", "Quick Hotkeys" → "Pintasan Tombol".
  - **Layar Dapur**: "KITCHEN DISPLAY SYSTEM" → "LAYAR PESANAN DAPUR", "Hot Kitchen" → "Dapur Utama".

### 🎨 Penyelarasan Tema Warna Tepi Sawah
- Menyesuaikan variabel palet netral di [`apps/admin/src/styles/index.css`](apps/admin/src/styles/index.css) dari abu-abu dingin (`#f9f9f8`, `#e7e5e4`) ke palet krim hangat dan kertas beras khas Tepi Sawah (`--c-bg: #faf7ee`, `--c-border: #e6dec7`).
- Menyelaraskan seluruh kartu, bilah tab, dan formulir dengan nuansa hijau daun tua (`#183a1d`), aksen emas padi (`#dda15e`), dan latar belakang hangat nan nyaman.

### 📑 Pembaruan Dokumentasi, Tata Kelola & Keputusan Arsitektur
- **ADR-007**: Dokumentasi arsitektur resmi audit merek, kanonikal Open Graph langsung, pencegahan stale view staf, dan standardisasi Bahasa Indonesia 100% ([`docs/decisions/ADR-007-audit-branding-og-dan-lokalisasi.md`](docs/decisions/ADR-007-audit-branding-og-dan-lokalisasi.md)).
- **Brand Direction v2.0**: Panduan identitas visual lengkap mencakup logo resmi, favicon multi-resolusi, banner Open Graph 16:9, palet warna, dan etika komunikasi bahasa ([`docs/brand/BRAND_DIRECTION.md`](docs/brand/BRAND_DIRECTION.md)).
- **Checklist Pra-Deployment**: Pembaruan 8 gerbang kendali mutu sebelum rilis ke production ([`docs/deployment/PRE_DEPLOYMENT_CHECKLIST.md`](docs/deployment/PRE_DEPLOYMENT_CHECKLIST.md)).
- **Dokumentasi Utama & Indeks Proyek**: Pembaruan [`README.md`](README.md) dan [`docs/PROJECT_DOCUMENTATION_INDEX.md`](docs/PROJECT_DOCUMENTATION_INDEX.md) memetakan seluruh domain aktif dan arsitektur peran kanonikal.

---

## [0.2.0] - 2026-10-06 (Pre-Production Hardening & Consolidation)

### 🎨 Brand Identity, Media & Assets
- **Logo Resmi & Favicon Klien**:
  - Diintegrasikan logo resmi otentik Tepi Sawah dengan identitas bulir padi emas melingkar (*golden rice stalk*) dan cangkir kopi mengepul beraksen cokelat hangat serta tipografi kaligrafi "Tepi Sawah".
  - Diterapkan favicon vektor SVG (`favicon.svg`) dan multi-size PNG (`favicon.png`, `apple-touch-icon.png`) berlatar hijau zamrud `#14301c` dengan cincin emas pada seluruh aplikasi.
- **Open Graph & Social Media Preview Banner**:
  - Dibuat banner Open Graph 16:9 (`og-image.jpg`, 1200×630, ~148KB) berlatar pemandangan sawah terasering asri, kartu logo resmi otentik, tipografi elegan (Georgia & Segoe UI), serta rincian fitur resto.
  - Kompatibel dan tajam di WhatsApp, Telegram, Facebook, Twitter, dan LinkedIn tanpa distorsi atau karakter terpotong.
- **Responsivitas Multi-Device Display**:
  - Perbaikan layout mobile (320px–414px), tablet (768px), hingga desktop ultra-wide (1440px+).
  - Dipasang batasan `max-width: 100vw`, `overflow-x: hidden`, dan `box-sizing: border-box` untuk mencegah teks/elemen terpotong, bertumpuk, atau melebar keluar viewport.
  - Sub-navigasi internal staff ditambahkan *horizontal swipe/scroll pill buttons* dengan `white-space: nowrap` dan *touch scrolling* yang mulus di perangkat mobile.

### 👥 Konsolidasi Peran Pengguna (Role Consolidation)
- **Penggabungan Owner/Admin/Supervisor**:
  - Akun `admin`, `supervisor`, dan `owner` dikonsolidasikan menjadi satu peran utama: **`owner`** (Pemilik / Super Administrator).
  - Memberikan hak penuh atas Owner & Admin Console, manajemen staf, pengaturan harga & diskon, pembatalan/void pesanan, laporan omzet bisnis, serta seluruh suite operasional (POS, KDS, Layanan Meja).
- **Penggabungan Kasir & Pelayan (Waiter)**:
  - Akun `waiter` dan `cashier` dikonsolidasikan menjadi satu peran operasional: **`cashier`** (Kasir & Layanan Meja).
  - Kasir kini dapat langsung mengakses:
    1. **Terminal Kasir**: Pembayaran tunai/QRIS, cetak struk, dan tutup kasir.
    2. **Antrean Konfirmasi**: Konfirmasi pesanan masuk dari scan QR meja pelanggan.
    3. **Layanan Meja & Saji**: Pemantauan hidangan siap saji dari dapur, pengantaran ke meja tamu, dan status meja.
    4. **Catat Pesanan Walk-In / Manual Meja**: Pencatatan langsung pesanan tamu offline tanpa smartphone.
- **Peran Kitchen (Dapur)**:
  - Tetap terisolasi khusus untuk antrean Kitchen Display System (KDS) guna menjaga fokus operasional juru masak.
- **Akun Demo Pre-Production**:
  - Kredensial demo resmi disederhanakan menjadi 3 akun kanonikal:
    - `owner@demo.tepisawah.id` (Owner & Admin) — sandi: `demo1234`
    - `kasir@demo.tepisawah.id` (Kasir & Layanan Meja) — sandi: `demo1234`
    - `dapur@demo.tepisawah.id` (KDS Dapur) — sandi: `demo1234`

### 🛡️ Governance & Version Control
- Ditambahkan dokumen kendali pre-production:
  - [`docs/operations/PRE_PRODUCTION_CONTROLS.md`](docs/operations/PRE_PRODUCTION_CONTROLS.md)
  - [`docs/decisions/ADR-006-role-consolidation.md`](docs/decisions/ADR-006-role-consolidation.md)
  - [`docs/deployment/PRE_DEPLOYMENT_CHECKLIST.md`](docs/deployment/PRE_DEPLOYMENT_CHECKLIST.md)
- Penerapan aturan cabang terlindungi (*branch protection*): Tidak diperbolehkan push langsung ke `main`, seluruh perubahan wajib melalui Pull Request dan lolos tes CI/CD otomatis.

---

## [0.1.0] - 2026-10-06 (Baseline MVP Release)

### Added
- Monorepo pnpm workspaces dengan 18 packages dan apps:
  - `apps/web`: Website informasi dan profil resto (`tepisawah.id`).
  - `apps/order`: Website pemesanan QR pelanggan berbasis meja (`order.tepisawah.id`).
  - `apps/staff`: Portal terpadu internal staf (`staff.tepisawah.id`).
  - `apps/pos`: Terminal kasir restoran.
  - `apps/admin`: Panel administrasi katalog dan meja.
  - `apps/kitchen`: Kitchen Display System (KDS).
  - `apps/waiter`: Layanan pesanan manual meja pelayan.
- Integrasi Supabase Postgres dengan Row-Level Security (RLS) dan GoTrue Authentication.
- State machine siklus pesanan (`submitted` → `confirmed` → `cooking` → `ready` → `served` → `paid` / `completed`).
- Skema tabel meja dengan token QR aktif yang dinamis (`table_qr_tokens`).
- Penyesuaian DNS domain Vercel untuk ketiga aplikasi publik.
