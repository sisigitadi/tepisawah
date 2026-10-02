# @tepisawah/staff

Staff portal — the single front door to the internal apps.

One staff login, then a role-based launcher: the app cards each role may open
(cashier → POS, waiter → Waiter, kitchen → Kitchen, supervisor/admin/owner →
POS + Admin). The portal is **navigation only** — every linked app re-runs its
own `ProtectedRoute` + `PermissionRoute` on arrival, and the backend enforces
the real authorization under RLS, so hiding an app here never protects it
([AUTH_RBAC_RLS.md §2.2](../../docs/security/AUTH_RBAC_RLS.md)).

## Structure

```
src/
  app/{App.tsx,bootstrap,providers,router}   composition + auth wiring
  components/AppHeader.tsx                    brand + identity + sign-out
  layouts/RootLayout.tsx                      chrome shell
  lib/{env,supabase}.ts                       env + browser client boundary
  pages/PortalPage.tsx                        role-based launcher
  routes/ProtectedRoute.tsx                   login / access-denied gate
  styles/index.css                            portal styles
```

## Develop

```bash
pnpm install
pnpm --filter @tepisawah/staff dev      # http://localhost:5179
pnpm --filter @tepisawah/staff typecheck
pnpm --filter @tepisawah/staff test
pnpm --filter @tepisawah/staff build
```

The port defaults to `5179`; override it per machine with `STAFF_PORT` in a
gitignored `.env.local` (`apps/web` uses `WEB_PORT` the same way).

## Environment

`src/lib/env.ts` is the only module that reads `import.meta.env`
([ENVIRONMENT_CONFIG.md §16–§17](../../docs/environment/ENVIRONMENT_CONFIG.md)):

| Var                     | Required | Purpose                                     |
| ----------------------- | -------- | ------------------------------------------- |
| `VITE_SUPABASE_URL`     | yes      | Backend URL (anon client, RLS-enforced)     |
| `VITE_SUPABASE_ANON_KEY`| yes      | Publishable key — never a service-role key  |
| `VITE_DEMO_MODE`        | no       | Demo deployments: click-to-fill role cards  |
| `VITE_DEMO_APP_URLS`    | no       | `id=url,id=url` launcher link overrides     |

`VITE_DEMO_APP_URLS` overrides the launcher's local dev ports on a hosted
deployment — the same contract the web app's `/demo` hub uses:

```text
VITE_DEMO_APP_URLS=pos=https://pos.tepisawah.id,admin=https://admin.tepisawah.id
```

## Adding an app to the launcher

Edit `ROLE_APPS` / `APPS` in [src/pages/PortalPage.tsx](src/pages/PortalPage.tsx)
and add the local dev port to `LOCAL_PORTS`. The backend grant that actually
authorizes the app lives in the `role_permissions` seed
([USER_ROLES.md](../../docs/product/USER_ROLES.md)) — keep the two in sync.
