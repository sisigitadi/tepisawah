/**
 * @tepisawah/pos — thermal receipt slip.
 *
 * Authentic 58mm and 80mm thermal receipt printer slip for active orders,
 * kitchen/guest bills, and reprint copies from history.
 */

import type { ReactNode } from "react";
import { PrintIcon } from "@tepisawah/ui";
import type { PaymentMethod, QueueOrder } from "../../data/terminal.js";
import {
  discountOf,
  formatIDR,
  formatNumber,
  grandTotalOf,
  serviceOf,
  subtotalOf,
  taxOf,
  getPosTaxSettings,
} from "../../data/terminal.js";

export interface ThermalSlipProps {
  order: QueueOrder;
  method?: PaymentMethod["id"];
  tenderedNumber?: number;
  change?: number;
  showHead?: boolean;
  onPrint?: () => void;
}

export function ThermalSlip({
  order,
  method = "cash",
  tenderedNumber,
  change,
  showHead = true,
  onPrint,
}: ThermalSlipProps): ReactNode {
  const taxSettings = getPosTaxSettings();
  const is58mm = taxSettings.printerPaperWidth === "58mm";
  const grandTotal = grandTotalOf(order);
  const effectiveTendered = tenderedNumber ?? grandTotal;
  const effectiveChange = change ?? (effectiveTendered - grandTotal);

  const handlePrint = (): void => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  return (
    <div className={`pos-thermal ${is58mm ? "pos-thermal--58mm" : ""}`}>
      {showHead && (
        <div className="pos-thermal__head">
          <span className="pos-thermal__label">
            <PrintIcon aria-hidden="true" /> Struk Thermal ({taxSettings.printerPaperWidth})
          </span>
          <button
            type="button"
            className="pos-btn pos-btn--sm pos-btn--outline"
            onClick={handlePrint}
            title="Kirim ke printer thermal"
            style={{ padding: "4px 10px", fontSize: "11px", height: "auto" }}
          >
            <PrintIcon aria-hidden="true" /> Cetak Struk
          </button>
        </div>
      )}

      <div
        className={`pos-thermal__paper ${is58mm ? "pos-thermal__paper--58mm" : ""}`}
        style={is58mm ? { width: "235px", fontSize: "10px", padding: "10px 8px" } : undefined}
      >
        {/* Header Status Watermark */}
        {order.isReprint ? (
          <div
            className="pos-thermal__watermark pos-thermal__watermark--reprint"
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
        ) : order.status === "paid" ? (
          <div
            className="pos-thermal__watermark pos-thermal__watermark--paid"
            style={{
              textAlign: "center",
              borderBottom: "1px dashed #cbd5e1",
              paddingBottom: "4px",
              marginBottom: "6px",
              fontWeight: 800,
              fontSize: "11px",
              color: "#15803d",
            }}
          >
            *** LUNAS ({method.toUpperCase()}) ***
          </div>
        ) : (
          <div
            className="pos-thermal__watermark pos-thermal__watermark--bill"
            style={{
              textAlign: "center",
              borderBottom: "1px dashed #cbd5e1",
              paddingBottom: "4px",
              marginBottom: "6px",
              fontWeight: 800,
              fontSize: "11px",
              color: "#475569",
            }}
          >
            *** BILL TAGIHAN SEMENTARA ***
          </div>
        )}

        <div className="pos-thermal__brand">Tepi Sawah Resto &amp; Cafe</div>
        <div className="pos-thermal__address">
          {taxSettings.receiptHeaderNote}
          <br />
          WA: {taxSettings.receiptPhone}
        </div>
        {taxSettings.showNpwpdOnReceipt && taxSettings.npwpd ? (
          <div
            style={{
              fontSize: "11px",
              fontWeight: "bold",
              textAlign: "center",
              marginTop: "2px",
              color: "#334155",
            }}
          >
            NPWPD: {taxSettings.npwpd}
          </div>
        ) : null}

        <div className="pos-thermal__line">
          <span>
            {new Intl.DateTimeFormat("id-ID", {
              day: "2-digit",
              month: "2-digit",
              year: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Asia/Jakarta",
            }).format(new Date())}{" "}
            WIB
          </span>
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
                <span>
                  {item.name.length > 26 ? `${item.name.slice(0, 24)}…` : item.name} ({item.qty}x)
                </span>
                <span>{formatNumber(item.qty * item.price)}</span>
              </div>
              {item.note && <div className="pos-thermal__item-note">- {item.note}</div>}
            </div>
          ))}
        </div>

        <div className="pos-thermal__totals">
          <div className="pos-thermal__total-row">
            <span>Subtotal:</span>
            <span>{formatNumber(subtotalOf(order))}</span>
          </div>
          {order.promo && (
            <div className="pos-thermal__total-row pos-thermal__total-row--promo">
              <span>Disc {order.promo.code}:</span>
              <span>-{formatNumber(discountOf(order))}</span>
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
            <span>{formatIDR(grandTotal)}</span>
          </div>
          <div className="pos-thermal__total-row pos-thermal__total-row--dim">
            <span>Tendered ({method.toUpperCase()}):</span>
            <span>{formatNumber(effectiveTendered)}</span>
          </div>
          <div className="pos-thermal__change">
            <span>KEMBALI:</span>
            <span>{formatIDR(Math.max(effectiveChange, 0))}</span>
          </div>
        </div>

        {taxSettings.bankAccountNumber && (
          <div
            style={{
              textAlign: "center",
              fontSize: "10px",
              color: "#64748b",
              marginTop: "6px",
              borderTop: "1px dashed #cbd5e1",
              paddingTop: "4px",
            }}
          >
            Transfer: {taxSettings.bankName} {taxSettings.bankAccountNumber}
            <br />
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
