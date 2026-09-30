/**
 * Orders API contract surface.
 *
 * Order submission goes through the `orders-submit` / `orders-transition` edge
 * functions; apps must not perform raw inserts (§35). Placeholders only.
 */
import type { Order } from "./types.js";
import type { OrderState } from "./states.js";
import { canTransition } from "./transitions.js";

export interface OrdersApi {
  submit(order: Omit<Order, "id" | "createdAt">): Promise<Order>;
  transition(id: string, to: OrderState): Promise<Order>;
}

export const ordersApi: OrdersApi = {
  async submit() {
    throw new Error("ordersApi.submit: not implemented (Phase 0)");
  },
  async transition() {
    throw new Error("ordersApi.transition: not implemented (Phase 0)");
  },
};

export { canTransition };
