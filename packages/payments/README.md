# @tepisawah/payments

> **Status: Phase 0 scaffold.** Payment domain types, methods, and statuses only — no gateway integration, no secrets.

The payments domain: payment methods (cash, card, QRIS), payment statuses, and the
contract types for payment creation and webhook handling.

## Exports

| Module       | Contents                                                       |
| ------------ | -------------------------------------------------------------- |
| `types.ts`   | `Payment`, `PaymentMethod`, `PaymentIntent`, …                  |
| `methods.ts` | `PAYMENT_METHODS` registry and method metadata                  |
| `statuses.ts`| `PaymentStatus` union and allowed status transitions            |
| `api.ts`     | Payment command contract types (create, QRIS webhook)           |

## Usage

```ts
import { PAYMENT_METHODS, type PaymentStatus } from "@tepisawah/payments";
```

## Conventions

- **No gateway credentials, keys, or secrets anywhere in this package.**
- Gateway calls happen only inside Supabase functions
  (`payments-create`, `payments-qris-webhook`); this package defines contracts.
- Webhook payload verification types live here; verification logic does not.

## Build

```bash
pnpm --filter @tepisawah/payments typecheck
```
