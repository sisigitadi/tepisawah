# PANDUAN OPERASIONAL & PERSIAPAN FINAL SOFT OPENING
## TEPI SAWAH RESTO & CAFE — HARI PELUNCURAN (18 OKTOBER 2026)

Dokumen ini berisi petunjuk operasional teknis untuk mempersiapkan sistem POS & Portal Staf Tepi Sawah menjelang **Soft Opening** hari ini, termasuk prosedur pembersihan database, input menu baru, pembukaan laci kas (cash shift), alur dapur langsung, rekap thermal printer, dan langkah deployment.

---

## 1. Pembersihan Data Uji Coba (Clean Slate — Kecuali Staf)

Untuk memastikan laporan penjualan, riwayat kasir, dan antrean pesanan hari ini murni 100% mencatat tamu nyata, seluruh data simulasi pengujian wajib dibersihkan.

### Ringkasan Eksekusi:
- **File Skrip**: `supabase/scripts/production-soft-opening-clean-slate.sql`
- **Tabel yang Dibersihkan**:
  - `orders`, `order_items`, `order_item_modifiers`, `order_status_history`, `table_session_order_links`, `table_sessions` (Seluruh transaksi uji coba).
  - `cash_shifts`, `cash_transactions` (Riwayat shift & pergerakan laci kas uji coba).
  - `reservations`, `service_requests`, `notifications`, `audit_logs` (Layanan & riwayat pengujian).
  - `products`, `modifiers`, `product_modifiers` (Katalog produk pengujian dibersihkan untuk input data baru).
  - `categories` lama di-reset, lalu disiapkan 4 wadah kategori dasar: **Promo & Paket**, **Makanan**, **Minuman**, **Camilan**.
  - `order_number_seq` di-reset kembali ke **1** (nomor pesanan hari ini dimulai dari TS-20261018-0001).
  - Status seluruh meja Saung & Lesehan (`tables`) dikembalikan ke **AVAILABLE** (Siap Digunakan).
- **YANG 100% DIPERTAHANKAN & AMAN (KECUALI STAFF)**:
  - **Akun Staf & Owner (`auth.users`, `public.profiles`, `public.user_roles`)**: Seluruh kasir, waiter, dapur, admin, dan owner **TETAP BISA LOGIN** dengan email & password/PIN masing-masing tanpa perlu registrasi ulang.
  - **Hak Akses & Peran (`public.roles`, `public.permissions`)**: Hak akses sistem tetap utuh.
  - **Pengaturan Restoran (`public.restaurant_settings`, `public.tax_settings`)**: Pajak PB1 10%, QRIS, Bank Mandiri/BCA, Nomor Meja, Printer Thermal tetap tersimpan.
  - **CMS Website Publik (`public.landing_content`)**: Foto galeri suasana, Google Maps Ciperna, dan informasi resto tetap aktif.

