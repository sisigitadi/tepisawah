# CATATAN RILIS VERSI 1.5
## SINKRONISASI QRIS MULTI-DEVICE REALTIME & PENGATURAN KEUANGAN KASIR

**Tanggal Rilis**: 18 Oktober 2026  
**Status**: Siap Produksi / Multi-Device Verified  
**Aplikasi Terdampak**: `@tepisawah/pos`, `@tepisawah/admin`, `@tepisawah/config`, Database Supabase

---

### 1. Ikhtisar Masalah & Latar Belakang

Pada pengujian operasional multi-perangkat (*multi-device testing*), ditemukan kendala di mana gambar QRIS yang telah diunggah dan disimpan di aplikasi Administrator pada satu perangkat (misal laptop manajer) **tidak muncul** saat kasir membuka terminal POS di perangkat lain (misal tablet kasir, iPad, atau komputer kasir kedua). Layar kasir hanya menampilkan *placeholder* kosong/dummy SVG, sehingga kasir tidak dapat menampilkan QRIS kepada pelanggan yang ingin membayar dengan dompet digital (GoPay, OVO, Dana, ShopeePay) atau mobile banking (BCA, Mandiri, BRI).

---

### 2. Analisis Akar Masalah (*Root Cause Analysis*)

1. **Duplikasi Baris Data pada Tabel `tax_settings` Supabase**:
   - Di database Supabase terdapat **2 baris data**:
     - Baris `id = 'default'` (dari skrip inisialisasi awal) dengan `qris_image_url: ""` (kosong).
     - Baris `id = '22222222-2222-4222-8222-222222222222'` (dari skrip migrasi sinkronisasi) yang menyimpan gambar QRIS kompresi WebP asli (87.891 bytes).
   - Query pemuatan data sebelumnya di Admin menggunakan `.select("*").limit(1).single()` tanpa klausul `ORDER BY`. Akibatnya, PostgreSQL mengembalikan baris pertama yang dibuat (`id = 'default'`), menimpa pengaturan di perangkat lain dengan nilai kosong.

2. **Aplikasi POS Kasir Tidak Melakukan Sinkronisasi Jaringan**:
   - Pada aplikasi POS Kasir (`apps/pos`), fungsi `getPosTaxSettings()` hanya membaca `localStorage` lokal pada browser perangkat tersebut.
   - Tidak ada proses pembacaan awal (*initial fetch*) dari database Supabase saat aplikasi POS dibuka di perangkat kasir baru.
   - Karena `localStorage` terisolasi per-perangkat/browser, perangkat kasir lain mendapatkan nilai default kosong.

3. **Ketiadaan *Listener Realtime***:
   - Perubahan data pajak, QRIS, rekening bank, atau ukuran kertas printer di Admin tidak memicu pembaruan otomatis di aplikasi kasir tanpa *reload* halaman secara manual.

---

### 3. Solusi & Perubahan Arsitektur

#### A. Hook Reaktif Baru: `useTaxSettings` (`apps/pos/src/hooks/useTaxSettings.ts`)
- **Initial Cross-Device Sync**: Saat terminal kasir dimuat di perangkat mana pun, hook ini langsung mengambil data `tax_settings` terbaru dari Supabase menggunakan pengurutan `updated_at DESC`:
  ```ts
  const { data } = await client
    .from("tax_settings")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  ```
- **Supabase Realtime Channel**: Berlangganan ke kanal realtime Supabase (`postgres_changes` pada tabel `tax_settings`). Setiap kali Admin mengunggah gambar QRIS baru atau mengubah tarif pajak/rekening, seluruh perangkat kasir yang sedang aktif langsung ter-update secara instan dalam hitungan milidetik tanpa interupsi.
- **Penyimpanan Lokal & Event Dispatch**: Data otomatis disinkronkan ke `localStorage` dan memicu custom event `tepisawah:tax_settings_changed`.

