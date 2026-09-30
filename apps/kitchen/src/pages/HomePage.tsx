/**
 * @tepisawah/kitchen — home page.
 *
 * Page components orchestrate features; they hold no SQL, authz or business
 * rules.
 */
import type { ReactNode } from "react";
import { pkg } from "../data/pkg.js";

export function HomePage(): ReactNode {
  return (
    <section>
      <h1>Tepi Sawah — Kitchen Display System</h1>
      <p>Kitchen display: live order queue, timers, recall, connection status.</p>
      <p>
        <small>
          {pkg.name}@{pkg.version}
        </small>
      </p>
    </section>
  );
}