### Cara Menjalankan di Supabase:
1. Buka [Supabase Dashboard](https://supabase.com/dashboard) -> Masuk ke project Tepi Sawah.
2. Buka menu **SQL Editor** di sidebar kiri -> Klik **"New Query"**.
3. Buka file `supabase/scripts/production-soft-opening-clean-slate.sql`, salin seluruh isinya, dan tempel ke SQL Editor.
4. Klik tombol **"Run"**.
5. Di bagian bawah hasil query, verifikasi tabel hasil:
   - `total_akun_staf_terlindungi`: >= 1 (akun staf utuh)
   - `sisa_orders`: 0
   - `sisa_shift_kasir`: 0
   - `sisa_produk`: 0
   - `total_kategori_tersedia`: 4 (wadah siap diisi)

---

## 2. Penginputan Menu Baru Hari Ini

Setelah database bersih, staf manajer/admin dapat menginput menu operasional:

### Opsi A: Input Mandiri via Portal Staf Admin
1. Buka Portal Staf: `https://staff.tepisawah.id/admin/catalog` (atau `localhost:5175/admin/catalog`).
2. Masuk sebagai akun **Owner** atau **Admin**.
3. Kategori sudah tersedia: `Promo & Paket`, `Makanan`, `Minuman`, `Camilan`.
4. Klik tombol **"+ Tambah Produk"**:
   - Masukkan Nama Produk, Deskripsi porsi, Harga, dan Unggah Foto (otomatis terkonversi WebP).
   - Tentukan ketersediaan (Stok Tersedia / Habis).
   - Simpan Produk.

### Opsi B: Tambah Menu Promo & Paket Sekaligus (Via SQL)
Jika ingin langsung mengisi 6 paket promo hemat andalan (Paket Nasi Liwet Komplit, Gurame Bakar Madu, Roaster Rempah Sawah, Ngopi Sunset, Liwet Saung 8-10 Orang, Paket Hemat Single) beserta modifier lengkap:
- Jalankan skrip `supabase/scripts/add-promo-catalog-menu.sql` di Supabase SQL Editor.

---

## 3. Prosedur Buka Kasir & Laci Kas Pagi (Shift Opening)

Untuk mempermudah kasir tanpa mengganggu kecepatan transaksi:

1. **Efisiensi Antarmuka Kasir**:
   - Header POS kini bersih dan ringkas tanpa banner hijau yang memakan tempat.
   - Tersedia satu tombol jelas: **"Laci Kas"** di sub-bar atas.
2. **Kewajiban Shift (Mandatory Shift)**:
   - Saat kasir pertama bertugas di pagi hari, buka tombol **"Laci Kas"**.
   - Di tab **"Buka Shift"**, masukkan **Modal Awal Kas** (misal: Rp 200.000 atau Rp 500.000).
   - Masukkan catatan kasir jika ada, lalu klik **"Buka Shift Sekarang"**.
   - Jika kasir lupa membuka shift dan langsung melayani transaksi tunai, sistem POS secara otomatis memblokir pembayaran dan menampilkan modal pembukaan shift terlebih dahulu.

---

## 4. Pengaturan Alur Dapur (Kitchen Toggle Flow)

Restoran dapat memilih alur pesanan sesuai kondisi operasional:

1. **Buka Menu Pengaturan**:
   - Masuk ke `Admin > Pengaturan Restoran > Alur Pesanan` (atau URL `/admin/settings`).
2. **Pilihan Alur**:
   - **Mode Dapur Aktif (Standar Resto Besar)**:
     - Kasir / Waiter terima pesanan -> Tiket masuk ke Layar Dapur (KDS `/kitchen`).
     - Koki tekan "Mulai Masak" (`IN_PREPARATION`) -> Koki tekan "Siap Antar" (`READY_TO_SERVE`).
     - Waiter mengantar ke meja dan klik "Selesai Antar" (`SERVED`).
   - **Mode Dapur Nonaktif (Langsung Saji / Fast-Paced Soft Opening)**:
     - Kasir menerima pembayaran -> Pesanan **langsung berstatus SIAP_SAJI (`READY_TO_SERVE`)** tanpa perlu dikonfirmasi manual di layar dapur.
     - Waiter / Runner langsung mengambil makanan dan mengantar ke saung/meja tamu.

---

## 5. Prosedur Rekap Kas Laci Kasir & Cetak Thermal Printer

Fitur cetak rekap laci kasir dirancang khusus untuk printer kasir thermal:

1. Buka tombol **"Laci Kas"** di POS -> Masuk ke tab **"Rekap Kasir"**.
2. **Pilih Rentang Waktu Rekap**:
   - `Sesi Shift Ini (Aktif)` — Rekap khusus kasir yang sedang bertugas.
   - `Hari Ini Penuh (All Shifts)` — Gabungan seluruh transaksi toko hari ini.
   - `Shift Pagi (07:00 - 15:00)` — Khusus shift pagi.
   - `Shift Sore / Malam (15:00 - 23:00)` — Khusus shift sore/tutup.
3. **Pilih Ukuran Kertas Thermal**:
   - `80mm (Desktop Thermal)` — Format standar printer kasir kasir meja USB/LAN.
   - `58mm (Mini Portable)` — Format ringkas printer Bluetooth / BP-ECO58 / RPP02N.
4. **Cetak Slip Thermal**:
   - Klik **"Cetak Slip Thermal"**.
   - Browser print dialog akan mencetak **hanya struk thermal murni** (Store Header, Kasir, Tanggal & Jam, Modal Awal, Penjualan Tunai, Kas Masuk/Keluar, Total Kas di Laci, Fisik, Selisih, dan Garis Tanda Tangan Kasir & Supervisor).
   - **TIDAK MENCETAK SCREENSHOT / POPUP MODAL**. Seluruh elemen layar browser, backdrop, tombol dan dialog otomatis disembunyikan oleh aturan CSS `@media print`.
5. **Tutup Kasir (Z-Report)**:
   - Saat jam shift berakhir, buka tab **"Tutup Shift"**.
   - Hitung fisik uang tunai di laci, masukkan ke form, dan periksa selisih.
   - Klik **"Tutup Shift & Cetak Z-Report"**.

---

## 6. Prosedur Deployment & Publikasi

Seluruh paket monorepo telah dibangun (*production build verified*):

```bash
# 1. Cek perubahan berkas yang siap dirilis
git status

# 2. Tambahkan seluruh berkas perubahan
git add .

# 3. Commit rilis produksi soft opening
git commit -m "chore(release): soft opening final production clean slate, thermal recap, and kitchen direct flow"

# 4. Dorong ke branch utama GitHub
git push origin main
```

### Domain Aktif Pasca Deployment:
- **Website Publik**: `https://tepisawah.id` & `https://www.tepisawah.id`
- **Pemesanan Mandiri Meja (QR)**: `https://order.tepisawah.id`
- **Portal Staf & Kasir Terpadu**: `https://staff.tepisawah.id`
  - POS Kasir: `https://staff.tepisawah.id/pos`
  - Layar Dapur: `https://staff.tepisawah.id/kitchen`
  - Portal Waiter: `https://staff.tepisawah.id/waiter`
  - Portal Admin / Owner: `https://staff.tepisawah.id/admin`
