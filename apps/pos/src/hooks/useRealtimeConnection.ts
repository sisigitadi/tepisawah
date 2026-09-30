/**
 * @tepisawah/pos — realtime connection hook.
 *
 * Phase 0 scaffold: structure and tooling only.
 */

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export interface RealtimeConnection {
  status: ConnectionStatus;
  connect(): void;
  disconnect(): void;
}

/**
 * Phase 0 stub: returns a disconnected placeholder. Phase 1 wires this to the
 * Supabase realtime channel via @tepisawah/realtime.
 */
export function useRealtimeConnection(): RealtimeConnection {
  return {
    status: "disconnected",
    connect() {
      // not implemented (Phase 0)
    },
    disconnect() {
      // not implemented (Phase 0)
    },
  };
}
