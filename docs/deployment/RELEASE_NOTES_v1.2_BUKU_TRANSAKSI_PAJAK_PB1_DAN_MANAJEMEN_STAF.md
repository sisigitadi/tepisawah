# CATATAN RILIS & PANDUAN OPERASIONAL PRODUKSI v1.2
## TEPI SAWAH RESTO & CAFE — PLATFORM DIGITAL TERPADU

**Versi**: 1.2 (Final Production Opening Ready)  
**Tanggal Rilis**: 17 Oktober 2026  
**Status Audit Mutu**: PASS (17 Paket Workspace Typecheck 0 Error, Vitest 100% Pass, Vite Production Build Pass)  
**Target Lingkungan**: Production (`tepisawah.id`, `order.tepisawah.id`, `staff.tepisawah.id`, Supabase Cloud)

---

## 1. Ringkasan Eksekutif Rilis v1.2

Rilis v1.2 merupakan pembaruan final komprehensif yang menjamin seluruh fungsi operasional restoran siap digunakan tanpa kendala (*zero blocking bugs*) untuk momentum **Hari Pembukaan (Opening Day)**:
1. **Hak Akses & Kelola Staf Penuh (Multi-Role Checkbox & Akun Aman)**: Admin/Owner dapat menambah staf baru, mencentang penugasan peran operasional (Kasir, Pelayan, Dapur, Admin), mengubah peran seketika, dan menghapus akun staf tanpa resiko *self-lockout* atau merusak sesi login yang sedang aktif.
2. **Sistem Buku Transaksi & Jejak Audit Permanen (Immutable Ledger)**: Seluruh riwayat transaksi terekam otomatis, aman dari edit atau hapus manual, dan dapat dipantau oleh Pemilik Restoran lengkap dengan statistik omset terbayar dan alur status dapur/meja.
3. **Pengaturan Pajak Restoran (PB1), Service Charge & Struk Kasir**: Konfigurasi mandiri untuk PB1 daerah (10%), biaya layanan, nomor NPWPD, aturan pembulatan kasir (*rounding*), dan pratinjau langsung (*live simulator*) cetak kertas thermal 80mm.

---

## 2. Fitur Baru & Perubahan Arsitektur

### A. Pengelolaan Staf & Hak Akses Berbasis Tugas (RBAC)
* **Checkbox Tugas Multi-Peran**: Saat membuat atau mengedit akun staf, Admin/Owner dapat memilih satu atau kombinasi peran:
  * 💵 **Kasir**: Akses terminal kasir POS, antrean pembayaran, cetak struk, dan penutupan bill.
  * 🍽️ **Pelayan / Waiter**: Akses pelayan, input pesanan manual dari meja, dan status antar hidangan.
  * 👨‍🍳 **Dapur (Kitchen)**: Akses Kitchen Display System (KDS), pengelolaan tiket masak, dan tombol siap saji.
  * ⚙️ **Admin**: Akses panel kontrol penuh (manajemen menu, meja, pengaturan, dan staf).
* **Fungsi Database Aman (RPC Security Definer)**:
  * `public.admin_update_user_roles(p_user_id, p_role_codes)`: Memperbarui centang peran secara instan dengan validasi hak akses pemanggil (`is_owner() OR is_admin()`).
  * `public.admin_delete_staff(p_user_id)`: Menghapus staf secara bersih dari tabel `user_roles`, `profiles`, dan `auth.users`, dilengkapi penjaga anti *self-lockout* (tidak dapat menghapus akun sendiri yang sedang aktif login).
* **Isolasi Sesi Client Ephemeral**:
  * Penambahan opsi `persistSession: false` pada client Supabase internal (`createEphemeralSupabaseClient`).
  * Pembuatan akun staf baru tidak lagi menimpa atau me-logout sesi login Owner/Admin di peramban web.

### B. Buku Transaksi Pemilik (Transactions Ledger & Audit Trail)
* **Lokasi Navigasi**: Tab **💰 Buku Transaksi** di Panel Admin (`/admin` atau `/staff`).
* **Ringkasan Eksekutif Real-Time**:
  * **Total Omset Terbayar**: Total pendapatan bersih dari seluruh transaksi berstatus `PAID` / `COMPLETED`.
  * **Total Pesanan Masuk**: Akumulasi seluruh nomor pesanan yang pernah dibuat sistem.
  * **Sedang Berjalan**: Pesanan aktif yang masih berada di antrean meja atau proses masak dapur.
  * **Dibatalkan / Void**: Jumlah pesanan yang dibatalkan beserta jejak alasan pembatalannya.
* **Filter Interaktif**:
  * Berdasarkan Waktu: Hari Ini, 7 Hari Terakhir, 30 Hari Terakhir, Semua Waktu.
  * Berdasarkan Status: Semua, Lunas Selesai, Aktif Berjalan, Dibatalkan.
  * Pencarian Cepat: Berdasarkan Nomor Tiket Pesanan atau Nomor Meja.
* **Keamanan Data Mutlak (Anti Manipulasi & Anti Hapus)**:
  * Tabel `orders` dan `order_status_history` dilindungi aturan RLS ketat:
    `REVOKE INSERT, UPDATE, DELETE FROM anon, authenticated;`
  * Transaksi tidak dapat diubah atau dihapus secara langsung melalui client-side. Perubahan status hanya diizinkan melalui *Stored Procedure* yang memvalidasi integritas matematika tagihan (`total = subtotal - discount + tax`).
* **Jejak Audit Kronologis (Immutable Audit Trail)**:
  * Setiap perubahan status mencatat: waktu kejadian presisi, peran eksekutor (Kasir/Pelayan/Dapur/Sistem), dan alasan perubahan.

