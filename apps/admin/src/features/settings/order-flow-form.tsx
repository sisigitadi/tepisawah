/**
 * Order Flow & Finance Form (Alur Pemesanan & Kasir).
 */
import { Button, Card } from "@tepisawah/ui";
import { useState } from "react";
import type { ReactNode } from "react";
import {
  loadOrderFlowSettings,
  saveOrderFlowSettings,
  type OrderFlowMode,
  type OrderFlowSettings,
} from "./order-flow-settings.js";

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
    setTimeout(() => {
      setSaving(false);
      onSavedToast?.("Pengaturan alur pemesanan & kasir berhasil disimpan.");
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
