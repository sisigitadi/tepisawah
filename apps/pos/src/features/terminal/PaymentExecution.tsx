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
import { QrisFullscreenModal } from "./QrisFullscreenModal.js";

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
  const [settlement, setSettlement] = useState<SettlementState>("idle");
  const [showQrisFullscreen, setShowQrisFullscreen] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const taxSettings = getPosTaxSettings();
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
        <div className="pos-settlement__head">
          <span className="pos-settlement__title">Eksekusi Pembayaran</span>
          <div className="pos-split" role="group" aria-label="Mode bill">
            {(["single", "item", "pax"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`pos-split__btn ${split === mode ? "pos-split__btn--active" : ""}`}
                aria-pressed={split === mode}
                onClick={() => setSplit(mode)}
              >
                {mode === "single" ? "Satu Tagihan" : mode === "item" ? "Pisah Menu" : "Bagi Rata"}
              </button>
            ))}
          </div>
        </div>

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
          <QrisWorkspace order={order} onOpenFullscreen={() => setShowQrisFullscreen(true)} />
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
            <button type="button" className="pos-btn pos-btn--outline" onClick={() => window.print()}>
              <EyeIcon aria-hidden="true" /> Preview Struk
            </button>
            <button
              type="button"
              className="pos-btn pos-btn--ghost-danger"
              onClick={onVoid}
            >
              <TrashIcon aria-hidden="true" /> Batal / Void Menu
            </button>
          </div>
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
  onOpenFullscreen?: () => void;
}

function QrisWorkspace({ order, onOpenFullscreen }: QrisWorkspaceProps): ReactNode {
  const taxSettings = getPosTaxSettings();
  const grandTotal = grandTotalOf(order);

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

interface ThermalSlipProps {
  order: QueueOrder;
  method: PaymentMethod["id"];
  tenderedNumber: number;
  change: number;
}

function ThermalSlip({ order, method, tenderedNumber, change }: ThermalSlipProps): ReactNode {
  const taxSettings = getPosTaxSettings();
  const is58mm = taxSettings.printerPaperWidth === "58mm";

  return (
    <div className={`pos-thermal ${is58mm ? "pos-thermal--58mm" : ""}`}>
      <div className="pos-thermal__head">
        <span className="pos-thermal__label">
          <PrintIcon aria-hidden="true" /> Struk Thermal ({taxSettings.printerPaperWidth})
        </span>
        <button
          type="button"
          className="pos-btn pos-btn--sm pos-btn--outline"
          onClick={() => window.print()}
          title="Kirim ke printer thermal"
          style={{ padding: "4px 10px", fontSize: "11px", height: "auto" }}
        >
          <PrintIcon aria-hidden="true" /> Cetak Struk
        </button>
      </div>

      <div
        className="pos-thermal__paper"
        style={is58mm ? { width: "235px", fontSize: "10px", padding: "10px 8px" } : undefined}
      >
        {order.isReprint && (
          <div
            style={{
              textAlign: "center",
              borderBottom: "1px dashed #cbd5e1",
              paddingBottom: "4px",
              marginBottom: "6px",
              fontWeight: 800,
              fontSize: "11px",
              color: "#b91c1c",
            }}
          >
            *** SALINAN NOTA / REPRINT ***
            {order.reprintTime && (
              <div style={{ fontSize: "9px", fontWeight: "normal", color: "#64748b" }}>
                Cetak Ulang: {order.reprintTime}
              </div>
            )}
          </div>
        )}

        <div className="pos-thermal__brand">Tepi Sawah Resto &amp; Cafe</div>
        <div className="pos-thermal__address">
          {taxSettings.receiptHeaderNote}<br />WA: {taxSettings.receiptPhone}
        </div>
        {taxSettings.showNpwpdOnReceipt && taxSettings.npwpd ? (
          <div style={{ fontSize: "11px", fontWeight: "bold", textAlign: "center", marginTop: "2px", color: "#334155" }}>
            NPWPD: {taxSettings.npwpd}
          </div>
        ) : null}
        <div className="pos-thermal__line">
          <span>{new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date())} WIB</span>
          <span>Kasir: Meja Kasir #01</span>
        </div>
        <div className="pos-thermal__line">
          <span>No: {order.ticket}</span>
          <span>
            {order.orderType === "TAKE_AWAY"
              ? "Bawa Pulang"
              : order.channel === "delivery"
                ? (order.orderType ?? "Online")
                : `Meja: ${order.table.replace("Meja ", "")}`}
          </span>
        </div>
        {order.customerName ? (
          <div className="pos-thermal__line">
            <span>Pelanggan: {order.customerName}</span>
          </div>
        ) : null}
        {order.externalReference ? (
          <div className="pos-thermal__line">
            <span>Ref: #{order.externalReference}</span>
          </div>
        ) : null}

        <div className="pos-thermal__items">
          {order.items.map((item) => (
            <div key={item.id}>
              <div className="pos-thermal__item">
                <span>{item.name.length > 26 ? `${item.name.slice(0, 24)}…` : item.name} ({item.qty}x)</span>
                <span>{formatNumber(item.qty * item.price)}</span>
              </div>
              {item.note && <div className="pos-thermal__item-note">- {item.note}</div>}
            </div>
          ))}
        </div>

        <div className="pos-thermal__totals">
          <div className="pos-thermal__total-row"><span>Subtotal:</span><span>{formatNumber(subtotalOf(order))}</span></div>
          {order.promo && (
            <div className="pos-thermal__total-row pos-thermal__total-row--promo">
              <span>Disc {order.promo.code}:</span><span>-{formatNumber(discountOf(order))}</span>
            </div>
          )}
          {order.bill || taxSettings.taxEnabled ? (
            <div className="pos-thermal__total-row">
              <span>{order.bill ? "Pajak:" : `${taxSettings.taxName}:`}</span>
              <span>{formatNumber(taxOf(order))}</span>
            </div>
          ) : null}
          {order.bill ? (
            serviceOf(order) > 0 ? (
              <div className="pos-thermal__total-row">
                <span>Biaya Layanan:</span>
                <span>{formatNumber(serviceOf(order))}</span>
              </div>
            ) : null
          ) : taxSettings.serviceChargeEnabled ? (
            <div className="pos-thermal__total-row">
              <span>{taxSettings.serviceChargeName}:</span>
              <span>{formatNumber(serviceOf(order))}</span>
            </div>
          ) : null}
          <div className="pos-thermal__grand">
            <span>TOTAL AKHIR:</span>
            <span>{formatIDR(grandTotalOf(order))}</span>
          </div>
          <div className="pos-thermal__total-row pos-thermal__total-row--dim">
            <span>Tendered ({method.toUpperCase()}):</span>
            <span>{formatNumber(tenderedNumber)}</span>
          </div>
          <div className="pos-thermal__change">
            <span>KEMBALI:</span>
            <span>{formatIDR(Math.max(change, 0))}</span>
          </div>
        </div>

        {taxSettings.bankAccountNumber && (
          <div style={{ textAlign: "center", fontSize: "10px", color: "#64748b", marginTop: "6px", borderTop: "1px dashed #cbd5e1", paddingTop: "4px" }}>
            Transfer: {taxSettings.bankName} {taxSettings.bankAccountNumber}<br />
            a/n {taxSettings.bankAccountHolder}
          </div>
        )}

        <div className="pos-thermal__footer" style={{ whiteSpace: "pre-line" }}>
          {taxSettings.receiptFooterNote}
        </div>
      </div>
    </div>
  );
}