### C. Pengaturan Pajak Restoran (PB1), Biaya Layanan & Struk Thermal
* **Lokasi Navigasi**: Tab **Pajak & Biaya (PB1)** pada menu **Pengaturan Restoran** (`/admin` -> Pengaturan).
* **Fitur Konfigurasi**:
  * **Pajak Restoran (PB1)**: Saklar On/Off, tarif persentase (standar 10%), nama label pada struk, dan nomor NPWPD/NOPD resmi.
  * **Skema Perhitungan**:
    * *Exclusive* (Pajak di luar harga): Subtotal menu + PB1 10% = Total yang dibayar pelanggan.
    * *Inclusive* (Harga nett sudah termasuk PB1): Sistem mengekstrak DPP dan nilai PB1 untuk laporan pembukuan tanpa membebani biaya tambahan ke pelanggan.
  * **Biaya Layanan (Service Charge)**: Saklar On/Off dan tarif persentase (misal 5%).
  * **Aturan Pembulatan Kasir (Rounding)**: Pilihan tanpa pembulatan, pembulatan ke ratusan terdekat (Rp 100), Rp 500, atau ribuan (Rp 1.000) untuk mempermudah kembalian kasir.
  * **Kustomisasi Struk Kasir**: Nama alamat, nomor WhatsApp, salam kaki struk (*Footer Greeting*), dan opsi penampilan NPWPD.
  * **Live Simulator Struk 80mm**: Pratinjau langsung cetakan kertas thermal kasir dengan kalkulasi matematika otomatis saat parameter diubah.
  * **Sinkronisasi Kasir POS**: Nilai konfigurasi langsung dibaca secara reaktif oleh terminal kasir POS (`apps/pos`) dan bill inspector.

---

## 3. Hasil Verifikasi Mutu & Pengujian Pra-Rilis

| Aspek Pengujian | Perintah / Uji | Hasil | Status |
|---|---|---|---|
| **Pengecekan Tipe Data (Typecheck)** | `pnpm -r run typecheck` (17 Paket) | 0 Error pada semua paket | **PASS** |
| **Unit & Integration Tests** | `pnpm --filter @tepisawah/admin test` | 49 dari 49 tests lulus | **PASS** |
| **Database Unit Tests** | `pnpm --filter @tepisawah/database test` | 272 dari 272 tests lulus | **PASS** |
| **Build Frontend Staf** | `pnpm --filter @tepisawah/staff run build` | Sukses (`apps/staff/dist`) | **PASS** |
| **Build Web Publik** | `pnpm --filter @tepisawah/web run build` | Sukses (`apps/web/dist`) | **PASS** |
| **Build Pemesanan QR** | `pnpm --filter @tepisawah/order run build` | Sukses (`apps/order/dist`) | **PASS** |
| **Pencegahan Self-Lockout** | RPC `admin_delete_staff` | Dicegah dengan error ramah | **PASS** |
| **Isolasi Sesi Admin** | Tambah Staf via Ephemeral Client | Sesi login admin tetap aktif | **PASS** |

---

## 4. Prosedur Deployment ke Lingkungan Produksi

### Langkah 1: Eksekusi Skrip Database di Supabase Cloud (Wajib)
Buka [Supabase Dashboard](https://supabase.com/dashboard) proyek produksi Anda $\rightarrow$ **SQL Editor** $\rightarrow$ Buka tab baru $\rightarrow$ Salin dan jalankan seluruh isi file:
```
supabase/scripts/fix-staff-roles-and-management.sql
```
*Skrip ini secara aman dan idempoten memasang izin permissions, fungsi RPC kelola tugas staf, fungsi hapus staf, dan tabel konfigurasi `tax_settings`.*

### Langkah 2: Deploy Frontend ke Vercel
Karena repositori terhubung otomatis dengan Vercel, lakukan sinkronisasi branch `feat/staff-edit-delete-checkbox-tasks` ke branch `main`:

```bash
# 1. Beralih ke branch main
git checkout main

# 2. Gabungkan perubahan dari branch rilis
git merge feat/staff-edit-delete-checkbox-tasks

# 3. Dorong ke GitHub untuk memicu deploy Vercel
git push origin main
```
*Vercel akan otomatis mendeteksi commit baru pada branch `main` dan mempublikasikan versi terbaru ke `staff.tepisawah.id`, `order.tepisawah.id`, dan `tepisawah.id` dalam tempo < 2 menit.*

---

## 5. Checklist Kesiapan Operasional Hari Pembukaan (*Opening Day*)

- [ ] **Database & Hak Akses**:
  - [ ] Akun Owner/Admin dapat masuk ke `https://staff.tepisawah.id/admin`.
  - [ ] Menu **Kelola Staf** dapat menambahkan akun kasir, koki, dan pelayan dengan centang tugas yang sesuai.
- [ ] **Pajak & Keuangan**:
  - [ ] Buka menu **Pengaturan** $\rightarrow$ tab **Pajak & Biaya (PB1)**.
  - [ ] Pastikan status PB1 (10%) dan nomor NPWPD restoran sudah sesuai dengan ketetapan manajemen.
  - [ ] Simpan pengaturan; periksa bahwa simulasi struk menampilkan rincian yang benar.
- [ ] **Alur Pesanan Meja & Dapur**:
  - [ ] Meja kasir membuka `/pos`.
  - [ ] Dapur membuka `/kitchen` pada tablet/layar display dapur.
  - [ ] Pelayan membuka `/` (Waiter Console).
  - [ ] Lakukan 1 uji coba transaksi: Buat pesanan $\rightarrow$ Tiket muncul di dapur $\rightarrow$ Siap saji $\rightarrow$ Pelunasan kasir $\rightarrow$ Cetak struk kasir $\rightarrow$ Transaksi otomatis tercatat rapi di **Buku Transaksi**.
