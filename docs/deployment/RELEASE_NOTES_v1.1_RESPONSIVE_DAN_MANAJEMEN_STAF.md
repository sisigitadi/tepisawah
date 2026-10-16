# DOKUMENTASI RILIS & PANDUAN DEPLOYMENT v1.1
## TEPI SAWAH RESTO & CAFE — PLATFORM DIGITAL TERINTEGRASI

**Tanggal Rilis**: 16 Oktober 2026  
**Status Verifikasi Mutu**: ✅ **PASS SEMUA** (Typecheck 0 error, Build 7/7 apps OK, Test 482/482 pass)  
**Branch Produksi**: `feat/admin-staff-management` -> `main`

---

## 1. Ringkasan Perubahan & Fitur Baru (v1.1)

### A. Perombakan Total Tampilan Responsif Lintas Perangkat (Anti-Slop Multi-Device Polish)
1. **Kasir POS (`apps/pos`)**:
   - Menu drawer navigasi samping fleksibel untuk tablet & POS portrait (`max-width: 1024px`).
   - Tombol toggle 44x44px ramah sentuh jempol.
   - Header fleksibel dengan `flex-wrap: wrap` agar profil pengguna, shift aktif, dan jam tidak berhimpitan.
   - Rasio kontras teks status dan tombol ditingkatkan ke standar WCAG AAA/AA.

2. **Pemesanan Mandiri Meja (`apps/order`)**:
   - Dukungan penuh iOS notch & safe area: `padding-bottom: max(1.25rem, env(safe-area-inset-bottom))`.
   - Tombol tambah pesanan dan varian dinaikkan ke target sentuh 44x44px.
   - Tata letak tablet 2 kolom reflow fluid (`minmax(min(100%, 16rem), 1fr)`).
   - Efek skeleton loading bersih tanpa pergeseran tata letak (CLS = 0).

3. **Layar Dapur / KDS (`apps/kitchen`)**:
   - Menggunakan viewport dynamic `100dvh` anti-terpotong oleh mobile browser address bar.
   - Tiket pesanan menggunakan chip hijau kontras tinggi `#4ade80` pada latar gelap pekat.

4. **Layanan Pramusaji (`apps/waiter`)**:
   - Tata letak pesanan manual dan grid saung reflow dari 1 kolom ponsel hingga 3 kolom layar lebar.
   - Bilah bawah navigasi ramah satu tangan.

5. **Panel Admin & CMS (`apps/admin`)**:
   - Katalog menu dan promo menggunakan grid fluid `minmax(min(100%, 18rem), 1fr)`.
   - Scroll horizontal dengan visual mask gradient pada tabel laporan.

6. **Portal Staf Terpadu (`apps/staff`)**:
   - Kartu login demo menggunakan grid 2 kolom tablet dan touch target 44px.
   - Pintu masuk FOH terpadu (`/pos`), Dapur (`/kitchen`), dan Admin (`/admin`).

7. **Website Publik (`apps/web`)**:
   - Form reservasi meja fluid anti-overflow pada ponsel sempit (< 360px).
   - Glassmorphism berlebihan dibersihkan menjadi panel solid kontras tinggi ramah sinar matahari.

---

### B. Audit & Pembenahan Modul Manajemen Staf (`StaffPage.tsx`)
1. **Integrasi Penuh ke Portal Staf Terpadu**:
   - Modul `StaffPage` kini dapat diakses langsung oleh *Owner* & *Manager* di `staff.tepisawah.id/admin?tab=staff` dan `staff.tepisawah.id/users`.
2. **Keamanan RBAC Ketat**:
   - Tombol aksi dibentengi hak akses: `users.read`, `users.update`, `users.roles_manage`, `users.disable`, dan `users.create`.
   - Pencegahan nonaktifkan diri sendiri (*self-lockout prevention*).
3. **Tampilan Ganda Responsif**:
   - **Desktop**: Tabel data komprehensif dengan status badge, peran, PIN kasir, dan tombol aksi.
   - **Ponsel/Tablet**: Kartu staf vertikal (`.staff-cards-view`) ramah gestur sentuhan.
4. **Modal Tambah Staf Baru & Edit Peran**:
   - Terhubung langsung ke Supabase Auth (`signUp`) dan tabel `user_roles`.
   - Aksesibilitas penuh: penutupan modal dengan tombol `Escape`, backdrop klik, dan fokus keyboard.

---

## 2. Kredensial Pengguna Resmi Sistem

Untuk mengakses portal operasional staf (`https://staff.tepisawah.id`):

