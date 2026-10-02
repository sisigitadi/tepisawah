/**
 * @tepisawah/staff — router composition.
 *
 * The portal is a single screen: the protected launcher. Guards stay UX-only —
 * security lives in the backend + RLS (docs/security/AUTH_RBAC_RLS.md §2.2);
 * each linked app re-runs its own `ProtectedRoute` + `PermissionRoute` on
 * arrival, so the portal never grants access it cannot back.
 */
import type { ReactNode } from "react";

import { RootLayout } from "../../layouts/RootLayout.js";
import { PortalPage } from "../../pages/PortalPage.js";
import { ProtectedRoute } from "../../routes/index.js";

export function AppRouter(): ReactNode {
  return (
    <RootLayout>
      <ProtectedRoute>
        <PortalPage />
      </ProtectedRoute>
    </RootLayout>
  );
}
