/**
 * Tax & Service Charge (PB1) Configuration Form.
 *
 * Mengatur parameter perpajakan restoran:
 * - PB1 (Pajak Restoran Daerah) 10% (aktif/nonaktif, persentase, exclusive vs inclusive)
 * - NPWPD (Nomor Pokok Wajib Pajak Daerah) untuk transparansi & kepatuhan Dispenda
 * - Biaya Layanan (Service Charge)
 * - Pembulatan total transaksi (Rounding)
 * - Personalisasi Struk Thermal Kasir
 * - Live Preview Kalkulator & Simulasi Kertas Struk 80mm
 */

import { Button, Card, compressImageToWebP } from "@tepisawah/ui";
import {
  type TaxSettings,
  type TaxCalculationMode,
  type RoundingMode,
  DEFAULT_TAX_SETTINGS,
  loadTaxSettings,
  saveTaxSettings,
  calculateBill,
  syncTaxSettingsFromDb,
  toDbTaxSettings,
} from "@tepisawah/config";
import { useEffect, useState, useMemo, useRef, type ChangeEvent, type ReactNode } from "react";
import { getSupabaseClient } from "../../lib/supabase.js";

export interface TaxFinanceFormProps {
  editable: boolean;
  onSavedToast?: (message: string) => void;
}

