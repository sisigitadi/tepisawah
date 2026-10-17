# PANDUAN PEMBERSIHAN DATA BERSIH MENUJU PRODUKSI
## RESET TOTAL DATA UJI COBA MENJELANG HARI PEMBUKAAN (OPENING DAY)

**Tanggal**: 17 Oktober 2026  
**Dokumen Terkait**: [RELEASE_NOTES_v1.4](RELEASE_NOTES_v1.4_KASIR_SHIFT_VOID_STRUK_DAN_PRODUKSI.md), [DEPLOYMENT_PRODUCTION_GUIDE.md](DEPLOYMENT_PRODUCTION_GUIDE.md)

---

### 1. Tujuan Pembersihan Data

Selama tahap pengembangan dan pengujian sistem, banyak transaksi palsu (dummy orders), pengujian pembayaran, riwayat shift kasir uji coba, permohonan reservasi tes, dan akun staf percobaan yang tersimpan di dalam basis data Supabase.

Sebelum restoran dibuka resmi untuk umum, database **wajib dibersihkan secara total** agar:
- Laporan omzet dan pembukuan kasir hari pertama berawal dari angka murni **Rp 0**.
- Saldo laci kas kasir meminta input modal awal resmi (*Starting Float*).
- Antrean pesanan di meja kasir dan kitchen display dapur bersih dari tiket lama.
- Seluruh meja saung berstatus hijau **AVAILABLE** (Siap Digunakan).
- **Akun Administrator (`admin@tepisawah.id`) dan Master Data (Katalog Menu, Denah Meja, Foto WebP, CMS Landing Page, Pengaturan PB1/QRIS) TETAP AMAN TERJAGA**.

---

### 2. Cara Eksekusi Pembersihan Data

Terdapat 2 opsi praktis untuk menjalankan pembersihan data:

#### Opsi A: Melalui Supabase SQL Editor (Paling Direkomendasikan & Cepat)
1. Buka browser dan login ke dashboard proyek Supabase Anda: [https://supabase.com/dashboard](https://supabase.com/dashboard).
2. Pilih proyek restoran Tepi Sawah Anda.
3. Klik menu **SQL Editor** pada navigasi sebelah kiri, lalu klik **New Query**.
4. Buka file skrip: [`supabase/scripts/production-clean-slate-preserve-admin.sql`](../../supabase/scripts/production-clean-slate-preserve-admin.sql).
5. Salin seluruh isi file tersebut dan tempelkan (*paste*) ke dalam jendela SQL Editor Supabase.
6. Klik tombol hijau **Run** (atau tekan `Ctrl + Enter`).
7. Periksa tabel hasil di bagian bawah yang menampilkan:
   - `sisa_orders`: `0`
   - `sisa_shifts`: `0`
   - `sisa_reservations`: `0`
   - `meja_belum_available`: `0`
   - `jumlah_admin_tersisa`: `1` (Akun Admin aktif aman)

#### Opsi B: Melalui Perintah Terminal (Node CLI)
Jika environment terminal Anda telah memiliki akses ke `DATABASE_URL` atau Supabase Service Role Key:
```bash
# Jalankan skrip pembersih dengan flag konfirmasi
node scripts/clean-for-production-launch.mjs --confirm
```

---

### 3. Checklist Verifikasi Pasca-Pembersihan

Setelah skrip selesai dieksekusi, lakukan verifikasi cepat:
1. **Login Portal Staf (`https://staff.tepisawah.id`)**:
   - Masuk menggunakan email `admin@tepisawah.id` dengan kata sandi produksi Anda. Login harus berhasil dan masuk sebagai Owner/Administrator.
2. **Periksa Terminal Kasir (`/pos`)**:
   - Subbar menampilkan `🔴 Laci Kasir Ditutup`.
   - Saldo kas laci: `Rp 0 (Tutup)`.
   - Antrean pesanan: Kosong (`0 Antrean • 0 Selesai`).
3. **Periksa Monitor Dapur (`/kitchen`)**:
   - Tidak ada tiket tertinggal di kolom Incoming, Cooking, maupun Ready.
4. **Periksa Tablet Waiter (`/waiter`)**:
   - Seluruh meja saung 1 s/d selesai berwarna hijau terang dengan label *Tersedia*.
5. **Periksa Menu Makanan & Minuman**:
   - Buka menu **Katalog** di Admin atau coba buka `/order`; seluruh daftar makanan, kategori, harga, dan foto WebP tetap tampil lengkap dan utuh.
