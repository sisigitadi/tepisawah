/**
 * scripts/check-sql-structure.mjs — structural SQL sanity check.
 *
 * Catches the class of bug where a statement's tail was truncated (e.g. a
 * VALUES list whose last row ends with a comma and never receives its ON
 * CONFLICT clause / semicolon). It is NOT a full SQL parser — it splits into
 * statements while respecting `$$…$$` dollar-quotes, `'…'` string literals and
 * `--` line comments, then reports statements with unbalanced parentheses or a
 * trailing comma as the last meaningful token.
 *
 * Usage: node scripts/check-sql-structure.mjs <file.sql>...
 */
import { readFileSync } from "node:fs";

/** Split one SQL file into top-level statements. */
function splitStatements(text) {
  const statements = [];
  let buffer = "";
  let i = 0;
  const n = text.length;

  while (i < n) {
    const char = text[i];
    const rest = text.slice(i);

    // Line comment — skip to end of line, but keep it in the buffer so the
    // caller can see surrounding context.
    if (char === "-" && text[i + 1] === "-") {
      const end = text.indexOf("\n", i);
      const stop = end === -1 ? n : end;
      buffer += text.slice(i, stop);
      i = stop;
      continue;
    }

    // Dollar-quoted block ($$ ... $$ or $tag$ ... $tag$).
    const dollar = rest.match(/^\$[A-Za-z0-9_]*\$/);
    if (dollar) {
      const tag = dollar[0];
      const close = text.indexOf(tag, i + tag.length);
      if (close === -1) {
        // Unterminated dollar-quote: treat the rest as one statement.
        buffer += text.slice(i);
        i = n;
      } else {
        buffer += text.slice(i, close + tag.length);
        i = close + tag.length;
      }
      continue;
    }

    // Single-quoted string literal ('' is an escaped quote).
    if (char === "'") {
      buffer += char;
      i += 1;
      while (i < n) {
        buffer += text[i];
        if (text[i] === "'") {
          if (text[i + 1] === "'") {
            buffer += text[i + 1];
            i += 2;
            continue;
          }
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }

    // Statement terminator.
    if (char === ";") {
      buffer += char;
      statements.push(buffer);
      buffer = "";
      i += 1;
      continue;
    }

    buffer += char;
    i += 1;
  }

  if (buffer.trim()) statements.push(buffer);
  return statements;
}

/** Strip comments and whitespace to get the meaningful tokens of a statement. */
function meaningful(statement) {
  return statement
    .split("\n")
    .map((line) => line.replace(/--.*/, "").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

/** Count parentheses outside of strings/dollar-quotes (approximate, on code only). */
function balancedParens(code) {
  let depth = 0;
  for (const char of code) {
    if (char === "(") depth += 1;
    else if (char === ")") depth -= 1;
    if (depth < 0) return false;
  }
  return depth === 0;
}

let problems = 0;

for (const file of process.argv.slice(2)) {
  const text = readFileSync(file, "utf8");
  const statements = splitStatements(text);
  for (const [index, raw] of statements.entries()) {
    const code = meaningful(raw);
    if (!code) continue;
    const lastLine = code.split("\n").pop();
    const endsWithComma = /,\s*$/.test(lastLine);
    const unbalanced = !balancedParens(code);
    if (endsWithComma || unbalanced) {
      problems += 1;
      const firstLine = code.split("\n")[0].slice(0, 90);
      console.error(
        `${file}: statement #${index + 1} ${endsWithComma ? "ends with a comma" : "unbalanced parens"} :: ${firstLine}`,
      );
    }
  }
  console.log(`${file}: ${statements.length} statements checked`);
}

if (problems) {
  console.error(`\ncheck-sql-structure: ${problems} problem(s) found`);
  process.exit(1);
}
console.log("check-sql-structure: all statements well-formed");
