/**
 * Cash drawer & cashier shift contracts.
 */

export type ShiftStatus = "OPEN" | "CLOSED";
export type CashTransactionType = "CASH_IN" | "CASH_OUT";

export interface CashShift {
  id: string;
  staffId: string;
  staffName: string;
  shiftName: string;
  openedAt: string;
  closedAt: string | null;
  startingCash: number;
  cashSales: number;
  cashIn: number;
  cashOut: number;
  expectedCash: number;
  actualCash: number | null;
  cashDifference: number | null;
  notes: string | null;
  status: ShiftStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CashTransaction {
  id: string;
  shiftId: string;
  type: CashTransactionType;
  amount: number;
  reason: string;
  createdBy: string;
  createdAt: string;
}

export interface OpenCashShiftInput {
  startingCash: number;
  shiftName?: string;
}

export interface RecordCashTransactionInput {
  shiftId: string;
  type: CashTransactionType;
  amount: number;
  reason: string;
}

export interface CloseCashShiftInput {
  shiftId: string;
  actualCash: number;
  notes?: string | null;
}

export interface CurrentShiftPayload {
  active: boolean;
  shift: CashShift | null;
  transactions: CashTransaction[];
}
