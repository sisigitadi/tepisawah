# @tepisawah/orders

> **Status: Phase 0 scaffold.** Order domain types, state machine, and schemas only — no business logic.

The orders domain: carts, order headers and items, and the order state machine that
governs transitions from `pending` through `preparing`, `ready`, `served`, and
`completed` or `cancelled`.

## Exports

| Module          | Contents                                                       |
| --------------- | -------------------------------------------------------------- |
| `types.ts`      | `Order`, `OrderItem`, `Cart`, `CartLine`, …                     |
| `states.ts`     | `OrderState` union and allowed-transition map                   |
| `transitions.ts`| Pure transition helpers and conflict detection                 |
| `schemas.ts`    | Validation schemas for order command payloads                  |
| `api.ts`        | Order command/query contract types                             |

## Usage

```ts
import { ORDER_STATES, canTransition } from "@tepisawah/orders";
```

## Conventions

- The state machine is the single owner of transition legality (REPOSITORY_STRUCTURE
  §34); UI mirrors it, never re-implements it.
- Submitting an order is a backend command (`supabase/functions/orders-submit`);
  this package defines the contract, not the execution.
- Optimistic-concurrency versioning types come from `@tepisawah/realtime`.

## Build

```bash
pnpm --filter @tepisawah/orders typecheck
```
