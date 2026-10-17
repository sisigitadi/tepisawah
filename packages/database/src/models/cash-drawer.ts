/**
 * Cash drawer & cashier shift mapping and validation helpers.
 */
import type {
  CashShift,
  CashTransaction,
  CloseCashShiftInput,
  OpenCashShiftInput,
  RecordCashTransactionInput,
} from "./cash-drawer-types.js";

function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function toCashShift(row: Record<string, unknown>): CashShift {
  return {
    id: String(row.id ?? ""),
    staffId: String(row.staff_id ?? ""),
    staffName: String(row.staff_name ?? "Kasir"),
    shiftName: String(row.shift_name ?? "Shift Kasir"),
    openedAt: String(row.opened_at ?? new Date().toISOString()),
    closedAt: row.closed_at ? String(row.closed_at) : null,
    startingCash: toNumber(row.starting_cash),
    cashSales: toNumber(row.cash_sales),
    cashIn: toNumber(row.cash_in),
    cashOut: toNumber(row.cash_out),
    expectedCash: toNumber(row.expected_cash),
    actualCash: row.actual_cash !== null && row.actual_cash !== undefined ? toNumber(row.actual_cash) : null,
    cashDifference: row.cash_difference !== null && row.cash_difference !== undefined ? toNumber(row.cash_difference) : null,
    notes: row.notes ? String(row.notes) : null,
    status: row.status === "CLOSED" ? "CLOSED" : "OPEN",
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

export function toCashTransaction(row: Record<string, unknown>): CashTransaction {
  return {
    id: String(row.id ?? ""),
    shiftId: String(row.shift_id ?? ""),
    type: row.type === "CASH_OUT" ? "CASH_OUT" : "CASH_IN",
    amount: toNumber(row.amount),
    reason: String(row.reason ?? ""),
    createdBy: String(row.created_by ?? ""),
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

export function isValidOpenCashShiftInput(input: unknown): input is OpenCashShiftInput {
  if (!input || typeof input !== "object") return false;
  const candidate = input as Record<string, unknown>;
  return typeof candidate.startingCash === "number" && candidate.startingCash >= 0;
}

export function isValidRecordCashTransactionInput(input: unknown): input is RecordCashTransactionInput {
  if (!input || typeof input !== "object") return false;
  const candidate = input as Record<string, unknown>;
  return (
    typeof candidate.shiftId === "string" &&
    candidate.shiftId.length > 0 &&
    (candidate.type === "CASH_IN" || candidate.type === "CASH_OUT") &&
    typeof candidate.amount === "number" &&
    candidate.amount > 0 &&
    typeof candidate.reason === "string" &&
    candidate.reason.trim().length > 0
  );
}

export function isValidCloseCashShiftInput(input: unknown): input is CloseCashShiftInput {
  if (!input || typeof input !== "object") return false;
  const candidate = input as Record<string, unknown>;
  return (
    typeof candidate.shiftId === "string" &&
    candidate.shiftId.length > 0 &&
    typeof candidate.actualCash === "number" &&
    candidate.actualCash >= 0
  );
}
