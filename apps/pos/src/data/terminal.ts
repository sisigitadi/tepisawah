/**
 * @tepisawah/pos — terminal data contracts & money helpers.
 *
 * The queue shape mirrors the Stitch POS reference. Live orders (SERVED, from
 * the database) carry `orderId` — the transition handle — and `bill`: the
 * server's own frozen totals from the `orders` row. When `bill` is present the
 * money helpers below return those values verbatim, because the receipt of
 * record is the server's snapshot, never a browser re-derivation
 * (API_CONTRACT.md §27; DB CHECK `total = subtotal - discount + tax`).
 * Fixture-shaped orders (no `bill`) keep the reference ledger's 10% PB1 + 5%
 * service derivation for the design sample.
 */

import type { OrderType } from "@tepisawah/database";

export type OrderChannel = "qr" | "waiter" | "takeaway" | "delivery";
export type OrderStatus = "waiting" | "process" | "hold" | "paid" | "void";

export interface BillItem {
  id: string;
  name: string;
  category: "MAKANAN" | "MINUMAN";
  qty: number;
  price: number;
  note?: string;
  station: string;
}

export interface QueueOrder {
  id: string;
  ticket: string;
  table: string;
  area: string;
  channel: OrderChannel;
  orderType?: OrderType;
  customerName?: string | null;
  externalReference?: string | null;
  status: OrderStatus;
  time: string;
  pax: number;
  items: BillItem[];
  promo?: { code: string; label: string; rate: number; approver: string };
  /** The database order id; present on live orders, absent on fixtures. */
  orderId?: string;
  /** The server's frozen totals; present on live orders, absent on fixtures. */
  bill?: { subtotal: number; discount: number; tax: number; total: number };
  /** Optimistic-concurrency handle for the settle transition (§26). */
  version?: number;
  /** Original raw status from database (e.g. "PAID", "VOID", "SERVED"). */
  rawStatus?: string;
  /** Flag indicating this is a reprinted receipt. */
  isReprint?: boolean;
  /** Timestamp when reprint occurred. */
  reprintTime?: string;
}

