/**
 * Catalog validation schemas.
 *
 * A validation library is intentionally not added; schemas are declared as
 * plain predicates so no extra dependency is introduced (PROJECT_RULES: avoid
 * unnecessary dependencies). The authoritative checks live in the database
 * CHECK constraints and in `@tepisawah/database` model validation, which runs
 * before any write (AUTH_RBAC_RLS.md §47).
 *
 * These predicates guard the read path: they let an app reject a malformed
 * projection row instead of rendering a half-shaped menu item.
 */
import type { MenuModifier, MenuItem } from "./types.js";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** A modifier group is usable only when its name and bounds survive. */
export function isValidMenuModifier(value: unknown): value is MenuModifier {
  if (!isObject(value)) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry["modifierId"] === "string" &&
    typeof entry["name"] === "string" &&
    isNumber(entry["priceDelta"]) &&
    typeof entry["isRequired"] === "boolean" &&
    isNumber(entry["minSelect"]) &&
    isNumber(entry["maxSelect"]) &&
    isNumber(entry["sortOrder"])
  );
}

/** A menu item needs its ids, name and a finite price (§7.2). */
export function isValidMenuItem(item: unknown): item is MenuItem {
  if (!isObject(item)) return false;
  const entry = item as Record<string, unknown>;
  return (
    typeof entry["id"] === "string" &&
    typeof entry["categoryId"] === "string" &&
    typeof entry["name"] === "string" &&
    isNumber(entry["price"]) &&
    typeof entry["isAvailable"] === "boolean" &&
    Array.isArray(entry["modifiers"]) &&
    (entry["modifiers"] as unknown[]).every(isValidMenuModifier)
  );
}
