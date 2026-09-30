# @tepisawah/realtime

> **Status: Phase 0 scaffold.** Realtime channel names, event types, dedup, and versioning helpers only — no business logic.

Realtime integration layer for Supabase Realtime: canonical channel names, typed
event payloads, idempotent event handling, and optimistic-concurrency versioning for
collaborative edits (POS ↔ kitchen display sync).

## Exports

| Module         | Contents                                                      |
| -------------- | ------------------------------------------------------------- |
| `channels.ts`  | `REALTIME_CHANNELS`, `isChannelName`, and per-domain channel builders (`orderChannel`, `kitchenChannel`, `paymentsChannel`, `serviceChannel`) |
| `events.ts`    | `REALTIME_EVENTS`, `RealtimeEvent`, `RealtimeEventHandler`, type guards (`isRealtimeEvent`, `isRealtimeEventValue`) |
| `client.ts`    | `SupabaseRealtime`, `setRealtimeClient` / `getRealtimeClient` / `hasRealtimeClient`, `broadcast`, `subscribe`, `PresenceState` |
| `dedupe.ts`    | `EventDeduper`, `DedupeOptions` — idempotent event processing  |
| `versioning.ts`| `INITIAL_VERSION`, `versionOf`, `hasVersion`, `nextVersion`, `mergeVersion`, `compareVersions`, `isStaleEdit` |

## Usage

```ts
import { orderChannel, subscribe, EventDeduper } from "@tepisawah/realtime";
```

## Conventions

- Channel names are built here and only here; apps and functions must not
  hand-write channel strings.
- Every event carries a monotonic version so stale edits are detected, not applied.
- The deduper is opt-in: subscribers wrap handlers when they need exactly-once
  semantics over an at-least-once transport.
- Only workspace dependency: `@tepisawah/types`.

## Build

```bash
pnpm --filter @tepisawah/realtime typecheck
```
