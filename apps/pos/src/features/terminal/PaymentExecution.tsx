/**
 * @tepisawah/pos — payment execution panel.
 *
 * Split-bill toggle, payment channel grid, dynamic cash-tender and QRIS
 * workspaces, the primary settlement button with success animation, and the
 * authentic 80mm thermal slip dock. Ported from the Stitch POS reference.
 */

import { useState, type ReactNode } from "react";
import {
  BackspaceIcon,
  BankIcon,
  CardIcon,
  CashIcon,
  CheckCircleIcon,
  EyeIcon,
  PrintIcon,
  QrIcon,
  ReceiptLongIcon,
  RefreshIcon,
  TimerIcon,
  TrashIcon,
} from "@tepisawah/ui";
import type { PaymentMethod, QueueOrder } from "../../data/terminal.js";
import {
  PAYMENT_METHODS,
  TENDER_PRESETS,
  discountOf,
  formatIDR,
  formatNumber,
  grandTotalOf,
  serviceOf,
  subtotalOf,
  taxOf,
  getPosTaxSettings,
} from "../../data/terminal.js";
import { useTaxSettings } from "../../hooks/index.js";
import { QrisFullscreenModal } from "./QrisFullscreenModal.js";
import { ThermalSlip } from "./ThermalSlip.js";

type SettlementState = "idle" | "printing" | "success";

interface PaymentExecutionProps {
  order: QueueOrder;
  method: PaymentMethod["id"];
  tendered: string;
  onMethodChange: (method: PaymentMethod["id"]) => void;
  onTenderedChange: (value: string) => void;
  onSettle: () => void;
  onVoid?: () => void;
}

const METHOD_ICONS: Record<PaymentMethod["id"], ReactNode> = {
  cash: <CashIcon />,
  qris: <QrIcon />,
  edc: <CardIcon />,
  wallet: <BankIcon />,
  platform: <ReceiptLongIcon />,
};

