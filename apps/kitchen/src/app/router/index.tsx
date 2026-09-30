/**
 * @tepisawah/kitchen — router composition.
 *
 * Guards stay UX-only — security lives in the backend + RLS. The KDS reads
 * `orders` through `orders_staff_read` (authenticated + active +
 * `orders.read`) and moves statuses through `transition_order()`, which
 * re-checks `kitchen.start` / `kitchen.ready` server-side; this composition
 * is navigation, not authorization (AUTH_RBAC_RLS.md §2.2).
 */
import type { ReactNode } from "react";

import { PERMISSIONS } from "@tepisawah/permissions";

import { RootLayout } from "../../layouts/RootLayout.js";
import { HomePage } from "../../pages/HomePage.js";
import { PermissionRoute, ProtectedRoute } from "../../routes/index.js";

export function AppRouter(): ReactNode {
  return (
    <RootLayout>
      <ProtectedRoute>
        <PermissionRoute permission={PERMISSIONS.ORDERS_READ}>
          <HomePage />
        </PermissionRoute>
      </ProtectedRoute>
    </RootLayout>
  );
}
