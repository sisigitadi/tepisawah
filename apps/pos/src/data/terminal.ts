/**
 * @tepisawah/pos — terminal sample data.
 *
 * Payment queue, bill registry and settlement catalog. Shape mirrors the
 * Stitch POS reference so the terminal can render while the Supabase
 * order/payment pipelines are wired in later phases.
 */

export type OrderChannel = "qr" | "waiter";
export type OrderStatus = "waiting" | "process" | "hold";

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
  status: OrderStatus;
  time: string;
  pax: number;
  items: BillItem[];
  promo?: { code: string; label: string; rate: number; approver: string };
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
  id: "cash" | "qris" | "edc" | "wallet";
  label: string;
  hint: string;
}

export const PAYMENT_METHODS: PaymentMethod[] = [
  { id: "cash", label: "Tunai (Cash)", hint: "Laci Otomatis" },
  { id: "qris", label: "QRIS Dinamis", hint: "BCA / Mandiri / GoPay" },
  { id: "edc", label: "Kartu EDC", hint: "Debit / Credit Mandiri" },
  { id: "wallet", label: "Transfer Bank", hint: "BCA VA / Settlement" },
];

export const TENDER_PRESETS = [
  { label: "[Pas] 260.000", value: 260000 },
  { label: "Rp 300.000", value: 300000 },
  { label: "Rp 500.000", value: 500000 },
];

/** Tax & service constants per the reference ledger. */
export const TAX_RATE = 0.1;
export const SERVICE_RATE = 0.05;

export function formatIDR(value: number): string {
  return "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(value));
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("id-ID").format(Math.round(value));
}

/** Subtotal of all bill items. */
export function subtotalOf(order: QueueOrder): number {
  return order.items.reduce((sum, item) => sum + item.qty * item.price, 0);
}

/** Promo discount applied to the subtotal when present. */
export function discountOf(order: QueueOrder): number {
  return order.promo ? subtotalOf(order) * order.promo.rate : 0;
}

/** DPP — taxable base after discount. */
export function taxBaseOf(order: QueueOrder): number {
  return subtotalOf(order) - discountOf(order);
}

/** PB1 resto tax. */
export function taxOf(order: QueueOrder): number {
  return taxBaseOf(order) * TAX_RATE;
}

/** Hospitality service charge. */
export function serviceOf(order: QueueOrder): number {
  return taxBaseOf(order) * SERVICE_RATE;
}

/** Grand total to settle. */
export function grandTotalOf(order: QueueOrder): number {
  return taxBaseOf(order) + taxOf(order) + serviceOf(order);
}
