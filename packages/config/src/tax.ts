/**
 * Tax & Service Charge (PB1) Configuration & Ledger Calculator.
 *
 * Mengatur parameter perpajakan dan biaya layanan restoran:
 * - Pajak Restoran (PB1 / PB-1 Daerah): 10% (atau disesuaikan)
 * - Skema Pajak: Ditambahkan di akhir (Exclusive) atau Sudah termasuk di harga (Inclusive)
 * - Biaya Layanan (Service Charge): 0% - 10%
 * - Nomor Pokok Wajib Pajak Daerah (NPWPD / NOPD) untuk struk kasir
 * - Pembulatan total transaksi (Rounding)
 * - Identitas header / footer struk thermal
 */

export type TaxCalculationMode = "exclusive" | "inclusive";
export type RoundingMode = "none" | "round100" | "round500" | "round1000";

export interface TaxSettings {
  taxEnabled: boolean;
  taxRate: number; // percentage, e.g. 10
  taxName: string; // e.g. "PB1 (Pajak Restoran 10%)"
  taxCalculation: TaxCalculationMode;
  npwpd: string; // e.g. "P.2.0192834.01.24"
  showNpwpdOnReceipt: boolean;
  serviceChargeEnabled: boolean;
  serviceChargeRate: number; // percentage, e.g. 5
  serviceChargeName: string; // e.g. "Biaya Layanan (5%)"
  rounding: RoundingMode;
  receiptHeaderNote: string;
  receiptFooterNote: string;
  receiptPhone: string;
}

export interface BillCalculation {
  subtotal: number;
  discount: number;
  taxBase: number; // DPP (Dasar Pengenaan Pajak)
  serviceAmount: number;
  taxAmount: number;
  rawTotal: number;
  roundingAmount: number;
  total: number;
}

export const DEFAULT_TAX_SETTINGS: TaxSettings = {
  taxEnabled: true,
  taxRate: 10,
  taxName: "PB1 (Pajak Restoran 10%)",
  taxCalculation: "exclusive",
  npwpd: "P.2.0192834.01.24",
  showNpwpdOnReceipt: true,
  serviceChargeEnabled: false,
  serviceChargeRate: 5,
  serviceChargeName: "Biaya Layanan (5%)",
  rounding: "none",
  receiptHeaderNote: "Kawasan Wisata Sawah, Ciperna, Kec. Talun, Cirebon",
  receiptFooterNote: "Matur Kesuwun, Hatur Nuhun.\nInstagram: @tepisawah.id",
  receiptPhone: "0812-3456-7890",
};

const STORAGE_KEY = "tepisawah_tax_finance_settings";

export function loadTaxSettings(): TaxSettings {
  if (typeof window === "undefined" || !window.localStorage) {
    return DEFAULT_TAX_SETTINGS;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TAX_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      taxEnabled: typeof parsed.taxEnabled === "boolean" ? parsed.taxEnabled : DEFAULT_TAX_SETTINGS.taxEnabled,
      taxRate: typeof parsed.taxRate === "number" ? parsed.taxRate : DEFAULT_TAX_SETTINGS.taxRate,
      taxName: parsed.taxName || DEFAULT_TAX_SETTINGS.taxName,
      taxCalculation: parsed.taxCalculation === "inclusive" ? "inclusive" : "exclusive",
      npwpd: parsed.npwpd !== undefined ? parsed.npwpd : DEFAULT_TAX_SETTINGS.npwpd,
      showNpwpdOnReceipt: typeof parsed.showNpwpdOnReceipt === "boolean" ? parsed.showNpwpdOnReceipt : DEFAULT_TAX_SETTINGS.showNpwpdOnReceipt,
      serviceChargeEnabled: typeof parsed.serviceChargeEnabled === "boolean" ? parsed.serviceChargeEnabled : DEFAULT_TAX_SETTINGS.serviceChargeEnabled,
      serviceChargeRate: typeof parsed.serviceChargeRate === "number" ? parsed.serviceChargeRate : DEFAULT_TAX_SETTINGS.serviceChargeRate,
      serviceChargeName: parsed.serviceChargeName || DEFAULT_TAX_SETTINGS.serviceChargeName,
      rounding: ["round100", "round500", "round1000"].includes(parsed.rounding) ? parsed.rounding : "none",
      receiptHeaderNote: parsed.receiptHeaderNote !== undefined ? parsed.receiptHeaderNote : DEFAULT_TAX_SETTINGS.receiptHeaderNote,
      receiptFooterNote: parsed.receiptFooterNote !== undefined ? parsed.receiptFooterNote : DEFAULT_TAX_SETTINGS.receiptFooterNote,
      receiptPhone: parsed.receiptPhone !== undefined ? parsed.receiptPhone : DEFAULT_TAX_SETTINGS.receiptPhone,
    };
  } catch {
    return DEFAULT_TAX_SETTINGS;
  }
}

export function saveTaxSettings(settings: TaxSettings): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new Event("storage"));
    window.dispatchEvent(new CustomEvent("tepisawah:tax_settings_changed", { detail: settings }));
  } catch {
    // Non-blocking
  }
}

/**
 * Kalkulasi rincian tagihan (DPP, Service Charge, Pajak Restoran PB1, dan Pembulatan).
 */
export function calculateBill(
  subtotal: number,
  discount: number = 0,
  settings: TaxSettings = loadTaxSettings()
): BillCalculation {
  const taxBase = Math.max(0, subtotal - discount);
  let serviceAmount = 0;
  let taxAmount = 0;
  let rawTotal = taxBase;

  // 1. Biaya Layanan (Service Charge)
  if (settings.serviceChargeEnabled && settings.serviceChargeRate > 0) {
    serviceAmount = Math.round(taxBase * (settings.serviceChargeRate / 100));
  }

  // 2. Pajak Restoran (PB1)
  if (settings.taxEnabled && settings.taxRate > 0) {
    if (settings.taxCalculation === "inclusive") {
      // Harga menu sudah termasuk PB1
      const basePlusService = taxBase + serviceAmount;
      const dpp = basePlusService / (1 + settings.taxRate / 100);
      taxAmount = Math.round(basePlusService - dpp);
      rawTotal = basePlusService;
    } else {
      // Harga menu belum termasuk PB1 (ditambahkan di akhir)
      const taxableBase = taxBase + serviceAmount;
      taxAmount = Math.round(taxableBase * (settings.taxRate / 100));
      rawTotal = taxBase + serviceAmount + taxAmount;
    }
  } else {
    rawTotal = taxBase + serviceAmount;
  }

  // 3. Pembulatan (Rounding)
  let roundingAmount = 0;
  if (settings.rounding === "round100") {
    roundingAmount = Math.ceil(rawTotal / 100) * 100 - rawTotal;
  } else if (settings.rounding === "round500") {
    roundingAmount = Math.ceil(rawTotal / 500) * 500 - rawTotal;
  } else if (settings.rounding === "round1000") {
    roundingAmount = Math.ceil(rawTotal / 1000) * 1000 - rawTotal;
  }

  const total = rawTotal + roundingAmount;

  return {
    subtotal,
    discount,
    taxBase,
    serviceAmount,
    taxAmount,
    rawTotal,
    roundingAmount,
    total,
  };
}
