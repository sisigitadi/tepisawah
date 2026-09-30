/**
 * @tepisawah/pos — home page.
 *
 * Page components orchestrate features; they hold no SQL, authz or business
 * rules.
 */
import type { ReactNode } from "react";
import { pkg } from "../data/pkg.js";

export function HomePage(): ReactNode {
  return (
    <section>
      <h1>Tepi Sawah — Point of Sale</h1>
      <p>Staff point of sale: orders, payments, tables, shifts, dashboard.</p>
      <p>
        <small>
          {pkg.name}@{pkg.version}
        </small>
      </p>
    </section>
  );
}
