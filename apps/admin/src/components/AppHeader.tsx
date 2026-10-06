/**
 * @tepisawah/admin — application header.
 *
 * Reusable chrome shared across pages; cross-app primitives belong in
 * @tepisawah/ui.
 */
import type { ReactNode } from "react";
import { DOMAINS, type AppName } from "@tepisawah/config";

export interface AppHeaderProps {
  /** Optional in-app navigation. Rendered after the brand link. */
  nav?: ReactNode;
}

export function AppHeader({ nav }: AppHeaderProps): ReactNode {
  const name: AppName = "admin";
  return (
    <header className="app-header">
      <a href={DOMAINS[name]} className="app-header__brand">
        <img src="/logo.png" alt="Tepi Sawah" className="app-header__logo" />
        <strong>Tepi Sawah — Admin Console</strong>
      </a>
      {nav ? <nav className="app-nav">{nav}</nav> : null}
    </header>
  );
}
