# STANDAR OPERASIONAL PROSEDUR (SOP) OPERATOR SISTEM
## TEPI SAWAH RESTO & CAFE — PLATFORM DIGITAL TERPADU

**Versi**: 1.0 (Panduan Operasional Staf)  
**Berlaku Mulai**: 17 Oktober 2026  
**Sasaran Pengguna**: Kasir POS, Waiter, Koki Dapur, Manajer Toko & Owner

---

## 1. SOP KASIR (TERMINAL POS)

### A. Membuka Shift Kasir (Awal Hari / Pergantian Shift)
1. Buka browser di komputer/tablet kasir dan masuk ke alamat: `https://staff.tepisawah.id/pos`.
2. Masuk menggunakan akun kasir Anda.
3. Periksa status di bilah subbar: jika tertulis `🔴 Laci Kasir Ditutup`, klik tombol **Laci Kas**.
4. Pada tab **Buka Kasir**:
   - Pilih nama shift (Shift Pagi / Shift Sore / Shift Full).
   - Masukkan nominal uang modal kecil di laci (*Starting Cash / Float*), contoh: `Rp 300.000` atau `Rp 500.000`.
   - Isi catatan jika ada rincian pecahan uang (misal: 10 lembar 20rb, 20 lembar 10rb).
   - Klik **Buka Kasir Sekarang**.
5. Indikator di subbar akan berubah menjadi `🟢 Kasir Dibuka` dan menampilkan saldo laci kas berjalan.

---

### B. Menerima & Menyelesaikan Pembayaran
1. Pilih pesanan pelanggan dari antrean di sebelah kiri.
2. Periksa rincian item, varian, level pedas, serta catatan khusus tamu.
3. Pilih metode pembayaran yang diinginkan pelanggan:
   - **Tunai (Cash)**: Klik nominal uang yang diterima dari tombol cepat (pas, 50k, 100k, dsb.) atau ketik manual. Sistem menghitung uang kembalian secara otomatis.
   - **QRIS Dinamis**: Klik tombol **Perbesar Layar Penuh (Tampilkan ke Pelanggan)** agar pelanggan memindai QR code di layar. Setelah saldo masuk di rekening kasir/EDC, klik centang verifikasi.
   - **Kartu Debit / EDC**: Gesek kartu pada mesin EDC fisik, lalu pilih bank yang sesuai di sistem.
   - **Transfer Bank**: Nomor rekening dan nama pemilik bank tertera di layar kasir lengkap dengan tombol salin nomor rekening instan.
4. Klik tombol **Bayar & Cetak Nota**.
5. Printer termal akan mencetak nota transaksi pelanggan secara otomatis.

---

### C. Mencatat Kas Masuk / Kas Keluar Operasional
Jika terdapat kebutuhan mendadak yang menggunakan uang dari laci kasir (misal: beli es batu tambahan, beli galon air minum, atau isi bensin darurat):
1. Klik tombol **Laci Kas** pada subbar terminal kasir.
2. Pilih tab **💸 Kas Masuk / Keluar**.
3. Pilih jenis transaksi (`Kas Keluar (-)` untuk belanja atau `Kas Masuk (+)` untuk penambahan modal kembalian).
4. Masukkan nominal uang yang diambil/ditambahkan.
5. Pilih alasan operasional pada menu dropdown dan ketik rincian keterangan tambahan di kolom catatan.
6. Klik **Simpan Transaksi Kas**. Saldo laci kas akan seketika terkoreksi secara akurat.

---

### D. Membatalkan Pesanan (Void Order)
Jika pesanan salah input atau tamu membatalkan pesanan sebelum membayar:
1. Klik pesanan yang bersangkutan pada antrean kasir.
2. Klik tombol merah **Batal / Void** di bagian bawah rincian tagihan.
3. Pilih alasan pembatalan yang sesuai (*Pelanggan Salah Pesan*, *Menu Habis*, *Ganti Meja*, dsb.).
4. Masukkan keterangan audit pada kolom catatan.
5. Klik **Konfirmasi Void & Batalkan**.
6. Tiket pesanan akan dibatalkan di kasir, dan layar dapur akan segera membunyikan alarm pembatalan.

---

### E. Mencetak Ulang Nota (Reprint Receipt)
Jika pelanggan meminta salinan nota tambahan atau nota sebelumnya tercecer:
1. Buka tab **Riwayat Selesai** di panel antrean kasir.
2. Pilih transaksi yang ingin dicetak ulang.
3. Klik tombol **Cetak Ulang Struk (Reprint)**.
4. Nota yang tercetak akan memuat penanda sah `*** SALINAN NOTA / REPRINT ***` beserta stempel waktu cetak salinan.

---

