/**
 * @tepisawah/web — router composition.
 *
 * Guards stay UX-only — security lives in the backend + RLS; the full route
 * table is composed as feature phases land.
 */
import type { ReactNode } from "react";
import { HomePage } from "../../pages/HomePage.js";

/**
 * Single public route for now: the marketing homepage. Its own header/footer
 * chrome replaces the generic app shell. Route composition lands with the
 * feature phases.
 */
export function AppRouter(): ReactNode {
  return <HomePage />;
}
