/**
 * @tepisawah/orders — customer cart domain (Phase 4).
 *
 * The cart is pre-order *intent*: product and modifier references, quantities
 * and notes. It deliberately carries no money — the price a customer pays is
 * always read from the catalog server-side at order creation
 * (API_CONTRACT.md §2.2, §10.1) — so a cart line is exactly the subset of
 * `DraftOrderItemInput` a customer's browser is permitted to hold.
 *
 * The customer ordering app builds its basket on this vocabulary so the cart's
 * shape is owned by the order domain rather than by the app that happens to
 * render it (REPOSITORY_STRUCTURE.md §34).
 */
import type { ID } from "@tepisawah/types";

/**
 * The longest per-item note a customer may attach. Mirrors the
 * `order_items.notes` column so a cart that passes here reaches the RPC
 * without a surprise truncation.
 */
export const MAX_CART_LINE_NOTES_LENGTH = 200;

/**
 * The longest order-level note a customer may attach. Mirrors `orders.notes`.
 */
export const MAX_CUSTOMER_NOTE_LENGTH = 500;

/** The most of one product a single cart line may hold. */
export const MAX_CART_LINE_QUANTITY = 99;

/**
 * One line in a customer's cart. References and intent only: there is no
 * `unitPrice`, no `subtotal` and no `name` field here, because those belong to
 * the catalog and the order snapshot, not to the basket (API_CONTRACT.md §27).
 */
export interface CartLine {
  productId: ID;
  quantity: number;
  /** Modifier ids chosen for this line; validated against the catalog. */
  modifierIds?: string[];
  /** A free-text request for this line, e.g. "tanpa bawang". */
  notes?: string | null;
}

/**
 * A customer's whole basket: its lines plus the order-level note the kitchen
 * and cashier will read alongside them.
 */
export interface Cart {
  lines: CartLine[];
  /** A note applying to the whole order, not one line. */
  customerNote?: string | null;
}

/**
 * A cart line with the catalog fields the basket UI needs to *display* the
 * line. Money here is display-only, read from the public catalog projection —
 * it is never sent back to the server (API_CONTRACT.md §10.1).
 */
export interface CartLineView {
  productId: ID;
  name: string;
  quantity: number;
  /** Modifier names chosen for the line, for the item breakdown. */
  modifierNames: string[];
  notes: string | null;
  /** Display-only: catalog unit price plus the chosen modifiers' deltas. */
  unitPrice: number;
  /** Display-only: `unitPrice * quantity`. */
  lineTotal: number;
  imageUrl: string | null;
}

/** True when the value is a cart line the domain accepts. */
export function isValidCartLine(value: unknown): value is CartLine {
  if (typeof value !== "object" || value === null) return false;
  const line = value as Record<string, unknown>;
  return (
    typeof line["productId"] === "string" &&
    line["productId"].length > 0 &&
    typeof line["quantity"] === "number" &&
    Number.isInteger(line["quantity"]) &&
    line["quantity"] >= 1 &&
    line["quantity"] <= MAX_CART_LINE_QUANTITY
  );
}

/** Total units across every line, for the basket badge and the footer count. */
export function cartLineCount(lines: readonly CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

/** True when the basket has nothing submittable in it. */
export function isCartEmpty(cart: Cart): boolean {
  return cart.lines.length === 0 || cartLineCount(cart.lines) === 0;
}

/**
 * Trim a note and drop it when it becomes empty, so an untouched field never
 * reaches the order as whitespace.
 */
export function normalizeCartNote(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length === 0 ? null : trimmed;
}
