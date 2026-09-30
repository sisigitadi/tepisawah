/**
 * @tepisawah/waiter — home page.
 *
 * Page components orchestrate features; they hold no SQL, authz or business
 * rules.
 */
import type { ReactNode } from "react";
import { pkg } from "../data/pkg.js";

export function HomePage(): ReactNode {
  return (
    <section>
      <h1>Tepi Sawah — Waiter App</h1>
      <p>Waiter handheld: tables, ready orders, service requests, manual order entry.</p>
      <p>
        <small>
          {pkg.name}@{pkg.version}
        </small>
      </p>
    </section>
  );
}
