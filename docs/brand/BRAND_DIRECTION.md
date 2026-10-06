# Tepi Sawah Resto & Cafe — Brand Direction v2.0

## 1. Identitas Produk & Domain Publik
- **Nama Usaha**: Tepi Sawah Resto & Cafe
- **Lokasi**: Ciperna, Cirebon, Jawa Barat
- **Domain Utama**: `https://tepisawah.id` (Kanonikal: `https://www.tepisawah.id`)
- **Pemesanan Mandiri Pelanggan (QR Meja)**: `https://order.tepisawah.id`
- **Portal Terpadu Staf Restoran**: `https://staff.tepisawah.id`

---

## 2. Aset Visual Resmi & Spesifikasi

### A. Logo Resmi
- **Simbol Utama**: Lingkaran bulir padi emas (*golden rice stalk*) membingkai siluet cangkir kopi mengepul beraksen cokelat hangat.
- **Tipografi Merek**: Tulisan kaligrafi elegan "Tepi Sawah" dan sub-judul "RESTO & CAFE".
- **Format**: File `logo.png` transparan berkualitas tinggi, tersedia seragam pada seluruh direktori publik aplikasi (`apps/web/public/`, `apps/order/public/`, `apps/staff/public/`).
- **Penggunaan**:
  - Header utama website dan portal pemesanan meja.
  - Gerbang validasi pemindai QR meja (`QrGatekeeperPage`).
  - Header portal staf dan struk pembayaran.

### B. Favicon & App Icon
- **Latar Belakang**: Hijau zamrud pekat (`#14301c`) dengan ornamen lingkaran padi emas.
- **Varian**:
  - `favicon.svg`: Format vektor tajam untuk layar beresolusi tinggi (*Retina display*).
  - `favicon.png`: Format PNG 32×32 untuk peramban desktop standar.
  - `apple-touch-icon.png`: Format PNG 180×180 untuk pintasan layar utama iOS / Android.

### C. Banner Pratinjau Media Sosial (Open Graph / Twitter Card)
- **Spesifikasi Berkas**:
  - Format: `og-image.jpg` (JPEG terkompresi tinggi, bobot ~151 KB).
  - Dimensi: 1200 × 630 piksel (rasio aspek 16:9).
  - Kompatibilitas: WhatsApp, Telegram, Facebook, Twitter (X), LinkedIn.
- **Komposisi Visual**:
  - Latar belakang foto sawah terasering asri dengan kabut pagi pegunungan.
  - Kartu logo resmi Tepi Sawah di sisi kiri dengan efek bayangan lembut.
  - Tipografi judul kontras tinggi "Tepi Sawah — Resto & Cafe | Ciperna, Cirebon".
  - Sub-judul fitur: Saung Tradisional, Gazebo Keluarga, Kopi Istimewa, dan Pemesanan QR Mandiri.
- **Kaidah Kanonikal**:
  - Seluruh tag `og:image` wajib menggunakan URL mutlak langsung tanpa pengalihan redirect: `https://www.tepisawah.id/og-image.jpg`.

---

## 3. Palet Warna Resmi (Brand Color Palette)

| Nama Warna | Kode Hex | Penggunaan Utama |
|---|---|---|
| **Deep Forest Moss** | `#183a1d` | Warna primer header, tombol aksi utama, navbar |
| **Paddy Green** | `#2e6b34` | Aksen hijau daun, badge status aktif, badge meja kosong |
| **Golden Amber** | `#dda15e` | Aksen bulir padi, highlight status siap saji, garis batas mewah |
| **Warm Amber Gold** | `#f3c644` | Tombol panggilan pelayan, tombol peringatan |
| **Warm Cream** | `#faf7ee` | Latar belakang utama seluruh aplikasi (pengganti putih steril) |
| **Rice Paper** | `#f8f4db` | Latar belakang kartu, form input, drawer keranjang |
| **Roasted Coffee** | `#2b1f17` | Teks utama, judul, angka nominal |
| **Muted Clay** | `#78716c` | Teks sekunder, deskripsi menu, timestamp waktu |

---

## 4. Kebijakan Bahasa & Gaya Komunikasi (Language Policy)

- **100% Bahasa Indonesia**: Seluruh teks yang tampil pada antarmuka pengguna (tamu maupun staf) wajib menggunakan Bahasa Indonesia yang wajar, santun, dan mudah dipahami.
- Hindari istilah teknis bahasa Inggris:
  - Gunakan **"Layar Pesanan Dapur"** bukan *Kitchen Display System (KDS)*.
  - Gunakan **"Meja Kasir & Pembayaran"** bukan *Cashier POS*.
  - Gunakan **"Layanan Meja & Antar"** bukan *Waiter Handheld*.
  - Gunakan **"Satu Tagihan / Pisah Menu / Bagi Rata"** bukan *Single Bill / Split Item / Custom Pax*.
  - Gunakan **"Nominal Uang Tunai Diterima"** bukan *Tendered*.
  - Gunakan **"Alur Pesanan"** bukan *Order Pipeline*.
