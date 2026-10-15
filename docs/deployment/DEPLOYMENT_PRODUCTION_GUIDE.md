# PANDUAN DEPLOYMENT KE LINGKUNGAN PRODUKSI
## TEPI SAWAH RESTO & CAFE — PLATFORM DIGITAL TERINTEGRASI

**Versi**: 1.0 (Produksi)  
**Pembaruan Terakhir**: 16 Oktober 2026  
**Dokumen Terkait**: [ADR-001 (Monorepo)](../decisions/ADR-001-monorepo.md), [ADR-002 (Supabase)](../decisions/ADR-002-supabase.md), [ADR-008 (CMS Dinamis)](../decisions/ADR-008-cms-landing-customization.md), [PRE_DEPLOYMENT_CHECKLIST.md](PRE_DEPLOYMENT_CHECKLIST.md)

---

## 1. Arsitektur Deployment Produksi

Platform Tepi Sawah dibangun menggunakan arsitektur monorepo modern (`pnpm workspace`) dengan pembagian layanan sebagai berikut:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        INFRASTRUKTUR PRODUKSI                          │
└────────────────────────────────────────────────────────────────────────┘
          │                                               │
          ▼                                               ▼
┌──────────────────┐                            ┌──────────────────┐
│   VERCEL EDGE    │                            │  SUPABASE CLOUD  │
│ (Frontend Apps)  │                            │  (Backend & DB)  │
└──────────────────┘                            └──────────────────┘
  │                                               │
  ├── 1. tepisawah.id       (apps/web)            ├── PostgreSQL 15 Engine
  ├── 2. order.tepisawah.id (apps/order)          ├── Supabase Auth (JWT)
  └── 3. staff.tepisawah.id (apps/staff)          ├── PostgreSQL RLS Policies
                                                  ├── Realtime Channel (WebSockets)
                                                  └── Storage Buckets
```

---

## 2. Prasyarat Sistem & Kebutuhan Alat

Sebelum melakukan deployment, pastikan lingkungan Anda memenuhi spesifikasi berikut:
- **Node.js**: Versi `22.x` LTS (Wajib Node 22+ untuk dukungan native WebSocket pada library Realtime Supabase).
- **Package Manager**: `pnpm` versi `12.4.2` (Tercatat pada root `package.json`).
- **Repositori Git**: GitHub `sisigitadi/tepisawah`.
- **Akun Layanan Cloud**:
  - Akun **Vercel Pro / Hobby** (terhubung ke repositori GitHub).
  - Proyek **Supabase** (Database PostgreSQL aktif dengan ekstensi UUID).

---

## 3. Konfigurasi Database Supabase

### A. Menjalankan Migrasi Skema
Seluruh migrasi database tersusun secara kronologis di dalam folder `supabase/migrations/`:
- `001_initial_schema.sql` hingga `017_*.sql`: Skema inti restoran, menu, kategori, meja, pesanan, riwayat status, dan RLS security.
- `018_reservations/001_reservations.sql`: Tabel penampung data reservasi online tamu.
- `019_landing_content/001_landing_content.sql`: Tabel konfigurasi CMS dinamis website publik.

Untuk mengaplikasikan migrasi pada proyek Supabase produksi:
```bash
# Opsi 1: Menggunakan Supabase CLI
supabase db push --linked

# Opsi 2: Eksekusi SQL via Supabase Dashboard
# Buka Supabase Dashboard -> SQL Editor -> Jalankan file supabase/staging-bootstrap.sql 
# (atau jalankan migrasi 001 s/d 019 berurutan).
```

### B. Inisialisasi Akun Staf Produksi Bersih
Jalankan skrip seed staf produksi untuk membuat akun otentikasi resmi dan menghapus akun demo:
```bash
node scripts/seed-production-staff.mjs
```

---

## 4. Variabel Lingkungan (*Environment Variables*)

Setiap aplikasi frontend membutuhkan variabel lingkungan yang disetel pada **Vercel Project Settings -> Environment Variables**:

### A. Proyek 1: Website Publik (`tepisawah.id` / `apps/web`)
| Nama Variabel | Nilai / Deskripsi |
|---|---|
| `VITE_SUPABASE_URL` | URL proyek Supabase Anda (`https://<project-ref>.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Publishable Anon Key Supabase |
| `VITE_ORDER_URL` | `https://order.tepisawah.id` |
| `VITE_STAFF_URL` | `https://staff.tepisawah.id` |

### B. Proyek 2: Pemesanan Mandiri Meja (`order.tepisawah.id` / `apps/order`)
| Nama Variabel | Nilai / Deskripsi |
|---|---|
| `VITE_SUPABASE_URL` | URL proyek Supabase Anda |
| `VITE_SUPABASE_ANON_KEY` | Publishable Anon Key Supabase |
| `VITE_LANDING_URL` | `https://www.tepisawah.id` |

