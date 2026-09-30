/**
 * @tepisawah/order — root layout.
 *
 * Chrome + outlet wrapper; page composition only.
 */
import type { ReactNode } from "react";
import { AppHeader } from "../components/AppHeader.js";

export function RootLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <div className="app-shell">
      <AppHeader />
      <main className="app-main">{children}</main>
    </div>
  );
}