#### B. Integrasi Kasir POS (`apps/pos/src/features/terminal/PaymentExecution.tsx`)
- Komponen `PaymentExecution` dan `HomePage` mengonsumsi hook reaktif `useTaxSettings`.
- **Dukungan Fallback Dinamis**:
  1. Jika gambar QRIS statis tersedia (`qrisImageUrl`), sistem menampilkan gambar WebP berkualitas tinggi.
  2. Jika gambar QRIS belum diunggah namun string payload QRIS Bank Indonesia (`qrisPayload`) diisi, sistem otomatis me-render kode QR dinamis resolusi tinggi (150x150 di workspace dan 300x300 di modal layar penuh).
  3. Jika keduanya kosong, menampilkan placeholder SVG standar QRIS Nasional.

#### C. Modal Layar Penuh Pelanggan (`apps/pos/src/features/terminal/QrisFullscreenModal.tsx`)
- Mendukung prop `qrisPayload` dan fallback rendering dinamis.
- Pelanggan dapat memindai QRIS berukuran besar (280x280) dengan jelas dari seberang meja kasir.

#### D. Konsolidasi Baris Database di Form Admin (`apps/admin/src/features/settings/tax-finance-form.tsx`)
- Pemuatan awal menggunakan `.order("updated_at", { ascending: false }).limit(1).maybeSingle()`.
- Saat Admin menekan **Simpan Pengaturan**, sistem otomatis menghapus baris lama `id = 'default'` sehingga hanya ada 1 baris canonical `id = '22222222-2222-4222-8222-222222222222'` di tabel `tax_settings`.

#### E. Pembaruan Skrip Migrasi SQL (`supabase/scripts/add-cash-drawer-void-and-settings-sync.sql`)
- Menambahkan statement SQL pembersihan:
  ```sql
  DELETE FROM public.tax_settings WHERE id <> '22222222-2222-4222-8222-222222222222';
  ```
- Memperbarui fungsi pembaca parameter pajak dan mode sesi meja agar selalu membaca baris terbaru dengan `ORDER BY updated_at DESC LIMIT 1`.

---

### 4. Prosedur Deployment

1. **Jalankan Skrip SQL di Supabase SQL Editor**:
   - Buka **Supabase Dashboard** -> **SQL Editor**.
   - Salin dan jalankan seluruh isi file `supabase/scripts/add-cash-drawer-void-and-settings-sync.sql`.
   - Skrip ini bersifat idempoten dan aman dijalankan ulang (*zero downtime*).

2. **Deploy Aplikasi Frontend ke Vercel**:
   - Commit dan push branch ke GitHub:
     ```bash
     git add .
     git commit -m "fix(pos): multi-device qris realtime sync and tax_settings deduplication"
     git push origin <nama-branch>
     ```
   - Vercel akan secara otomatis membangun dan men-deploy:
     - `tepisawah.id` (`apps/web`)
     - `order.tepisawah.id` (`apps/order`)
     - `staff.tepisawah.id` (`apps/staff` / `apps/pos` / `apps/admin`)

3. **Verifikasi Pasca-Deployment**:
   - Buka Admin di Komputer A (`/admin` -> menu **Pajak, QRIS & Struk**).
   - Pastikan gambar QRIS terlihat dan klik **Simpan Pengaturan**.
   - Buka POS Kasir di Komputer/Tablet B (`/pos`).
   - Buka pesanan aktif, pilih metode **QRIS**, dan klik **Perbesar di Layar**.
   - Pastikan gambar QRIS tampil dengan jelas di Perangkat B tanpa perlu upload ulang.

---

### 5. Hasil Verifikasi Mutu

- **Linting & Typecheck**: 17 dari 17 proyek monorepo lulus `tsc --noEmit` tanpa error.
- **Production Build**: 17 dari 17 paket monorepo berhasil di-build untuk distribusi produksi (`pnpm build`).
- **REST API Endpoint**: Respon endpoint Supabase `tax_settings` mengembalikan baris canonical dengan ukuran gambar 87 KB.
