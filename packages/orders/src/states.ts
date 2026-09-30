/**
 * Order lifecycle states and transitions.
 *
 * The authoritative state machine lives on the backend (edge function
 * `orders-transition`); this module mirrors the states so clients can render
 * them without duplicating business rules (§30, §34).
 */
export const ORDER_STATES = {
  pending: "pending",
  confirmed: "confirmed",
  preparing: "preparing",
  ready: "ready",
  served: "served",
  cancelled: "cancelled",
} as const;

export type OrderState = (typeof ORDER_STATES)[keyof typeof ORDER_STATES];

export const ORDER_STATE_LABELS: Record<OrderState, string> = {
  [ORDER_STATES.pending]: "Pending",
  [ORDER_STATES.confirmed]: "Confirmed",
  [ORDER_STATES.preparing]: "Preparing",
  [ORDER_STATES.ready]: "Ready",
  [ORDER_STATES.served]: "Served",
  [ORDER_STATES.cancelled]: "Cancelled",
};
