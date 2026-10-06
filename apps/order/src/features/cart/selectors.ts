/**
 * @tepisawah/order — `cart` selectors.
 *
 * Pure projections from the basket map plus the live catalog. They are the only
 * place the cart touches money, and only for *display*: the catalog price and
 * modifier deltas are read from the public projection and summed into a line
 * total the customer sees. Nothing here is ever sent back to the server —
 * `toCheckoutLines` emits references and intent only, no money
 * (API_CONTRACT.md §2.2, §10.1, §27).
 *
 * A product the catalog no longer lists (archived between the customer opening
 * the menu and opening the basket) resolves to nothing and is dropped, so a
 * stale basket never sends a product the server would refuse anyway.
 */
import {
  MAX_CART_LINE_NOTES_LENGTH,
  MAX_CART_LINE_QUANTITY,
  normalizeCartNote,
  type CartLine,
  type CartLineView,
} from "@tepisawah/orders";

import type { CartMap, PublicCatalogProduct } from "./types.js";

/**
 * Resolve the basket against the catalog into display lines, in catalog order
 * so the basket reads top-to-bottom like the menu.
 */
export function resolveCartLines(
  cart: CartMap,
  products: ReadonlyArray<PublicCatalogProduct>,
): CartLineView[] {
  const lines: CartLineView[] = [];
  for (const product of products) {
    const entry = cart[product.productId];
    // An entry with no quantity is a modifier choice the customer has not
    // added yet (or a line they stepped back to zero): it is not a basket line.
    if (entry === undefined || entry.quantity <= 0) continue;
    const chosen = product.modifiers.filter((modifier) =>
      entry.modifierIds.includes(modifier.modifierId),
    );
    const unitPrice =
      product.price + chosen.reduce((sum, modifier) => sum + modifier.priceDelta, 0);
    lines.push({
      productId: product.productId,
      name: product.name,
      quantity: entry.quantity,
      modifierNames: chosen.map((modifier) => modifier.name),
      notes: normalizeCartNote(entry.notes),
      unitPrice,
      lineTotal: unitPrice * entry.quantity,
      imageUrl: product.imageUrl,
    });
  }
  return lines;
}

/** Total units in the basket, for the floating bar and the drawer header. */
export function cartItemCount(cart: CartMap): number {
  return Object.values(cart).reduce((sum, entry) => sum + entry.quantity, 0);
}

/** Display-only grand total; the server computes the number the customer pays. */
export function cartTotalPrice(lines: ReadonlyArray<CartLineView>): number {
  return lines.reduce((sum, line) => sum + line.lineTotal, 0);
}

/**
 * The checkout lines with the catalog names the checkout review prints next to
 * each quantity. Built from the resolved views so the name and the intent stay
 * one projection, never two that can drift apart.
 */
export function resolveCartEntries(
  cart: CartMap,
  products: ReadonlyArray<PublicCatalogProduct>,
): Array<CartLine & { name: string }> {
  const byId = new Map(products.map((product) => [product.productId, product]));
  return toCheckoutLines(cart, products).map((line) => {
    const product = byId.get(line.productId);
    return { ...line, name: product?.name ?? line.productId };
  });
}

/**
 * Project the basket into the checkout contract: product id, quantity, modifier
 * ids and notes. No money field exists on the result, so the request cannot
 * carry one even by mistake (API_CONTRACT.md §10.1).
 *
 * Modifier ids come from the basket entry rather than the resolved view because
 * the view keeps names for display; the ids are what the RPC validates.
 */
export function toCheckoutLines(
  cart: CartMap,
  products: ReadonlyArray<PublicCatalogProduct>,
): CartLine[] {
  return resolveCartLines(cart, products).map((line) => {
    const entry = cart[line.productId];
    return {
      productId: line.productId,
      quantity: line.quantity,
      // The view keeps modifier *names* for display; the ids are what the RPC
      // validates, so they come straight off the basket entry.
      modifierIds: [...(entry?.modifierIds ?? [])],
      notes: line.notes,
    };
  });
}

/**
 * Clamp a stepper's target so a long press cannot exceed the domain limit
 * (@tepisawah/orders `MAX_CART_LINE_QUANTITY`).
 */
export function clampQuantity(quantity: number): number {
  return Math.min(MAX_CART_LINE_QUANTITY, Math.max(0, Math.trunc(quantity)));
}

/** Clamp a note to the length the order domain accepts. */
export function clampNote(note: string): string {
  return note.slice(0, MAX_CART_LINE_NOTES_LENGTH);
}

/**
 * Basket map transitions, all pure so both the menu card and the drawer move
 * the same basket through the same helpers. Each returns a new map; the caller
 * stores it (the router holds the basket so a checkout round trip survives).
 */
export function incrementEntry(cart: CartMap, productId: string): CartMap {
  const entry = cart[productId];
  if (entry === undefined) {
    return { ...cart, [productId]: { quantity: 1, modifierIds: [], notes: null } };
  }
  const quantity = clampQuantity(entry.quantity + 1);
  if (quantity === 0) return removeEntry(cart, productId);
  return { ...cart, [productId]: { ...entry, quantity } };
}

export function decrementEntry(cart: CartMap, productId: string): CartMap {
  const entry = cart[productId];
  if (entry === undefined) return cart;
  const quantity = clampQuantity(entry.quantity - 1);
  if (quantity === 0) return removeEntry(cart, productId);
  return { ...cart, [productId]: { ...entry, quantity } };
}

export function removeEntry(cart: CartMap, productId: string): CartMap {
  if (cart[productId] === undefined) return cart;
  const next: CartMap = { ...cart };
  delete next[productId];
  return next;
}

export function setEntryNote(cart: CartMap, productId: string, notes: string): CartMap {
  const entry = cart[productId];
  if (entry === undefined) return cart;
  return {
    ...cart,
    [productId]: { ...entry, notes: clampNote(notes) },
  };
}

export function setEntryModifiers(
  cart: CartMap,
  productId: string,
  modifierIds: string[],
): CartMap {
  const entry = cart[productId] ?? { quantity: 0, modifierIds: [], notes: null };
  return { ...cart, [productId]: { ...entry, modifierIds } };
}

/** True when there is nothing in the basket the customer could submit. */
export function isCartEmpty(cart: CartMap): boolean {
  return cartItemCount(cart) === 0;
}
