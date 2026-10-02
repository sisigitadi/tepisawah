/**
 * scripts/env-file.mjs — shared reader for gitignored local env override files.
 *
 * The staging scripts all read the same flat KEY=VALUE file (`.env.staging.local`)
 * under the same rules: comments and blank lines are skipped, surrounding quotes
 * are stripped, and a variable already present in the process environment always
 * wins over the file. That parser was copy-pasted verbatim across scripts, so a
 * fix to one would silently drift from the others; this is the one copy.
 *
 * Precedence is the reason this exists rather than reaching for dotenv: the
 * scripts must let an exported variable override the file — CI supplies the same
 * `STAGING_*` names as step env and has no file at all (`.github/workflows/ci.yml`)
 * — while a workstation keeps its credentials in the gitignored file. Merging is
 * therefore additive only, never clobbering.
 *
 * Usage:
 *   import { loadEnvFile, parseEnvFile } from "./env-file.mjs";
 *
 *   loadEnvFile(".env.staging.local");          // merge into process.env
 *   const parsed = parseEnvFile(".env.local");   // or take the entries yourself
 */
import { readFileSync } from "node:fs";
import { env } from "node:process";

/**
 * Parse a flat KEY=VALUE file into a Map. Tolerates comments, blank lines, CRLF
 * and a single pair of surrounding quotes. A missing or unreadable file yields an
 * empty Map — reading an override that does not exist is normal, not an error.
 */
export function parseEnvFile(file) {
  const entries = new Map();
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return entries;
  }
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const equals = line.indexOf("=");
    if (equals < 1) continue;
    const key = line.slice(0, equals).trim();
    let value = line.slice(equals + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) entries.set(key, value);
  }
  return entries;
}

/**
 * Merge a parsed file into the process environment. Values already present are
 * never overwritten, so an exported variable takes precedence over the file.
 */
export function loadEnvFile(file) {
  for (const [key, value] of parseEnvFile(file)) {
    if (!(key in env)) env[key] = value;
  }
  return env;
}