export function PaymentExecution({
  order,
  method,
  tendered,
  onMethodChange,
  onTenderedChange,
  onSettle,
  onVoid,
}: PaymentExecutionProps): ReactNode {
  const [split, setSplit] = useState<"single" | "item" | "pax">("single");
  const [showSplitOptions, setShowSplitOptions] = useState<boolean>(false);
  const [settlement, setSettlement] = useState<SettlementState>("idle");
  const [showQrisFullscreen, setShowQrisFullscreen] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const taxSettings = useTaxSettings();
  const grandTotal = grandTotalOf(order);
  const tenderedNumber = Number.parseInt(tendered.replaceAll(/[.,]/g, ""), 10) || 0;
  const change = tenderedNumber - grandTotal;
  const isCashLike = method === "cash" || method === "edc";

  const handleSettle = (): void => {
    if (settlement !== "idle") return;
    setSettlement("printing");
    onSettle();
    if (taxSettings.printerAutoPrint) {
      window.setTimeout(() => {
        window.print();
      }, 400);
    }
    window.setTimeout(() => {
      setSettlement("success");
      window.setTimeout(() => setSettlement("idle"), 2200);
    }, 1000);
  };

  const setNominal = (value: number): void => {
    onTenderedChange(formatNumber(value));
  };

  const clearNominal = (): void => {
    onTenderedChange("");
  };

  return (
    <section className="pos-settlement" aria-label="Eksekusi pembayaran">
      <div className="pos-settlement__card">
        {/* Bill Summary Banner */}
        <div
          style={{
            background: "linear-gradient(135deg, #183a1d 0%, #2e6b34 100%)",
            color: "#fefae0",
            padding: "1rem 1.25rem",
            borderRadius: "10px",
            marginBottom: "1rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            boxShadow: "0 4px 12px rgba(24, 58, 29, 0.15)",
          }}
        >
          <div>
            <div style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#dda15e", fontWeight: 700 }}>
              {order.table} ({order.ticket})
            </div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, marginTop: "2px", letterSpacing: "-0.01em" }}>
              {formatIDR(grandTotal)}
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: "0.8rem", color: "rgba(254, 250, 224, 0.9)" }}>
            <div>Subtotal: {formatIDR(subtotalOf(order))}</div>
            {taxSettings.taxEnabled && taxOf(order) > 0 ? (
              <div style={{ color: "#86efac", fontWeight: 600 }}>PB1 (10%): +{formatIDR(taxOf(order))}</div>
            ) : (
              <div style={{ color: "rgba(254, 250, 224, 0.65)" }}>PB1: Rp 0 (Nonaktif)</div>
            )}
          </div>
        </div>

        <div className="pos-settlement__head">
          <div className="pos-settlement__title-group">
            <span className="pos-settlement__title">Metode Pembayaran</span>
            <span className="pos-settlement__subtitle">Pilih cara bayar tamu</span>
          </div>

          <button
            type="button"
            className={`pos-split-toggle-btn ${showSplitOptions || split !== "single" ? "pos-split-toggle-btn--active" : ""}`}
            onClick={() => setShowSplitOptions((prev) => !prev)}
            aria-expanded={showSplitOptions}
            title="Bagi tagihan (Split Bill)"
          >
            <span>⚙️ {split === "single" ? "Opsi Split Bill" : split === "item" ? "Split: Pisah Menu" : "Split: Bagi Rata"}</span>
          </button>
        </div>

        {showSplitOptions && (
          <div className="pos-split-drawer" role="group" aria-label="Mode bill">
            <span className="pos-split-drawer__label">Mode Tagihan:</span>
            <div className="pos-split">
              {(["single", "item", "pax"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`pos-split__btn ${split === mode ? "pos-split__btn--active" : ""}`}
                  aria-pressed={split === mode}
                  onClick={() => setSplit(mode)}
                >
                  {mode === "single" ? "Satu Tagihan (Utuh)" : mode === "item" ? "Pisah Per Menu" : "Bagi Rata (Pax)"}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="pos-methods">
          {PAYMENT_METHODS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`pos-method ${method === entry.id ? "pos-method--active" : ""}`}
              aria-pressed={method === entry.id}
              onClick={() => onMethodChange(entry.id)}
            >
              <span className="pos-method__icon" aria-hidden="true">{METHOD_ICONS[entry.id]}</span>
              <span className="pos-method__text">
                <span className="pos-method__label">{entry.label}</span>
                <span className="pos-method__hint">{entry.hint}</span>
              </span>
            </button>
          ))}
        </div>

        {isCashLike ? (
          <div className="pos-workspace">
            <div className="pos-workspace__head">
              <label className="pos-workspace__label" htmlFor="cashInput">
                Nominal Uang Tunai Diterima
              </label>
              <span className="pos-workspace__bill">Tagihan: {formatIDR(grandTotal)}</span>
            </div>

            <div className="pos-tender-presets">
              {TENDER_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  className="pos-tender-preset"
                  onClick={() => setNominal(preset.value)}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="pos-tender-input">
              <span className="pos-tender-input__currency" aria-hidden="true">Rp</span>
              <input
                id="cashInput"
                type="text"
                inputMode="numeric"
                className="pos-tender-input__field"
                value={tendered}
                onChange={(event) => onTenderedChange(event.target.value)}
                placeholder="0"
              />
              <button
                type="button"
                className="pos-tender-input__clear"
                onClick={clearNominal}
                aria-label="Hapus nominal"
              >
                <BackspaceIcon />
              </button>
            </div>

            <div className={`pos-change ${change < 0 ? "pos-change--short" : ""}`}>
              <div>
                <span className="pos-change__label">Kembalian Otomatis</span>
                <span className="pos-change__note">
                  {change < 0 ? "Uang yang dimasukkan kurang" : "Uang pecahan kasir aman"}
                </span>
              </div>
              <span className="pos-change__value">
                {change < 0 ? "-" : ""}{formatIDR(Math.abs(change))}
              </span>
            </div>

            <div className="pos-denomination">
              <span>Saran pecahan kasir:</span>
              <span className="pos-denomination__value">{suggestDenomination(Math.abs(change))}</span>
            </div>
          </div>
        ) : method === "platform" ? (
          <div className="pos-workspace">
            <div className="pos-workspace__head">
              <label className="pos-workspace__label">
                Pelunasan Platform Online ({order.orderType ?? "Mitra Delivery"})
              </label>
              <span className="pos-workspace__bill">Tagihan: {formatIDR(grandTotal)}</span>
            </div>
            <div style={{ padding: "1.25rem 0", color: "var(--ink-variant, #404040)", fontSize: "0.875rem", lineHeight: "1.6" }}>
              <p style={{ margin: "0 0 0.5rem 0", fontWeight: 600, color: "var(--color-primary-dark, #1b4332)" }}>
                ✓ Pembayaran Non-Tunai Mitra
              </p>
              <p style={{ margin: 0 }}>
                Pelanggan telah membayar melalui aplikasi mitra {order.orderType ?? "Online Delivery"}.
                {order.externalReference ? ` Nomor Referensi: #${order.externalReference}. ` : " "}
                Penyelesaian ini akan mencatat transaksi sebagai lunas tanpa membuka laci kasir tunai.
              </p>
            </div>
          </div>
        ) : method === "wallet" ? (
          <div className="pos-workspace">
            <div className="pos-workspace__head">
              <label className="pos-workspace__label">
                Transfer Bank Resto ({taxSettings.bankName || "BCA"})
              </label>
              <span className="pos-workspace__bill">Tagihan: {formatIDR(grandTotal)}</span>
            </div>
            <div style={{ padding: "1rem 0", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{ background: "#f8fafc", padding: "1rem", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Bank Tujuan:</div>
                <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1e293b" }}>{taxSettings.bankName || "BCA"}</div>

                <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.5rem" }}>Nomor Rekening:</div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "2px" }}>
                  <span style={{ fontSize: "1.2rem", fontWeight: 800, color: "#0f172a", fontFamily: "monospace" }}>
                    {taxSettings.bankAccountNumber || "1340889210"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (taxSettings.bankAccountNumber) {
                        navigator.clipboard.writeText(taxSettings.bankAccountNumber);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }
                    }}
                    style={{ padding: "3px 8px", fontSize: "0.75rem", borderRadius: "4px", border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}
                  >
                    {copied ? "✓ Tersalin" : "Salin"}
                  </button>
                </div>

                <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.5rem" }}>Atas Nama Pemilik:</div>
                <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#334155" }}>
                  {taxSettings.bankAccountHolder || "RM Tepi Sawah"}
                </div>
              </div>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b" }}>
                Pastikan dana sudah masuk ke rekening sebelum menekan tombol Bayar &amp; Cetak Struk.
              </p>
            </div>
          </div>
        ) : (
          <QrisWorkspace order={order} taxSettings={taxSettings} onOpenFullscreen={() => setShowQrisFullscreen(true)} />
        )}

        <div className="pos-settle">
          <button
            type="button"
            id="btnPayFinal"
            className={`pos-settle__primary pos-settle__primary--${settlement}`}
            onClick={handleSettle}
            disabled={settlement !== "idle"}
          >
            {settlement === "idle" && (<><ReceiptLongIcon aria-hidden="true" /> <span>Bayar &amp; Cetak Struk (F3 / Enter)</span></>)}
            {settlement === "printing" && (<><RefreshIcon className="pos-spin" aria-hidden="true" /> <span>Mencetak Struk Kasir &amp; Sinkronisasi...</span></>)}
            {settlement === "success" && (
              <>
                <CheckCircleIcon aria-hidden="true" />{" "}
                <span>
                  {method === "platform"
                    ? "Pelunasan Mitra Sukses!"
                    : method === "qris"
                      ? "Pembayaran QRIS Sukses!"
                      : "Pembayaran Sukses! (Laci Terbuka)"}
                </span>
              </>
            )}
          </button>
          <div className="pos-settle__row">
            <button
              type="button"
              className="pos-btn pos-btn--outline"
              onClick={() => window.print()}
              style={{ width: "100%", justifyContent: "center", padding: "0.65rem 1rem" }}
            >
              <EyeIcon aria-hidden="true" /> Preview Struk Tagihan
            </button>
          </div>
          {onVoid && (
            <div className="pos-settle__danger-row">
              <button
                type="button"
                className="pos-settle__void-btn"
                onClick={() => {
                  if (
                    window.confirm(
                      `Yakin ingin membatalkan (VOID) pesanan ${order.table} (${order.ticket})? Seluruh pesanan ini akan dibatalkan.`
                    )
                  ) {
                    onVoid();
                  }
                }}
                title="Batalkan seluruh pesanan meja ini (memerlukan konfirmasi)"
              >
                <TrashIcon aria-hidden="true" /> Batalkan Pesanan (Void Menu)
              </button>
            </div>
          )}
        </div>
      </div>

      <ThermalSlip order={order} method={method} tenderedNumber={tenderedNumber} change={change} />

      <QrisFullscreenModal
        open={showQrisFullscreen}
        onClose={() => setShowQrisFullscreen(false)}
        order={order}
        qrisImageUrl={taxSettings.qrisImageUrl}
        qrisPayload={taxSettings.qrisPayload}
      />
    </section>
  );
}

function suggestDenomination(amount: number): string {
  if (amount <= 0) return "—";
  const denominations = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100];
  const parts: string[] = [];
  let remaining = amount;
  for (const denom of denominations) {
    const count = Math.floor(remaining / denom);
    if (count > 0 && parts.length < 3) {
      parts.push(`${count}x ${denom >= 1000 ? `${denom / 1000}k` : denom}`);
    }
    remaining -= count * denom;
  }
  return parts.length > 0 ? parts.join(" + ") : "bulatkan";
}

interface QrisWorkspaceProps {
  order: QueueOrder;
  taxSettings: ReturnType<typeof useTaxSettings>;
  onOpenFullscreen?: () => void;
}

function QrisWorkspace({ order, taxSettings, onOpenFullscreen }: QrisWorkspaceProps): ReactNode {
  const grandTotal = grandTotalOf(order);

  const dynamicQrUrl =
    !taxSettings.qrisImageUrl && taxSettings.qrisPayload
      ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(taxSettings.qrisPayload)}`
      : null;

  return (
    <div className="pos-qris">
      <div className="pos-qris__head">
        <span className="pos-qris__label">QRIS Settlement Gateway</span>
        <button
          type="button"
          onClick={onOpenFullscreen}
          style={{
            padding: "3px 8px",
            borderRadius: "4px",
            border: "1px solid #059669",
            background: "#ecfdf5",
            color: "#065f46",
            fontSize: "0.75rem",
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          🔍 Perbesar di Layar
        </button>
      </div>

      <div
        className="pos-qris__stage"
        onClick={onOpenFullscreen}
        style={{ cursor: "pointer" }}
        title="Klik untuk scan pelanggan"
      >
        {taxSettings.qrisImageUrl ? (
          <img
            src={taxSettings.qrisImageUrl}
            alt="QRIS"
            style={{ width: "125px", height: "125px", objectFit: "contain", borderRadius: "6px" }}
          />
        ) : dynamicQrUrl ? (
          <img
            src={dynamicQrUrl}
            alt="QRIS"
            style={{ width: "125px", height: "125px", objectFit: "contain", borderRadius: "6px" }}
          />
        ) : (
          <QrGlyph />
        )}
        <span className="pos-qris__overlay">{order.ticket}</span>
      </div>

      <div className="pos-qris__meta">
        <p className="pos-qris__nmid">NMID: ID1020261947264</p>
        <p className="pos-qris__hint">Klik QR atau tombol di atas untuk scan pelanggan</p>
      </div>

      <div className="pos-qris__status">
        <span className="pos-qris__status-dot" aria-hidden="true" />
        <span>Tagihan: {formatIDR(grandTotal)}</span>
      </div>
    </div>
  );
}

function QrGlyph(): ReactNode {
  return (
    <svg className="pos-qris__glyph" viewBox="0 0 100 100" fill="currentColor" aria-hidden="true">
      <path fill="#183A1D" d="M5,5 h30 v30 h-30 z M10,10 v20 h20 v-20 z M15,15 h10 v10 h-10 z" />
      <path fill="#183A1D" d="M65,5 h30 v30 h-30 z M70,10 v20 h20 v-20 z M75,15 h10 v10 h-10 z" />
      <path fill="#183A1D" d="M5,65 h30 v30 h-30 z M10,70 v20 h20 v-20 z M15,75 h10 v10 h-10 z" />
      <rect fill="#12521e" height="8" width="8" x="42" y="10" />
      <rect fill="#12521e" height="12" width="6" x="52" y="18" />
      <rect fill="#12521e" height="6" width="12" x="40" y="28" />
      <rect fill="#12521e" height="6" width="12" x="15" y="42" />
      <rect fill="#12521e" height="8" width="8" x="25" y="52" />
      <rect fill="#835418" height="10" width="10" x="45" y="45" />
      <rect fill="#12521e" height="14" width="8" x="60" y="42" />
      <rect fill="#12521e" height="6" width="12" x="75" y="45" />
      <rect fill="#12521e" height="12" width="8" x="45" y="65" />
      <rect fill="#12521e" height="8" width="14" x="58" y="68" />
      <rect fill="#12521e" height="10" width="10" x="75" y="65" />
      <rect fill="#12521e" height="8" width="15" x="65" y="82" />
      <rect fill="#12521e" height="6" width="12" x="45" y="85" />
    </svg>
  );
}
