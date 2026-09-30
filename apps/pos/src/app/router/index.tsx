/**
 * @tepisawah/pos — router composition.
 *
 * Guards stay UX-only — security lives in the backend + RLS; the full route
 * table is composed as feature phases land.
 */
import type { ReactNode } from "react";
import { RootLayout } from "../../layouts/RootLayout.js";
import { HomePage } from "../../pages/HomePage.js";

export function AppRouter(): ReactNode {
  return (
    <RootLayout>
      <HomePage />
    </RootLayout>
  );
}
