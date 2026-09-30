/**
 * Payments API contract surface.
 *
 * Payment creation goes through the `payments-create` edge function; webhook
 * handling through `payments-qris-webhook`. Apps must not write payment rows
 * directly (§35).
 */
import type { Payment, PaymentMethod } from "./types.js";

export interface PaymentsApi {
  create(input: {
    orderId: string;
    method: PaymentMethod;
    amount: number;
  }): Promise<Payment>;
}

export const paymentsApi: PaymentsApi = {
  async create() {
    throw new Error("paymentsApi.create: not implemented (Phase 0)");
  },
};
