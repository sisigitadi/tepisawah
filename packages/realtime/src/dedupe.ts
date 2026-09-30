/**
 * Event deduplication.
 *
 * Supabase Realtime can replay an event after a reconnect or emit it through
 * both broadcast and database replication. Consumers must be idempotent, so
 * this module tracks seen event ids and monotonic versions per stream.
 */
import type { RealtimeEvent } from "./events.js";

export interface DedupeOptions {
  /** Maximum number of seen ids retained per stream. */
  capacity?: number;
}

/** Bounded in-memory dedupe ledger keyed by stream (tenant or channel). */
export class EventDeduper {
  private readonly seen = new Map<string, Set<string>>();
  private readonly versions = new Map<string, number>();
  private readonly capacity: number;

  constructor(options: DedupeOptions = {}) {
    this.capacity = options.capacity ?? 512;
  }

  /**
   * Accept an event once; reject duplicates and out-of-order replays.
   *
   * Returns `true` when the caller should process the event.
   */
  accept(event: RealtimeEvent): boolean {
    if (this.isDuplicate(event)) return false;
    this.markSeen(event);
    return true;
  }

  /** True when the event was already seen or is stale. */
  isDuplicate(event: RealtimeEvent): boolean {
    const stream = streamKey(event);
    const seen = this.seen.get(stream);
    if (seen !== undefined && seen.has(event.id)) return true;
    const last = this.versions.get(stream);
    if (last !== undefined && event.version <= last) return true;
    return false;
  }

  /** Record an accepted event in the ledger. */
  markSeen(event: RealtimeEvent): void {
    const stream = streamKey(event);
    let seen = this.seen.get(stream);
    if (seen === undefined) {
      seen = new Set<string>();
      this.seen.set(stream, seen);
    }
    seen.add(event.id);
    this.versions.set(stream, event.version);
    if (seen.size > this.capacity) {
      seen.clear();
    }
  }

  /** Drop all bookkeeping (used on logout / tenant switch). */
  clear(): void {
    this.seen.clear();
    this.versions.clear();
  }
}

/** Stable ledger key for an event's stream. */
function streamKey(event: RealtimeEvent): string {
  return `${event.tenantId}:${event.type}`;
}
