/**
 * scripts/generate-types.mjs — Supabase generated types (Phase 1).
 *
 * Shells out to the Supabase CLI when it is available and a project is linked,
 * writing `packages/database/src/generated/database.types.ts` and rewiring the
 * barrel to re-export it. When the CLI is absent — e.g. a clean checkout on a
 * machine without Supabase installed — it no-ops safely so CI never depends on
 * a backend being reachable.
 *
 * Generated output is committed and reviewed, never hand-edited
 * (REPOSITORY_STRUCTURE.md §20). No types are invented: without the CLI the
 * placeholder `Database` interface in `generated/index.ts` stays authoritative.
 */
import { existsSync, writeFileSync } from "node:fs";
import { exit } from "node:process";
import { spawnSync } from "node:child_process";

const GENERATED_DIR = new URL("../packages/database/src/generated/", import.meta.url);
const TYPES_FILE = new URL("database.types.ts", GENERATED_DIR);
const INDEX_FILE = new URL("index.ts", GENERATED_DIR);

function hasSupabaseCli() {
  const result = spawnSync("supabase", ["--version"], { stdio: "ignore", shell: true });
  return result.status === 0;
}

if (!hasSupabaseCli()) {
  console.log(
    "generate-types: Supabase CLI not found — keeping placeholder Database interface.\n" +
      "  Install https://supabase.com/docs/guides/cli and run `supabase link` to generate.",
  );
  exit(0);
}

if (!existsSync(new URL("../supabase/.temp/", import.meta.url))) {
  console.log(
    "generate-types: no linked Supabase project — run `supabase link` first.\n" +
      "  Refusing to generate types without a live schema (never invent types).",
  );
  exit(0);
}

const result = spawnSync("supabase", ["gen", "types", "typescript", "--local"], {
  cwd: new URL("../", import.meta.url),
  shell: true,
  encoding: "utf8",
});

if (result.status !== 0 || !result.stdout?.includes("Database")) {
  console.error("generate-types: `supabase gen types` failed; leaving existing types untouched");
  exit(1);
}

writeFileSync(TYPES_FILE, result.stdout);
writeFileSync(
  INDEX_FILE,
  [
    "/**",
    " * Generated Supabase types barrel.",
    " *",
    " * Re-exports the CLI-generated Database interface. Do not hand-edit;",
    " * regenerate with `node scripts/generate-types.mjs`.",
    " */",
    "export * from \"./database.types.js\";",
    "export { default as Database } from \"./database.types.js\";",
    "",
  ].join("\n"),
);

console.log("generate-types: wrote packages/database/src/generated/database.types.ts");
