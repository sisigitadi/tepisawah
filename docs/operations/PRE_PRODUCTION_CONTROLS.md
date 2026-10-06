# Standar Operasional & Kontrol Pre-Production (Pre-Production Governance)

Dokumen ini menetapkan kebijakan kendali mutu, version control, dan protokol perubahan (*change management*) untuk platform **Tepi Sawah Resto & POS**.

Karena platform telah dideploy ke infrastruktur live (Vercel & Supabase), seluruh ekosistem berada dalam status **Pre-Production**. Tidak diperbolehkan ada perubahan kode, skema, atau konfigurasi yang dilakukan tanpa melalui alur verifikasi resmi.

---

## 1. Arsitektur Lingkungan & Cabang Git

| Cabang / Tag | Lingkungan | Target URL | Kebijakan Akses |
|---|---|---|---|
| `main` | Production / Live Demo | `tepisawah.id`<br>`order.tepisawah.id`<br>`staff.tepisawah.id` | **Dilindungi (Protected)**. Push langsung diblokir. Wajib melalui Pull Request (PR) dengan review dan tes CI/CD hijau. |
| `feat/*` | Fitur Baru | Local dev / Vercel Preview | Dibuat dari `main`, diverifikasi lokal sebelum diajukan ke PR. |
| `fix/*` | Perbaikan Bug | Local dev / Vercel Preview | Dibuat dari `main`, memuat pengujian regresi. |
| `vX.Y.Z` | Release Tag | Production Build | Dibuat setiap rilis resmi dengan catatan changelog lengkap. |

---

## 2. Alur Kerja Kontrol Perubahan (Change Management Workflow)

Setiap perubahan di masa depan wajib mengikuti 5 langkah berikut:

```
[1. Issue / Task Request]
          ↓
[2. Cabang Kerja: feat/* atau fix/*]
          ↓
[3. Verifikasi Mutu Lokal (Typecheck + Tests)]
          ↓
[4. Pembaruan Dokumen (CHANGELOG + ADR jika ada)]
          ↓
[5. Pull Request → Review → CI Passing → Merge ke main]
```

### Aturan 1: Jangan Pernah Mengubah Kode Langsung di Server / Dashboard
- Dilarang mengedit file langsung di dashboard Vercel atau git `main`.
- Dilarang membuat tabel/kolom/kebijakan baru langsung di SQL Editor Supabase tanpa mencatat file migrasi berurut di folder `supabase/migrations/`.

### Aturan 2: Wajib Memperbarui Dokumen Terkait
Setiap Pull Request yang memuat perubahan fungsional atau arsitektur **WAJIB** memperbarui dokumen berikut:
1. `CHANGELOG.md` — Menuliskan detail perubahan di bawah versi aktif.
2. `docs/decisions/ADR-XXX.md` — Jika terdapat perubahan paradigma, penggabungan peran, perubahan gateway pembayaran, atau arsitektur data.
3. `docs/deployment/PRE_DEPLOYMENT_CHECKLIST.md` — Jika ada variabel lingkungan (*environment variables*) baru yang perlu disetel.

---

## 3. Protokol Verifikasi Pra-Deploy (Pre-Deploy Checklist)

Sebelum penggabungan (*merge*) ke `main` dan pemicuan rilis Vercel, pengembang wajib memastikan:

### A. Integritas Kode & Tipe Data
```bash
# 1. Pastikan tidak ada konflik tipe data TypeScript di seluruh monorepo
pnpm run typecheck

# 2. Jalankan seluruh unit & integration test
pnpm run test
```
*Kriteria Lolos: 0 kesalahan tipe data (type errors) dan 100% tes lulus (0 failed).*

### B. Validasi Tampilan & Responsivitas (UI/UX)
- Buka dan uji di 3 ukuran viewport standar:
  - **Mobile (360px - 414px)**: Pastikan tidak ada horizontal scrolling, teks tidak bertumpuk, tombol mudah ditekan (*touch target* minimal 44px).
  - **Tablet (768px - 1024px)**: Grid produk dan antrean pesanan tersusun rapi.
  - **Desktop (1280px+)**: Navigasi sidebar/header sejajar dan proporsional.
- Periksa aset media dan logo:
  - Favicon muncul di tab peramban.
  - Open Graph preview terbaca jelas saat link dibagikan di WhatsApp/Telegram.

### C. Konsistensi Hak Akses Pengguna (RBAC)
- Uji alur masuk (*login*) dengan 3 peran kanonikal:
  1. `owner@demo.tepisawah.id` (Akses ke Admin Console, Laporan Bisnis, POS, KDS, Layanan Meja).
  2. `kasir@demo.tepisawah.id` (Akses ke Terminal Kasir, Konfirmasi QR, Layanan Meja, Manual Order).
  3. `dapur@demo.tepisawah.id` (Akses khusus KDS).

### D. Keamanan & Variabel Lingkungan
- Pastikan tidak ada API Secret Key (`SUPABASE_SERVICE_ROLE_KEY`, password database, dll) yang ter-commit ke git repo publik.
- Variabel publik wajib menggunakan prefix `VITE_`.

---

## 4. Prosedur Penanganan Insiden & Rollback (Rollback Protocol)

Jika setelah deployment terjadi kegagalan atau gangguan operasional pada salah satu aplikasi:
1. **Rollback Instan via Vercel**:
   - Masuk ke dashboard project Vercel yang terdampak.
   - Buka tab **Deployments**.
   - Temukan deployment stabil sebelumnya dan klik tombol **Instant Rollback**.
2. **Revert Git**:
   - Jalankan `git revert HEAD` pada branch baru, buka PR darurat (*hotfix*), dan merge ke `main`.
3. **Penyelamatan Database**:
   - Jika migrasi database bermasalah, jalankan skrip *down-migration* atau kembalikan data dari backup harian Supabase (*Point-in-Time Recovery*).