### C. Proyek 3: Portal Staf Terpadu (`staff.tepisawah.id` / `apps/staff`)
| Nama Variabel | Nilai / Deskripsi |
|---|---|
| `VITE_SUPABASE_URL` | URL proyek Supabase Anda |
| `VITE_SUPABASE_ANON_KEY` | Publishable Anon Key Supabase |
| `VITE_ORDER_URL` | `https://order.tepisawah.id` |

---

## 5. Konfigurasi Deployment di Vercel

### Proyek 1: `tepisawah` (Website Publik)
- **Root Directory**: `./` (Root monorepo)
- **Framework Preset**: `Vite`
- **Build Command**: `pnpm --filter @tepisawah/web build`
- **Output Directory**: `apps/web/dist`
- **Domain Kustom**: `tepisawah.id` dan `www.tepisawah.id` (Kanonikal).

### Proyek 2: `tepisawah-order` (Pemesanan Meja QR)
- **Root Directory**: `./`
- **Framework Preset**: `Vite`
- **Build Command**: `pnpm --filter @tepisawah/order build`
- **Output Directory**: `apps/order/dist`
- **Domain Kustom**: `order.tepisawah.id`.

### Proyek 3: `tepisawah-staff` (Portal Staf Terpadu)
- **Root Directory**: `./`
- **Framework Preset**: `Vite`
- **Build Command**: `pnpm --filter @tepisawah/staff build`
- **Output Directory**: `apps/staff/dist`
- **Domain Kustom**: `staff.tepisawah.id`.

---

## 6. Verifikasi Lokal Sebelum Push (*Pre-Flight Check*)

Sebelum melakukan dorongan kode ke remote repository, jalankan verifikasi mutu lokal:

```bash
# 1. Pastikan seluruh dependensi terkunci rapi
pnpm install --frozen-lockfile

# 2. Periksa tipe data seluruh paket dan aplikasi
pnpm -r run typecheck

# 3. Jalankan seluruh unit dan integration test (482 tests)
pnpm -r run test

# 4. Bangun seluruh paket dan aplikasi produksi
pnpm -r run build

# 5. Verifikasi integritas direktori dist/
node scripts/verify-build.mjs
```

---

## 7. Prosedur Rilis & Git Push

Setelah seluruh verifikasi lokal bernilai `PASS`:

```bash
# 1. Cek status berkas
git status

# 2. Tambahkan berkas perubahan
git add .

# 3. Buat commit rilis produksi
git commit -m "feat(cms): add dynamic landing CMS with multi-slot WebP, live maps, and production readiness"

# 4. Dorong ke branch utama (atau buka Pull Request jika proteksi aktif)
git push origin main
```

Setiap *push* ke branch `main` yang terhubung ke Vercel akan secara otomatis memicu proses *Deployment Pipeline*. Vercel akan mengunduh repositori, menjalankan perintah `pnpm build`, dan mempublikasikan versi terbaru ke CDN Edge global dalam waktu < 2 menit.

---

## 8. Checklist Verifikasi Pasca-Deployment (*Post-Deploy Smoke Test*)

Lakukan pengujian langsung pada domain aktif:
1. **Website Publik (`www.tepisawah.id`)**:
   - [ ] Halaman terbuka tanpa error konsol.
   - [ ] Gambar Hero, Galeri Suasana, dan Menu Pilihan muncul dengan tajam.
   - [ ] Seksi Peta Lokasi menampilkan Iframe Google Maps Ciperna secara interaktif.
   - [ ] Bagikan tautan ke WhatsApp / Telegram; pastikan banner Open Graph (`og-image.jpg`) tampil sempurna.
2. **CMS Portal Staf (`staff.tepisawah.id/admin/cms`)**:
   - [ ] Masuk sebagai *Owner* atau *Store Manager*.
   - [ ] Ubah salah satu teks menu pilihan atau promo paket.
   - [ ] Unggah foto baru; periksa bahwa file terkompresi menjadi WebP secara otomatis.
   - [ ] Klik "Simpan Perubahan" dan periksa halaman publik `tepisawah.id`; perubahan harus langsung terlihat.
3. **Pemesanan QR Meja (`order.tepisawah.id`)**:
   - [ ] Buka tautan meja contoh (misal: `order.tepisawah.id/?table=1&token=...`).
   - [ ] Buat pesanan baru dan kirim ke kasir.
4. **Kasir POS & Dapur (`staff.tepisawah.id`)**:
   - [ ] Notifikasi pesanan baru masuk secara real-time di Meja Kasir (`/pos`).
   - [ ] Konfirmasi pesanan; tiket langsung muncul di Layar Dapur (`/kitchen`).
   - [ ] Selesaikan pembayaran dan cetak struk.
