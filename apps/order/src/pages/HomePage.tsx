/**
 * @tepisawah/order — home page.
 *
 * Page components orchestrate features; they hold no SQL, authz or business
 * rules.
 */
import type { ReactNode } from "react";
import { pkg } from "../data/pkg.js";

export function HomePage(): ReactNode {
  return (
    <section>
      <h1>Tepi Sawah — Customer Ordering</h1>
      <p>QR-table customer ordering experience: catalog, cart, checkout, order status.</p>
      <p>
        <small>
          {pkg.name}@{pkg.version}
        </small>
      </p>
    </section>
  );
}
