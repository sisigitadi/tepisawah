/**
 * Realtime event envelopes and event names.
 *
 * Events are the wire format broadcast over Supabase Realtime. Business rules
 * stay on the backend; clients only render what these envelopes carry
 * (REPOSITORY_STRUCTURE.md §34).
 */
import type { ISODateString } from "@tepisawah/types";

/** Canonical realtime event names. */
export const REALTIME_EVENTS = {
  orderCreated: "order.created",
  orderUpdated: "order.updated",
  orderTransitioned: "order.transitioned",
  orderCancelled: "order.cancelled",
  paymentCreated: "payment.created",
  paymentStatusUpdated: "payment.status_updated",
  serviceRequested: "service.requested",
  serviceResolved: "service.resolved",
  presenceSynced: "presence.synced",
} as const;

export type RealtimeEventName =
  (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];

/**
 * Base envelope shared by every broadcast event. `id` and `version` make events
 * idempotent on the client (see ./dedupe.ts and ./versioning.ts).
 */
export interface RealtimeEvent<T = unknown> {
  /** Server-assigned unique event id, used for deduplication. */
  id: string;
  /** Monotonic per-stream version, used to reject out-of-order replays. */
  version: number;
  /** Discriminating event name. */
  type: RealtimeEventName;
  /** Tenant the event belongs to. */
  tenantId: string;
  /** Server time the event was produced. */
  occurredAt: ISODateString;
  /** Event payload; shape is determined by `type`. */
  payload: T;
}

/** Narrow an unknown envelope to a single event name. */
export function isRealtimeEvent<T>(
  type: RealtimeEventName,
): (value: unknown) => value is RealtimeEvent<T> {
  return (value): value is RealtimeEvent<T> => {
    if (typeof value !== "object" || value === null) return false;
    const event = value as Partial<RealtimeEvent>;
    return (
      typeof event.id === "string" &&
      typeof event.version === "number" &&
      event.type === type &&
      typeof event.tenantId === "string" &&
      typeof event.occurredAt === "string" &&
      "payload" in event
    );
  };
}

/** True when a value carries the base realtime envelope shape. */
export function isRealtimeEventValue(value: unknown): value is RealtimeEvent {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Partial<RealtimeEvent>).id === "string" &&
    typeof (value as Partial<RealtimeEvent>).version === "number" &&
    typeof (value as Partial<RealtimeEvent>).type === "string" &&
    typeof (value as Partial<RealtimeEvent>).tenantId === "string"
  );
}

/** Realtime presence state shared by the presence channel. */
export interface PresenceState {
  userId: string;
  displayName: string;
  role: string;
  joinedAt: ISODateString;
}
