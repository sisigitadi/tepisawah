/**
 * @tepisawah/admin — Printer Settings Form (Panel Pengelola).
 *
 * Dedicated configuration panel for restaurant thermal printers,
 * including Blueprint BP-ECO58 (58mm Bluetooth Mini Portable Printer)
 * via Blueprint Mobile POS Android app and 80mm desktop thermal machines.
 */

import { useState, type ReactNode } from "react";
import {
  loadPrinterConfig,
  savePrinterConfig,
  runTestPrint,
  type PrinterConfig,
  type PrinterDriverMode,
  type PrinterPaperWidth,
} from "@tepisawah/config";
import { Button, Card } from "@tepisawah/ui";

export interface PrinterSettingsFormProps {
  editable: boolean;
  onSavedToast?: (msg: string) => void;
}

export function PrinterSettingsForm({
  editable,
  onSavedToast,
}: PrinterSettingsFormProps): ReactNode {
  const [config, setConfig] = useState<PrinterConfig>(() => loadPrinterConfig());
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    savePrinterConfig(config);
    setSaved(true);
    onSavedToast?.("Pengaturan printer thermal berhasil disimpan & disinkronkan.");
    setTimeout(() => setSaved(false), 2500);
  };

  const handleTest = () => {
    setTesting(true);
    runTestPrint(config);
    setTimeout(() => setTesting(false), 1000);
  };

  return (
    <div className="printer-settings-container" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Intro Card */}
      <Card
        title="Konfigurasi Printer Thermal &amp; Blueprint"
        description="Atur printer struk kasir Blueprint BP-ECO58 Bluetooth atau printer thermal desktop 80mm. Pengaturan ini langsung tersinkronisasi ke seluruh meja kasir staf."
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", marginTop: "1rem" }}>
          {/* Driver Mode */}
          <div>
            <label
              htmlFor="printer-driver-mode"
              style={{ display: "block", fontWeight: 700, marginBottom: "0.4rem", color: "#183a1d" }}
            >
              Driver / Metode Cetak:
            </label>
            <select
              id="printer-driver-mode"
              value={config.driverMode}
              disabled={!editable}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  driverMode: e.target.value as PrinterDriverMode,
                }))
              }
              style={{
                width: "100%",
                maxWidth: "28rem",
                padding: "0.6rem 0.85rem",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "0.9375rem",
                background: "#ffffff",
                color: "#1e293b",
                fontWeight: 500,
              }}
            >
              <option value="blueprint_mobile">
                📱 Aplikasi Blueprint Mobile (Android) — Direkomendasikan untuk BP-ECO58
              </option>
              <option value="browser">
                🌐 Browser Print Spooler (Universal Android, iOS, Windows, Mac)
              </option>
              <option value="rawbt">
                ⚡ RawBT Bluetooth Print Service (Android Intent Bridge)
              </option>
              <option value="bluetooth">
                📡 Web Bluetooth Direct (Google Chrome Android &amp; PC)
              </option>
            </select>
            <p style={{ margin: "0.35rem 0 0 0", fontSize: "0.8125rem", color: "#64748b" }}>
              {config.driverMode === "blueprint_mobile"
                ? "Mengirim data struk format 32-kolom ESC/POS langsung ke aplikasi Blueprint Mobile di Android dan Print Spooler."
                : config.driverMode === "browser"
                ? "Membuka dialog cetak bawaan browser dengan layout kertas termal terkunci."
                : config.driverMode === "rawbt"
                ? "Mengirim perintah ESC/POS via URL intent RawBT (rawbt:data:...)."
                : "Menghubungkan browser langsung ke modul Bluetooth BP-ECO58 tanpa aplikasi perantara."}
            </p>
          </div>

          {/* Paper Width */}
          <div>
            <label
              style={{ display: "block", fontWeight: 700, marginBottom: "0.4rem", color: "#183a1d" }}
            >
              Lebar Kertas Thermal:
            </label>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.6rem 1rem",
                  borderRadius: "8px",
                  border: config.paperWidth === "58mm" ? "2px solid #2e6b34" : "1px solid #cbd5e1",
                  background: config.paperWidth === "58mm" ? "#f0fdf4" : "#ffffff",
                  cursor: editable ? "pointer" : "default",
                  fontWeight: config.paperWidth === "58mm" ? 700 : 500,
                }}
              >
                <input
                  type="radio"
                  name="paperWidth"
                  value="58mm"
                  checked={config.paperWidth === "58mm"}
                  disabled={!editable}
                  onChange={() => setConfig((prev) => ({ ...prev, paperWidth: "58mm" }))}
                />
                <span>58mm (Blueprint BP-ECO58 / Mini Portable)</span>
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.6rem 1rem",
                  borderRadius: "8px",
                  border: config.paperWidth === "80mm" ? "2px solid #2e6b34" : "1px solid #cbd5e1",
                  background: config.paperWidth === "80mm" ? "#f0fdf4" : "#ffffff",
                  cursor: editable ? "pointer" : "default",
                  fontWeight: config.paperWidth === "80mm" ? 700 : 500,
                }}
              >
                <input
                  type="radio"
                  name="paperWidth"
                  value="80mm"
                  checked={config.paperWidth === "80mm"}
                  disabled={!editable}
                  onChange={() => setConfig((prev) => ({ ...prev, paperWidth: "80mm" }))}
                />
                <span>80mm (Desktop POS Printer)</span>
              </label>
            </div>
          </div>

          {/* Auto Print */}
          <div>
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.6rem",
                cursor: editable ? "pointer" : "default",
                userSelect: "none",
              }}
            >
              <input
                type="checkbox"
                checked={config.autoPrint}
                disabled={!editable}
                onChange={(e) => setConfig((prev) => ({ ...prev, autoPrint: e.target.checked }))}
                style={{ width: "1.15rem", height: "1.15rem", accentColor: "#183a1d" }}
              />
              <span style={{ fontWeight: 600, color: "#1e293b", fontSize: "0.9375rem" }}>
                Cetak Struk Otomatis Saat Transaksi Berhasil Diselesaikan
              </span>
            </label>
            <p style={{ margin: "0.25rem 0 0 1.75rem", fontSize: "0.8125rem", color: "#64748b" }}>
              Bila diaktifkan, struk akan langsung dikirim ke printer thermal begitu kasir menekan tombol "Bayar &amp; Selesaikan".
            </p>
          </div>

          {/* Bluetooth Device Name */}
          <div>
            <label
              htmlFor="printer-bt-name"
              style={{ display: "block", fontWeight: 700, marginBottom: "0.4rem", color: "#183a1d" }}
            >
              Nama Perangkat Bluetooth (Label):
            </label>
            <input
              id="printer-bt-name"
              type="text"
              value={config.bluetoothDeviceName || "BP-ECO58"}
              disabled={!editable}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  bluetoothDeviceName: e.target.value,
                }))
              }
              placeholder="Contoh: BP-ECO58 atau Blueprint M58"
              style={{
                width: "100%",
                maxWidth: "28rem",
                padding: "0.6rem 0.85rem",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "0.9375rem",
              }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
            <Button
              variant="primary"
              disabled={!editable}
              onClick={handleSave}
            >
              💾 Simpan Pengaturan Printer
            </Button>

            <Button
              variant="secondary"
              disabled={testing}
              onClick={handleTest}
            >
              {testing ? "Mengirim Tes Struk…" : "🖨️ Uji Coba Cetak (Test Print)"}
            </Button>

            {saved && (
              <span style={{ color: "#166534", fontWeight: 600, fontSize: "0.875rem" }}>
                ✓ Pengaturan tersimpan &amp; aktif!
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* Guide Card for Blueprint Mobile on Android */}
      <Card
        title="📱 Panduan Koneksi Blueprint Mobile di Android (BP-ECO58)"
        description="Ikuti 3 langkah praktis ini untuk menghubungkan tablet/smartphone Android kasir dengan printer Blueprint BP-ECO58."
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "0.75rem", fontSize: "0.875rem", lineHeight: 1.6, color: "#334155" }}>
          <div style={{ background: "#f8fafc", padding: "0.85rem 1rem", borderRadius: "8px", borderLeft: "4px solid #183a1d" }}>
            <strong style={{ color: "#183a1d", fontSize: "0.9375rem" }}>Langkah 1: Hubungkan Bluetooth Printer</strong>
            <p style={{ margin: "0.25rem 0 0 0" }}>
              Nyalakan printer Blueprint BP-ECO58. Buka menu <strong>Pengaturan &gt; Bluetooth</strong> di perangkat Android, scan perangkat baru, pilih <strong>BP-ECO58</strong> (atau nama printer Blueprint Anda), dan masukkan PIN pairing (biasanya <strong>0000</strong> atau <strong>1234</strong>).
            </p>
          </div>

          <div style={{ background: "#f8fafc", padding: "0.85rem 1rem", borderRadius: "8px", borderLeft: "4px solid #2e6b34" }}>
            <strong style={{ color: "#2e6b34", fontSize: "0.9375rem" }}>Langkah 2: Buka Aplikasi Blueprint Mobile</strong>
            <p style={{ margin: "0.25rem 0 0 0" }}>
              Pastikan aplikasi <strong>Blueprint POS / Blueprint Mobile Print</strong> sudah terpasang di perangkat Android. Buka aplikasi tersebut dan pastikan printer BP-ECO58 tercantum dengan status <em>Connected (Terhubung)</em>.
            </p>
          </div>

          <div style={{ background: "#f8fafc", padding: "0.85rem 1rem", borderRadius: "8px", borderLeft: "4px solid #dda15e" }}>
            <strong style={{ color: "#b45309", fontSize: "0.9375rem" }}>Langkah 3: Uji Coba dari Web POS Tepi Sawah</strong>
            <p style={{ margin: "0.25rem 0 0 0" }}>
              Klik tombol <strong>"🖨️ Uji Coba Cetak"</strong> di atas. Dialog cetak sistem Android akan terbuka, pilih printer Blueprint Anda, dan printer akan otomatis mengeluarkan kertas struk uji coba rapi 32-kolom.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
