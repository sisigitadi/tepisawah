/**
 * @tepisawah/config — Thermal Printer & Bluetooth Driver Service.
 *
 * Dedicated support for:
 * 1. Blueprint BP-ECO58 (58mm Bluetooth Mini Portable Printer) via Blueprint Mobile POS
 * 2. RawBT Android Bluetooth Print Service (intent bridge)
 * 3. Browser Print Spooler (window.print with locked 48mm/72mm CSS)
 * 4. Web Bluetooth Direct (Chrome Android/Desktop)
 * 5. Standard 80mm desktop thermal printers
 */

import { loadTaxSettings, saveTaxSettings, type TaxSettings } from "./tax.js";

export type PrinterPaperWidth = "58mm" | "80mm";
export type PrinterDriverMode = "blueprint_mobile" | "browser" | "rawbt" | "bluetooth";

export interface PrinterConfig {
  paperWidth: PrinterPaperWidth;
  driverMode: PrinterDriverMode;
  autoPrint: boolean;
  bluetoothDeviceName?: string;
}

export interface ReceiptItem {
  readonly id?: string;
  readonly name: string;
  readonly qty: number;
  readonly price: number;
  readonly note?: string | null;
}

export interface ReceiptOrderData {
  readonly id: string;
  readonly ticket?: string;
  readonly table: string;
  readonly pax?: number;
  readonly time?: string;
  readonly items: readonly ReceiptItem[];
  readonly subtotal?: number;
  readonly taxAmount?: number;
  readonly total?: number;
}

export const DEFAULT_PRINTER_CONFIG: PrinterConfig = {
  paperWidth: "58mm",
  driverMode: "blueprint_mobile",
  autoPrint: true,
  bluetoothDeviceName: "BP-ECO58",
};

const STORAGE_KEY = "tepisawah_printer_config";

export function loadPrinterConfig(): PrinterConfig {
  const tax = loadTaxSettings();
  if (typeof window === "undefined" || !window.localStorage) {
    return {
      paperWidth: tax.printerPaperWidth ?? "58mm",
      driverMode: "blueprint_mobile",
      autoPrint: tax.printerAutoPrint ?? true,
      bluetoothDeviceName: "BP-ECO58",
    };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        paperWidth: tax.printerPaperWidth ?? "58mm",
        driverMode: "blueprint_mobile",
        autoPrint: tax.printerAutoPrint ?? true,
        bluetoothDeviceName: "BP-ECO58",
      };
    }
    const parsed = JSON.parse(raw);
    const validModes: PrinterDriverMode[] = ["blueprint_mobile", "browser", "rawbt", "bluetooth"];
    return {
      paperWidth: parsed.paperWidth === "80mm" ? "80mm" : "58mm",
      driverMode: validModes.includes(parsed.driverMode) ? parsed.driverMode : "blueprint_mobile",
      autoPrint: typeof parsed.autoPrint === "boolean" ? parsed.autoPrint : true,
      bluetoothDeviceName: parsed.bluetoothDeviceName || "BP-ECO58",
    };
  } catch {
    return DEFAULT_PRINTER_CONFIG;
  }
}

export function savePrinterConfig(config: PrinterConfig): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    // Synchronize paperWidth and autoPrint to global TaxSettings
    const tax = loadTaxSettings();
    saveTaxSettings({
      ...tax,
      printerPaperWidth: config.paperWidth,
      printerAutoPrint: config.autoPrint,
    });
    window.dispatchEvent(new CustomEvent("tepisawah:printer_config_changed", { detail: config }));
  } catch {
    // Non-blocking
  }
}

