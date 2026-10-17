# CATATAN RILIS & PANDUAN OPERASIONAL PRODUKSI v1.3
## TEPI SAWAH RESTO & CAFE: PLATFORM DIGITAL TERPADU

**Versi**: 1.3 (Staff Username Authentication, Rate-Limit Elimination, & Ledger Snapshot Fix)  
**Tanggal Rilis**: 17 Oktober 2026  
**Status Audit Mutu**: PASS (17 Paket Workspace Typecheck 0 Error, Vitest 100% Pass [474 tes], Vite Production Build Pass)  
**Target Lingkungan**: Production (`tepisawah.id`, `order.tepisawah.id`, `staff.tepisawah.id`, Supabase Cloud)

---

## 1. Ringkasan Eksekutif Rilis v1.3

Rilis v1.3 menghadirkan pembaruan sistem otentikasi staf, peningkatan keandalan basis data, dan perlindungan domain produksi:
1. **Otentikasi Staf Berbasis Username & Kata Sandi**:
   - Seluruh staf operasional (Kasir, Pelayan, Dapur KDS, Supervisor) kini didaftarkan dan masuk ke sistem murni menggunakan **Username & Password** (contoh: `kasir1`, `koki_eko`, `waiter_siti`).
   - Tidak ada lagi kewajiban memasukkan alamat email pribadi staf operasional.
   - Khusus akun eksekutif manajemen (Administrator & Owner), email resmi (`admin@tepisawah.id`) tetap diwajibkan untuk keperluan pemulihan akun dan notifikasi audit sistem.
2. **Penyelesaian Tuntas Masalah Email Rate Limit**:
   - Menambahkan fungsi PostgreSQL `admin_create_staff` (SECURITY DEFINER) pada skrip `supabase/scripts/fix-staff-roles-and-management.sql`.
   - Fungsi ini mendaftarkan akun staf langsung ke tabel otentikasi dengan status `email_confirmed_at = now()` dan kata sandi terenkripsi `pgcrypto`, sehingga bebas dari batasan pengiriman email Supabase.
3. **Perbaikan Kueri Buku Kas Transaksi (PostgREST Schema Alignment)**:
   - Menyelaraskan kueri PostgREST dan pemetaan data di `TransactionsLedgerPage.tsx` ke kolom snapshot historis yang aktif (`product_name_snapshot`, `unit_price_snapshot`, `line_total`), meniadakan pesan peringatan kolom basis data.
4. **Proteksi Domain Produksi Mode Demo & Pembaruan Service Worker**:
   - Menambahkan filter pengaman domain di `packages/config/src/demo.ts` sehingga mode demo tidak akan pernah muncul di domain produksi.
   - Memperbarui versi cache Service Worker pada aplikasi staf (`apps/staff/public/sw.js`) menjadi `tepisawah-staff-v1.0.1`.

---

## 2. Rincian Perubahan Teknis

### A. Alur Pendaftaran & Masuk Staf

* **Halaman Kelola Staf (`StaffPage.tsx`)**:
  - Modal tambah staf baru kini memprioritaskan pemilihan tugas operasional terlebih dahulu.
  - Field **Username Akun Staf** wajib diisi menggunakan kombinasi huruf kecil, angka, atau garis bawah.
  - Field **Email Resmi Admin / Pemilik Resto** otomatis muncul hanya jika peran Administrator atau Owner dipilih.
  - Tabel staf desktop dan kartu staf mobile menampilkan pengenal `@<username>` di bawah nama staf.
* **Panel Masuk Portal Staf (`LoginPanel.tsx`)**:
  - Label masukan diubah menjadi `Username atau Email`.
  - Jika staf mengetikkan username tanpa tanda `@`, sistem otomatis memetakan ke kredensial staf internal.
  - Menyediakan fallback pencarian email resmi jika akun manajemen masuk menggunakan username `admin`.

### B. Basis Data & Fungsi PostgreSQL

* **Kolom Username pada Profil**:
  - Menambahkan kolom `username text` dengan indeks unik `idx_profiles_username` pada tabel `public.profiles`.
  - Memperbarui trigger otomatis `public.handle_new_user()` agar mengekstrak metadata `username`.
* **Fungsi RPC `public.admin_create_staff`**:
  - Parameter: `(p_username, p_password, p_display_name, p_phone, p_role_codes, p_email)`.
  - Memvalidasi wewenang eksekutif (`is_owner() OR is_admin()`).
  - Menyimpan akun ke `auth.users`, `public.profiles`, dan `public.user_roles` secara atomik dalam satu transaksi database.

### C. Buku Transaksi Pemilik (`TransactionsLedgerPage.tsx`)

* Menghubungkan relasi kueri `order_items` dengan nama kolom aktual:
  ```ts
  order_items(id, product_name_snapshot, unit_price_snapshot, quantity, line_total, notes)
  ```
* Seluruh item menu yang dipesan, harga satuan saat transaksi terjadi, dan subtotal baris kini terangkum rapi tanpa galat PostgREST.

---

## 3. Panduan Migrasi Basis Data di Supabase

Untuk menerapkan perubahan skema dan fungsi RPC ke Supabase Cloud:
1. Masuk ke **Supabase Dashboard** -> Proyek Tepi Sawah.
2. Buka menu **SQL Editor** -> Buat kueri baru (**New Query**).
3. Salin seluruh isi berkas `supabase/scripts/fix-staff-roles-and-management.sql`.
4. Jalankan kueri (**Run**).
5. Konfirmasi hasil eksekusi:
   - Kolom `username` berhasil ditambahkan ke `public.profiles`.
   - Fungsi `public.admin_create_staff` terpasang dengan hak eksekusi `authenticated`.
   - Singleton tabel `public.tax_settings` terinisialisasi.
6. Masuk ke menu **Authentication** -> **Providers** -> **Email**, lalu pastikan opsi **Confirm email** disetel ke **OFF** agar pembuatan akun staf operasional tidak pernah memicu pengiriman email.

---

## 4. Hasil Verifikasi Kualitas Monorepo

| Pemeriksaan Mutu | Perintah | Hasil | Status |
|---|---|---|---|
| TypeScript Typecheck | `pnpm -r run typecheck` | 17 paket workspace, 0 galat | PASS |
| Unit & Integration Tests | `pnpm run test` | 30 berkas tes, 474 tes lulus | PASS |
| Production Build Staff App | `pnpm --filter @tepisawah/staff run build` | Bundle terkompilasi bersih | PASS |
| Production Build Admin App | `pnpm --filter @tepisawah/admin run build` | Bundle terkompilasi bersih | PASS |
| Service Worker Cache Version | `apps/staff/public/sw.js` | Versi `tepisawah-staff-v1.0.1` | PASS |
