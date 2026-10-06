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
  // Jika pengunjung membuka link dari scan QR meja (contoh: tepisawah.id/?table=A1&t=...),
  // alihkan secara langsung dan mulus ke portal order pelanggan
  if (typeof window !== "undefined") {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has("table")) {
      const isLocal =
        window.location.origin.includes("localhost") ||
        window.location.origin.includes("127.0.0.1");
      const orderHost = isLocal
        ? "http://localhost:5174"
        : "https://order.tepisawah.id";
      window.location.replace(`${orderHost}/${window.location.search}`);
      return null;
    }
  }

  if (env.demoMode && window.location.pathname === "/demo") {
    return <DemoPage />;
  }
  return <HomePage />;
}
