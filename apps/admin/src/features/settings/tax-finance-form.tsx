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

import { Button, Card } from "@tepisawah/ui";
import {
  type TaxSettings,
  type TaxCalculationMode,
  type RoundingMode,
  DEFAULT_TAX_SETTINGS,
  loadTaxSettings,
  saveTaxSettings,
  calculateBill,
} from "@tepisawah/config";
import { useState, useMemo, type ReactNode } from "react";

export interface TaxFinanceFormProps {
  editable: boolean;
  onSavedToast?: (message: string) => void;
}

export function TaxFinanceForm({ editable, onSavedToast }: TaxFinanceFormProps): ReactNode {
  const [settings, setSettings] = useState<TaxSettings>(() => loadTaxSettings());
  const [saving, setSaving] = useState(false);

  // Sample items for live simulator
  const sampleSubtotal = 75000; // Contoh: Nasi Liwet Gurame (55k) + Es Kelapa Jeruk (20k)
  const sampleDiscount = 0;

  const bill = useMemo(() => {
    return calculateBill(sampleSubtotal, sampleDiscount, settings);
  }, [settings, sampleSubtotal, sampleDiscount]);

  const formatIDR = (val: number) => {
    return "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(val));
  };

  const handleSave = () => {
    setSaving(true);
    saveTaxSettings(settings);
    setTimeout(() => {
      setSaving(false);
      onSavedToast?.("Pengaturan Pajak Restoran (PB1) & Struk berhasil disimpan dan disinkronkan ke POS Kasir.");
    }, 250);
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

        {/* Bagian 4: Simulasi Live Kalkulator & Struk Thermal */}
        <div style={{ marginTop: "2rem", borderTop: "2px dashed #cbd5e1", paddingTop: "1.5rem" }}>
          <div className="flow-section-header">
            <h3 className="flow-section-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span>🧾</span> Live Simulator Struk Kasir &amp; Kalkulasi Riil
            </h3>
            <p className="flow-section-desc">
              Tampilan simulasi rincian tagihan kasir berdasarkan pengaturan di atas secara instan.
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
            </div>

            {/* Simulasi Kertas Struk Thermal 80mm */}
            <div
              style={{
                background: "#ffffff",
                boxShadow: "0 4px 12px rgba(0,0,0,0.08), 0 0 1px rgba(0,0,0,0.1)",
                borderRadius: "4px",
                border: "1px solid #e2e8f0",
                padding: "1.25rem 1rem",
                fontFamily: "monospace",
                fontSize: "0.8rem",
                lineHeight: 1.35,
                color: "#1e293b",
                maxWidth: "340px",
                margin: "0 auto",
              }}
            >
              <div style={{ textAlign: "center", borderBottom: "1px dashed #cbd5e1", paddingBottom: "0.75rem", marginBottom: "0.75rem" }}>
                <div style={{ fontWeight: 800, fontSize: "1rem" }}>TEPI SAWAH RESTO &amp; CAFE</div>
                <div style={{ fontSize: "0.72rem", color: "#475569", marginTop: "2px" }}>
                  {settings.receiptHeaderNote}
                </div>
                <div style={{ fontSize: "0.72rem", color: "#475569" }}>WA: {settings.receiptPhone}</div>
                {settings.showNpwpdOnReceipt && settings.npwpd && (
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#0f172a", marginTop: "3px" }}>
                    NPWPD: {settings.npwpd}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "#64748b", marginBottom: "0.5rem" }}>
                <span>17/10/26 12:30 WIB</span>
                <span>Kasir: Meja #01</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "#64748b", borderBottom: "1px dashed #cbd5e1", paddingBottom: "0.5rem", marginBottom: "0.5rem" }}>
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
                    fontSize: "0.95rem",
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

              <div style={{ textAlign: "center", borderTop: "1px dashed #cbd5e1", marginTop: "0.75rem", paddingTop: "0.75rem", fontSize: "0.72rem", color: "#475569", whiteSpace: "pre-line" }}>
                {settings.receiptFooterNote}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