export const QUEUE_ORDERS: QueueOrder[] = [
  {
    id: "TS-001",
    ticket: "#TS-20260927-001",
    table: "Meja A12",
    area: "Kabin Sawah Utara",
    channel: "qr",
    status: "waiting",
    time: "11:28 WIB",
    pax: 4,
    items: [
      {
        id: "i1",
        name: "Chicken Roaster Rempah",
        category: "MAKANAN",
        qty: 2,
        price: 85000,
        note: "Sambal matah dipisah, ayam matang empuk buat lansia.",
        station: "KDS: Ready",
      },
      {
        id: "i2",
        name: "Nasi Liwet Sawah Komplit",
        category: "MAKANAN",
        qty: 1,
        price: 45000,
        note: "Termasuk lalapan segar ciperna, sambal terasi teruji.",
        station: "KDS: Ready",
      },
      {
        id: "i3",
        name: "Es Kelapa Jeruk Segar",
        category: "MINUMAN",
        qty: 2,
        price: 18000,
        note: "Less sweet (gula aren sedikit dipisah).",
        station: "Bar: Served",
      },
    ],
    promo: { code: "TS-LUNCH10", label: "Diskon Promo Lunch 10%", rate: 0.1, approver: "Spv. Rian" },
  },
  {
    id: "TS-002",
    ticket: "#TS-20260927-002",
    table: "Meja S02",
    area: "Saung Lesehan 2",
    channel: "waiter",
    status: "waiting",
    time: "11:30 WIB",
    pax: 2,
    items: [
      { id: "i1", name: "Gurame Bakar Madu", category: "MAKANAN", qty: 1, price: 95000, station: "KDS: Ready" },
      { id: "i2", name: "Nasi Liwet Sawah Komplit", category: "MAKANAN", qty: 1, price: 45000, station: "KDS: Ready" },
    ],
  },
  {
    id: "TS-003",
    ticket: "#TS-20260927-003",
    table: "Meja R01",
    area: "Rooftop Sunset",
    channel: "qr",
    status: "waiting",
    time: "11:15 WIB",
    pax: 6,
    items: [
      { id: "i1", name: "Gurame Bakar Madu", category: "MAKANAN", qty: 2, price: 95000, station: "KDS: Ready" },
      { id: "i2", name: "Karedok Leunca Segar", category: "MAKANAN", qty: 2, price: 25000, station: "KDS: Ready" },
      { id: "i3", name: "Es Teh Manis Sereh", category: "MINUMAN", qty: 4, price: 15000, station: "Bar: Served" },
    ],
  },
  {
    id: "TS-004",
    ticket: "#TS-20260927-004",
    table: "Meja G05",
    area: "Gazebo Bambu",
    channel: "qr",
    status: "hold",
    time: "11:34 WIB",
    pax: 5,
    items: [
      { id: "i1", name: "Nasi Liwet Sawah Komplit", category: "MAKANAN", qty: 3, price: 45000, station: "KDS: Cooking" },
      { id: "i2", name: "Ayam Bakar Tepi Sawah", category: "MAKANAN", qty: 2, price: 75000, station: "KDS: Cooking" },
      { id: "i3", name: "Karedok Leunca Segar", category: "MAKANAN", qty: 1, price: 25000, station: "KDS: Ready" },
      { id: "i4", name: "Es Kelapa Jeruk Segar", category: "MINUMAN", qty: 3, price: 18000, station: "Bar: Served" },
      { id: "i5", name: "Kopi Susu Aren Tepi Sawah", category: "MINUMAN", qty: 2, price: 22000, station: "Bar: Queued" },
    ],
  },
  {
    id: "TS-005",
    ticket: "#TS-20260927-005",
    table: "Meja B03",
    area: "Teras Kopi",
    channel: "waiter",
    status: "process",
    time: "11:20 WIB",
    pax: 2,
    items: [
      { id: "i1", name: "Kopi Susu Aren Tepi Sawah", category: "MINUMAN", qty: 2, price: 22000, station: "Bar: Served" },
      { id: "i2", name: "Pisang Goreng Madu", category: "MAKANAN", qty: 1, price: 28000, station: "KDS: Ready" },
    ],
  },
];

export interface PaymentMethod {
  id: "cash" | "qris" | "edc" | "wallet" | "platform";
  label: string;
  hint: string;
}

export const PAYMENT_METHODS: PaymentMethod[] = [
  { id: "cash", label: "Tunai (Cash)", hint: "Laci Otomatis" },
  { id: "qris", label: "QRIS Dinamis", hint: "BCA / Mandiri / GoPay" },
  { id: "edc", label: "Kartu EDC", hint: "Debit / Credit Mandiri" },
  { id: "wallet", label: "Transfer Bank", hint: "BCA VA / Settlement" },
  { id: "platform", label: "Platform Mitra", hint: "GoFood / Grab / Shopee" },
];

export function formatIDR(value: number): string {
  return "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(value));
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("id-ID").format(Math.round(value));
}

export interface TenderPreset {
  label: string;
  value: number;
}

export function getTenderPresets(grandTotal: number): TenderPreset[] {
  const roundedTotal = Math.round(grandTotal);
  if (roundedTotal <= 0) {
    return [
      { label: "[Pas] 0", value: 0 },
      { label: "Rp 50.000", value: 50000 },
      { label: "Rp 100.000", value: 100000 },
    ];
  }

  const presets: TenderPreset[] = [
    { label: `[Pas] ${formatNumber(roundedTotal)}`, value: roundedTotal },
  ];

  const candidates = new Set<number>();

  if (roundedTotal < 20000) {
    candidates.add(20000);
    candidates.add(50000);
    candidates.add(100000);
  } else if (roundedTotal < 50000) {
    candidates.add(50000);
    candidates.add(100000);
  } else if (roundedTotal < 100000) {
    candidates.add(100000);
    candidates.add(150000);
    candidates.add(200000);
  } else {
    const next50k = Math.ceil(roundedTotal / 50000) * 50000;
    const next100k = Math.ceil(roundedTotal / 100000) * 100000;
    if (next50k > roundedTotal) candidates.add(next50k);
    if (next100k > roundedTotal) candidates.add(next100k);
    candidates.add((next100k > roundedTotal ? next100k : next50k) + 100000);
    candidates.add(500000);
    candidates.add(1000000);
  }

  const sorted = Array.from(candidates).filter((v) => v > roundedTotal).sort((a, b) => a - b);
  for (const val of sorted) {
    if (presets.length >= 3) break;
    presets.push({
      label: `Rp ${formatNumber(val)}`,
      value: val,
    });
  }

  while (presets.length < 3) {
    const last = presets[presets.length - 1]!.value;
    const next = last + 50000;
    presets.push({ label: `Rp ${formatNumber(next)}`, value: next });
  }

  return presets;
}

