/**
 * @tepisawah/waiter — router composition.
 *
 * Guards stay UX-only — security lives in the backend + RLS; the full route
 * table is composed as feature phases land.
 *
 * Route selection is search-param based (no router library yet):
 * - `?order` → manual order entry (`orders.create_manual`)
 * - otherwise → handheld console; its live "Siap Saji" board reads `orders`
 *   through `orders_staff_read` and serves through `transition_order()`
 *   re-checking `orders.serve`, so the guard here is navigation
 *   (AUTH_RBAC_RLS.md §2.2).
 */
import type { ReactNode } from "react";

import { PERMISSIONS } from "@tepisawah/permissions";

import { ManualOrderPage } from "../../features/manual-order/index.js";
import { RootLayout } from "../../layouts/RootLayout.js";
import { HomePage } from "../../pages/HomePage.js";
import { PermissionRoute, ProtectedRoute } from "../../routes/index.js";

function isManualOrderRoute(): boolean {
  return new URLSearchParams(window.location.search).has("order");
}

export function AppRouter(): ReactNode {
  return (
    <RootLayout>
      {isManualOrderRoute() ? (
        // Staff-only: auth + `orders.create_manual`. Both are re-checked inside
        // `create_draft_order()`, so this is navigation, not authorization.
        <ProtectedRoute>
          <PermissionRoute permission={PERMISSIONS.ORDERS_CREATE_MANUAL}>
            <ManualOrderPage />
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
