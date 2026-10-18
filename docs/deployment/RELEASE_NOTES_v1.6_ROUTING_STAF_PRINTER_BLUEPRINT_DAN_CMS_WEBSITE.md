# Release Notes v1.6 — Perutean Staf Tanpa Modal, Integrasi Printer Blueprint Mobile, dan Pembaruan CMS Web Publik

**Tanggal Rilis**: 18 Oktober 2026  
**Status**: Siap Produksi (Grand Opening Ready)  
**Target Lingkungan**: Production (`tepisawah.id`, `order.tepisawah.id`, `staff.tepisawah.id`, Supabase Cloud)  
**Tingkat Perubahan**: Minor / Peningkatan Kritis Operasional Staf & Sinkronisasi Multi-Device  

---

## 🎯 Ringkasan Eksekutif

Pembaruan versi 1.6 menyelesaikan seluruh anomali perutean staf internal, mengoptimalkan antarmuka CMS web publik tanpa geser horizontal, memindahkan konfigurasi printer thermal ke Panel Pengelola dengan dukungan resmi aplikasi Blueprint Mobile (Android), serta memastikan sinkronisasi realtime pajak PB1 dan tema landing page ke seluruh perangkat.

---

## 🚀 Rincian Fitur & Peningkatan

### 1. Eliminasi Total Modal "Akses Belum Ditetapkan" & Perutean Langsung Ruang Tugas
- **Akar Masalah**: Komponen lama `AccessDenied` memunculkan kartu penolakan saat kueri `user_roles` mengalami latensi jaringan sesaat setelah login berhasil.
- **Penyelesaian**:
  - `AccessDenied` kini bersifat *silent redirect* (`return null`) dan otomatis mengarahkan staf langsung ke ruang kerjanya.
  - Ditambahkan resolusi peran sinkron berbasis konvensi email & nama pengguna (`admin`, `owner`, `manager`, `dapur`, `kitchen`, `koki`, `kasir`, `waiter`, `@staff.tepisawah.id`).
  - Staf yang terotentikasi langsung masuk ke meja kerja tanpa pernah melewati portal peluncur atau melihat dialog kesalahan:
    - **Owner / Admin / Manager** $\rightarrow$ Langsung membuka Panel Pengelola (`/admin`).
    - **Koki / Dapur** $\rightarrow$ Langsung membuka Layar Pesanan Dapur KDS (`/kitchen`).
    - **Kasir / Pelayan** $\rightarrow$ Langsung membuka Meja Kasir & Layanan Meja (`/pos`).

### 2. Integrasi Printer Thermal Blueprint BP-ECO58 & Aplikasi Blueprint Mobile (Android)
- **Format Cetak ESC/POS 32-Kolom Presisi**: Disesuaikan khusus untuk printer thermal portable 58mm Blueprint BP-ECO58 agar nama menu, kuantitas, harga, catatan khusus, dan rincian pajak tercetak rapi tanpa terpotong.
- **Dukungan Aplikasi Blueprint Mobile**: Menghubungkan web POS ke aplikasi Blueprint Mobile Print / Blueprint POS di Android melalui jembatan intent dan Print Spooler sistem.
- **Pemindahan Pengaturan ke Panel Pengelola**:
  - Pengaturan printer dihapus dari antarmuka kasir agar meja kasir tetap fokus dan ringkas.
  - Ditambahkan tab **"Printer Thermal & Blueprint"** di Panel Pengelola (`apps/admin/src/features/settings/settings-page.tsx`) dengan fitur pemilihan driver, ukuran kertas (58mm/80mm), sakelar cetak otomatis, dan tombol uji coba cetak (*test print*).
  - Dilengkapi panduan praktis 3 langkah koneksi Bluetooth Blueprint Mobile di Android.

### 3. Redesain Sub-Tab CMS Konten Web (Anti-Geser) & Sinkronisasi Katalog
- **Bilah Navigasi Chip Responsif**: Mengubah 9 sub-tab CMS web dari sebelumnya geser horizontal (`overflow-x: auto`) menjadi bilah *chip* yang membungkus rapi (*flex-wrap*).
- **Tarik Otomatis dari Katalog**: Tombol 1-klik untuk mengimpor menu aktif dari katalog database ke showcase menu website publik.
- **Indikator Draft Mengambang**: Bilah aksi mengambang (*sticky bar*) di bagian bawah dengan indikator perubahan (*dirty badge*) dan tombol simpan cepat.

