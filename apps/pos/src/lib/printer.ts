/**
 * @tepisawah/pos — Thermal Printer & Bluetooth Driver Service.
 *
 * Dedicated support for Blueprint BP-ECO58 (58mm Bluetooth Mini Portable Printer)
 * via Blueprint Mobile POS Android app and 80mm desktop thermal printers.
 * Re-exports the unified printer engine from @tepisawah/config.
 */

export {
  loadPrinterConfig,
  savePrinterConfig,
  generateReceiptText,
  printWithBlueprintMobile,
  printWithRawBt,
  executePrint,
  runTestPrint,
  type PrinterConfig,
  type PrinterDriverMode,
  type PrinterPaperWidth,
  type ReceiptItem,
  type ReceiptOrderData,
} from "@tepisawah/config";
