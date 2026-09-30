/**
 * Payments domain types.
 * Contract types only — no business logic (§34).
 */
import type { ID, ISODateString, Money } from "@tepisawah/types";

export type PaymentMethod = "cash" | "qris" | "card";

export interface Payment {
  id: ID;
  orderId: ID;
  method: PaymentMethod;
  amount: Money;
  createdAt: ISODateString;
}