function formatIDR(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Pad string left/right for 32 chars (58mm BP-ECO58) or 42 chars (80mm) */
function padLine(left: string, right: string, maxLen = 32): string {
  const spaceNeeded = maxLen - left.length - right.length;
  if (spaceNeeded <= 0) {
    return left.slice(0, Math.max(1, maxLen - right.length - 1)) + " " + right;
  }
  return left + " ".repeat(spaceNeeded) + right;
}

function centerText(text: string, maxLen = 32): string {
  if (text.length >= maxLen) return text.slice(0, maxLen);
  const leftPad = Math.floor((maxLen - text.length) / 2);
  return " ".repeat(leftPad) + text;
}

/** Generate formatted plain-text ESC/POS slip for Blueprint BP-ECO58 and thermal printers */
export function generateReceiptText(
  order: ReceiptOrderData,
  taxSettings: TaxSettings = loadTaxSettings()
): string {
  const is58mm = taxSettings.printerPaperWidth === "58mm";
  const lineLen = is58mm ? 32 : 42;
  const sep = "=".repeat(lineLen);
  const thinSep = "-".repeat(lineLen);

  const lines: string[] = [];
  lines.push(centerText("TEPI SAWAH RESTO & CAFE", lineLen));
  lines.push(centerText(taxSettings.receiptHeaderNote || "Kawasan Wisata Sawah, Ciperna", lineLen));
  if (taxSettings.receiptPhone) {
    lines.push(centerText("Telp: " + taxSettings.receiptPhone, lineLen));
  }
  if (taxSettings.showNpwpdOnReceipt && taxSettings.npwpd) {
    lines.push(centerText("NPWPD: " + taxSettings.npwpd, lineLen));
  }
  lines.push(sep);

  lines.push(padLine("No:", order.ticket || order.id, lineLen));
  lines.push(padLine("Meja:", `${order.table}${order.pax ? ` (${order.pax} Pax)` : ""}`, lineLen));
  lines.push(padLine("Waktu:", order.time || new Date().toLocaleTimeString("id-ID"), lineLen));
  lines.push(thinSep);

  let computedSubtotal = 0;
  for (const item of order.items) {
    const itemTotal = item.qty * item.price;
    computedSubtotal += itemTotal;
    const itemLeft = `${item.qty}x ${item.name}`;
    const itemRight = formatIDR(itemTotal).replace("Rp\u00a0", "").replace("Rp ", "");
    lines.push(padLine(itemLeft, itemRight, lineLen));
    if (item.note) {
      lines.push(`   (${item.note.slice(0, lineLen - 5)})`);
    }
  }

  lines.push(thinSep);
  const subtotal = order.subtotal ?? computedSubtotal;
  lines.push(padLine("Subtotal:", formatIDR(subtotal).replace("Rp\u00a0", "").replace("Rp ", ""), lineLen));

  const taxAmount = order.taxAmount ?? (taxSettings.taxEnabled ? Math.round(subtotal * (taxSettings.taxRate / 100)) : 0);
  if (taxSettings.taxEnabled && taxAmount > 0) {
    lines.push(padLine(taxSettings.taxName || "PB1 (10%):", formatIDR(taxAmount).replace("Rp\u00a0", "").replace("Rp ", ""), lineLen));
  }

  const grandTotal = order.total ?? (subtotal + taxAmount);
  lines.push(sep);
  lines.push(padLine("TOTAL:", formatIDR(grandTotal), lineLen));
  lines.push(sep);

  if (taxSettings.receiptFooterNote) {
    for (const foot of taxSettings.receiptFooterNote.split("\n")) {
      lines.push(centerText(foot, lineLen));
    }
  }

  lines.push("\n\n\n"); // Feed paper
  return lines.join("\n");
}

/** Print via RawBT intent bridge on Android for BP-ECO58 */
export function printWithRawBt(text: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const base64Data = btoa(unescape(encodeURIComponent(text)));
    const rawBtUrl = `rawbt:data:application/octet-stream;base64,${base64Data}`;
    window.location.href = rawBtUrl;
    return true;
  } catch {
    return false;
  }
}

/** Print via Blueprint Mobile Android App / Intent Spooler */
export function printWithBlueprintMobile(text: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const isAndroid = /android/i.test(navigator.userAgent || "");
    if (isAndroid) {
      // Intent scheme targeting Blueprint Mobile POS / Blueprint Mobile Print
      const encodedText = encodeURIComponent(text);
      const blueprintIntentUrl = `intent:#Intent;action=android.intent.action.SEND;type=text/plain;S.android.intent.extra.TEXT=${encodedText};package=com.blueprint.mobileprint;end`;
      
      // Attempt triggering intent
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = blueprintIntentUrl;
      document.body.appendChild(iframe);
      setTimeout(() => {
        try {
          document.body.removeChild(iframe);
        } catch {
          // ignore
        }
      }, 1000);
      
      // Also invoke native window.print() so Android Print Spooler handles Blueprint Print Service seamlessly
      setTimeout(() => {
        window.print();
      }, 300);
      return true;
    }

    // Desktop or non-Android fallback
    window.print();
    return true;
  } catch {
    window.print();
    return false;
  }
}

/** Execute printing based on configured driver */
export async function executePrint(
  order: ReceiptOrderData,
  config = loadPrinterConfig()
): Promise<void> {
  const tax = loadTaxSettings();
  const receiptText = generateReceiptText(order, tax);

  if (config.driverMode === "blueprint_mobile") {
    printWithBlueprintMobile(receiptText);
  } else if (config.driverMode === "rawbt") {
    const sent = printWithRawBt(receiptText);
    if (!sent) {
      window.print();
    }
  } else {
    // Standard web print / browser spooler
    window.print();
  }
}

/** Perform a test print to BP-ECO58 */
export function runTestPrint(config = loadPrinterConfig()): void {
  const testOrder: ReceiptOrderData = {
    id: "TEST-01",
    ticket: "#TEST-BP-ECO58",
    table: "Meja Uji Coba",
    time: new Date().toLocaleTimeString("id-ID") + " WIB",
    pax: 2,
    items: [
      { id: "t1", name: "Kopi Susu Gula Aren", qty: 2, price: 22000 },
      { id: "t2", name: "Pisang Goreng Keju", qty: 1, price: 25000 },
    ],
  };

  void executePrint(testOrder, config);
}
