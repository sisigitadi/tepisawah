/**
 * Payment method metadata.
 */
import type { PaymentMethod } from "./types.js";

export const PAYMENT_METHODS: readonly PaymentMethod[] = ["cash", "qris", "card"];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  qris: "QRIS",
  card: "Card",
};
