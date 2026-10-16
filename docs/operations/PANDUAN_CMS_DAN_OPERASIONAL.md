# PANDUAN PENGGUNAAN CMS & MANAJEMEN OPERASIONAL STAF
## TEPI SAWAH RESTO & CAFE — SISTEM PRODUKSI

**Versi**: 1.0 (Produksi)  
**Pembaruan Terakhir**: 16 Oktober 2026  
**Sasaran Pengguna**: Pemilik Restoran (*Owner*), Pengelola Toko (*Store Manager*), Supervisor, dan Staf Operasional  

---

## 1. Akses Portal & Masuk Sistem

Platform digital Tepi Sawah Resto & Cafe memisahkan antarmuka menjadi tiga portal utama:
1. **Website Publik**: `https://www.tepisawah.id` (Profil resto, menu, promo, reservasi, lokasi).
2. **Pemesanan Mandiri Tamu**: `https://order.tepisawah.id` (Akses scan QR meja langsung).
3. **Portal Staf Terpadu**: `https://staff.tepisawah.id` (Akses kasir POS, dapur, pelayan, dan CMS pengelola).

### Langkah Masuk Portal Pengelola:
1. Buka peramban (disarankan Google Chrome, Microsoft Edge, atau Safari versi terbaru) dan kunjungi:
   ```text
   https://staff.tepisawah.id
   ```
2. Masukkan email resmi dan kata sandi akun berwenang (*Owner* atau *Store Manager*).
3. Setelah berhasil masuk, Anda akan diarahkan ke layar **Portal Staf**. Klik menu **"Panel Pengelola Restoran"** atau akses langsung URL:
   ```text
   https://staff.tepisawah.id/admin/cms
   ```

---

## 2. Fitur Pengelola Konten Web (CMS)

Modul CMS dirancang dengan prinsip *zero-code* dan antarmuka ramah pengguna. Setiap perubahan langsung disimpan ke basis data dan dapat dipratinjau secara langsung (*Live Preview*).

### A. Seksi 1: Beranda (Hero Banner)
- **Fungsi**: Mengubah tampilan visual pertama yang dilihat pengunjung saat membuka website.
- **Pengaturan yang Tersedia**:
  - **Lencana Unggulan**: Teks kecil pemikat di atas judul (contoh: *"Kuliner Sunda Autentik & Nuansa Alami"*).
  - **Judul Utama**: Judul besar selamat datang (contoh: *"Kelezatan Khas Nusantara di Tengah Hamparan Sawah"*).
  - **Subjudul / Deskripsi**: Penjelasan singkat suasana saung, pemandangan senja, dan cita rasa masakan.
  - **Teks Tombol Aksi (CTA)**: Tombol "Reservasi Meja" dan "Lihat Menu Digital".
  - **Gambar Latar Panorama**: Unggah foto lanskap sawah beresolusi tinggi. Sistem otomatis mengompresi gambar ke format WebP berkualitas prima tanpa membuat situs lambat.

---

### B. Seksi 2: Menu Pilihan (Hingga 6 Slot Dinamis)
- **Fungsi**: Menyoroti menu-menu andalan restoran (misal: Gurame Bakar Cobek, Ayam Roaster Sawah, Kopi Senja, Bebek Goreng Kremes).
- **Kapasitas**: Tersedia **6 Slot Menu Mandiri**.
- **Fitur Tiap Slot**:
  1. **Unggah Foto WebP Otomatis**: Klik tombol "Pilih Gambar" untuk mengunggah foto makanan/minuman dari galeri ponsel atau laptop. Sistem otomatis mengubahnya ke WebP `< 80 KB`.
  2. **Nama Menu**: Judul hidangan.
  3. **Kategori Menu**: Tag kategori (Makanan Utama, Minuman, Camilan).
  4. **Harga**: Format Rupiah resmi (misal: `Rp 85.000`).
  5. **Deskripsi Singkat**: Komposisi hidangan, bumbu khas, atau keunggulan rasa.
  6. **Lencana Khusus**: Label penanda seperti *"Favorit"*, *"Spesial"*, atau *"Wajib Coba"*.
  7. **Status Tampil**: Tombol switch aktif/nonaktif untuk menyembunyikan menu yang sedang kosong (*sold out*) tanpa menghapus datanya.

---

