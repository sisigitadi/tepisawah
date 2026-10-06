# Changelog

Semua perubahan penting pada proyek **Tepi Sawah Resto & POS Platform** didokumentasikan di sini mengikuti pedoman [Keep a Changelog](https://keepachangelog.com/id/1.0.0/) dan [Semantic Versioning](https://semver.org/).

---

## [0.2.0] - 2026-10-06 (Pre-Production Hardening & Consolidation)

### 🎨 Brand Identity, Media & Assets
- **Logo & Favicon**:
  - Dibuat logo resmi beresolusi tinggi dengan identitas bulir padi emas (*golden rice stalk*), ornamen lingkaran elegan, dan teks "TEPI SAWAH Resto & Cafe — Est. 2024".
  - Diterapkan favicon vektor SVG (`favicon.svg`) dan resolusi multi-device PNG (`favicon.png`, `apple-touch-icon.png`) pada seluruh aplikasi (`web`, `order`, `staff`).
- **Open Graph & Social Media Preview**:
  - Dibuat banner Open Graph 16:9 (`og-image.jpg`, 1200×630, ~140KB) berformat optimal untuk WhatsApp, Telegram, Facebook, Twitter, dan LinkedIn.
  - Ditambahkan meta tags `og:title`, `og:description`, `og:image`, `og:image:width`, `og:image:height`, `twitter:card` (*summary_large_image*), serta `theme-color` `#2c5e3b` pada `index.html` ketiga aplikasi.
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
