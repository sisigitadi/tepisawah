import { Button, Card } from "@tepisawah/ui";
import { useState } from "react";
import type { ReactNode } from "react";
import {
  loadOrderFlowSettings,
  saveOrderFlowSettings,
  type KitchenBypassMode,
  type OrderFlowMode,
  type OrderFlowSettings,
} from "./order-flow-settings.js";
import { getSupabaseClient } from "../../lib/supabase.js";

export interface OrderFlowFormProps {
  editable: boolean;
  onSavedToast?: (message: string) => void;
}

export function OrderFlowForm({ editable, onSavedToast }: OrderFlowFormProps): ReactNode {
  const [settings, setSettings] = useState<OrderFlowSettings>(() => loadOrderFlowSettings());
  const [saving, setSaving] = useState(false);

  const handleSelectMode = (mode: OrderFlowMode) => {
    if (!editable) return;
    setSettings((prev) => ({ ...prev, orderFlowMode: mode }));
  };

  const handleSave = () => {
    setSaving(true);
    saveOrderFlowSettings(settings);

    try {
      const client = getSupabaseClient();
      void (client.from("tax_settings") as any)
        .update({
          kitchen_enabled: settings.kitchenEnabled,
          kitchen_bypass_mode: settings.kitchenBypassMode,
          updated_at: new Date().toISOString(),
        })
        .eq("id", "22222222-2222-4222-8222-222222222222");
    } catch {
      // Non-blocking
    }

    setTimeout(() => {
      setSaving(false);
      onSavedToast?.("Pengaturan alur pemesanan & status dapur berhasil disimpan.");
    }, 250);
  };

  return (
    <Card
      elevation="low"
      title="Alur Pemesanan Meja & Keuangan"
      description="Tentukan alur pemesanan untuk pelanggan, fleksibilitas kasir, dan keterlibatan pramusaji."
      footer={
        <Button
          variant="primary"
          loading={saving}
          disabled={!editable}
          onClick={handleSave}
        >
          Simpan Alur Pemesanan
        </Button>
      }
    >
      <div className="flow-settings-container">
        <div className="flow-section-header">
          <h3 className="flow-section-title">Mode Alur Pemesanan Pelanggan (QR Order)</h3>
          <p className="flow-section-desc">
            Pilih bagaimana sistem memproses pesanan yang dibuat oleh pelanggan dari meja.
          </p>
        </div>

        <div className="flow-cards-grid">
          {/* Opsi 1: Fleksibel */}
          <div
            className={`flow-card ${settings.orderFlowMode === "flexible" ? "flow-card--active" : ""}`}
            onClick={() => handleSelectMode("flexible")}
            role="button"
            tabIndex={0}
          >
            <div className="flow-card__top">
              <span className="flow-card__radio">
                <input
                  type="radio"
                  name="orderFlowMode"
                  checked={settings.orderFlowMode === "flexible"}
                  onChange={() => handleSelectMode("flexible")}
                  disabled={!editable}
                />
              </span>
              <div className="flow-card__heading">
                <div className="flow-card__title-row">
                  <h4 className="flow-card__title">Mode Fleksibel (Hybrid)</h4>
                  <span className="flow-badge flow-badge--recommended">Rekomendasi</span>
                </div>
                <span className="flow-card__sub">Pelanggan bebas memilih saat checkout</span>
              </div>
            </div>
            <p className="flow-card__body">
              Pelanggan dapat memilih opsi <strong>"Bayar Nanti di Kasir"</strong> ATAU{" "}
              <strong>"Bayar Langsung via QRIS di HP"</strong> saat mengirim pesanan. Sangat fleksibel untuk semua tipe pengunjung.
            </p>
            <div className="flow-card__steps">
              <span>Scan QR Meja</span> &rarr; <span>Pilih Menu</span> &rarr; <span>Pilih Bayar di Kasir / QRIS</span>
            </div>
          </div>

          {/* Opsi 2: Bayar di Kasir */}
          <div
            className={`flow-card ${settings.orderFlowMode === "post_pay" ? "flow-card--active" : ""}`}
            onClick={() => handleSelectMode("post_pay")}
            role="button"
            tabIndex={0}
          >
            <div className="flow-card__top">
              <span className="flow-card__radio">
                <input
                  type="radio"
                  name="orderFlowMode"
                  checked={settings.orderFlowMode === "post_pay"}
                  onChange={() => handleSelectMode("post_pay")}
                  disabled={!editable}
                />
              </span>
              <div className="flow-card__heading">
                <div className="flow-card__title-row">
                  <h4 className="flow-card__title">Pesan Dulu, Bayar di Kasir</h4>
                  <span className="flow-badge">Post-Payment</span>
                </div>
                <span className="flow-card__sub">Standar resto keluarga & santai</span>
              </div>
            </div>
            <p className="flow-card__body">
              Pesanan langsung masuk ke antrian masak dapur. Pelanggan menikmati hidangan terlebih dahulu, lalu melunasi tagihan di meja kasir sebelum pulang (Tunai, QRIS Kasir, atau EDC).
            </p>
            <div className="flow-card__steps">
              <span>Scan QR Meja</span> &rarr; <span>Kirim Pesanan</span> &rarr; <span>Dapur Masak</span> &rarr; <span>Bayar di Kasir</span>
            </div>
          </div>

          {/* Opsi 3: Wajib Bayar di Awal */}
          <div
            className={`flow-card ${settings.orderFlowMode === "pre_pay" ? "flow-card--active" : ""}`}
            onClick={() => handleSelectMode("pre_pay")}
            role="button"
            tabIndex={0}
          >
            <div className="flow-card__top">
              <span className="flow-card__radio">
                <input
                  type="radio"
                  name="orderFlowMode"
                  checked={settings.orderFlowMode === "pre_pay"}
                  onChange={() => handleSelectMode("pre_pay")}
                  disabled={!editable}
                />
              </span>
              <div className="flow-card__heading">
                <div className="flow-card__title-row">
                  <h4 className="flow-card__title">Wajib Bayar di Awal Baru Masak</h4>
                  <span className="flow-badge">Pre-Payment</span>
                </div>
                <span className="flow-card__sub">Anti pesanan tertinggal / belum bayar</span>
              </div>
            </div>
            <p className="flow-card__body">
              Pelanggan harus menyelesaikan pembayaran (melalui QRIS di HP atau konfirmasi kasir) terlebih dahulu. Setelah status pembayaran lunas, tiket pesanan otomatis diteruskan ke dapur.
            </p>
            <div className="flow-card__steps">
              <span>Scan QR Meja</span> &rarr; <span>Bayar QRIS / Kasir</span> &rarr; <span>Status Lunas</span> &rarr; <span>Dapur Masak</span>
            </div>
          </div>
        </div>

        {/* Status Modul Dapur & Alur Memasak (KDS) */}
        <div className="flow-section-header" style={{ marginTop: "1.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
            <h3 className="flow-section-title">Status Modul Dapur &amp; Alur Memasak (KDS)</h3>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                padding: "0.2rem 0.6rem",
                borderRadius: "999px",
                background: settings.kitchenEnabled ? "rgba(46, 125, 50, 0.12)" : "rgba(198, 40, 40, 0.12)",
                color: settings.kitchenEnabled ? "#2e7d32" : "#c62828",
                border: `1px solid ${settings.kitchenEnabled ? "rgba(46, 125, 50, 0.3)" : "rgba(198, 40, 40, 0.3)"}`,
              }}
            >
              {settings.kitchenEnabled ? "● Dapur Aktif (Layar KDS)" : "○ Dapur Nonaktif (Alur Langsung)"}
            </span>
          </div>
          <p className="flow-section-desc">
            Tentukan apakah pesanan diteruskan ke Layar Dapur (/kitchen) atau kasir/waiter langsung memproses hidangan dan mengantar ke meja.
          </p>
        </div>

        <div className="flow-cards-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          {/* Opsi 1: Dapur Aktif */}
          <div
            className={`flow-card ${settings.kitchenEnabled ? "flow-card--active" : ""}`}
            onClick={() => editable && setSettings((prev) => ({ ...prev, kitchenEnabled: true }))}
            role="button"
            tabIndex={0}
          >
            <div className="flow-card__top">
              <span className="flow-card__radio">
                <input
                  type="radio"
                  name="kitchenEnabled"
                  checked={settings.kitchenEnabled}
                  onChange={() => editable && setSettings((prev) => ({ ...prev, kitchenEnabled: true }))}
                  disabled={!editable}
                />
              </span>
              <div className="flow-card__heading">
                <div className="flow-card__title-row">
                  <h4 className="flow-card__title">Dapur Aktif (Layar KDS)</h4>
                  <span className="flow-badge">Standar Resto</span>
                </div>
                <span className="flow-card__sub">Tiket masak mengalir ke layar tablet koki</span>
              </div>
            </div>
            <p className="flow-card__body">
              Pesanan masuk ke Layar Pesanan Dapur (/kitchen). Koki memantau antrean masak, memulai proses memasak (<em>Memasak</em>), dan menandai saat masakan siap diambil (<em>Siap Saji</em>).
            </p>
            <div className="flow-card__steps">
              <span>Pesanan Masuk</span> &rarr; <span>Koki Masak (KDS)</span> &rarr; <span>Siap Saji</span> &rarr; <span>Pelayan Antar</span>
            </div>
          </div>

          {/* Opsi 2: Dapur Nonaktif */}
          <div
            className={`flow-card ${!settings.kitchenEnabled ? "flow-card--active" : ""}`}
            onClick={() => editable && setSettings((prev) => ({ ...prev, kitchenEnabled: false }))}
            role="button"
            tabIndex={0}
          >
            <div className="flow-card__top">
              <span className="flow-card__radio">
                <input
                  type="radio"
                  name="kitchenEnabled"
                  checked={!settings.kitchenEnabled}
                  onChange={() => editable && setSettings((prev) => ({ ...prev, kitchenEnabled: false }))}
                  disabled={!editable}
                />
              </span>
              <div className="flow-card__heading">
                <div className="flow-card__title-row">
                  <h4 className="flow-card__title">Dapur Nonaktif (Alur Langsung)</h4>
                  <span className="flow-badge flow-badge--recommended">Alur Cepat</span>
                </div>
                <span className="flow-card__sub">Kasir/waiter terima transaksi, masak, langsung antar</span>
              </div>
            </div>
            <p className="flow-card__body">
              Restoran beroperasi tanpa monitor dapur terpisah. Kasir atau pramusaji menerima pesanan, proses memasak dilakukan langsung (lewat struk fisik), dan staf langsung mengantar pesanan ke meja tamu.
            </p>
            <div className="flow-card__steps">
              <span>Terima Transaksi</span> &rarr; <span>Proses Masak</span> &rarr; <span>Langsung Antar ke Meja</span>
            </div>
          </div>
        </div>

        {/* Sub-opsi bila Dapur Nonaktif */}
        {!settings.kitchenEnabled && (
          <div
            style={{
              marginTop: "1rem",
              padding: "1rem",
              borderRadius: "8px",
              background: "var(--surface-container, #fdfbf7)",
              border: "1px dashed var(--outline-variant, #cbd5e1)",
            }}
          >
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--color-primary-dark, #1b4332)", marginBottom: "0.5rem" }}>
              ⚡ Mode Antar saat Dapur Nonaktif:
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "0.75rem" }}>
              <label
                style={{
                  display: "flex",
                  gap: "0.6rem",
                  padding: "0.75rem",
                  borderRadius: "6px",
                  background: settings.kitchenBypassMode === "direct_serve" ? "rgba(46, 125, 50, 0.08)" : "#fff",
                  border: `1px solid ${settings.kitchenBypassMode === "direct_serve" ? "#2e7d32" : "#e2e8f0"}`,
                  cursor: editable ? "pointer" : "default",
                }}
              >
                <input
                  type="radio"
                  name="kitchenBypassMode"
                  checked={settings.kitchenBypassMode === "direct_serve"}
                  onChange={() => editable && setSettings((prev) => ({ ...prev, kitchenBypassMode: "direct_serve" }))}
                  disabled={!editable}
                  style={{ marginTop: "2px" }}
                />
                <div>
                  <strong style={{ fontSize: "0.85rem", display: "block" }}>Otomatis Siap Antar (Direct Serve)</strong>
                  <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted, #64748b)" }}>
                    Pesanan yang dikonfirmasi langsung siap antar ke meja tanpa jeda status masak manual.
                  </span>
                </div>
              </label>

              <label
                style={{
                  display: "flex",
                  gap: "0.6rem",
                  padding: "0.75rem",
                  borderRadius: "6px",
                  background: settings.kitchenBypassMode === "manual_cook_serve" ? "rgba(46, 125, 50, 0.08)" : "#fff",
                  border: `1px solid ${settings.kitchenBypassMode === "manual_cook_serve" ? "#2e7d32" : "#e2e8f0"}`,
                  cursor: editable ? "pointer" : "default",
                }}
              >
                <input
                  type="radio"
                  name="kitchenBypassMode"
                  checked={settings.kitchenBypassMode === "manual_cook_serve"}
                  onChange={() => editable && setSettings((prev) => ({ ...prev, kitchenBypassMode: "manual_cook_serve" }))}
                  disabled={!editable}
                  style={{ marginTop: "2px" }}
                />
                <div>
                  <strong style={{ fontSize: "0.85rem", display: "block" }}>Kontrol Masak Kasir / Waiter</strong>
                  <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted, #64748b)" }}>
                    Kasir &amp; waiter dapat menekan tombol &ldquo;Mulai Masak&rdquo; lalu &ldquo;Selesai &amp; Antar&rdquo; langsung dari meja kasir/waiter.
                  </span>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Fleksibilitas Kasir & Pramusaji */}
        <div className="flow-section-header" style={{ marginTop: "1.75rem" }}>
          <h3 className="flow-section-title">Fleksibilitas Kasir & Pramusaji (Staff Assisted)</h3>
          <p className="flow-section-desc">
            Dukungan pelanggan yang tidak menggunakan smartphone atau butuh bantuan pelayan.
          </p>
        </div>

        <div className="flow-toggles-list">
          <label className="flow-toggle-item">
            <input
              type="checkbox"
              checked={settings.allowStaffTableOrder}
              disabled={!editable}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, allowStaffTableOrder: e.target.checked }))
              }
            />
            <div className="flow-toggle-text">
              <strong>Izinkan Kasir & Pramusaji Input Pesanan Meja Langsung</strong>
              <p>
                Pelayan dapat mencatat pesanan lewat smartphone pramusaji (Waiter Console), dan kasir dapat memilih nomor meja langsung dari POS Kasir tanpa mengharuskan pelanggan scan QR mandiri.
              </p>
            </div>
          </label>

          <label className="flow-toggle-item">
            <input
              type="checkbox"
              checked={settings.autoAcceptPostPay}
              disabled={!editable}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, autoAcceptPostPay: e.target.checked }))
              }
            />
            <div className="flow-toggle-text">
              <strong>Otomatis Teruskan Pesanan "Bayar di Kasir" ke Dapur</strong>
              <p>
                Pesanan yang dikirim oleh pelanggan langsung muncul di Kitchen Display System (KDS) tanpa perlu tombol "Konfirmasi" manual dari kasir, mempercepat proses masak saat resto ramai.
              </p>
            </div>
          </label>
        </div>

        <div className="flow-section-header" style={{ marginTop: "1.5rem" }}>
          <h3 className="flow-section-title">Catatan Petunjuk Kasir pada Struk / Checkout</h3>
        </div>
        <div className="flow-input-wrap">
          <input
            type="text"
            className="admin-form-input"
            value={settings.qrisInstruction}
            disabled={!editable}
            onChange={(e) =>
              setSettings((prev) => ({ ...prev, qrisInstruction: e.target.value }))
            }
            placeholder="Petunjuk pembayaran untuk pelanggan..."
          />
        </div>
      </div>
    </Card>
  );
}
