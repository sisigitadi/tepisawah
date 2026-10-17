# CATATAN RILIS VERSI 1.4
## MODUL KASIR SHIFT, VOID PESANAN, STRUK TERMAL, & KESIAPAN PRODUKSI

**Tanggal Rilis**: 17 Oktober 2026  
**Status**: Produksi / Grand Opening  
**Aplikasi Terdampak**: `@tepisawah/pos`, `@tepisawah/kitchen`, `@tepisawah/waiter`, `@tepisawah/admin`, `@tepisawah/database`, `@tepisawah/config`

---

### 1. Ikhtisar Pembaruan

Versi 1.4 menghadirkan penyempurnaan alur kerja operasional kasir dan restoran secara menyeluruh untuk menjamin keandalan, akuntabilitas keuangan, dan kecepatan pelayanan pada Hari Pembukaan (*Opening Day*):
1. **Siklus Lengkap Laci Kasir (*Cash Drawer & Shift Management*)**: Modal awal, pencatatan kas operasional, saldo berjalan real-time di subbar, dan rekonsiliasi tutup kasir fisik vs sistem.
2. **Fitur Batal / Void Transaksi**: Kasir dapat membatalkan pesanan yang belum dibayar dengan alasan wajib, langsung memicu alarm audio dan peringatan visual di KDS Dapur agar koki menghentikan proses memasak.
3. **Fleksibilitas Struk Termal & Cetak Ulang**: Pilihan ukuran kertas 58mm dan 80mm, auto-print setelah pembayaran sukses, serta tab Riwayat Selesai dengan watermark *[SALINAN / REPRINT]* dan stempel waktu.
4. **Sesi Meja Dinamis**: Opsi mode otomatis (*Open Ordering*) di backend Supabase untuk membuka sesi meja secara otomatis saat pesanan pertama masuk, meniadakan kendala sesi belum dibuka.
5. **Dukungan Pembayaran QRIS & Transfer Bank**: Modal layar penuh QRIS berkontras tinggi untuk pelanggan dan 1-click salin rekening transfer bank di kasir.
6. **Pembersihan Bersih Produksi (*Production Clean Slate*)**: Skrip transaksional aman untuk mengosongkan seluruh pesanan, shift, dan staf uji coba dengan perlindungan penuh atas akun Administrator dan Master Data.

---

### 2. Rincian Fitur Baru

#### A. Manajemen Shift & Laci Kas (`CashDrawerModal`)
- **Buka Kasir**: Kasir menginput modal float kas awal (misal Rp 300.000 atau Rp 500.000) sebelum melayani pembayaran tunai.
- **Kalkulasi Real-time**: Sistem menghitung saldo kas yang seharusnya ada di laci secara server-side:
  $$\text{Expected Cash} = \text{Modal Awal} + \text{Penjualan Tunai} + \text{Kas Masuk} - \text{Kas Keluar}$$
- **Kas Masuk & Keluar**: Form pencatatan pengeluaran harian darurat (pembelian es batu kristal, gas LPG, galon air, kertas nota) dengan riwayat transparan.
- **Tutup Kasir (Reconciliation)**: Kasir memasukkan uang riil fisik hasil hitungan tangan. Sistem mendeteksi selisih secara otomatis:
  - `🟢 Kas Pas`: Selisih Rp 0.
  - `🟡 Lebih Kas`: Uang fisik lebih banyak dari catatan sistem.
  - `🔴 Kurang Kas`: Uang fisik kurang dari catatan sistem.

#### B. Fitur Pembatalan / Void (`VoidOrderModal`)
- Kasir dapat membatalkan tiket draf atau pesanan belum bayar.
- Alasan pembatalan wajib dipilih dari daftar standar (*Pelanggan Salah Pesan*, *Menu Habis*, *Ganti Meja*, *Pesanan Fiktif/Batal Sepihak*, dsb.) ditambah keterangan catatan staf.
- **Integrasi KDS Dapur Realtime**: Saat pesanan di-void, KDS mendeteksi pembatalan seketika, membunyikan nada lonceng peringatan, dan menampilkan banner merah menyala.

#### C. Konfigurasi Printer & Cetak Ulang Nota
- Pengaturan terpusat di Admin: Lebar kertas 58mm (mini portable) atau 80mm (standar kasir POS) serta toggle cetak otomatis nota.
- Format nota termal dirancang dengan styling CSS `@media print` khusus agar pas dengan batas margin kertas thermal printer tanpa terpotong.
- Cetak ulang dari tab **Riwayat Selesai** menambahkan banner tegas `*** SALINAN NOTA / REPRINT ***` dan waktu pencetakan salinan.

#### D. Pengaturan QRIS & Rekening Bank
- Unggah URL gambar QRIS dinamis dan input data rekening bank (Nama Bank, Nomor Rekening, Nama Pemilik) melalui menu *Pajak, QRIS & Struk* di Admin.
- Pada kasir POS, kasir dapat menekan tombol **Perbesar QRIS** untuk menampilkan kode QR berukuran besar dengan kontras tinggi yang siap dipindai oleh layar kamera pelanggan.
- Untuk metode Transfer Bank, kasir dapat menyalin nomor rekening dengan 1 klik untuk memverifikasi mutasi.

---

### 3. Skrip Database & Migrasi

- `supabase/scripts/add-cash-drawer-void-and-settings-sync.sql`:
  - Menambahkan kolom `table_session_mode`, `qris_image_url`, `qris_payload`, `bank_name`, `bank_account_number`, `bank_account_holder`, `printer_paper_width`, `printer_auto_print` pada tabel `tax_settings`.
  - Membuat tabel `cash_shifts` dan `cash_transactions` lengkap dengan RLS dan fungsi RPC `open_cash_shift`, `get_current_cash_shift`, `record_cash_transaction`, `close_cash_shift`.
  - Memperbarui `create_draft_order` untuk otomatis membuka sesi meja pada mode `auto`.
  - Memperbarui `transition_order` untuk mencatat pembatalan status `VOID`.
- `supabase/scripts/production-clean-slate-preserve-admin.sql`:
  - Skrip pembersihan bersih transaksi uji coba menjelang peluncuran produksi tanpa menghapus akun Admin dan Master Data.

---

### 4. Hasil Verifikasi Mutu

- **Linting & Typecheck**: 17 dari 17 paket monorepo lulus `tsc --noEmit` tanpa error.
- **Unit Tests**: 480+ pengujian unit lulus (0 failures).
- **Production Build**: Seluruh bundle aplikasi (`@tepisawah/pos`, `@tepisawah/admin`, `@tepisawah/kitchen`, `@tepisawah/waiter`, `@tepisawah/order`, `@tepisawah/web`, `@tepisawah/staff`) berhasil dibangun untuk *production distribution*.
