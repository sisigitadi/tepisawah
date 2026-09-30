/**
 * @tepisawah/web — home page.
 *
 * Page components orchestrate features; they hold no SQL, authz or business
 * rules.
 */
import type { ReactNode } from "react";
import { pkg } from "../data/pkg.js";

export function HomePage(): ReactNode {
  return (
    <section>
      <h1>Tepi Sawah — Public Website</h1>
      <p>Public marketing and information site for Tepi Sawah Resto & Cafe.</p>
      <p>
        <small>
          {pkg.name}@{pkg.version}
        </small>
      </p>
    </section>
  );
}