export const TENDER_PRESETS: TenderPreset[] = getTenderPresets(260000);

import { loadTaxSettings, calculateBill, type TaxSettings } from "@tepisawah/config";

export function getPosTaxSettings(): TaxSettings {
  return loadTaxSettings();
}

/** Tax & service constants per the reference ledger. */
export const TAX_RATE = 0.1;
export const SERVICE_RATE = 0.05;

/** Subtotal of all bill items (the server's own value on a live order). */
export function subtotalOf(order: QueueOrder): number {
  if (order.bill) return order.bill.subtotal;
  return order.items.reduce((sum, item) => sum + item.qty * item.price, 0);
}

/** Promo discount applied to the subtotal when present. */
export function discountOf(order: QueueOrder): number {
  if (order.bill) return order.bill.discount;
  return order.promo ? subtotalOf(order) * order.promo.rate : 0;
}

/** DPP — taxable base after discount. */
export function taxBaseOf(order: QueueOrder): number {
  return subtotalOf(order) - discountOf(order);
}

/** PB1 resto tax (the server's own value on a live order, respecting active tax settings for unpaid orders). */
export function taxOf(order: QueueOrder): number {
  const settings = loadTaxSettings();
  // If tax is disabled and order is not yet finalized, tax is strictly 0
  if (!settings.taxEnabled || settings.taxRate === 0) {
    if (order.status !== "paid") return 0;
  }
  if (order.bill) return order.bill.tax;
  const bill = calculateBill(subtotalOf(order), discountOf(order), settings);
  return bill.taxAmount;
}

/** Hospitality service charge (not yet modelled server-side → 0 on live). */
export function serviceOf(order: QueueOrder): number {
  if (order.bill) return 0;
  const settings = loadTaxSettings();
  const bill = calculateBill(subtotalOf(order), discountOf(order), settings);
  return bill.serviceAmount;
}

/** Grand total to settle (the server's own value on a live order, respecting active tax settings for unpaid orders). */
export function grandTotalOf(order: QueueOrder): number {
  const settings = loadTaxSettings();
  if (order.bill) {
    // If tax was disabled after draft order creation, adjust unpaid total by removing obsolete tax
    if ((!settings.taxEnabled || settings.taxRate === 0) && order.status !== "paid") {
      return Math.max(0, order.bill.subtotal - order.bill.discount);
    }
    return order.bill.total;
  }
  const bill = calculateBill(subtotalOf(order), discountOf(order), settings);
  return bill.total;
}

/**
 * Suggest optimal cashier bill denominations for customer change.
 * Breaks down amount into Indonesian Rupiah banknotes and coins accurately.
 */
export function suggestDenomination(amount: number): string {
  if (amount <= 0) return "—";
  const denominations = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100];
  const parts: string[] = [];
  let remaining = Math.round(amount);

  for (const denom of denominations) {
    const count = Math.floor(remaining / denom);
    if (count > 0) {
      parts.push(`${count}x ${denom >= 1000 ? `${denom / 1000}k` : denom}`);
      remaining -= count * denom;
    }
  }

  if (remaining > 0) {
    parts.push(`bulatkan ${remaining}`);
  }

  return parts.length > 0 ? parts.join(" + ") : "—";
}
