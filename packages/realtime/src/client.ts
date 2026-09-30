/**
 * Injection-based realtime client binding.
 *
 * `@supabase/supabase-js` is intentionally not a dependency of this package
 * (REPOSITORY_STRUCTURE.md §6, §53): the app bootstrap layer supplies the
 * concrete Supabase client and we adapt it to a small, testable surface.
 */
import type { PresenceState, RealtimeEvent } from "./events.js";

/** Callback invoked when an event lands on a subscribed channel. */
export type RealtimeEventHandler = (event: RealtimeEvent) => void;

/** Minimal subset of a channel that this package needs from the host client. */
export interface RealtimeChannel {
  onMessage(handler: RealtimeEventHandler): RealtimeChannel;
  onPresence(handler: (state: PresenceState[]) => void): RealtimeChannel;
  subscribe(): RealtimeChannel;
  unsubscribe(): Promise<void>;
}

/** Minimal subset of the Supabase client that this package consumes. */
export interface SupabaseRealtime {
  channel(name: string): RealtimeChannel;
  removeChannel(channel: RealtimeChannel): Promise<void>;
}

let client: SupabaseRealtime | null = null;

/** Install the concrete Supabase client (called once during app bootstrap). */
export function setRealtimeClient(instance: SupabaseRealtime): void {
  client = instance;
}

/** True once a realtime client has been installed. */
export function hasRealtimeClient(): boolean {
  return client !== null;
}

/** Access the installed client; throws before bootstrap has run. */
export function getRealtimeClient(): SupabaseRealtime {
  if (client === null) {
    throw new Error(
      "realtime client not initialised: call setRealtimeClient during bootstrap",
    );
  }
  return client;
}

/**
 * Subscribe to a channel and forward envelopes to the handler.
 *
 * Handlers should pair this with `EventDeduper` (see ./dedupe.ts) so replays
 * after a reconnect are idempotent. Returns an unsubscribe handle. This layer
 * never owns business logic (REPOSITORY_STRUCTURE.md §34).
 */
export function subscribe(
  channelName: string,
  handler: RealtimeEventHandler,
): () => Promise<void> {
  const channel = getRealtimeClient().channel(channelName);
  channel.onMessage(handler).subscribe();
  return async () => {
    await channel.unsubscribe();
  };
}

/** Broadcast helper; the backend remains the single source of truth (§34). */
export function broadcast(_channelName: string, _event: RealtimeEvent): void {
  throw new Error("not implemented (Phase 0)");
}
