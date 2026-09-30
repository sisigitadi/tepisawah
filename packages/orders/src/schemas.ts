/**
 * Orders validation schemas (plain predicates; no validation library in Phase 0).
 */
import type { Order, OrderLineItem } from "./types.js";

export function isValidLineItem(item: unknown): item is OrderLineItem {
  return (
    typeof item === "object" &&
    item !== null &&
    "id" in item &&
    "itemId" in item &&
    "quantity" in item &&
    typeof (item as { quantity: unknown }).quantity === "number" &&
    (item as { quantity: number }).quantity >= 1
  );
}

export function isValidOrder(order: unknown): order is Order {
  return (
    typeof order === "object" &&
    order !== null &&
    "id" in order &&
    "code" in order &&
    "items" in order &&
    Array.isArray((order as { items: unknown }).items) &&
    (order as { items: unknown[] }).items.every(isValidLineItem)
  );
}
