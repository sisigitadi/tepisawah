# CATATAN RILIS PRODUKSI & DOKUMENTASI DEPLOYMENT (v1.1)
## Perbaikan Ambiguous RPC Overloading & Resolusi Thermal Receipt Printing

**Tanggal Rilis**: 17 Oktober 2026  
**Target Lingkungan**: Staging & Production (`staff.tepisawah.id`, `order.tepisawah.id`, `tepisawah.id`)  
**Status Verifikasi**: 491/491 Unit Tests Passed | 17/17 Typecheck Packages Passed | Build Integrity Verified  

---

## 1. Ringkasan Perubahan

Rilis ini menyelesaikan 3 masalah krusial operasional kasir dan konfirmasi pesanan:
1. **Konfirmasi Pesanan (RPC `transition_order`)**: Mengatasi error ambigu PostgreSQL akibat duplikasi signature fungsi dengan parameter `bigint` vs `integer`.
2. **Buka Laci Kasir (RPC `open_cash_shift`)**: Mengatasi error kolom `column "full_name" does not exist` (diselaraskan ke `display_name`) serta resolusi duplikasi parameter overload.
3. **Cetak Struk Kasir (Thermal Receipt Printing)**: Mengatasi masalah pratinjau dan kertas cetak keluar kosong pada printer thermal 58mm & 80mm.

---

## 2. Rincian Teknis & Akar Masalah

### A. Ambiguous Function Overload: `transition_order`
- **Gejala**: Saat kasir/staf mengonfirmasi pesanan masuk dari antrean, muncul pesan:
  `Could not choose the best candidate function between: public.transition_order(p_order_id => uuid, p_to_status => text, p_expected_version => integer, p_reason => text), public.transition_order(p_order_id => uuid, p_to_status => text, p_reason => text, p_expected_version => bigint)`
- **Akar Masalah**: Dua migrasi terpisah mendaftarkan `transition_order` dengan tipe data versi berbeda (`bigint` dan `integer`). PostgreSQL tidak dapat menentukan kandidat fungsi terbaik saat pemanggilan via Supabase RPC.
- **Solusi**:
  - Dibuat script migrasi `supabase/scripts/fix-transition-order-overload.sql` yang melakukan `DROP FUNCTION IF EXISTS` pada signature usang dan mendefinisikan signature tunggal kanonikal dengan parameter `p_expected_version bigint DEFAULT NULL`.
  - Pembaruan berkas skema di `supabase/migrations/010_order_status_history/006_transition_order.sql` dan `apply-schema.sql`.

### B. Buka Laci Kasir: `column "full_name" does not exist` & Overload `open_cash_shift`
- **Gejala**: Tombol "Buka Kasir" menghasilkan pesan `column "full_name" does not exist` dan ambigu fungsi `(p_shift_name => text, p_starting_cash => numeric)` vs `(p_starting_cash => numeric, p_shift_name => text)`.
- **Akar Masalah**: Tabel `profiles` di Supabase menggunakan kolom `display_name`, bukan `full_name`. Selain itu, terdapat fungsi lama dengan urutan parameter terbalik.
- **Solusi**:
  - Script `supabase/scripts/add-cash-drawer-void-and-settings-sync.sql` diperbarui:
    - Menghapus kedua versi lama fungsi `open_cash_shift`.
    - Mengambil nama staf kasir dari `profiles.display_name` (dengan fallback `auth.users.email`).
    - Menetapkan signature kanonikal tunggal `open_cash_shift(p_starting_cash numeric, p_shift_name text DEFAULT 'Shift Pagi/Siang')`.

