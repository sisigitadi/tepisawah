/**
 * Payment lifecycle statuses.
 *
 * Authoritative status flow is enforced by the `payments-create` and
 * `payments-qris-webhook` edge functions (§30, §34).
 */
export const PAYMENT_STATUSES = {
  pending: "pending",
  succeeded: "succeeded",
  failed: "failed",
  refunded: "refunded",
} as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[keyof typeof PAYMENT_STATUSES];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  [PAYMENT_STATUSES.pending]: "Pending",
  [PAYMENT_STATUSES.succeeded]: "Succeeded",
  [PAYMENT_STATUSES.failed]: "Failed",
  [PAYMENT_STATUSES.refunded]: "Refunded",
};
