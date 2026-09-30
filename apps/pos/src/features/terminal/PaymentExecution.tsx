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
} from "../../data/terminal.js";

type SettlementState = "idle" | "printing" | "success";

interface PaymentExecutionProps {
  order: QueueOrder;
  method: PaymentMethod["id"];
  tendered: string;
  onMethodChange: (method: PaymentMethod["id"]) => void;
  onTenderedChange: (value: string) => void;
  onSettle: () => void;
}

const METHOD_ICONS: Record<PaymentMethod["id"], ReactNode> = {
  cash: <CashIcon />,
  qris: <QrIcon />,
  edc: <CardIcon />,
  wallet: <BankIcon />,
};

export function PaymentExecution({
  order,
  method,
  tendered,
  onMethodChange,
  onTenderedChange,
  onSettle,
}: PaymentExecutionProps): ReactNode {
  const [split, setSplit] = useState<"single" | "item" | "pax">("single");
  const [settlement, setSettlement] = useState<SettlementState>("idle");

  const grandTotal = grandTotalOf(order);
  const tenderedNumber = Number.parseInt(tendered.replaceAll(/[.,]/g, ""), 10) || 0;
  const change = tenderedNumber - grandTotal;
  const isCashLike = method === "cash" || method === "edc" || method === "wallet";

  const handleSettle = (): void => {
    if (settlement !== "idle") return;
    setSettlement("printing");
    onSettle();
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
                {mode === "single" ? "Single Bill" : mode === "item" ? "Split Item" : "Custom Pax"}
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
                Uang Diterima Pelanggan (Tendered)
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
        ) : (
          <QrisWorkspace order={order} />
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
            {settlement === "success" && (<><CheckCircleIcon aria-hidden="true" /> <span>Pembayaran Sukses! (Laci Terbuka)</span></>)}
          </button>
          <div className="pos-settle__row">
            <button type="button" className="pos-btn pos-btn--outline">
              <EyeIcon aria-hidden="true" /> Preview Struk
            </button>
            <button type="button" className="pos-btn pos-btn--ghost-danger">
              <TrashIcon aria-hidden="true" /> Batal / Void (Spv)
            </button>
          </div>
        </div>
      </div>

      <ThermalSlip order={order} method={method} tenderedNumber={tenderedNumber} change={change} />
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
}

function QrisWorkspace({ order }: QrisWorkspaceProps): ReactNode {
  return (
    <div className="pos-qris">
      <div className="pos-qris__head">
        <span className="pos-qris__label">QRIS Settlement Gateway</span>
        <span className="pos-qris__timer"><TimerIcon aria-hidden="true" /> 04:45</span>
      </div>

      <div className="pos-qris__stage">
        <QrGlyph />
        <span className="pos-qris__overlay">{order.id}</span>
      </div>

      <div className="pos-qris__meta">
        <p className="pos-qris__nmid">NMID: ID1020261947264</p>
        <p className="pos-qris__hint">Customer facing screen menampilkan kode ini</p>
      </div>

      <div className="pos-qris__status">
        <span className="pos-qris__status-dot" aria-hidden="true" />
        <span>Menunggu Konfirmasi Pembayaran Server Bank...</span>
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
  return (
    <div className="pos-thermal">
      <div className="pos-thermal__head">
        <span className="pos-thermal__label"><PrintIcon aria-hidden="true" /> Thermal 80mm Output</span>
        <span className="pos-thermal__status">Printer EPSON: READY</span>
      </div>

      <div className="pos-thermal__paper">
        <div className="pos-thermal__brand">Warung Tepi Sawah</div>
        <div className="pos-thermal__address">
          Jl. Raya Ciperna No. 88, Cirebon<br />Telp: (0231) 882910
        </div>
        <div className="pos-thermal__line">
          <span>27/09/26 11:32 WIB</span>
          <span>Kasir: Sigit</span>
        </div>
        <div className="pos-thermal__line">
          <span>No: {order.ticket}</span>
          <span>Meja: {order.table.replace("Meja ", "")}</span>
        </div>

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
          <div className="pos-thermal__total-row"><span>PB1 (10%):</span><span>{formatNumber(taxOf(order))}</span></div>
          <div className="pos-thermal__total-row"><span>Service (5%):</span><span>{formatNumber(serviceOf(order))}</span></div>
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

        <div className="pos-thermal__footer">
          Maturnuwun — Hatur Nuhun.<br />Instagram: @tepisawah.ciperna
        </div>
      </div>
    </div>
  );
}
