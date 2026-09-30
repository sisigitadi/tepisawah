# @tepisawah/permissions

> **Status: Phase 0 scaffold.** Role/permission matrix and pure guard predicates only — no authorization enforcement side effects.

Defines the restaurant's role model and the permission matrix used by POS, waiter,
kitchen, and admin apps. Guards are pure functions over a role + permission pair so
they can be reused by UI route guards and by Supabase edge functions alike.

## Exports

| Module          | Contents                                                       |
| --------------- | -------------------------------------------------------------- |
| `roles.ts`      | `Role`, `ROLES`, and the role hierarchy                         |
| `permissions.ts`| `Permission`, `PERMISSIONS`, and the role → permission matrix   |
| `guards.ts`     | `hasPermission`, `hasAnyPermission`, and type-guard predicates  |

## Usage

```ts
import { ROLES, PERMISSIONS, hasPermission } from "@tepisawah/permissions";

const canRefund = hasPermission(currentUserRole, PERMISSIONS.REFUND_PAYMENT);
```

## Conventions

- The matrix is the single source of truth; apps must not hard-code their own lists.
- Guards never perform network calls or read local storage.
- Server-side enforcement mirrors this matrix in Supabase functions (Phase 1+).

## Build

```bash
pnpm --filter @tepisawah/permissions typecheck
```