### F. Menutup Shift Kasir (Akhir Hari / Serah Terima)
1. Klik tombol **Laci Kas** di subbar terminal kasir.
2. Pilih tab **🔒 Tutup Kasir (End Shift)**.
3. Buka laci kasir dan hitung seluruh uang kertas serta uang koin secara teliti.
4. Masukkan jumlah uang fisik riil tersebut ke kolom **Hitungan Uang Fisik Riil di Laci (Actual Cash)**.
5. Sistem akan menampilkan status pencocokan:
   - `🟢 Kas Pas`: Jumlah fisik cocok persis dengan perhitungan sistem.
   - `🟡 Lebih Kas`: Terdapat kelebihan uang fisik dibanding catatan sistem.
   - `🔴 Kurang Kas`: Terdapat kekurangan uang fisik dibanding catatan sistem.
6. Masukkan catatan penutupan atau serah terima kasir.
7. Klik **Tutup Kasir & Selesaikan Shift**.
8. Klik tombol **Cetak Rekap** untuk mencetak laporan ringkasan shift sebagai bukti fisik penyerahan kepada Owner/Supervisor.

---

## 2. SOP WAITER (PENCATAT PESANAN)

1. Buka tablet waiter di alamat: `https://staff.tepisawah.id/waiter`.
2. Masuk menggunakan akun waiter.
3. Pilih jenis pesanan:
   - **Dine In (Makan di Tempat)**: Pilih nomor meja saung yang dituju (meja berstatus hijau *AVAILABLE*).
   - **Take Away (Bungkus Pulang)**: Pilih tab Take Away, masukkan nama tamu dan nomor kontak jika ada.
   - **Online Delivery**: Pilih layanan (GoFood / GrabFood / ShopeeFood) dan masukkan nomor ID order dari aplikasi driver.
4. Tambahkan menu yang dipesan tamu:
   - Jika menu memiliki pilihan level pedas, es batu, atau varian, pilih opsi yang diminta tamu.
   - Tambahkan catatan khusus jika ada permohonan khusus (contoh: *tanpa bawang goreng, kuah dipisah*).
5. Klik **Kirim Pesanan ke Kasir & Dapur**. Pesanan akan otomatis muncul di antrean kasir dan layar dapur.

---

## 3. SOP KITCHEN DISPLAY SYSTEM (DAPUR)

1. Buka layar monitor dapur di alamat: `https://staff.tepisawah.id/kitchen`.
2. Saat pesanan baru masuk:
   - Sistem membunyikan nada pemberitahuan pesanan baru.
   - Tiket pesanan akan muncul di kolom **Pesanan Masuk (Incoming)** berwarna biru.
3. Mulai memasak:
   - Klik tombol **Mulai Masak** pada tiket pesanan. Tiket akan berpindah ke kolom **Sedang Dimasak (Cooking)** berwarna jingga.
4. Pesanan siap dihidangkan:
   - Saat seluruh hidangan telah selesai disiapkan, klik **Siap Saji**.
   - Waiter akan menerima notifikasi bahwa hidangan meja tersebut siap diantar ke tamu.
5. **PENTING — Menanggapi Alarm Pembatalan (Void)**:
   - Jika kasir melakukan void terhadap pesanan yang belum disajikan, layar dapur akan membunyikan alarm peringatan keras dan menampilkan banner merah: `PERINGATAN PEMBATALAN: Pesanan [Nomor Order] telah dibatalkan oleh kasir!`.
   - Koki wajib **segera menghentikan proses memasak** untuk mencegah pemborosan bahan baku (*food waste*).

---

## 4. SOP ADMINISTRATOR / OWNER

1. Buka portal admin di alamat: `https://staff.tepisawah.id/admin`.
2. **Pendaftaran Akun Staf Resmi**:
   - Buka menu **Manajemen Staf**.
   - Daftarkan staf baru dengan mengisi Nama Lengkap, Username unik, Kata Sandi, dan pilih Peran (*Kasir*, *Pelayan / Waiter*, *Koki Dapur*, atau *Supervisor*).
   - Sistem kini mendukung pendaftaran staf langsung menggunakan username tanpa memerlukan alamat email pribadi staf.
3. **Pengaturan Pajak, QRIS & Struk**:
   - Buka menu **Pajak, QRIS & Struk**.
   - Sesuaikan persentase Pajak Restoran (PB1), Service Charge, dan URL gambar QRIS dinamis.
   - Pilih ukuran lebar kertas printer kasir (58mm atau 80mm).
   - Tentukan kebijakan sesi meja: pilih **Otomatis (Buka Sesi Otomatis / Open Ordering)** untuk mempermudah operasional kasir dan waiter tanpa hambatan buka sesi manual.
