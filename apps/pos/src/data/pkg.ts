/**
 * @tepisawah/pos — package metadata.
 *
 * Phase 0 scaffold: structure and tooling only.
 * Imported from package.json so the app version stays single-sourced.
 */

import pkgJson from "../../package.json" with { type: "json" };

export const pkg = {
  name: pkgJson.name,
  version: pkgJson.version,
} as const;
