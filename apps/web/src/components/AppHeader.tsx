/**
 * @tepisawah/web — application header.
 *
 * Reusable chrome shared across pages; cross-app primitives belong in
 * @tepisawah/ui.
 */
import type { ReactNode } from "react";
import { DOMAINS, type AppName } from "@tepisawah/config";

export function AppHeader(): ReactNode {
  const name: AppName = "web";
  return (
    <header>
      <a href={DOMAINS[name]}>
        <strong>Tepi Sawah — Public Website</strong>
      </a>
    </header>
  );
}
