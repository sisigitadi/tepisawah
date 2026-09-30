/**
 * scripts/verify-build.mjs — build & boundary verification (Phase 1).
 *
 * Run after `pnpm run build`. Verifies that:
 *   - every workspace package and app produced `dist/`;
 *   - the Supabase client boundary artifacts exist on disk.
 *
 * Reports rather than crashes when the build has not run yet; exits 1 if any
 * expected output is missing.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { exit } from "node:process";

const ROOT = new URL("../", import.meta.url);

let missing = 0;

function check(label, path) {
  if (existsSync(path)) {
    console.log(`verify-build: OK   ${label}`);
  } else {
    console.log(`verify-build: MISS ${label}`);
    missing += 1;
  }
}

// Build outputs.
for (const group of ["packages", "apps"]) {
  const dir = new URL(`${group}/`, ROOT);
  for (const name of readdirSync(dir).sort()) {
    if (statSync(new URL(name, dir)).isDirectory()) check(`${group}/${name}/dist`, new URL(`${name}/dist`, dir));
  }
}

// Client-boundary artifacts (must exist regardless of build).
check("packages/database/src/client.ts", new URL("packages/database/src/client.ts", ROOT));
check("packages/config/src/env.ts", new URL("packages/config/src/env.ts", ROOT));
check("supabase/functions/_shared/supabase.ts", new URL("supabase/functions/_shared/supabase.ts", ROOT));

if (missing) {
  console.error(`verify-build: ${missing} expected output(s) missing`);
  exit(1);
}
console.log("verify-build: all workspace builds and boundary artifacts present");
