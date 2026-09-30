/**
 * Money representation.
 *
 * Monetary amounts are carried as integer minor units (cents / IDR sen) to
 * avoid floating point rounding. Formatting for display is an app concern.
 */

/** Amount in the smallest currency unit. */
export type MinorUnits = number;

/** Monetary value: amount + ISO 4217 currency code. */
export interface Money {
  amount: MinorUnits;
  currency: string;
}

/** Zero-value money for the given currency. */
export function zeroMoney(currency = "IDR"): Money {
  return { amount: 0, currency };
}
