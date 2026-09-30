/**
 * @tepisawah/pos — bill inspector panel.
 *
 * Order header banner, itemized food &amp; beverage registry with special-note
 * badges, and the calculation ledger (subtotal → promo → DPP → PB1 → service
 * → grand total), ported from the Stitch POS reference.
 */

import type { ReactNode } from "react";
import { ChatIcon, CoffeeIcon, DiningIcon, NoteIcon, PrintIcon, UserIcon, VerifiedIcon, XCircleIcon } from "@tepisawah/ui";
import type { BillItem, QueueOrder } from "../../data/terminal.js";
import {
  discountOf,
  formatIDR,
  grandTotalOf,
  serviceOf,
  subtotalOf,
  taxBaseOf,
  taxOf,
} from "../../data/terminal.js";

interface BillInspectorProps {
  order: QueueOrder;
  onPrint: () => void;
}

export function BillInspector({ order, onPrint }: BillInspectorProps): ReactNode {
  const portions = order.items.reduce((sum, item) => sum + item.qty, 0);

  return (
    <section className="pos-inspector" aria-label="Pemeriksa tagihan aktif">
      <div className="pos-inspector__banner">
        <div className="pos-inspector__banner-glow" aria-hidden="true" />
        <div className="pos-inspector__banner-main">
          <div className="pos-inspector__eyebrow">
            <span className="pos-inspector__badge">Active Bill Inspector</span>
            <span className="pos-inspector__ticket">Ticket {order.ticket}</span>
          </div>
          <h2 className="pos-inspector__title">
            {order.table} <span className="pos-inspector__area">• {order.area}</span>
          </h2>
          <div className="pos-inspector__meta">
            <span><UserIcon aria-hidden="true" /> Tamu {order.table} (Family {order.pax} Pax)</span>
            <span className="pos-inspector__verified"><VerifiedIcon aria-hidden="true" /> QR Auto-Validated</span>
          </div>
        </div>
        <div className="pos-inspector__aside">
          <span className="pos-inspector__aside-label">Waktu Pesanan</span>
          <span className="pos-inspector__aside-time">{order.time} (18m lalu)</span>
          <div className="pos-inspector__pills">
            <span className="pos-inspector__pill">Pax: {order.pax}</span>
            <span className="pos-inspector__pill pos-inspector__pill--ghost">Pajak PB1: Aktif</span>
          </div>
        </div>
      </div>

      <div className="pos-inspector__registry">
        <div className="pos-registry__head">
          <span className="pos-registry__caption">
            Rincian Menu Dipesan ({order.items.length} Varian • {portions} Porsi)
          </span>
          <button type="button" className="pos-registry__note">
            <NoteIcon aria-hidden="true" /> Tambah Catatan Meja
          </button>
        </div>

        <div className="pos-registry__items">
          {order.items.map((item) => (
            <BillRow key={item.id} item={item} />
          ))}
        </div>

        <div className="pos-ledger">
          <div className="pos-ledger__row">
            <span>Subtotal Makanan &amp; Minuman</span>
            <span className="pos-ledger__value">{formatIDR(subtotalOf(order))}</span>
          </div>

          {order.promo && (
            <div className="pos-ledger__row pos-ledger__row--promo">
              <span className="pos-ledger__promo-label">
                <TagInline />
                <span className="pos-ledger__promo-text">{order.promo.label} ({order.promo.code})</span>
                <span className="pos-ledger__promo-approver">{order.promo.approver}</span>
              </span>
              <span className="pos-ledger__promo-value">-{formatIDR(discountOf(order))}</span>
            </div>
          )}

          <div className="pos-ledger__row">
            <span>Dasar Pengenaan Pajak (DPP)</span>
            <span className="pos-ledger__value">{formatIDR(taxBaseOf(order))}</span>
          </div>
          <div className="pos-ledger__row">
            <span>Resto Tax / Pajak PB1 (10%)</span>
            <span className="pos-ledger__value">{formatIDR(taxOf(order))}</span>
          </div>
          <div className="pos-ledger__row">
            <span>Service Charge Hospitality (5%)</span>
            <span className="pos-ledger__value">{formatIDR(serviceOf(order))}</span>
          </div>

          <div className="pos-ledger__grand">
            <div>
              <span className="pos-ledger__grand-label">Total Tagihan Final</span>
              <p className="pos-ledger__grand-note">Sudah termasuk PB1 &amp; Service Charge</p>
            </div>
            <span className="pos-ledger__grand-value" id="inspectorTotalValue">
              {formatIDR(grandTotalOf(order))}
            </span>
          </div>
        </div>

        <div className="pos-inspector__actions">
          <button type="button" className="pos-btn pos-btn--outline pos-btn--grow" onClick={onPrint}>
            <PrintIcon aria-hidden="true" /> Cetak Struk Dapur / Bill Tamu
          </button>
          <button type="button" className="pos-btn pos-btn--ghost-danger">
            <XCircleIcon aria-hidden="true" /> Void Menu
          </button>
        </div>
      </div>
    </section>
  );
}

function TagInline(): ReactNode {
  return (
    <svg
      className="pos-ledger__promo-icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.5 12.5l-8 8a2 2 0 0 1-2.8 0L3.5 14V3.5H14l6.5 6.5a2 2 0 0 1 0 2.5z" />
      <circle cx="8" cy="8" r="1.4" />
    </svg>
  );
}

function BillRow({ item }: { item: BillItem }): ReactNode {
  return (
    <div className="pos-item">
      <div className="pos-item__thumb" aria-hidden="true">
        {item.category === "MAKANAN" ? <DiningIcon /> : <CoffeeIcon />}
      </div>
      <div className="pos-item__main">
        <div className="pos-item__name-row">
          <span className="pos-item__name">{item.name}</span>
          <span className={`pos-item__cat ${item.category === "MAKANAN" ? "pos-item__cat--food" : "pos-item__cat--drink"}`}>
            {item.category}
          </span>
        </div>
        <span className="pos-item__qty">{item.qty} porsi × {formatIDR(item.price)}</span>
        {item.note && (
          <div className="pos-item__note">
            <ChatIcon aria-hidden="true" />
            <span><strong>Catatan:</strong> {item.note}</span>
          </div>
        )}
      </div>
      <div className="pos-item__amount">
        <span className="pos-item__amount-value">{formatIDR(item.qty * item.price)}</span>
        <span className="pos-item__station">{item.station}</span>
      </div>
    </div>
  );
}