### C. Seksi 3: Promo & Paket Hemat (Hingga 6 Slot Dinamis)
- **Fungsi**: Menampilkan paket makan keluarga, promo rombongan, atau paket arisan/gathering.
- **Kapasitas**: Tersedia **6 Slot Paket Mandiri**.
- **Fitur Tiap Slot**:
  1. **Unggah Foto Paket**: Gambar hidangan lengkap paket yang otomatis dikonversi ke WebP.
  2. **Nama Paket**: Judul promosi (contoh: *"Paket Liwet Komplit 4 Orang"*, *"Paket Gathering Bahagia"*).
  3. **Persentase Diskon / Badge**: Label penghematan (contoh: *"Hemat 20%"*, *"Best Deal"*).
  4. **Harga Promo & Harga Coret**: Menampilkan perbandingan harga asli vs harga hemat.
  5. **Daftar Menu Inklusi**: Rincian hidangan yang didapat pelanggan dalam paket.
  6. **Periode Berlaku**: Keterangan masa berlaku (contoh: *"Berlaku Setiap Hari"*).

---

### D. Seksi 4: Tentang Kami (Kisah & Filosofi)
- **Fungsi**: Mengenalkan filosofi Tepi Sawah Resto & Cafe, kenyamanan saung lesehan, dan komitmen bahan pangan segar.
- **Pengaturan**:
  - Judul kisah & paragraf narasi filosofi kuliner.
  - 3 Kartu Keunggulan Resto (contoh: *Bahan Alami Pilihan*, *Suasana Santai & Asri*, *Pelayanan Ramah & Hangat*).
  - Unggah foto saung lesehan dan suasana alam.

---

### E. Seksi 5: Panduan Cara Pesan
- **Fungsi**: Edukasi tamu agar dapat memesan secara mandiri melalui QR code meja.
- **Pengaturan**:
  - Langkah 1: Pindai QR di meja saung.
  - Langkah 2: Pilih hidangan favorit & sesuaikan level pedas/topping.
  - Langkah 3: Pesanan langsung diteruskan ke dapur dan kasir secara real-time.

---

### F. Seksi 6: Galeri Suasana (Hingga 6 Foto WebP)
- **Fungsi**: Etalase visual sudut-sudut terbaik restoran (Rooftop Senja, Saung Tepi Kolam, Area Bermain Anak, Lesehan Tradisional).
- **Fitur**:
  - 6 slot foto yang dapat diganti kapan saja.
  - Judul foto dan keterangan kategori suasana.
  - Kompresi instan ke format WebP proporsional 4:3 / 16:9.

---

### G. Seksi 7: Reservasi Meja & Acara
- **Fungsi**: Mengelola alur pemesanan meja dan acara rombongan tamu.
- **Pengaturan**:
  - Nomor WhatsApp resmi admin reservasi.
  - Teks petunjuk syarat & ketentuan reservasi.
  - Form reservasi online yang terhubung ke database dan mengirim pesan konfirmasi otomatis ke WhatsApp restoran.

---

### H. Seksi 8: Lokasi, Peta Real & Jam Buka
- **Fungsi**: Memberikan kepastian titik temu dan jam buka restoran bagi calon pengunjung.
- **Pengaturan**:
  - **Alamat Lengkap**: Jl. Raya Ciperna, Kec. Talun, Kabupaten Cirebon, Jawa Barat 45171.
  - **Google Maps Embed URL**: Tautan Iframe peta resmi Google Maps yang menampilkan koordinat dan rute akurat.
  - **Jam Buka Harian**: Jadwal operasional (misal: *Senin – Minggu: 10.00 – 22.00 WIB*).
  - **Indikator Real-time**: Label status buka/tutup otomatis sesuai waktu lokal saat ini.

---

### I. Kustomisasi Warna, Latar Belakang & Tema
- **Fungsi**: Mengubah atmosfer estetika website secara elegan tanpa bantuan desainer grafis.
- **Fitur**:
  - **Warna Primer**: Warna utama (default: Hijau Hutan Tepi Sawah `#14301c`).
  - **Warna Aksen**: Warna emas padi `#d4a373` atau oranye hangat.
  - **Warna Latar Belakang**: Krem hangat `#fbfbf9` atau putih bersih.
  - **Pemeriksa Kontras Otomatis (WCAG)**: Sistem akan memperingatkan jika kombinasi warna membuat teks sulit dibaca di bawah sinar matahari.
  - **Tombol Reset Bawaan**: Memulihkan seluruh palet warna ke identitas resmi Tepi Sawah dalam 1 detik.

---

## 3. Manajemen Staf & Operasional Soft Opening (Front of House Terpadu)

