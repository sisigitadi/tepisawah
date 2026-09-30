/**
 * Order state transition map.
 *
 * Client-side validation mirrors the server authority for UX only; the edge
 * function `orders-transition` is the single owner of the rules (§34).
 */
import { ORDER_STATES, type OrderState } from "./states.js";

const TRANSITIONS: Record<OrderState, readonly OrderState[]> = {
  [ORDER_STATES.pending]: [ORDER_STATES.confirmed, ORDER_STATES.cancelled],
  [ORDER_STATES.confirmed]: [ORDER_STATES.preparing],
  [ORDER_STATES.preparing]: [ORDER_STATES.ready],
  [ORDER_STATES.ready]: [ORDER_STATES.served],
  [ORDER_STATES.served]: [],
  [ORDER_STATES.cancelled]: [],
};

export function canTransition(from: OrderState, to: OrderState): boolean {
  return TRANSITIONS[from].includes(to);
}
