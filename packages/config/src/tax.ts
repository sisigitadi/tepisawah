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
  tableSessionMode: "strict" | "auto";
  qrisImageUrl?: string;
  qrisPayload?: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  printerPaperWidth: "58mm" | "80mm";
  printerAutoPrint: boolean;
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
  tableSessionMode: "auto",
  qrisImageUrl: "",
  qrisPayload: "",
  bankName: "BCA",
  bankAccountNumber: "",
  bankAccountHolder: "",
  printerPaperWidth: "80mm",
  printerAutoPrint: true,
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
      tableSessionMode: parsed.tableSessionMode === "strict" ? "strict" : "auto",
      qrisImageUrl: parsed.qrisImageUrl ?? DEFAULT_TAX_SETTINGS.qrisImageUrl,
      qrisPayload: parsed.qrisPayload ?? DEFAULT_TAX_SETTINGS.qrisPayload,
      bankName: parsed.bankName || DEFAULT_TAX_SETTINGS.bankName,
      bankAccountNumber: parsed.bankAccountNumber ?? DEFAULT_TAX_SETTINGS.bankAccountNumber,
      bankAccountHolder: parsed.bankAccountHolder ?? DEFAULT_TAX_SETTINGS.bankAccountHolder,
      printerPaperWidth: parsed.printerPaperWidth === "58mm" ? "58mm" : "80mm",
      printerAutoPrint: typeof parsed.printerAutoPrint === "boolean" ? parsed.printerAutoPrint : DEFAULT_TAX_SETTINGS.printerAutoPrint,
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

export function syncTaxSettingsFromDb(row: Record<string, unknown>): TaxSettings {
  const current = loadTaxSettings();
  const merged: TaxSettings = {
    taxEnabled: typeof row.tax_enabled === "boolean" ? row.tax_enabled : current.taxEnabled,
    taxRate: typeof row.tax_rate === "number" ? row.tax_rate : Number(row.tax_rate) || current.taxRate,
    taxName: String(row.tax_name || current.taxName),
    taxCalculation: row.tax_calculation === "inclusive" ? "inclusive" : "exclusive",
    npwpd: String(row.npwpd ?? current.npwpd),
    showNpwpdOnReceipt: typeof row.show_npwpd_on_receipt === "boolean" ? row.show_npwpd_on_receipt : current.showNpwpdOnReceipt,
    serviceChargeEnabled: typeof row.service_charge_enabled === "boolean" ? row.service_charge_enabled : current.serviceChargeEnabled,
    serviceChargeRate: typeof row.service_charge_rate === "number" ? row.service_charge_rate : Number(row.service_charge_rate) || current.serviceChargeRate,
    serviceChargeName: String(row.service_charge_name || current.serviceChargeName),
    rounding: ["round100", "round500", "round1000"].includes(String(row.rounding)) ? (row.rounding as RoundingMode) : "none",
    receiptHeaderNote: String(row.receipt_header_note ?? current.receiptHeaderNote),
    receiptFooterNote: String(row.receipt_footer_note ?? current.receiptFooterNote),
    receiptPhone: String(row.receipt_phone ?? current.receiptPhone),
    tableSessionMode: row.table_session_mode === "strict" ? "strict" : "auto",
    qrisImageUrl: String(row.qris_image_url ?? current.qrisImageUrl ?? ""),
    qrisPayload: String(row.qris_payload ?? current.qrisPayload ?? ""),
    bankName: String(row.bank_name || current.bankName),
    bankAccountNumber: String(row.bank_account_number ?? current.bankAccountNumber),
    bankAccountHolder: String(row.bank_account_holder ?? current.bankAccountHolder),
    printerPaperWidth: row.printer_paper_width === "58mm" ? "58mm" : "80mm",
    printerAutoPrint: typeof row.printer_auto_print === "boolean" ? row.printer_auto_print : current.printerAutoPrint,
  };
  saveTaxSettings(merged);
  return merged;
}

export function toDbTaxSettings(settings: TaxSettings): Record<string, unknown> {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    tax_enabled: settings.taxEnabled,
    tax_rate: settings.taxRate,
    tax_name: settings.taxName,
    tax_calculation: settings.taxCalculation,
    npwpd: settings.npwpd,
    show_npwpd_on_receipt: settings.showNpwpdOnReceipt,
    service_charge_enabled: settings.serviceChargeEnabled,
    service_charge_rate: settings.serviceChargeRate,
    service_charge_name: settings.serviceChargeName,
    rounding: settings.rounding,
    receipt_header_note: settings.receiptHeaderNote,
    receipt_footer_note: settings.receiptFooterNote,
    receipt_phone: settings.receiptPhone,
    table_session_mode: settings.tableSessionMode,
    qris_image_url: settings.qrisImageUrl ?? "",
    qris_payload: settings.qrisPayload ?? "",
    bank_name: settings.bankName,
    bank_account_number: settings.bankAccountNumber,
    bank_account_holder: settings.bankAccountHolder,
    printer_paper_width: settings.printerPaperWidth,
    printer_auto_print: settings.printerAutoPrint,
    updated_at: new Date().toISOString(),
  };
}
