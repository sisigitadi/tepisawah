# Tepi Sawah Resto & Cafe — Digital Platform

Platform digital terintegrasi untuk **Tepi Sawah Resto & Cafe** (Ciperna, Cirebon). Menggabungkan website publik, pemesanan mandiri pelanggan via QR meja, serta portal terpadu staf operasional (Kasir POS, Layanan Meja, Layanan Dapur, dan Panel Pengelola Bisnis).

---

## 🌐 Lingkungan & Domain Produksi (Pre-Production)

| Aplikasi | Domain | Deskripsi Fungsional |
|---|---|---|
| **Website Utama** | [https://tepisawah.id](https://tepisawah.id) (Kanonikal: `www.tepisawah.id`) | Profil restoran, galeri saung/alam, daftar menu, kontak, dan panduan reservasi/QR. |
| **Pemesanan Pelanggan** | [https://order.tepisawah.id](https://order.tepisawah.id) | Pemesanan mandiri tamu di meja berbasis QR code terproteksi token aktif. |
| **Portal Staf Terpadu** | [https://staff.tepisawah.id](https://staff.tepisawah.id) | Portal operasional terpadu: Kasir POS, Layanan Meja & Antar, Layanan Dapur, dan Panel Pengelola. |

---

## 👥 Konsolidasi Peran Pengguna (Canonical Roles)

Berdasarkan keputusan arsitektur [ADR-006](docs/decisions/ADR-006-role-consolidation.md), sistem menyederhanakan hak akses menjadi 3 peran operasional utama:

1. **Owner / Pemilik** (`owner`):
   - Akses penuh: Panel Pengelola (`/admin`), pengaturan katalog & harga, konfigurasi meja, pembatalan pesanan, laporan omzet, otorisasi kasir, dan pengawasan dapur.
   - Akun Demo: `owner@demo.tepisawah.id` (Sandi: `demo1234`).
2. **Kasir** (`cashier`):
   - Akses terintegrasi: Meja Kasir & Pembayaran (`/pos`), konfirmasi pesanan QR meja, pemantauan hidangan siap saji dapur, pencatatan pesanan manual pelanggan walk-in.
   - Akun Demo: `kasir@demo.tepisawah.id` (Sandi: `demo1234`).
3. **Dapur** (`kitchen`):
   - Akses khusus: Layanan Pesanan Dapur (`/kitchen`) untuk memantau tiket masuk, waktu masak, dan menandai hidangan siap saji.
   - Akun Demo: `dapur@demo.tepisawah.id` (Sandi: `demo1234`).

---

## 🛠️ Tumpukan Teknologi (Tech Stack)

- **Frontend**: React 18, TypeScript, Vite, Vanilla CSS terstandarisasi.
- **Backend & Database**: Supabase (PostgreSQL 15, Supabase Auth, PostgreSQL RLS, Realtime Channel).
- **Deployment**: Vercel (3 proyek monorepo: `tepisawah`, `tepisawah-order`, `tepisawah-staff`).
- **Pengujian**: Vitest + Testing Library (474 unit & integration tests lulus).
- **Manajemen Repositori**: pnpm workspace monorepo.

---

## 📚 Indeks Dokumentasi & Kontrol Rilis

Seluruh pengembangan wajib mematuhi standar kontrol mutu dan arsitektur resmi:

- 📋 [Standar Kontrol Pre-Production](docs/operations/PRE_PRODUCTION_CONTROLS.md) — Aturan git branching, PR mandatori, dan manajemen rilis.
- ✅ [Checklist Pra-Deployment](docs/deployment/PRE_DEPLOYMENT_CHECKLIST.md) — 8 gerbang mutu wajib sebelum rilis ke production.
- 📜 [Changelog Lengkap](CHANGELOG.md) — Riwayat perubahan versi terperinci.
- 🌾 [Brand Direction & Design System](docs/brand/BRAND_DIRECTION.md) — Spesifikasi logo, favicon, Open Graph, dan palet warna.
- 📐 [Keputusan Arsitektur (ADRs)](docs/decisions/):
  - [ADR-001: Arsitektur Monorepo](docs/decisions/ADR-001-monorepo.md)
  - [ADR-002: Supabase sebagai Backend Primer](docs/decisions/ADR-002-supabase.md)
  - [ADR-003: Mesin Status Siklus Pesanan](docs/decisions/ADR-003-order-state-machine.md)
  - [ADR-004: Pemesanan Publik Pelanggan via QR](docs/decisions/ADR-004-public-customer-ordering.md)
  - [ADR-005: Penanganan Pembayaran](docs/decisions/ADR-005-payment-provider.md)
  - [ADR-006: Konsolidasi Peran Pengguna](docs/decisions/ADR-006-role-consolidation.md)
  - [ADR-007: Audit Merek, Open Graph Kanonikal, & Lokalisasi](docs/decisions/ADR-007-audit-branding-og-dan-lokalisasi.md)

---

## 🚀 Perintah Cepat Pengembang (Developer Quickstart)

```bash
# 1. Pasang dependensi
pnpm install

# 2. Jalankan pemeriksaan tipe data
pnpm -r run typecheck

# 3. Jalankan pengujian otomatis
pnpm run test

# 4. Jalankan server lokal
pnpm run dev
```