| Peran (Role) | Email Login | Hak Akses Utama |
|---|---|---|
| **Owner (Pemilik)** | `owner@tepisawah.id` | Akses penuh: Laporan keuangan, CMS web, Pengaturan Staf, Katalog, POS |
| **Manager (Manajer Toko)** | `manager@tepisawah.id` | Pengaturan Staf, Manajemen Meja, Katalog Menu, Koreksi Stok |
| **Cashier (Kasir FOH)** | `kasir@tepisawah.id` | Konfirmasi QR, Kasir POS, Cetak Struk, Pembayaran QRIS/Tunai |
| **Waiter (Pramusaji FOH)** | `waiter@tepisawah.id` | Catat Pesanan Manual Meja, Monitor Makanan Matang, Antar ke Meja |
| **Kitchen (Koki Dapur)** | `kitchen@tepisawah.id` | Layar KDS Dapur, Timer Memasak, Tandai Pesanan Selesai |

---

## 3. Hasil Verifikasi Mutu Pre-Flight (Lokal)

| Pengujian | Perintah | Status | Keterangan |
|---|---|---|---|
| **TypeScript Typecheck** | `pnpm -r run typecheck` | ✅ PASS | 0 error di seluruh 17 workspace packages |
| **Unit & Integration Test** | `pnpm -r run test` | ✅ PASS | 482 test passed (Database 272, Auth 58, Order 61, Admin 49, Waiter 23, Web 8, Staff 7, Pos 4) |
| **Production Build** | `pnpm -r run build` | ✅ PASS | Seluruh bundle Vite terkompilasi bersih di direktori `dist/` |
| **Build Artifacts Boundary** | `node scripts/verify-build.mjs` | ✅ PASS | Seluruh 7 aplikasi dan 10 paket inti valid |

---

## 4. Panduan Eksekusi Deployment ke Vercel

### Langkah 1: Simpan & Dorong Perubahan ke Git
```bash
# Tambahkan seluruh berkas perubahan
git add .

# Buat commit rilis
git commit -m "feat(ui): multi-device responsive overhaul and staff management portal integration"

# Dorong branch ke remote GitHub
git push origin feat/admin-staff-management
```

> **Catatan**: Jika pipeline produksi Vercel dihubungkan ke branch `main`, gabungkan branch ini melalui Pull Request atau langsung lakukan merge:
> ```bash
> git checkout main
> git merge feat/admin-staff-management
> git push origin main
> ```

---

### Langkah 2: Konfigurasi 3 Proyek Vercel (Otomatis CD)

Setiap dorongan ke branch utama akan otomatis memicu Vercel Build untuk 3 aplikasi web:

#### 1. Proyek Website Publik (`tepisawah.id`)
- **Root Directory**: `./`
- **Build Command**: `pnpm --filter @tepisawah/web build`
- **Output Directory**: `apps/web/dist`
- **Environment Variables**:
  - `VITE_SUPABASE_URL`: `https://zrewnesvqemcxlwvwdei.supabase.co`
  - `VITE_SUPABASE_ANON_KEY`: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
  - `VITE_ORDER_URL`: `https://order.tepisawah.id`
  - `VITE_STAFF_URL`: `https://staff.tepisawah.id`

#### 2. Proyek Pemesanan Tamu (`order.tepisawah.id`)
- **Root Directory**: `./`
- **Build Command**: `pnpm --filter @tepisawah/order build`
- **Output Directory**: `apps/order/dist`
- **Environment Variables**:
  - `VITE_SUPABASE_URL`: `https://zrewnesvqemcxlwvwdei.supabase.co`
  - `VITE_SUPABASE_ANON_KEY`: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
  - `VITE_LANDING_URL`: `https://www.tepisawah.id`

#### 3. Proyek Portal Staf Terpadu (`staff.tepisawah.id`)
- **Root Directory**: `./`
- **Build Command**: `pnpm --filter @tepisawah/staff build`
- **Output Directory**: `apps/staff/dist`
- **Environment Variables**:
  - `VITE_SUPABASE_URL`: `https://zrewnesvqemcxlwvwdei.supabase.co`
  - `VITE_SUPABASE_ANON_KEY`: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
  - `VITE_ORDER_URL`: `https://order.tepisawah.id`

---

## 5. Checklist Verifikasi Pasca-Deployment (Live Smoke Test)

1. **Website Publik (`www.tepisawah.id`)**:
   - [ ] Buka di browser ponsel & desktop.
   - [ ] Pastikan navigasi, banner, menu rekomendasi, dan form reservasi tampil rapi.
2. **Pemesanan QR (`order.tepisawah.id`)**:
   - [ ] Buka URL meja: `https://order.tepisawah.id/?table=1&token=...`
   - [ ] Cek safe area iPhone (tombol keranjang tidak tertutup home indicator).
3. **Portal Staf Terpadu (`staff.tepisawah.id`)**:
   - [ ] Masuk menggunakan akun `owner@tepisawah.id`.
   - [ ] Buka menu **Kelola Staf** (`/admin?tab=staff` atau `/admin/staff`).
   - [ ] Pastikan tabel staf muncul, tombol "Tambah Staf Baru" berfungsi, dan peran staf dapat diperbarui.
   - [ ] Coba tes tampilan di layar ponsel: tabel berubah menjadi kartu ramah sentuh.
