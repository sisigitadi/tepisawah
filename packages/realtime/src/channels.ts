/**
 * Realtime channel names and helpers.
 *
 * Channel naming is owned by this package so that apps and edge functions
 * never disagree about a topic string (REPOSITORY_STRUCTURE.md §32, §42).
 */

/** Canonical realtime channel namespace. */
export const REALTIME_CHANNELS = {
  orders: "orders",
  kitchen: "kitchen",
  payments: "payments",
  service: "service",
  presence: "presence",
} as const;

export type RealtimeChannelName =
  (typeof REALTIME_CHANNELS)[keyof typeof REALTIME_CHANNELS];

/** Scope a broadcast channel to a single tenant/order id. */
export function orderChannel(orderId: string): string {
  return `${REALTIME_CHANNELS.orders}:${orderId}`;
}

/** Scope a broadcast channel to a single tenant's kitchen display. */
export function kitchenChannel(tenantId: string): string {
  return `${REALTIME_CHANNELS.kitchen}:${tenantId}`;
}

/** Scope a broadcast channel to payment status updates for one order. */
export function paymentsChannel(orderId: string): string {
  return `${REALTIME_CHANNELS.payments}:${orderId}`;
}

/** Scope a broadcast channel to guest service requests for one table. */
export function serviceChannel(tableId: string): string {
  return `${REALTIME_CHANNELS.service}:${tableId}`;
}

/** True when a raw channel name belongs to the given namespace. */
export function isChannelName(value: string): value is RealtimeChannelName {
  return (
    value === REALTIME_CHANNELS.orders ||
    value === REALTIME_CHANNELS.kitchen ||
    value === REALTIME_CHANNELS.payments ||
    value === REALTIME_CHANNELS.service ||
    value === REALTIME_CHANNELS.presence
  );
}