export function TaxFinanceForm({ editable, onSavedToast }: TaxFinanceFormProps): ReactNode {
  const [settings, setSettings] = useState<TaxSettings>(() => loadTaxSettings());
  const [saving, setSaving] = useState(false);
  const qrisFileInputRef = useRef<HTMLInputElement | null>(null);
  const [qrisCompressing, setQrisCompressing] = useState(false);
  const [qrisUploadError, setQrisUploadError] = useState<string | null>(null);
  const [showManualUrl, setShowManualUrl] = useState(false);
  const [qrisImageSize, setQrisImageSize] = useState<string | null>(() => {
    const url = loadTaxSettings().qrisImageUrl;
    if (!url) return null;
    if (url.startsWith("data:image")) {
      const head = url.indexOf(",") + 1;
      const b64 = url.slice(head);
      const kb = Math.round((b64.length * 3) / 4 / 1024);
      return `${kb} KB (WebP)`;
    }
    return null;
  });

  const handleQrisFileSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setQrisUploadError(null);

    if (!file.type.startsWith("image/")) {
      setQrisUploadError("Harap pilih file gambar (JPG, PNG, atau WebP).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setQrisUploadError("Ukuran file maksimal 10MB sebelum kompresi.");
      return;
    }

    setQrisCompressing(true);
    try {
      const result = await compressImageToWebP(file, {
        maxDimension: 1000,
        quality: 0.85,
      });
      const kb = Math.round(result.compressedSize / 1024);
      setQrisImageSize(`${kb} KB (WebP)`);
      setSettings((prev) => ({ ...prev, qrisImageUrl: result.dataUrl }));
    } catch (err) {
      setQrisUploadError(err instanceof Error ? err.message : "Gagal mengompres gambar QRIS.");
    } finally {
      setQrisCompressing(false);
    }
  };

  // Sync settings with Supabase database on mount
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const client = getSupabaseClient();
        const { data } = await client
          .from("tax_settings")
          .select("*")
          .limit(1)
          .single();
        if (data && active) {
          const synced = syncTaxSettingsFromDb(data as Record<string, unknown>);
          setSettings(synced);
        }
      } catch {
        // Fallback to local
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Sample items for live simulator
  const sampleSubtotal = 75000; // Contoh: Nasi Liwet Gurame (55k) + Es Kelapa Jeruk (20k)
  const sampleDiscount = 0;

  const bill = useMemo(() => {
    return calculateBill(sampleSubtotal, sampleDiscount, settings);
  }, [settings, sampleSubtotal, sampleDiscount]);

  const formatIDR = (val: number) => {
    return "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(val));
  };

  const handleSave = async () => {
    setSaving(true);
    saveTaxSettings(settings);
    try {
      const client = getSupabaseClient();
      await (client.from("tax_settings") as any).upsert(toDbTaxSettings(settings));
    } catch {
      // Non-blocking fallback
    }
    setSaving(false);
    onSavedToast?.("Pengaturan Pajak Restoran (PB1), QRIS, Rekening & Struk berhasil disimpan ke database.");
  };

  const handleReset = () => {
    if (!editable) return;
    setSettings(DEFAULT_TAX_SETTINGS);
  };

  return (
    <Card
      elevation="low"
      title="Pengaturan Pajak Restoran (PB1) & Biaya Layanan"
      description="Konfigurasi tarif PB1 daerah Cirebon, biaya layanan, nomor NPWPD, pembulatan, dan tampilan struk kasir."
      footer={
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", width: "100%", flexWrap: "wrap" }}>
          <Button
            variant="secondary"
            disabled={!editable || saving}
            onClick={handleReset}
          >
            Reset Standar PB1 10%
          </Button>
          <Button
            variant="primary"
            loading={saving}
            disabled={!editable}
            onClick={handleSave}
          >
            Simpan Pengaturan Pajak &amp; Struk
          </Button>
        </div>
      }
    >
      <div className="flow-settings-container">
        {/* Bagian 1: Pajak Restoran (PB1) */}
        <div className="flow-section-header">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
            <h3 className="flow-section-title" style={{ margin: 0 }}>
              1. Pajak Restoran / PB1 (Pajak Barang &amp; Jasa Tertentu - PBJT)
            </h3>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: "999px",
                background: settings.taxEnabled ? "rgba(16, 185, 129, 0.15)" : "rgba(100, 116, 139, 0.15)",
                color: settings.taxEnabled ? "#10b981" : "#64748b",
              }}
            >
              {settings.taxEnabled ? "PB1 AKTIF" : "PB1 NONAKTIF"}
            </span>
          </div>
          <p className="flow-section-desc">
            Pajak Restoran resmi untuk pelaporan daerah (standar Kabupaten/Kota Cirebon adalah 10%).
          </p>
        </div>

        <div className="flow-toggles-list" style={{ marginTop: "0.5rem" }}>
          <label className="flow-toggle-item">
            <input
              type="checkbox"
              checked={settings.taxEnabled}
              disabled={!editable}
              onChange={(e) => setSettings((prev) => ({ ...prev, taxEnabled: e.target.checked }))}
            />
            <div className="flow-toggle-text">
              <strong>Aktifkan Pajak Restoran (PB1) pada Transaksi</strong>
              <p>
                Jika dicentang, sistem kasir POS dan kalkulasi pembayaran akan otomatis menghitung tarif PB1.
              </p>
            </div>
          </label>
        </div>

        {settings.taxEnabled && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "1rem",
              marginTop: "1rem",
              background: "rgba(248, 250, 252, 0.8)",
              padding: "1rem",
              borderRadius: "8px",
              border: "1px solid rgba(226, 232, 240, 0.8)",
            }}
          >
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.25rem", color: "#334155" }}>
                Tarif Pajak Restoran (%)
              </label>
              <input
                type="number"
                min="0"
                max="30"
                step="0.5"
                className="admin-form-input"
                style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                value={settings.taxRate}
                disabled={!editable}
                onChange={(e) => setSettings((prev) => ({ ...prev, taxRate: Math.max(0, parseFloat(e.target.value) || 0) }))}
              />
              <span style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "2px", display: "block" }}>
                Standar perda F&amp;B: 10%
              </span>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.25rem", color: "#334155" }}>
                Label Pajak pada Struk &amp; Layar
              </label>
              <input
                type="text"
                className="admin-form-input"
                style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                value={settings.taxName}
                disabled={!editable}
                onChange={(e) => setSettings((prev) => ({ ...prev, taxName: e.target.value }))}
                placeholder="Contoh: PB1 (10%)"
              />
              <span style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "2px", display: "block" }}>
                Tampil di lembar tagihan pelanggan
              </span>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.25rem", color: "#334155" }}>
                Nomor NPWPD / NOPD Restoran
              </label>
              <input
                type="text"
                className="admin-form-input"
                style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                value={settings.npwpd}
                disabled={!editable}
                onChange={(e) => setSettings((prev) => ({ ...prev, npwpd: e.target.value }))}
                placeholder="P.2.0192834.01.24"
              />
              <span style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "2px", display: "block" }}>
                Nomor Pokok Wajib Pajak Daerah Tepi Sawah
              </span>
            </div>
          </div>
        )}

        {/* Skema Perhitungan Pajak */}
        {settings.taxEnabled && (
          <div style={{ marginTop: "1rem" }}>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.5rem", color: "#334155" }}>
              Skema Perhitungan Pajak
            </label>
            <div className="flow-cards-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
              <div
                className={`flow-card ${settings.taxCalculation === "exclusive" ? "flow-card--active" : ""}`}
                onClick={() => editable && setSettings((prev) => ({ ...prev, taxCalculation: "exclusive" }))}
                role="button"
                tabIndex={0}
                style={{ padding: "0.85rem" }}
              >
                <div className="flow-card__top">
                  <span className="flow-card__radio">
                    <input
                      type="radio"
                      name="taxCalculation"
                      checked={settings.taxCalculation === "exclusive"}
                      onChange={() => editable && setSettings((prev) => ({ ...prev, taxCalculation: "exclusive" }))}
                      disabled={!editable}
                    />
                  </span>
                  <div className="flow-card__heading">
                    <div className="flow-card__title-row">
                      <h4 className="flow-card__title" style={{ fontSize: "0.95rem" }}>Pajak di Luar Harga (Exclusive)</h4>
                      <span className="flow-badge flow-badge--recommended">Standar Resto</span>
                    </div>
                    <span className="flow-card__sub">Subtotal Menu + PB1 {settings.taxRate}% = Total Bayar</span>
                  </div>
                </div>
                <p className="flow-card__body" style={{ fontSize: "0.8rem", marginTop: "0.5rem" }}>
                  Harga di buku menu belum termasuk pajak. PB1 {settings.taxRate}% ditambahkan di lembar kasir dan struk saat pembayaran.
                </p>
              </div>

              <div
                className={`flow-card ${settings.taxCalculation === "inclusive" ? "flow-card--active" : ""}`}
                onClick={() => editable && setSettings((prev) => ({ ...prev, taxCalculation: "inclusive" }))}
                role="button"
                tabIndex={0}
                style={{ padding: "0.85rem" }}
              >
                <div className="flow-card__top">
                  <span className="flow-card__radio">
                    <input
                      type="radio"
                      name="taxCalculation"
                      checked={settings.taxCalculation === "inclusive"}
                      onChange={() => editable && setSettings((prev) => ({ ...prev, taxCalculation: "inclusive" }))}
                      disabled={!editable}
                    />
                  </span>
                  <div className="flow-card__heading">
                    <div className="flow-card__title-row">
                      <h4 className="flow-card__title" style={{ fontSize: "0.95rem" }}>Pajak Termasuk (Inclusive)</h4>
                    </div>
                    <span className="flow-card__sub">Harga menu nett sudah memuat PB1</span>
                  </div>
                </div>
                <p className="flow-card__body" style={{ fontSize: "0.8rem", marginTop: "0.5rem" }}>
                  Pelanggan membayar pas sesuai harga daftar menu. Nilai PB1 diekstrak secara otomatis untuk pelaporan pajak daerah tanpa membebani tambahan biaya.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Bagian 2: Biaya Layanan (Service Charge) */}
        <div className="flow-section-header" style={{ marginTop: "1.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
            <h3 className="flow-section-title" style={{ margin: 0 }}>
              2. Biaya Layanan (Service Charge)
            </h3>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: "999px",
                background: settings.serviceChargeEnabled ? "rgba(16, 185, 129, 0.15)" : "rgba(100, 116, 139, 0.15)",
                color: settings.serviceChargeEnabled ? "#10b981" : "#64748b",
              }}
            >
              {settings.serviceChargeEnabled ? "SERVICE CHARGE AKTIF" : "NONAKTIF (0%)"}
            </span>
          </div>
          <p className="flow-section-desc">
            Biaya operasional pelayanan tambahan (biasanya 5% untuk resto berkonsep dine-in penuh).
          </p>
        </div>

        <div className="flow-toggles-list" style={{ marginTop: "0.5rem" }}>
          <label className="flow-toggle-item">
            <input
              type="checkbox"
              checked={settings.serviceChargeEnabled}
              disabled={!editable}
              onChange={(e) => setSettings((prev) => ({ ...prev, serviceChargeEnabled: e.target.checked }))}
            />
            <div className="flow-toggle-text">
              <strong>Aktifkan Biaya Layanan (Service Charge)</strong>
              <p>
                Tambahkan persentase service charge sebelum perhitungan PB1 pada pesanan dine-in.
              </p>
            </div>
          </label>
        </div>

        {settings.serviceChargeEnabled && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "1rem",
              marginTop: "0.75rem",
              background: "rgba(248, 250, 252, 0.8)",
              padding: "1rem",
              borderRadius: "8px",
              border: "1px solid rgba(226, 232, 240, 0.8)",
            }}
          >
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.25rem", color: "#334155" }}>
                Tarif Biaya Layanan (%)
              </label>
              <input
                type="number"
                min="0"
                max="20"
                step="0.5"
                className="admin-form-input"
                style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                value={settings.serviceChargeRate}
                disabled={!editable}
                onChange={(e) => setSettings((prev) => ({ ...prev, serviceChargeRate: Math.max(0, parseFloat(e.target.value) || 0) }))}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.25rem", color: "#334155" }}>
                Label pada Struk
              </label>
              <input
                type="text"
                className="admin-form-input"
                style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                value={settings.serviceChargeName}
                disabled={!editable}
                onChange={(e) => setSettings((prev) => ({ ...prev, serviceChargeName: e.target.value }))}
                placeholder="Biaya Layanan (5%)"
              />
            </div>
          </div>
        )}

        {/* Bagian 3: Pembulatan & Detail Struk */}
        <div className="flow-section-header" style={{ marginTop: "1.75rem" }}>
          <h3 className="flow-section-title">3. Aturan Pembulatan (Rounding) &amp; Identitas Struk Kasir</h3>
          <p className="flow-section-desc">
            Pengaturan nominal akhir kasir dan informasi yang tercetak pada kertas thermal 80mm.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem", marginTop: "0.75rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.25rem", color: "#334155" }}>
              Aturan Pembulatan Total Kasir
            </label>
            <select
              className="admin-form-input"
              style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#fff" }}
              value={settings.rounding}
              disabled={!editable}
              onChange={(e) => setSettings((prev) => ({ ...prev, rounding: e.target.value as RoundingMode }))}
            >
              <option value="none">Tanpa Pembulatan (Nilai Pas)</option>
              <option value="round100">Bulatkan ke Ratusan Terdekat (Rp 100)</option>
              <option value="round500">Bulatkan ke Rp 500</option>
              <option value="round1000">Bulatkan ke Ribuan Terdekat (Rp 1.000)</option>
            </select>
            <span style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "2px", display: "block" }}>
              Mempermudah kembalian uang tunai saat jam sibuk
            </span>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.25rem", color: "#334155" }}>
              Nomor WhatsApp / CS di Struk
            </label>
            <input
              type="text"
              className="admin-form-input"
              style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
              value={settings.receiptPhone}
              disabled={!editable}
              onChange={(e) => setSettings((prev) => ({ ...prev, receiptPhone: e.target.value }))}
            />
          </div>
        </div>

        <div style={{ marginTop: "1rem" }}>
          <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.25rem", color: "#334155" }}>
            Pesan Kaki Struk (Footer Greeting)
          </label>
          <textarea
            rows={2}
            className="admin-form-input"
            style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "6px", border: "1px solid #cbd5e1", resize: "vertical" }}
            value={settings.receiptFooterNote}
            disabled={!editable}
            onChange={(e) => setSettings((prev) => ({ ...prev, receiptFooterNote: e.target.value }))}
            placeholder="Ucapan terima kasih atau info sosial media..."
          />
        </div>

        {/* Bagian 4: Pengaturan QRIS & Rekening Bank */}
        <div style={{ marginTop: "2rem", borderTop: "2px dashed #cbd5e1", paddingTop: "1.5rem" }}>
          <div className="flow-section-header">
            <h3 className="flow-section-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span>💳</span> Setup Pembayaran QRIS &amp; Rekening Bank
            </h3>
            <p className="flow-section-desc">
              Data QRIS dan nomor rekening bank transfer untuk ditampilkan di layar kasir saat pelanggan memilih pembayaran non-tunai.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "1.25rem",
              marginTop: "1rem",
            }}
          >
            <div style={{ gridColumn: "1 / -1" }}>
              {/* Hidden file input */}
              <input
                ref={qrisFileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => void handleQrisFileSelected(e)}
              />

              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.4rem", color: "#1e293b" }}>
                Gambar QRIS Pembayaran (Website &amp; Kasir POS)
              </label>

              {qrisUploadError && (
                <div style={{ padding: "0.5rem 0.75rem", background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: "6px", fontSize: "0.8rem", marginBottom: "0.6rem" }}>
                  ⚠️ {qrisUploadError}
                </div>
              )}

              {settings.qrisImageUrl ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "1.25rem",
                    padding: "1rem",
                    background: "#f8fafc",
                    border: "1px solid #cbd5e1",
                    borderRadius: "10px",
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{
                      width: "130px",
                      height: "130px",
                      background: "#ffffff",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                      padding: "4px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                      flexShrink: 0,
                    }}
                  >
                    <img
                      src={settings.qrisImageUrl}
                      alt="QRIS Tepi Sawah"
                      style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                    />
                  </div>

                  <div style={{ flex: "1 1 200px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "#183a1d" }}>
                        Gambar QRIS Siap Digunakan
                      </span>
                      {qrisImageSize && (
                        <span style={{ fontSize: "0.72rem", background: "#dcfce7", color: "#166534", padding: "0.15rem 0.5rem", borderRadius: "9999px", fontWeight: 600 }}>
                          ✓ {qrisImageSize}
                        </span>
                      )}
                    </div>
                    <p style={{ margin: "0 0 0.75rem", fontSize: "0.8rem", color: "#64748b", lineHeight: 1.4 }}>
                      Gambar QRIS ini otomatis terkompresi WebP untuk loading instan di tablet kasir POS dan layar pembayaran pelanggan.
                    </p>

                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        disabled={!editable || qrisCompressing}
                        onClick={() => qrisFileInputRef.current?.click()}
                        style={{
                          padding: "0.4rem 0.85rem",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          color: "#183a1d",
                          background: "#ffffff",
                          border: "1px solid #cbd5e1",
                          borderRadius: "6px",
                          cursor: "pointer",
                        }}
                      >
                        {qrisCompressing ? "⏳ Mengompres..." : "🔄 Ganti Gambar QRIS"}
                      </button>

                      <button
                        type="button"
                        disabled={!editable}
                        onClick={() => {
                          setSettings((prev) => ({ ...prev, qrisImageUrl: "" }));
                          setQrisImageSize(null);
                        }}
                        style={{
                          padding: "0.4rem 0.85rem",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          color: "#ef4444",
                          background: "#ffffff",
                          border: "1px solid #fecaca",
                          borderRadius: "6px",
                          cursor: "pointer",
                        }}
                      >
                        🗑️ Hapus
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowManualUrl(!showManualUrl)}
                        style={{
                          padding: "0.4rem 0.65rem",
                          fontSize: "0.78rem",
                          color: "#64748b",
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          textDecoration: "underline",
                        }}
                      >
                        {showManualUrl ? "Sembunyikan URL" : "Edit URL Manual"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    border: "2px dashed #cbd5e1",
                    borderRadius: "10px",
                    padding: "1.25rem",
                    textAlign: "center",
                    background: "#f8fafc",
                    cursor: editable ? "pointer" : "default",
                    transition: "border-color 0.15s ease",
                  }}
                  onClick={() => {
                    if (editable) qrisFileInputRef.current?.click();
                  }}
                >
                  <div style={{ fontSize: "2rem", marginBottom: "0.35rem" }}>
                    {qrisCompressing ? "⏳" : "💳"}
                  </div>
                  <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "#183a1d", marginBottom: "0.2rem" }}>
                    {qrisCompressing ? "Sedang Mengompres Gambar ke WebP..." : "Klik untuk Unggah Gambar QRIS"}
                  </div>
                  <p style={{ margin: "0 0 0.75rem", fontSize: "0.8rem", color: "#64748b" }}>
                    Pilih file QRIS resmi (PNG, JPG, WebP). Otomatis dikompresi resolusi tajam &amp; ringan untuk website dan POS.
                  </p>
                  <button
                    type="button"
                    disabled={!editable || qrisCompressing}
                    onClick={(e) => {
                      e.stopPropagation();
                      qrisFileInputRef.current?.click();
                    }}
                    style={{
                      padding: "0.45rem 1rem",
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      color: "#ffffff",
                      background: "#183a1d",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                    }}
                  >
                    📁 Pilih Gambar dari Perangkat
                  </button>

                  <div style={{ marginTop: "0.75rem" }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowManualUrl(!showManualUrl);
                      }}
                      style={{
                        fontSize: "0.78rem",
                        color: "#64748b",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        textDecoration: "underline",
                      }}
                    >
                      {showManualUrl ? "Tutup input URL" : "Atau masukkan URL gambar secara manual"}
                    </button>
                  </div>
                </div>
              )}

              {showManualUrl && (
                <div style={{ marginTop: "0.75rem", padding: "0.75rem", background: "#f1f5f9", borderRadius: "8px" }}>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#334155", marginBottom: "0.25rem" }}>
                    URL Gambar QRIS Eksternal:
                  </label>
                  <input
                    type="text"
                    className="admin-form-input"
                    style={{ width: "100%", padding: "0.45rem 0.65rem", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.82rem" }}
                    value={settings.qrisImageUrl}
                    disabled={!editable}
                    onChange={(e) => {
                      setSettings((prev) => ({ ...prev, qrisImageUrl: e.target.value }));
                      setQrisImageSize(null);
                    }}
                    placeholder="https://.../qris-tepisawah.png"
                  />
                  <span style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "2px", display: "block" }}>
                    Tautan gambar QRIS dari Supabase Storage atau CDN publik
                  </span>
                </div>
              )}
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.25rem", color: "#334155" }}>
                QRIS String / EMVCo Payload (Opsional)
              </label>
              <input
                type="text"
                className="admin-form-input"
                style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                value={settings.qrisPayload}
                disabled={!editable}
                onChange={(e) => setSettings((prev) => ({ ...prev, qrisPayload: e.target.value }))}
                placeholder="00020101021126590014ID.LINKAJA.WWW0118..."
              />
              <span style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "2px", display: "block" }}>
                Jika diisi, sistem POS dapat men-generate QR Code secara otomatis
              </span>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.25rem", color: "#334155" }}>
                Nama Bank Rekening Resto
              </label>
              <input
                type="text"
                className="admin-form-input"
                style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                value={settings.bankName}
                disabled={!editable}
                onChange={(e) => setSettings((prev) => ({ ...prev, bankName: e.target.value }))}
                placeholder="BCA / Mandiri / BRI / BNI"
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.25rem", color: "#334155" }}>
                Nomor Rekening Bank
              </label>
              <input
                type="text"
                className="admin-form-input"
                style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                value={settings.bankAccountNumber}
                disabled={!editable}
                onChange={(e) => setSettings((prev) => ({ ...prev, bankAccountNumber: e.target.value }))}
                placeholder="Contoh: 1340889210"
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.25rem", color: "#334155" }}>
                Atas Nama Pemilik Rekening
              </label>
              <input
                type="text"
                className="admin-form-input"
                style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                value={settings.bankAccountHolder}
                disabled={!editable}
                onChange={(e) => setSettings((prev) => ({ ...prev, bankAccountHolder: e.target.value }))}
                placeholder="Contoh: RM Tepi Sawah / CV Tepi Sawah Sejahtera"
              />
            </div>
          </div>
        </div>

        {/* Bagian 5: Konfigurasi Printer Kasir & Kertas */}
        <div style={{ marginTop: "2rem", borderTop: "2px dashed #cbd5e1", paddingTop: "1.5rem" }}>
          <div className="flow-section-header">
            <h3 className="flow-section-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span>🖨️</span> Pengaturan Printer &amp; Kertas Kasir
            </h3>
            <p className="flow-section-desc">
              Ukuran kertas thermal dan opsi cetak otomatis nota transaksi pada kasir.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "1.25rem",
              marginTop: "1rem",
            }}
          >
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.25rem", color: "#334155" }}>
                Lebar Kertas Struk Thermal
              </label>
              <select
                className="admin-form-input"
                style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#fff" }}
                value={settings.printerPaperWidth}
                disabled={!editable}
                onChange={(e) => setSettings((prev) => ({ ...prev, printerPaperWidth: e.target.value as "58mm" | "80mm" }))}
              >
                <option value="80mm">80mm (Standar Desktop POS / Thermal Lebar)</option>
                <option value="58mm">58mm (Printer Portabel / Mini Thermal Bluetooth)</option>
              </select>
              <span style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "2px", display: "block" }}>
                Menyesuaikan layout cetak nota agar tidak terpotong atau terlalu renggang
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontWeight: 600, color: "#1e293b" }}>
                <input
                  type="checkbox"
                  checked={settings.printerAutoPrint}
                  disabled={!editable}
                  onChange={(e) => setSettings((prev) => ({ ...prev, printerAutoPrint: e.target.checked }))}
                />
                <span>Cetak Nota Otomatis Setelah Pembayaran Sukses</span>
              </label>
              <span style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "4px", paddingLeft: "1.5rem" }}>
                Bila aktif, dialog cetak struk kasir langsung terbuka sesaat setelah tombol konfirmasi bayar ditekan
              </span>
            </div>
          </div>
        </div>

        {/* Bagian 6: Aturan Sesi Meja (Table Session Policy) */}
        <div style={{ marginTop: "2rem", borderTop: "2px dashed #cbd5e1", paddingTop: "1.5rem" }}>
          <div className="flow-section-header">
            <h3 className="flow-section-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span>🪑</span> Aturan Sesi Meja (Table Session Policy)
            </h3>
            <p className="flow-section-desc">
              Tentukan apakah pesanan meja baru memerlukan pembukaan sesi manual oleh supervisor/kasir atau otomatis dibuka saat pesanan pertama masuk.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "1.25rem",
              marginTop: "1rem",
            }}
          >
            <div
              onClick={() => editable && setSettings((prev) => ({ ...prev, tableSessionMode: "auto" }))}
              style={{
                border: settings.tableSessionMode === "auto" ? "2px solid #059669" : "1px solid #cbd5e1",
                background: settings.tableSessionMode === "auto" ? "#ecfdf5" : "#ffffff",
                borderRadius: "8px",
                padding: "1rem",
                cursor: editable ? "pointer" : "default",
                transition: "all 0.15s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <input
                  type="radio"
                  name="tableSessionMode"
                  checked={settings.tableSessionMode === "auto"}
                  onChange={() => editable && setSettings((prev) => ({ ...prev, tableSessionMode: "auto" }))}
                  disabled={!editable}
                />
                <strong style={{ color: "#065f46" }}>Otomatis Buka Sesi (Open Ordering)</strong>
                <span style={{ fontSize: "0.68rem", background: "#059669", color: "#fff", padding: "2px 6px", borderRadius: "4px" }}>
                  Rekomendasi
                </span>
              </div>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "#334155", lineHeight: 1.4 }}>
                Pelanggan dan kasir dapat langsung membuat order di meja kosong tanpa terhambat peringatan "Sesi meja belum dibuka". Sistem di backend otomatis membuka sesi meja aktif dan menghubungkannya ke order.
              </p>
            </div>

            <div
              onClick={() => editable && setSettings((prev) => ({ ...prev, tableSessionMode: "strict" }))}
              style={{
                border: settings.tableSessionMode === "strict" ? "2px solid #0284c7" : "1px solid #cbd5e1",
                background: settings.tableSessionMode === "strict" ? "#f0f9ff" : "#ffffff",
                borderRadius: "8px",
                padding: "1rem",
                cursor: editable ? "pointer" : "default",
                transition: "all 0.15s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <input
                  type="radio"
                  name="tableSessionMode"
                  checked={settings.tableSessionMode === "strict"}
                  onChange={() => editable && setSettings((prev) => ({ ...prev, tableSessionMode: "strict" }))}
                  disabled={!editable}
                />
                <strong style={{ color: "#0369a1" }}>Sesi Meja Ketat (Strict Mode)</strong>
              </div>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "#334155", lineHeight: 1.4 }}>
                Setiap meja kosong wajib dibuka sesinya terlebih dahulu oleh kasir atau supervisor melalui halaman Manajemen Meja sebelum pesanan dapat dibuat.
              </p>
            </div>
          </div>
        </div>

        {/* Bagian 7: Simulasi Live Kalkulator & Struk Thermal */}
        <div style={{ marginTop: "2rem", borderTop: "2px dashed #cbd5e1", paddingTop: "1.5rem" }}>
          <div className="flow-section-header">
            <h3 className="flow-section-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span>🧾</span> Live Simulator Struk Kasir &amp; Kalkulasi Riil
            </h3>
            <p className="flow-section-desc">
              Tampilan simulasi rincian tagihan kasir berdasarkan pengaturan di atas secara instan ({settings.printerPaperWidth}).
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "1.5rem",
              marginTop: "1rem",
              alignItems: "start",
            }}
          >
            {/* Kartu Rincian Kalkulasi */}
            <div
              style={{
                background: "#f8fafc",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
                padding: "1.25rem",
              }}
            >
              <h4 style={{ margin: "0 0 1rem", fontSize: "0.95rem", color: "#1e293b", fontWeight: 700 }}>
                Rincian Matematika Tagihan:
              </h4>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.875rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>Subtotal Menu:</span>
                  <span style={{ fontWeight: 600 }}>{formatIDR(bill.subtotal)}</span>
                </div>

                {settings.serviceChargeEnabled && (
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#0284c7" }}>
                    <span>{settings.serviceChargeName}:</span>
                    <span style={{ fontWeight: 600 }}>+{formatIDR(bill.serviceAmount)}</span>
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", color: "#475569" }}>
                  <span>Dasar Pengenaan Pajak (DPP):</span>
                  <span>{formatIDR(bill.taxBase + (settings.serviceChargeEnabled ? bill.serviceAmount : 0))}</span>
                </div>

                {settings.taxEnabled && (
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#059669" }}>
                    <span>
                      {settings.taxName} {settings.taxCalculation === "inclusive" ? "(Termasuk)" : ""}:
                    </span>
                    <span style={{ fontWeight: 600 }}>
                      {settings.taxCalculation === "inclusive"
                        ? `(${formatIDR(bill.taxAmount)})`
                        : `+${formatIDR(bill.taxAmount)}`}
                    </span>
                  </div>
                )}

                {bill.roundingAmount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#d97706" }}>
                    <span>Pembulatan ({settings.rounding}):</span>
                    <span>+{formatIDR(bill.roundingAmount)}</span>
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    borderTop: "2px solid #e2e8f0",
                    paddingTop: "0.75rem",
                    marginTop: "0.5rem",
                    fontSize: "1.1rem",
                    fontWeight: 800,
                    color: "#0f172a",
                  }}
                >
                  <span>TOTAL AKHIR:</span>
                  <span style={{ color: "#166534" }}>{formatIDR(bill.total)}</span>
                </div>
              </div>

              <div
                style={{
                  marginTop: "1rem",
                  padding: "0.75rem",
                  borderRadius: "6px",
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  fontSize: "0.75rem",
                  color: "#1e40af",
                  lineHeight: 1.4,
                }}
              >
                💡 <strong>Informasi Dispenda:</strong> Dengan tarif PB1 {settings.taxRate}%, restoran Anda memenuhi
                kewajiban pungutan pajak restoran resmi Kota/Kabupaten. Setiap struk kasir dapat mencantumkan nomor NPWPD Anda.
              </div>

              {settings.bankAccountNumber && (
                <div
                  style={{
                    marginTop: "0.75rem",
                    padding: "0.75rem",
                    borderRadius: "6px",
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    fontSize: "0.75rem",
                    color: "#166534",
                    lineHeight: 1.4,
                  }}
                >
                  🏧 <strong>Info Bank Kasir:</strong> {settings.bankName} - {settings.bankAccountNumber} a/n {settings.bankAccountHolder}
                </div>
              )}
            </div>

            {/* Simulasi Kertas Struk Thermal */}
            <div
              style={{
                background: "#ffffff",
                boxShadow: "0 4px 12px rgba(0,0,0,0.08), 0 0 1px rgba(0,0,0,0.1)",
                borderRadius: "4px",
                border: "1px solid #e2e8f0",
                padding: settings.printerPaperWidth === "58mm" ? "1rem 0.75rem" : "1.25rem 1rem",
                fontFamily: "monospace",
                fontSize: settings.printerPaperWidth === "58mm" ? "0.74rem" : "0.8rem",
                lineHeight: 1.35,
                color: "#1e293b",
                maxWidth: settings.printerPaperWidth === "58mm" ? "270px" : "340px",
                margin: "0 auto",
                width: "100%",
              }}
            >
              <div style={{ textAlign: "center", borderBottom: "1px dashed #cbd5e1", paddingBottom: "0.75rem", marginBottom: "0.75rem" }}>
                <div style={{ fontWeight: 800, fontSize: settings.printerPaperWidth === "58mm" ? "0.9rem" : "1rem" }}>TEPI SAWAH RESTO &amp; CAFE</div>
                <div style={{ fontSize: "0.7rem", color: "#475569", marginTop: "2px" }}>
                  {settings.receiptHeaderNote}
                </div>
                <div style={{ fontSize: "0.7rem", color: "#475569" }}>WA: {settings.receiptPhone}</div>
                {settings.showNpwpdOnReceipt && settings.npwpd && (
                  <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#0f172a", marginTop: "3px" }}>
                    NPWPD: {settings.npwpd}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "#64748b", marginBottom: "0.35rem" }}>
                <span>17/10/26 12:30 WIB</span>
                <span>Kasir: Meja #01</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "#64748b", borderBottom: "1px dashed #cbd5e1", paddingBottom: "0.5rem", marginBottom: "0.5rem" }}>
                <span>No: TS-20261017-0001</span>
                <span>Meja: 05</span>
              </div>

              {/* Sample Items */}
              <div style={{ borderBottom: "1px dashed #cbd5e1", paddingBottom: "0.5rem", marginBottom: "0.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Nasi Liwet Gurame (1x)</span>
                  <span>55.000</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Es Kelapa Jeruk (1x)</span>
                  <span>20.000</span>
                </div>
              </div>

              {/* Totals */}
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Subtotal:</span>
                  <span>{new Intl.NumberFormat("id-ID").format(bill.subtotal)}</span>
                </div>

                {settings.serviceChargeEnabled && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Service ({settings.serviceChargeRate}%):</span>
                    <span>{new Intl.NumberFormat("id-ID").format(bill.serviceAmount)}</span>
                  </div>
                )}

                {settings.taxEnabled && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{settings.taxName}:</span>
                    <span>{new Intl.NumberFormat("id-ID").format(bill.taxAmount)}</span>
                  </div>
                )}

                {bill.roundingAmount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Pembulatan:</span>
                    <span>{new Intl.NumberFormat("id-ID").format(bill.roundingAmount)}</span>
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontWeight: 800,
                    fontSize: settings.printerPaperWidth === "58mm" ? "0.85rem" : "0.95rem",
                    borderTop: "1px solid #1e293b",
                    borderBottom: "1px solid #1e293b",
                    padding: "4px 0",
                    marginTop: "4px",
                  }}
                >
                  <span>TOTAL:</span>
                  <span>{formatIDR(bill.total)}</span>
                </div>
              </div>

              {settings.bankAccountNumber && (
                <div style={{ textAlign: "center", borderTop: "1px dashed #cbd5e1", marginTop: "0.5rem", paddingTop: "0.5rem", fontSize: "0.68rem", color: "#475569" }}>
                  Transfer: {settings.bankName} {settings.bankAccountNumber}<br />
                  a/n {settings.bankAccountHolder}
                </div>
              )}

              <div style={{ textAlign: "center", borderTop: "1px dashed #cbd5e1", marginTop: "0.5rem", paddingTop: "0.5rem", fontSize: "0.68rem", color: "#475569", whiteSpace: "pre-line" }}>
                {settings.receiptFooterNote}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
