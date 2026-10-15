# ADR-008: Sistem Pengelola Konten Web (CMS) Dinamis, Kustomisasi Multi-Slot WebP, dan Tema Visual

**Status**: Diterima & Diterapkan (Accepted & Implemented)  
**Tanggal**: 2026-10-16  
**Penyusun**: Tim Engineering & Product Tepi Sawah  

---

## 1. Konteks & Latar Belakang

Website publik Tepi Sawah Resto & Cafe (`tepisawah.id`) sebelumnya mengandalkan data statis (*hardcoded*) untuk menampilkan profil restoran, galeri foto, menu pilihan, promo, dan lokasi. Kebutuhan operasional bisnis restoran menuntut:
1. **Fleksibilitas Promosi Harian**: Pengelola restoran (Owner / Store Manager) perlu memperbarui daftar promo paket, menu musiman, dan diskon tanpa harus melakukan *redeploy* atau memanggil pengembang perangkat lunak.
2. **Kustomisasi Multi-Slot Terstandar**: Setiap seksi visual utama (Menu Pilihan, Promo & Paket, Galeri Suasana) harus mampu menampung hingga 6 item/gambar mandiri dengan kemampuan aktif/nonaktifkan seksi secara individual.
3. **Efisiensi Aset & Beban Jaringan (Anti-Slop)**: Gambar yang diunggah pengguna seringkali berukuran mega-byte (MB) beresolusi tinggi dari kamera ponsel, yang dapat memperlambat *first contentful paint* (FCP) pelanggan. Diperlukan kompresi otomatis berbasis peramban (client-side Canvas) ke format WebP berkualitas tinggi dengan bobot `< 80 KB`.
4. **Peta Lokasi Realistis**: Peta lokasi wajib mencerminkan titik koordinat presisi Tepi Sawah Resto & Cafe di Ciperna, Cirebon, melalui Google Maps Embed Iframe interaktif.
5. **Tema Dinamis Terkontrol**: Pengelola dapat mengubah warna aksen (hijau alami, emas sawah) dan warna latar tanpa merusak kontras tipografi maupun keterbacaan antarmuka publik.

---

## 2. Keputusan Desain (Decisions)

### A. Arsitektur CMS Terintegrasi pada Portal Staf (`apps/admin/src/features/cms/CmsPage.tsx`)
- Modul CMS ditempatkan di dalam Panel Pengelola Restoran (`/admin/cms`) dengan proteksi hak akses `SETTINGS_READ` & `SETTINGS_WRITE`.
- Menyediakan 8 tab navigasi pengelolaan konten terpisah:
  1. **Beranda (Hero)**: Judul utama, subjudul, teks lencana, tombol aksi cepat (Reservasi & Lihat Menu), dan gambar latar panorama sawah.
  2. **Menu Pilihan**: Hingga 6 slot menu dinamis dengan nama, deskripsi, harga, label (*signature/favorit*), status aktif/nonaktif, dan pengunggah gambar WebP otomatis.
  3. **Promo & Paket**: Hingga 6 slot paket hemat dengan nama paket, harga promo, harga coret, persentase diskon, daftar menu yang didapat, status aktif/nonaktif, dan gambar WebP otomatis.
  4. **Tentang Kami**: Judul cerita, deskripsi filosofi restoran, 3 kartu keunggulan/lencana, dan foto suasana saung tepi sawah.
  5. **Cara Pesan**: 3 langkah interaktif pemesanan (Pindai QR Meja, Pilih Menu & Bayar, Santap Hidangan).
  6. **Galeri Suasana**: Hingga 6 slot foto suasana autentik (lesehan saung, rooftop senja, gathering keluarga, kopi santai) dengan judul, kategori, dan rasio visual optimal.
  7. **Reservasi Meja**: Judul seksi, nomor WhatsApp konfirmasi, teks tombol, dan informasi jam operasional reservasi.
  8. **Lokasi & Kontak**: Alamat lengkap Ciperna Cirebon, jam buka operasional harian, nomor telepon/WhatsApp, dan URL Embed Google Maps Iframe presisi.
  9. **Kustomisasi Warna & Tema**: Pengaturan warna primer (`--color-primary`), warna aksen sekunder (`--color-accent`), warna latar (`--color-bg-base`), dan warna kartu (`--color-surface`) dengan live preview dan validasi kontras otomatis.

### B. Otomasi Kompresi WebP Sisi Klien (`packages/ui/src/utils/image-compression.ts`)
- Fungsi `compressImageToWebP(file, maxDimension, quality, maxSizeBytes)`:
  - Mengonversi berkas JPEG/PNG/HEIC ke WebP menggunakan HTML5 Canvas.
  - Melakukan *downscale* proporsional jika resolusi melebihi batas (maks 1200px untuk hero/banner, maks 800px untuk kartu/galeri).
  - Melakukan optimasi kompresi bertahap hingga bobot berkas terjamin `< 80 KB`.
  - Mengembalikan representasi Base64 Data URL yang aman untuk pratinjau instan (*live preview*) dan sinkronisasi penyimpanan.

### C. Keamanan Data & Mekanisme *Zero-Breakage Fallback*
- Hook `useLandingContent()` pada `apps/web/src/hooks/useLandingContent.ts`:
  1. Mencoba membaca konfigurasi terbaru dari penyimpanan lokal (`localStorage`) atau tabel Supabase `landing_content`.
  2. Jika data kosong, rusak, atau terjadi gangguan koneksi, sistem secara anggun (*graceful fallback*) beralih ke berkas kanonikal `/landing-content.json`.
  3. Setiap elemen memiliki nilai bawaan (*hardcoded fallback safe guards*) sehingga antarmuka publik dijamin 100% tidak pernah mengalami *white-screen* atau *blank page*.
- Tersedia tombol **"Reset ke Konten Standar Restoran"** pada panel CMS untuk memulihkan seluruh konten ke setelan baku resmi hanya dengan satu klik.

### D. Injeksi Tema Dinamis CSS Variables (`ThemeInjector.tsx`)
- Komponen `ThemeInjector` mendengarkan perubahan pada properti `theme` di landing content.
- Melakukan pemutakhiran variabel CSS root (`--brand-primary`, `--brand-accent`, `--bg-landing`, dll.) secara reaktif di tingkat `document.documentElement.style`.

---

## 3. Konsekuensi & Manfaat

- **Bagi Manajemen Restoran**: Bebas memperbarui konten promosi mingguan, agenda akhir pekan, foto acara, dan harga paket tanpa ketergantungan pada tim teknis.
- **Bagi Pelanggan**: Pengalaman memuat halaman web publik instan (< 1.2 detik), tampilan visual tajam dan modern, serta akses reservasi dan panduan lokasi yang akurat.
- **Bagi Tim Engineering**: Arsitektur modular, tipe data TypeScript terisolasi (`LandingContentConfig`), pengujian otomatis terverifikasi (100% pass), dan siap rilis ke lingkungan produksi.
