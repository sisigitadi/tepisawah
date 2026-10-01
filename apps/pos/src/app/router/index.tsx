/**
 * @tepisawah/pos — router composition.
 *
 * Guards stay UX-only — security lives in the backend + RLS. The terminal
 * reads `orders` through `orders_staff_read` (authenticated + active +
 * `orders.read`), confirms/rejects through `transition_order()` re-checking
 * `orders.confirm` / `orders.reject`, and settles through the same command
 * re-checking `payments.create`; this composition is navigation, not
 * authorization (AUTH_RBAC_RLS.md §2.2).
 *
 * Route selection is search-param based (no router library yet — the same
 * pattern the waiter app uses for manual order entry):
 * - `?confirm` → cashier confirmation queue
 * - otherwise  → payment terminal
 */
import type { ReactNode } from "react";

import { PERMISSIONS } from "@tepisawah/permissions";

import { ConfirmQueuePage } from "../../features/orders/index.js";
import { RootLayout } from "../../layouts/RootLayout.js";
import { HomePage } from "../../pages/HomePage.js";
import { PermissionRoute, ProtectedRoute } from "../../routes/index.js";

function isConfirmRoute(): boolean {
  return new URLSearchParams(window.location.search).has("confirm");
}

export function AppRouter(): ReactNode {
  return (
    <RootLayout>
      {isConfirmRoute() ? (
        <ProtectedRoute>
          <PermissionRoute permission={PERMISSIONS.ORDERS_READ}>
            <ConfirmQueuePage />
          </PermissionRoute>
        </ProtectedRoute>
      ) : (
        <ProtectedRoute>
          <PermissionRoute permission={PERMISSIONS.ORDERS_READ}>
            <HomePage />
          </PermissionRoute>
        </ProtectedRoute>
      )}
    </RootLayout>
  );
}
