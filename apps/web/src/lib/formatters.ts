/**
 * @tepisawah/web — value formatters.
 *
 * Phase 0 scaffold: structure and tooling only.
 * Presentation helpers only — price calculation and rounding stay in the backend (§34).
 */

export function formatCurrency(amount: number, currency = "IDR"): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency }).format(amount);
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