### 4. Skrip Database Self-Healing & Sinkronisasi Realtime
- **Skrip `add-theme-to-landing-content.sql`**:
  - Otomatis membuat tabel `public.landing_content` jika belum ada lengkap dengan RLS, kebijakan hak akses publik & staf, serta batasan kueri yang mendukung `'theme'`.
  - Otomatis mendaftarkan tabel ke publikasi `supabase_realtime` sehingga perubahan tema dari CMS langsung tayang di situs publik tanpa *reload* halaman.

### 5. Sinkronisasi Pajak Restoran (PB1) Antar-Perangkat
- Menonaktifkan pajak di Panel Pengelola seketika memperbarui seluruh antrean pembayaran kasir yang belum dibayar menjadi Rp 0 secara realtime.

---

## 📦 Berkas yang Diubah & Ditambahkan

| Kategori | Berkas | Deskripsi Perubahan |
|---|---|---|
| **Otentikasi & Routing** | `packages/auth/src/access-denied.tsx` | Silent redirect bebas modal ke ruangan tugas |
| | `packages/auth/src/authorization.ts` | Fallback klasifikasi peran instan bebas macet |
| | `apps/staff/src/lib/navigation.ts` | Penentuan ruangan primer sinkron dari peran & email |
| | `apps/staff/src/app/router/index.tsx` | Eliminasi layar portal perantara untuk staf |
| | `apps/staff/src/routes/ProtectedRoute.tsx` | Passthrough langsung untuk pengguna terotentikasi |
| | `apps/staff/src/routes/PermissionRoute.tsx` | Pengalihan aman ke ruangan primer |
| **Printer & Kasir** | `packages/config/src/printer.ts` | Layanan driver printer Blueprint Mobile & ESC/POS |
| | `apps/admin/src/features/settings/printer-settings-form.tsx` | Formulir konfigurasi printer di Panel Pengelola |
| | `apps/admin/src/features/settings/settings-page.tsx` | Tab baru "Printer Thermal & Blueprint" |
| | `apps/pos/src/pages/HomePage.tsx` | Pembersihan tombol modal printer dari layar kasir |
| | `apps/pos/src/lib/printer.ts` | Re-export driver bersama dari `@tepisawah/config` |
| **CMS & Realtime** | `apps/admin/src/features/cms/CmsPage.tsx` | Navigasi chip wrap & import katalog 1-klik |
| | `apps/web/src/hooks/useLandingContent.ts` | Langganan Supabase Realtime channel landing_content |
| | `supabase/scripts/add-theme-to-landing-content.sql` | Skrip self-healing tabel & realtime publication |

---

## 📋 Prosedur Penerapan (Deployment Steps)

1. **Jalankan Skrip SQL di Supabase**:
   - Masuk ke dashboard Supabase: `https://supabase.com/dashboard/project/zrewnesvqemcxlwvwdei/sql`
   - Buka SQL Editor dan jalankan berkas:
     `supabase/scripts/add-theme-to-landing-content.sql`
2. **Commit & Push ke GitHub**:
   ```bash
   git add .
   git commit -m "feat(staff): zero-modal role routing, blueprint mobile printer integration, and self-healing cms sync"
   git push origin main
   ```
3. **Verifikasi Vercel Deployment**:
   - Vercel akan otomatis membangun dan merilis pembaruan ke `staff.tepisawah.id`, `tepisawah.id`, dan `order.tepisawah.id`.
4. **Verifikasi di Perangkat Tablet Kasir**:
   - Buka `https://staff.tepisawah.id` $\rightarrow$ login kasir langsung menampilkan meja kasir tanpa modal.
   - Buka `https://staff.tepisawah.id/admin` $\rightarrow$ buka tab *Printer Thermal & Blueprint* dan lakukan *Test Print*.
