/**
 * Order & Kitchen Workflow Configuration.
 *
 * Mengatur alur pemesanan restoran dan status modul dapur (KDS):
 * 1. Mode Alur Pembayaran:
 *    - "post_pay": Pesan Dulu, Bayar Nanti di Kasir
 *    - "pre_pay": Wajib Bayar di Awal Baru Masak
 *    - "flexible": Fleksibel (Customer memilih saat checkout)
 * 2. Status Modul Dapur:
 *    - kitchenEnabled = true: Dapur aktif, pesanan masuk ke Layar KDS (/kitchen)
 *    - kitchenEnabled = false: Dapur nonaktif, kasir/waiter terima transaksi, masak, lalu langsung antar
 * 3. Mode Bypass Dapur (Saat Nonaktif):
 *    - "direct_serve": Otomatis langsung siap saji / disajikan saat transaksi dikonfirmasi
 *    - "manual_cook_serve": Kontrol masak manual oleh kasir / waiter (Mulai Masak -> Selesai & Antar)
 */

export type OrderFlowMode = "post_pay" | "pre_pay" | "flexible";
export type KitchenBypassMode = "direct_serve" | "manual_cook_serve";

export interface OrderFlowSettings {
  orderFlowMode: OrderFlowMode;
  allowStaffTableOrder: boolean;
  autoAcceptPostPay: boolean;
  qrisInstruction: string;
  kitchenEnabled: boolean;
  kitchenBypassMode: KitchenBypassMode;
}

export const DEFAULT_ORDER_FLOW_SETTINGS: OrderFlowSettings = {
  orderFlowMode: "flexible",
  allowStaffTableOrder: true,
  autoAcceptPostPay: true,
  qrisInstruction: "Scan QRIS di kasir setelah selesai makan, atau bayar langsung via QRIS di HP.",
  kitchenEnabled: true,
  kitchenBypassMode: "direct_serve",
};

const STORAGE_KEY = "tepisawah_order_flow_settings";

export function loadOrderFlowSettings(): OrderFlowSettings {
  if (typeof window === "undefined" || !window.localStorage) {
    return DEFAULT_ORDER_FLOW_SETTINGS;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ORDER_FLOW_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      orderFlowMode: parsed.orderFlowMode ?? DEFAULT_ORDER_FLOW_SETTINGS.orderFlowMode,
      allowStaffTableOrder: parsed.allowStaffTableOrder ?? DEFAULT_ORDER_FLOW_SETTINGS.allowStaffTableOrder,
      autoAcceptPostPay: parsed.autoAcceptPostPay ?? DEFAULT_ORDER_FLOW_SETTINGS.autoAcceptPostPay,
      qrisInstruction: parsed.qrisInstruction ?? DEFAULT_ORDER_FLOW_SETTINGS.qrisInstruction,
      kitchenEnabled: typeof parsed.kitchenEnabled === "boolean" ? parsed.kitchenEnabled : DEFAULT_ORDER_FLOW_SETTINGS.kitchenEnabled,
      kitchenBypassMode: parsed.kitchenBypassMode ?? DEFAULT_ORDER_FLOW_SETTINGS.kitchenBypassMode,
    };
  } catch {
    return DEFAULT_ORDER_FLOW_SETTINGS;
  }
}

export function saveOrderFlowSettings(settings: OrderFlowSettings): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new Event("storage"));
    window.dispatchEvent(new CustomEvent("tepisawah_order_flow_updated", { detail: settings }));
  } catch {
    // Non-blocking
  }
}

export function isKitchenActive(): boolean {
  return loadOrderFlowSettings().kitchenEnabled;
}

export function syncOrderFlowFromDb(row: Record<string, unknown>): OrderFlowSettings {
  const current = loadOrderFlowSettings();
  const next: OrderFlowSettings = {
    ...current,
    kitchenEnabled: typeof row.kitchen_enabled === "boolean" ? row.kitchen_enabled : current.kitchenEnabled,
    kitchenBypassMode:
      row.kitchen_bypass_mode === "direct_serve" || row.kitchen_bypass_mode === "manual_cook_serve"
        ? (row.kitchen_bypass_mode as KitchenBypassMode)
        : current.kitchenBypassMode,
  };
  saveOrderFlowSettings(next);
  return next;
}
