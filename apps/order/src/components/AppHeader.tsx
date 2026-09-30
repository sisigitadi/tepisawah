/**
 * @tepisawah/order — application header.
 *
 * Reusable chrome shared across pages; cross-app primitives belong in
 * @tepisawah/ui.
 */
import type { ReactNode } from "react";
import { DOMAINS, type AppName } from "@tepisawah/config";

export function AppHeader(): ReactNode {
  const name: AppName = "order";
  return (
    <header>
      <a href={DOMAINS[name]}>
        <strong>Tepi Sawah — Customer Ordering</strong>
      </a>
    </header>
  );
}
