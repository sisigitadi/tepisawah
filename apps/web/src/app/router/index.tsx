/**
 * @tepisawah/web — router composition.
 *
 * Guards stay UX-only — security lives in the backend + RLS; the full route
 * table is composed as feature phases land.
 */
import type { ReactNode } from "react";

import { env } from "../../lib/env.js";
import { DemoPage } from "../../pages/DemoPage.js";
import { HomePage } from "../../pages/HomePage.js";

/**
 * Public routes. The homepage owns its own header/footer chrome; route
 * composition lands with the feature phases.
 *
 * `/demo` is the presentation hub — every staff app plus the generic demo
 * accounts behind one URL. It only renders on demo deployments
 * (`VITE_DEMO_MODE=true`); any other build serves the homepage there too, so
 * the hub and its credential table never ship to production from the same
 * code path (ENVIRONMENT_CONFIG.md §37).
 */
export function AppRouter(): ReactNode {
  if (env.demoMode && window.location.pathname === "/demo") {
    return <DemoPage />;
  }
  return <HomePage />;
}
