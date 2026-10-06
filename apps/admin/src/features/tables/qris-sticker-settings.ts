/**
 * Pengaturan dan Isian Stiker QRIS untuk Halaman 2 (Sisi Belakang Kartu Meja).
 *
 * Memungkinkan pemilik/admin restoran mengubah teks merchant, NMID, kode QRIS,
 * WiFi tamu, dan panduan pembayaran yang tercetak di Halaman 2.
 */

export interface QrisStickerConfig {
  /** Nama merchant yang tertera di stiker QRIS */
  merchantName: string;
  /** Nomor National Merchant Identifier (NMID) */
  nmid: string;
  /** Lokasi / Kota merchant */
  city: string;
  /** String payload QRIS standar Bank Indonesia */
  qrisPayload: string;
  /** Tampilkan frame QRIS pembayaran di Halaman 2 */
  showQrisCode: boolean;
  /** Tampilkan info WiFi di Halaman 2 */
  showWifi: boolean;
  /** Nama jaringan WiFi tamu */
  wifiSsid: string;
  /** Kata sandi WiFi tamu */
  wifiPassword: string;
  /** Panduan / aplikasi pembayaran yang didukung */
  paymentGuide: string;
  /** Jam operasional restoran */
  operationalHours: string;
  /** Akun media sosial / Instagram */
  instagram: string;
  /** Link website yang tercetak di footer */
  footerUrl: string;
}

export const DEFAULT_QRIS_STICKER_CONFIG: QrisStickerConfig = {
  merchantName: "TEPI SAWAH RESTO & COFFEE",
  nmid: "ID1026002938475",
  city: "Ciperna, Cirebon",
  qrisPayload:
    "00020101021226600016ID.CO.QRIS.WWW01189360091100293847550215ID102600293847553033605802ID5910TEPI SAWAH6007CIREBON6304",
  showQrisCode: true,
  showWifi: true,
  wifiSsid: "TepiSawah_Guest",
  wifiPassword: "silakan tanya staf",
  paymentGuide: "BCA, Mandiri, BRI, BNI, GoPay, OVO, ShopeePay, DANA",
  operationalHours: "Buka Setiap Hari: 10.00 – 22.00 WIB",
  instagram: "@tepisawah.resto",
  footerUrl: "tepisawah.id",
};

const STORAGE_KEY = "tepisawah_qris_sticker_config";

export function loadQrisStickerConfig(): QrisStickerConfig {
  if (typeof window === "undefined") return DEFAULT_QRIS_STICKER_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_QRIS_STICKER_CONFIG;
    return { ...DEFAULT_QRIS_STICKER_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_QRIS_STICKER_CONFIG;
  }
}

export function saveQrisStickerConfig(config: QrisStickerConfig): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    console.error("Gagal menyimpan konfigurasi stiker QRIS:", err);
  }
}
