/**
 * @tepisawah/waiter — router composition.
 *
 * Guards stay UX-only — security lives in the backend + RLS; the full route
 * table is composed as feature phases land.
 */
import type { ReactNode } from "react";

import { PERMISSIONS } from "@tepisawah/permissions";

import { ManualOrderPage } from "../../features/manual-order/index.js";
import { RootLayout } from "../../layouts/RootLayout.js";
import { HomePage } from "../../pages/HomePage.js";
import { PermissionRoute, ProtectedRoute } from "../../routes/index.js";

/** Manual order entry opens with the `?order` search param (no router lib yet). */
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
        <HomePage />
      )}
    </RootLayout>
  );
}
