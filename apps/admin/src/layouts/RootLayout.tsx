/**
 * @tepisawah/admin — root layout.
 *
 * Chrome + outlet wrapper; page composition only.
 */
import type { ReactNode } from "react";
import { AppHeader } from "../components/AppHeader.js";

export interface RootLayoutProps {
  children?: ReactNode;
  nav?: ReactNode;
}

export function RootLayout({ children, nav }: RootLayoutProps): ReactNode {
  return (
    <div className="app-shell">
      <AppHeader nav={nav} />
      <main className="app-main">{children}</main>
    </div>
  );
}
