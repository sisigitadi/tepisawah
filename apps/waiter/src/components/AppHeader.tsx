/**
 * @tepisawah/waiter — application header.
 *
 * Reusable chrome shared across pages; cross-app primitives belong in
 * @tepisawah/ui.
 */
import type { ReactNode } from "react";
import { DOMAINS, type AppName } from "@tepisawah/config";

export function AppHeader(): ReactNode {
  const name: AppName = "waiter";
  return (
    <header>
      <a href={DOMAINS[name]}>
        <strong>Tepi Sawah — Layanan Meja & Antar</strong>
      </a>
    </header>
  );
}
