/**
 * Common cross-cutting types shared across packages.
 *
 * This module is a leaf dependency: it must not import from any other
 * @tepisawah package other than sibling files in this package.
 * (REPOSITORY_STRUCTURE.md §33)
 */

/** ISO-8601 timestamp string, e.g. "2025-01-01T00:00:00Z". */
export type ISODateString = string;

/** Database row identifier (uuid). */
export type ID = string;

/** Branded numeric id used by lookup tables. */
export type NumericId = number;

/** Discriminated error result used by API contract helpers. */
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };
