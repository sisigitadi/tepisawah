# ADR-006: Konsolidasi Peran Pengguna Operasional Restoran

**Status**: Diterima & Diterapkan (Accepted & Implemented)  
**Tanggal**: 2026-10-06  
**Penyusun**: Engineering & Product Team Tepi Sawah  

---

## 1. Konteks & Latar Belakang

Pada desain arsitektur awal (MVP v0.1.0), sistem mendefinisikan 6 peran pengguna diskrit:
1. `admin` (Administrator Sistem)
2. `supervisor` (Supervisor Operasional)
3. `owner` (Pemilik Usaha)
4. `cashier` (Kasir)
5. `waiter` (Pelayan Meja)
6. `kitchen` (Koki / Dapur)

Dalam praktik operasional harian restoran Tepi Sawah:
- Pemilik (*Owner*), Administrator, dan Supervisor memiliki kepentingan dan tanggung jawab pengawasan yang saling tumpang tindih. Pembagian ke dalam 3 akun terpisah menciptakan kebingungan login dan friksi koordinasi saat monitoring laporan, konfigurasi meja, dan penyesuaian katalog.
- Kasir dan Pelayan (*Waiter*) bekerja sangat erat dalam satu siklus layanan meja: kasir menerima dan mengonfirmasi pesanan QR meja, mencetak struk, sementara pelayan memantau makanan siap saji dan mencatat pesanan manual jika pelanggan walk-in tidak menggunakan smartphone. Memisahkan aplikasi dan kredensial kasir dari pelayan memperlambat rotasi staf dan penyelesaian kendala di meja.

---

## 2. Keputusan Desain (Decision)

Kami mengonsolidasikan 6 peran menjadi **3 peran kanonikal utama**:

```
[SEBELUMNYA]                         [KONSOLIDASI BARU]
• admin        \
• supervisor    —> DIKONSOLIDASIKAN —> 👑 OWNER (Pemilik & Super Admin)
• owner        /

• cashier      \
• waiter        —> DIKONSOLIDASIKAN —> 💳 KASIR (Kasir & Layanan Meja)

• kitchen       —————————————————————> 👨‍🍳 KITCHEN (KDS Dapur)
```

### A. Peran `owner` (Pemilik & Super Admin)
- **Cakupan Hak Akses**: Superset tertinggi (seluruh izin operasional, manajemen, dan keuangan).
- **Aplikasi yang Dapat Diakses**:
  - `apps/admin` (Owner Console): Katalog menu, meja & QR, manajemen staf, diskon & pajak, pembatalan pesanan, analitik omzet.
  - `apps/pos` (Kasir Terminal): Otorisasi void, pengawasan transaksi.
  - `apps/kitchen` (KDS): Inspeksi alur dapur.
  - `apps/waiter` (Layanan Meja): Pengawasan meja.
- **Akun Demo Pre-Production**: `owner@demo.tepisawah.id` (Sandi: `demo1234`).

### B. Peran `cashier` (Kasir & Layanan Meja)
- **Cakupan Hak Akses**:
  - Semua izin POS standar (`ORDERS_READ`, `ORDERS_UPDATE`, `PAYMENTS_CREATE`, `SESSIONS_READ`).
  - Tambahan izin Layanan Meja (`ORDERS_SERVE`, `SERVICE_REQUESTS_READ`, `SERVICE_REQUESTS_RESOLVE`).
- **Antarmuka Terintegrasi**:
  - Portal Kasir (`apps/staff` sub-rute POS) kini dilengkapi tab integrasi:
    1. 💳 **Terminal Kasir**: Pembayaran tunai/QRIS.
    2. 📥 **Antrean Konfirmasi**: Konfirmasi pesanan QR dari meja tamu.
    3. 🍽️ **Layanan Meja & Saji**: Pantau hidangan siap saji dari dapur & update status disajikan.
    4. ✍️ **Catat Order Walk-In**: Pencatatan manual pesanan meja tamu.
- **Akun Demo Pre-Production**: `kasir@demo.tepisawah.id` (Sandi: `demo1234`).

### C. Peran `kitchen` (Dapur)
- **Cakupan Hak Akses**: Khusus Kitchen Display System (`ORDERS_READ`, `ORDERS_COOK`).
- **Isolasi Alur**: Dapur hanya melihat pesanan yang sudah berstatus `confirmed`, dengan tombol aksi:
  `Mulai Masak (cooking)` → `Siap Saji (ready)`.
- **Akun Demo Pre-Production**: `dapur@demo.tepisawah.id` (Sandi: `demo1234`).

---

## 3. Kompatibilitas Mundur Database (Backward Compatibility)

- Tipe enum dan tabel peran di database (`roles.code`) tetap mempertahankan nama peran legacy agar tidak merusak data historis atau migrasi skema yang sudah ada.
- Pada lapisan izin aplikasi (`@tepisawah/permissions`), pemetaan peran `waiter` dianggap sebagai alias/bagian dari grup operasional `cashier`, dan peran `supervisor` & `admin` dianggap sebagai alias dari grup `owner`.
- Pada portal login staf dan switcher akun demo, hanya 3 akun kanonikal yang disajikan kepada pengguna.

---

## 4. Konsekuensi & Keuntungan

1. **Efisiensi Pengguna**: Staf tidak perlu sering berganti akun (*switch account*) di perangkat kasir/tablet.
2. **Kejelasan Tanggung Jawab**: 1 akun untuk pengambil keputusan (Owner), 1 akun untuk garda depan resto (Kasir & Meja), 1 akun untuk produksi makanan (Dapur).
3. **Kemudahan Onboarding**: Presentasi ke klien/pemilik resto menjadi jauh lebih intuitif dan fokus.