Untuk memaksimalkan efisiensi tenaga kerja dan menekan biaya operasional selama periode **Soft Opening**, portal staf telah disederhanakan menjadi **3 Pintu Operasional Utama** dengan penyatuan peran Kasir dan Pramusaji (*Waiter*) ke dalam satu meja kerja Front of House (FOH):

### 3 Pintu Operasional Utama:
1. **Kasir & Layanan Meja (Front of House — `/pos`)**:
   - **Peran Pengguna**: Kasir (`cashier`) dan Pramusaji (`waiter`).
   - **Tujuan**: Memungkinkan 1 atau 2 orang staf menangani seluruh alur lantai depan secara simultan tanpa berpindah aplikasi.
   - **4 Sub-Aksi Terpadu (Akses Cepat & Ramah Jempol Ponsel)**:
     1. **📥 Antrean Konfirmasi QR (`/pos?tab=confirm`)**: Memvalidasi dan menyetujui pesanan yang dikirim pelanggan dari meja lewat scan QR.
     2. **🍽️ Siap Antar ke Meja (`/pos?tab=serve`)**: Memantau hidangan matang dari dapur dan mencentang pesanan yang telah disajikan ke saung/meja pelanggan.
     3. **✍️ Catat Pesanan Meja (`/pos?tab=manual-order`)**: Membantu tamu yang ingin memesan langsung lewat pelayan di meja atau tamu tanpa smartphone.
     4. **💳 Meja Kasir & Bayar Tagihan (`/pos?tab=terminal`)**: Terminal kasir utama untuk memilih meja, melihat rincian tagihan, menerima pembayaran tunai/QRIS/kartu, dan mencetak struk resmi.
   - **Navigasi Ponsel (Bottom Navigation Bar)**: Pada layar HP atau tablet vertikal (< 768px), navigasi otomatis berpindah ke bilah bawah (*bottom bar*) ramah sentuhan jempol dengan target sentuh min 48px.

2. **Dapur & Bar Minuman (Back of House / KDS — `/kitchen`)**:
   - **Peran Pengguna**: Koki Dapur (`kitchen`).
   - **Tujuan**: Layar sentuh dapur untuk melihat tiket pesanan masuk secara real-time, timer durasi memasak, dan tombol "Selesai Masak" untuk memberi sinyal ke pelayan FOH.

3. **Panel Pengelola & Pemilik (Admin / Owner — `/admin`)**:
   - **Peran Pengguna**: Pemilik Resto (`owner`) dan Manajer Toko (`manager`).
   - **Tujuan**: Laporan ringkasan penjualan, analitik omset, kelola katalog & harga menu, kelola QR meja & denah saung, pengelolaan reservasi acara, dan Pengelola Konten Web (CMS).

### Kesiapan Lingkungan Produksi Penuh (*Production-Ready*):
- **Bebas Mode Demo**: Seluruh pemilih peran demo (*role switcher*), pengisi kredensial otomatis demo, dan tombol cepat demo telah dibersihkan secara permanen dari antarmuka login dan header.
- **Login Resmi**: Seluruh staf masuk menggunakan email dan kata sandi resmi yang telah didaftarkan oleh Admin/Owner di menu `/admin/staff`.

### Prosedur Tambah Staf Baru:
1. Masuk ke Panel Pengelola Restoran (`/admin`).
2. Buka menu **"Kelola Staf"** (`/admin/staff`).
3. Klik **"Tambah Staf Baru"**, masukkan nama lengkap, email resmi, peran yang ditugaskan (`cashier`, `waiter`, `kitchen`, `manager`, atau `owner`), dan PIN operasional kasir.
4. Simpan. Staf yang bersangkutan dapat langsung masuk menggunakan kredensial tersebut di ponsel maupun perangkat POS resto.


---

## 4. Tips Mengambil & Mengunggah Foto untuk CMS

Agar tampilan website selalu terlihat mewah, profesional, dan menggugah selera:
1. **Pencahayaan Alami**: Ambil foto makanan di dekat jendela atau saung terbuka pada pagi atau sore hari (*golden hour*).
2. **Sudut Pengambilan Gambar**:
   - Untuk hidangan berkuah/cobek: Sudut 45 derajat.
   - Untuk paket liwet komplit: Sudut atas (*flat lay* / 90 derajat).
   - Untuk suasana resto: Sudut horizontal mata memandang (*eye level*) memperlihatkan saung dan sawah.
3. **Kamera Ponsel**: Bersihkan lensa kamera sebelum memotret. Anda tidak perlu mengecilkan resolusi secara manual; peramban Tepi Sawah akan memproses dan mengompresinya secara otomatis.
