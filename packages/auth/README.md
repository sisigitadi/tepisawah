# @tepisawah/auth

> **Status: Phase 0 scaffold.** Auth client wiring, session handling, and React providers/guards only — no credentials, no role enforcement logic.

Authentication integration layer for Supabase Auth. Apps inject the Supabase client;
this package wraps email/password sign-in, session tracking, and role/permission
guards for the router.

## Exports

| Module            | Contents                                                     |
| ----------------- | ------------------------------------------------------------ |
| `client.ts`       | `setAuthClient` / `getAuthClient` / `hasAuthClient` injection |
| `session.ts`      | `getCurrentSession`, `signInWithEmail`, `signOutCurrent`, `onAuthState`, `toAuthUser`, `SessionResult` |
| `auth-context.tsx`| `AuthProvider` and `useAuth` hook                             |
| `guards.ts`       | `isAuthenticated`, `userHasPermission`, `userHasAnyPermission`, `getRole`, `isRole` |

## Usage

```tsx
import { AuthProvider, useAuth } from "@tepisawah/auth";
import { PERMISSIONS } from "@tepisawah/permissions";

const { user } = useAuth();
const isAdmin = userHasPermission(user, PERMISSIONS.ADMIN_ACCESS);
```

## Conventions

- **No `@supabase/supabase-js` dependency here** — the client is injected by the app
  via `setAuthClient`, keeping the package testable and dependency-light.
- The app role claim is read from the JWT via `ROLE_CLAIM`; the permission matrix
  itself lives in `@tepisawah/permissions`.
- This package never stores credentials or tokens itself.

## Build

```bash
pnpm --filter @tepisawah/auth typecheck
```