### C. Struk Thermal Menghasilkan Kertas Kosong
- **Gejala**: Kasir menekan "Cetak Struk" atau "Cetak Ulang Struk", namun browser print preview menampilkan halaman kosong (blank paper).
- **Akar Masalah**:
  1. **Tab Riwayat (`filter === "history"`)**: Komponen `ThermalSlip` sebelumnya berada di dalam `<PaymentExecution>`, padahal panel tersebut di-unmount pada tab riwayat (karena pesanan sudah lunas). Akibatnya, saat kasir mencetak salinan dari riwayat, elemen struk sama sekali tidak ada di dalam DOM HTML.
  2. **Global Print Hiding pada CSS Admin**: Berkas `apps/admin/src/styles/index.css` memiliki aturan `@media print { body * { visibility: hidden; } }` yang diimpor terakhir pada `apps/staff/src/main.tsx`. Aturan ini membuat seluruh DOM di halaman Kasir menjadi tidak terlihat saat dicetak.
  3. **Viewport Container Clipping**: Elemen pembungkus `.app-shell` dan `.app-main` pada portal staf memiliki `overflow: hidden; height: 100vh;` yang memotong elemen anak saat dicetak.
  4. **Kontras Tinta Thermal**: Garis putus-putus dan watermark menggunakan warna abu-abu tipis (`#cbd5e1`) yang pudar di head printer thermal.
- **Solusi**:
  - Dibuat komponen terpisah `apps/pos/src/features/terminal/ThermalSlip.tsx` yang mendukung ukuran roll 58mm dan 80mm serta menampilkan watermark status akurat (`*** LUNAS ***`, `*** BILL TAGIHAN SEMENTARA ***`, `*** SALINAN NOTA / REPRINT ***`).
  - Di `apps/pos/src/pages/HomePage.tsx`:
    - Kolom ke-3 pada tab Riwayat kini merender pratinjau struk thermal riwayat secara langsung.
    - Ditambahkan callback `handlePrintReceipt` dengan penundaan micro-buffer (60ms) agar DOM React ter-render sebelum memicu native `window.print()`.
  - Di `apps/admin/src/styles/index.css`:
    - Aturan `body * { visibility: hidden; }` dihapus dan diisolasi dengan `:has()` hanya untuk pencetakan stiker QR meja admin.
  - Dibuat berkas resolusi cetak terpadu `apps/staff/src/styles/print.css`:
    - Diimpor paling akhir di `apps/staff/src/main.tsx` untuk menjamin prioritas CSS cascade tertinggi.
    - Menetapkan `.pos-thermal__paper` dan seluruh isinya `visibility: visible !important; opacity: 1 !important; color: #000 !important;`.
    - Mengatur ukuran `@page { size: auto; margin: 0; }` agar sesuai dengan continuous roll thermal paper.

---

## 3. Matriks Pengujian & Verifikasi Mutu

| Kategori Pengujian | Perintah | Hasil | Status |
|---|---|---|---|
| Monorepo Typecheck | `pnpm -r run typecheck` | 17 paket TypeScript lolos 0 error | PASS |
| Unit Test Suite | `pnpm test` | 491 tests passed (0 fail) across all packages | PASS |
| Database Queries Test | `vitest run` di `packages/database` | 278 tests passed (11 files) | PASS |
| Production Build | `pnpm run build` | 7 aplikasi & 10 paket terkompilasi | PASS |
| Build Artifact Verification | `node scripts/verify-build.mjs` | Semua output `dist/` valid | PASS |
| Live DOM Thermal Slip Test | Browser Subagent Emulation | `.pos-thermal__paper` tampil presisi | PASS |

---

## 4. Panduan Eksekusi Deployment

### Langkah 1: Eksekusi SQL di Supabase (Database Backend)
Buka **Supabase Dashboard** -> **SQL Editor**, lalu jalankan berkas SQL perbaikan:
1. `supabase/scripts/fix-transition-order-overload.sql`
2. `supabase/scripts/add-cash-drawer-void-and-settings-sync.sql`

*(Kedua script bersifat idempoten dan aman dieksekusi berulang kali tanpa risiko kehilangan data)*.

### Langkah 2: Git Commit & Push
Commit seluruh perubahan yang telah diverifikasi:
```bash
git add .
git commit -m "fix(pos): resolve thermal receipt print blank paper and postgresql rpc overloads"
git push origin main
```

### Langkah 3: Verifikasi Deployment Vercel
Vercel akan otomatis mendeteksi perubahan pada branch `main` dan memperbarui:
- `staff.tepisawah.id` (Portal Staf: POS, Dapur, Waiter, Admin)
- `order.tepisawah.id` (Customer QR Ordering)
- `tepisawah.id` (Landing Page)
