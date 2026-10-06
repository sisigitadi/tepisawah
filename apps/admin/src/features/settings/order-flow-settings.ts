/**
 * Order & Payment Flow Settings.
 *
 * Mengatur fleksibilitas alur pemesanan dan keuangan restoran:
 * 1. Mode Alur:
 *    - "post_pay": Pesan Dulu, Bayar Nanti di Kasir (Dapur langsung masak).
 *    - "pre_pay": Wajib Bayar di Awal Baru Masak (Customer bayar QRIS/Kasir dulu).
 *    - "flexible": Fleksibel (Customer bebas memilih saat checkout).
 * 2. Operasional Staff:
 *    - Izinkan Kasir & Pelayan scan / input order meja langsung.
 *    - Otomatis kirim ke dapur untuk mode bayar nanti.
 */

export type OrderFlowMode = "post_pay" | "pre_pay" | "flexible";

export interface OrderFlowSettings {
  orderFlowMode: OrderFlowMode;
  allowStaffTableOrder: boolean;
  autoAcceptPostPay: boolean;
  qrisInstruction: string;
}

export const DEFAULT_ORDER_FLOW_SETTINGS: OrderFlowSettings = {
  orderFlowMode: "flexible",
  allowStaffTableOrder: true,
  autoAcceptPostPay: true,
  qrisInstruction: "Scan QRIS di kasir setelah selesai makan, atau bayar langsung via QRIS di HP.",
};

const STORAGE_KEY = "tepisawah_order_flow_settings";

export function loadOrderFlowSettings(): OrderFlowSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ORDER_FLOW_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      orderFlowMode: parsed.orderFlowMode ?? DEFAULT_ORDER_FLOW_SETTINGS.orderFlowMode,
      allowStaffTableOrder: parsed.allowStaffTableOrder ?? DEFAULT_ORDER_FLOW_SETTINGS.allowStaffTableOrder,
      autoAcceptPostPay: parsed.autoAcceptPostPay ?? DEFAULT_ORDER_FLOW_SETTINGS.autoAcceptPostPay,
      qrisInstruction: parsed.qrisInstruction ?? DEFAULT_ORDER_FLOW_SETTINGS.qrisInstruction,
    };
  } catch {
    return DEFAULT_ORDER_FLOW_SETTINGS;
  }
}

export function saveOrderFlowSettings(settings: OrderFlowSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new Event("storage"));
  } catch {
    // Non-blocking
  }
}
