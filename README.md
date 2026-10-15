# Tepi Sawah Resto & Cafe — Digital Platform

Platform digital terintegrasi untuk **Tepi Sawah Resto & Cafe** (Ciperna, Cirebon). Menggabungkan website publik dinamis dengan sistem CMS, pemesanan mandiri pelanggan via QR meja, serta portal terpadu staf operasional (Kasir POS, Layanan Meja, Layanan Dapur, dan Panel Pengelola Bisnis).

---

## 🌐 Lingkungan & Domain Produksi

| Aplikasi | Domain | Deskripsi Fungsional |
|---|---|---|
| **Website Utama & CMS Publik** | [https://tepisawah.id](https://tepisawah.id) (Kanonikal: `www.tepisawah.id`) | Profil restoran, galeri saung/alam, menu pilihan, promo & paket, reservasi meja, dan peta lokasi interaktif. |
| **Pemesanan Pelanggan (QR Meja)** | [https://order.tepisawah.id](https://order.tepisawah.id) | Pemesanan mandiri tamu di saung/meja berbasis QR code dinamis terproteksi token sesi aktif. |
| **Portal Staf Terpadu** | [https://staff.tepisawah.id](https://staff.tepisawah.id) | Portal operasional terpadu: Kasir POS, Layanan Meja & Antar, Layanan Dapur (KDS), dan Panel Pengelola & CMS Web. |

---

## ✨ Fitur Unggulan Sistem

1. **Pengelola Konten Web (CMS) 8 Seksi Dinamis**:
   - Pengaturan instan dari Portal Staf (`/admin/cms`) tanpa perlu koding atau redeploy.
   - Kustomisasi teks, status aktif/nonaktif, dan urutan pada Beranda (Hero), Menu Pilihan, Promo & Paket, Tentang Kami, Cara Pesan, Galeri Suasana, Reservasi Meja, dan Lokasi & Kontak.
2. **Kustomisasi Multi-Slot & Kompresi WebP Otomatis**:
   - Mendukung kustomisasi hingga **6 slot foto dan teks** untuk Menu Pilihan, Promo & Paket, dan Galeri Suasana.
   - Kompresi sisi klien otomatis: file gambar kamera ponsel langsung dikonversi menjadi format WebP berkualitas tinggi dengan bobot terkompresi `< 80 KB`.
3. **Peta Google Maps Ciperna Real-time**:
   - Menampilkan koordinat presisi Tepi Sawah Resto & Cafe di Ciperna, Cirebon melalui Iframe Google Maps interaktif dan responsif.
4. **Kustomisasi Latar Belakang & Tema Warna Dinamis**:
   - Pengaturan palet warna primer, warna aksen, warna latar belakang, dan warna kartu dengan validasi kontras otomatis (WCAG) dan *live preview*.
5. **Ekosistem Operasional Staf Siap Produksi**:
   - Alur pemesanan meja real-time, sinkronisasi kasir POS dan KDS dapur, pembagian tagihan fleksibel, dan cetak struk pembayaran.

---

## 👥 Peran Operasional Resmi (Production Canonical Roles)

Berdasarkan keputusan arsitektur [ADR-006](docs/decisions/ADR-006-role-consolidation.md) dan audit kesiapan produksi:

1. **Owner / Pemilik** (`owner`):
   - Akses penuh: Panel Pengelola (`/admin`), CMS Web Publik (`/admin/cms`), pengaturan katalog & harga, konfigurasi meja, pembatalan pesanan, laporan omzet, otorisasi kasir, dan pengawasan dapur.
2. **Store Manager / Manajer Resto** (`manager`):
   - Pengawasan operasional harian, kelola stok menu, kelola CMS web publik, dan laporan kasir harian.
3. **Kasir** (`cashier`):
   - Akses terintegrasi: Meja Kasir & Pembayaran (`/pos`), konfirmasi pesanan QR meja, penerimaan pembayaran (Tunai, QRIS, Kartu), cetak struk, dan buka/tutup giliran kerja (*shift*).
4. **Dapur** (`kitchen`):
   - Akses khusus: Layar Pesanan Dapur (`/kitchen`) untuk memantau tiket masuk, estimasi waktu masak, dan menandai hidangan siap saji.
5. **Pelayan / Pramusaji** (`waiter`):
   - Akses mobile: Layanan Meja & Antar (`/waiter`) untuk mengantar hidangan siap saji dan membantu pesanan walk-in tamu.

---

## 🛠️ Tumpukan Teknologi (Tech Stack)

- **Frontend**: React 18, TypeScript, Vite, Vanilla CSS terstandarisasi.
- **Backend & Database**: Supabase (PostgreSQL 15, Supabase Auth, PostgreSQL RLS, Realtime Channel WebSockets).
- **Deployment**: Vercel (Proyek: `tepisawah`, `tepisawah-order`, `tepisawah-staff`).
- **Pengujian**: Vitest + Testing Library (482 unit & integration tests lulus 100%).
- **Manajemen Repositori**: pnpm workspace monorepo.

---

## 📚 Indeks Dokumentasi & Panduan Operasional

Seluruh panduan teknis dan operasional terdokumentasi secara lengkap:

- 📖 [Panduan Penggunaan CMS & Manajemen Staf](docs/operations/PANDUAN_CMS_DAN_OPERASIONAL.md) — Panduan lengkap kustomisasi website 8 seksi dan operasional resto.
- 🚀 [Panduan Deployment Produksi](docs/deployment/DEPLOYMENT_PRODUCTION_GUIDE.md) — Langkah deployment Vercel, Supabase, migrasi database, dan konfigurasi DNS.
- 📋 [Standar Kontrol Pre-Production](docs/operations/PRE_PRODUCTION_CONTROLS.md) — Aturan git branching, PR mandatori, dan manajemen rilis.
- ✅ [Checklist Pra-Deployment](docs/deployment/PRE_DEPLOYMENT_CHECKLIST.md) — 8 gerbang mutu wajib sebelum rilis ke production.
- 🌾 [Brand Direction & Design System](docs/brand/BRAND_DIRECTION.md) — Spesifikasi logo, favicon, Open Graph, dan palet warna.
- 📐 [Keputusan Arsitektur Resmi (ADRs)](docs/decisions/):
  - [ADR-001: Arsitektur Monorepo](docs/decisions/ADR-001-monorepo.md)
  - [ADR-002: Supabase sebagai Backend Primer](docs/decisions/ADR-002-supabase.md)
  - [ADR-003: Mesin Status Siklus Pesanan](docs/decisions/ADR-003-order-state-machine.md)
  - [ADR-004: Pemesanan Publik Pelanggan via QR](docs/decisions/ADR-004-public-customer-ordering.md)
  - [ADR-005: Penanganan Pembayaran](docs/decisions/ADR-005-payment-provider.md)
  - [ADR-006: Konsolidasi Peran Pengguna](docs/decisions/ADR-006-role-consolidation.md)
  - [ADR-007: Audit Merek, Open Graph Kanonikal, & Lokalisasi](docs/decisions/ADR-007-audit-branding-og-dan-lokalisasi.md)
  - [ADR-008: CMS Dinamis, Multi-Slot WebP, & Tema Visual](docs/decisions/ADR-008-cms-landing-customization.md)

---

## 🚀 Perintah Cepat Pengembang (Developer Quickstart)

```bash
# 1. Pasang dependensi
pnpm install

# 2. Jalankan pemeriksaan tipe data
pnpm -r run typecheck

# 3. Jalankan seluruh pengujian otomatis
pnpm -r run test

# 4. Bangun seluruh aplikasi produksi
pnpm -r run build

# 5. Jalankan server pengembang lokal
pnpm run dev
```
