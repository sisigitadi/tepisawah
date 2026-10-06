# ADR-007: Audit Penyelarasan Merek, Open Graph Kanonikal, Routing Staf & Lokalisasi Bahasa Indonesia

**Status**: Diterima & Diterapkan (Accepted & Implemented)  
**Tanggal**: 2026-10-06  
**Penyusun**: Tim Engineering & Product Tepi Sawah  

---

## 1. Konteks & Latar Belakang

Setelah deployment pre-production platform Tepi Sawah (`tepisawah.id`, `order.tepisawah.id`, dan `staff.tepisawah.id`), audit menyeluruh menemukan beberapa ketidaksesuaian kritis:
1. **Kegagalan Pratinjau Sosial (Open Graph)** pada `tepisawah.id`: WhatsApp, Telegram, dan media sosial lainnya tidak memunculkan kartu pratinjau gambar saat link `tepisawah.id` dibagikan. Hal ini disebabkan oleh *308 Permanent Redirect* otomatis dari Vercel (apex ke `www.tepisawah.id`), yang tidak diikuti oleh scraper media sosial saat mengunduh gambar.
2. **Inkonsistensi Logo pada Customer Ordering (`order.tepisawah.id`)**: Header dan gerbang QR masih menggunakan emoji generik `🌾` dan kamera `📷`, bukan logo resmi otentik Tepi Sawah.
3. **Stale View pada Pergantian Peran Staf (`staff.tepisawah.id`)**: Ketika pengguna keluar (*sign out*) dari rute internal (seperti `/admin`), kemudian masuk kembali dengan peran berbeda (seperti `cashier`), aplikasi tetap berada pada rute sebelumnya tanpa menyegarkan antarmuka ke peran yang baru dipilih.
4. **Penggunaan Bahasa Inggris pada Antarmuka Pengguna**: Sebagian istilah teknis ("Staff Portal", "Dashboard Overview", "Payment Terminal", "KDS", "Split Item", "Tendered", dll.) masih berbahasa Inggris, menyulitkan staf dan manajemen lokal.
5. **Ketidakselarasan Tema**: Beberapa halaman internal (seperti panel admin) masih menggunakan warna netral abu-abu dingin yang tidak selaras dengan identitas alami Tepi Sawah.

---

## 2. Keputusan Desain (Decisions)

### A. Penanganan Open Graph Kanonikal Langsung (Direct Canonical URL)
- Mengarahkan `og:url`, `og:image`, `og:image:secure_url`, dan `twitter:image` pada `apps/web/index.html` secara mutlak ke `https://www.tepisawah.id/og-image.jpg`.
- Menambahkan tag `<link rel="canonical" href="https://www.tepisawah.id/" />`.
- Menstandarkan berkas `og-image.jpg`: rasio 16:9 (1200×630 piksel), format JPEG terkompresi (< 300KB), latar lanskap sawah terasering dengan kartu logo emas resmi dan tipografi kontras tinggi.

### B. Standardisasi Logo Resmi Lintas Aplikasi
- Seluruh aplikasi web publik, portal order, dan portal staf wajib menggunakan berkas gambar logo resmi:
  - Header aplikasi order menggunakan `<img src="/logo.png" className="order-brand-logo" alt="Tepi Sawah" />`.
  - Halaman gerbang QR (`QrGatekeeperPage`) menggunakan emblem logo resmi dengan animasi *pulse ring*.
- Favicon seragam: format SVG (`favicon.svg`) dan PNG multi-resolusi (`favicon.png`, `apple-touch-icon.png`) berlatar hijau zamrud `#14301c`.

### C. Proteksi Rute Staf & Eliminasi Tampilan Tertinggal (*Stale View*)
- Router staf (`apps/staff/src/app/router/index.tsx`) memantau `user.id` dan hak akses ruangan (`allowedRooms`):
  - Jika peran atau pengguna berganti dan ruangan aktif tidak diizinkan, router otomatis me-redirect ke `"portal"` (`/`).
  - Ruangan admin diproteksi secara deklaratif menggunakan `PermissionRoute` dengan izin `SETTINGS_READ`.
- Tombol "Keluar" (`signOut`) pada header staf otomatis memindahkan URL peramban ke `/` sebelum menghapus sesi Supabase Auth.
- Disediakan pemilih peran demo instan pada header dan beranda portal untuk demonstrasi mulus tanpa friksi logout.

### D. Standardisasi Bahasa Indonesia yang Natural & Umum
- Ditetapkan kebijakan **100% Bahasa Indonesia** untuk seluruh antarmuka pengguna:
  - *Staff Portal* → **Portal Staf**
  - *Staff Login* → **Portal Staf — Masuk**
  - *Owner & Admin Console* → **Panel Pengelola Restoran**
  - *Cashier POS & Payment* → **Meja Kasir & Pembayaran**
  - *Kitchen Display (KDS)* → **Layar Pesanan Dapur**
  - *Waiter Handheld* → **Layanan Meja & Antar**
  - *Dashboard Overview* → **Ringkasan Operasional Resto**
  - *Orders Pipeline* → **Alur Pesanan**
  - *Table Layout* → **Tata Letak Meja**
  - *Daily Reports* → **Laporan Harian**
  - *Transaction History* → **Riwayat Transaksi**
  - *Shift & Cash* → **Kas & Giliran Kerja**
  - *Single Bill / Split Item / Custom Pax* → **Satu Tagihan / Pisah Menu / Bagi Rata**
  - *Tendered* → **Nominal Uang Tunai Diterima**
  - *Change* → **Kembalian**
  - *Total Unpaid* → **Total Belum Dibayar**

### E. Penyelarasan Tema Visual Tepi Sawah
- Menerapkan palet warna alami Tepi Sawah pada seluruh aplikasi:
  - Latar belakang: *Warm Cream* (`#faf7ee`) dan *Rice Paper* (`#f8f4db`).
  - Batas kartu: Lembut alami (`#e6dec7`).
  - Teks utama: Kopi pekat (`#2b1f17`).
  - Aksen utama: Hijau lumut sawah (`#183a1d`) dan emas bulir padi (`#dda15e`).

---

## 3. Konsekuensi & Dampak

- **Positif**:
  - Tautan media sosial (WhatsApp/Telegram) menampilkan preview yang konsisten, jelas, dan profesional.
  - Pengalaman pelanggan saat memesan melalui QR meja terasa kohesif dengan merek resto.
  - Staf dan pemilik tidak lagi mengalami kendala salah tampilan saat beralih peran kerja.
  - Istilah operasional mudah dimengerti oleh staf lokal tanpa kebingungan bahasa.
- **Pengendalian Kualitas**:
  - Seluruh 474 unit & integration test dipelihara dan lulus 100%.
  - Seluruh 17 paket workspace lulus typecheck TypeScript.
