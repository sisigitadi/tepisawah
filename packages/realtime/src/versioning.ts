/**
 * Optimistic-concurrency version helpers.
 *
 * Every mutable record carries a `version` counter. Mutation requests carry
 * the version the client observed; the backend rejects stale writes. This
 * module computes the next version and validates the base version of a change.
 */

/** Initial version assigned to newly created records. */
export const INITIAL_VERSION = 1;

/**
 * Compute the version of a record after a change.
 *
 * Callers pass the version they currently observe; the result is the version
 * the persisted record will hold once the change is applied.
 */
export function nextVersion(current: number): number {
  return Math.max(INITIAL_VERSION, Math.floor(current) + 1);
}

/**
 * Compute a version after merging two concurrent branches of a record.
 *
 * The merged version must dominate both branches so clients holding either
 * observe the result as newer than their own.
 */
export function mergeVersion(a: number, b: number): number {
  return nextVersion(Math.max(a, b));
}

/**
 * Reject a change whose base version is not the current head.
 *
 * Realtime updates race with local edits; a stale base means the client is
 * editing a record that has since moved on.
 */
export function isStaleEdit(current: number, base: number): boolean {
  return base !== current;
}

/** Type guard for objects carrying an optimistic version. */
export function hasVersion(value: unknown): value is { version: number } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { version?: unknown }).version === "number" &&
    Number.isFinite((value as { version: number }).version)
  );
}

/** Read the version of a record, defaulting to the initial version. */
export function versionOf(
  value: { version?: number } | undefined | null,
): number {
  if (hasVersion(value)) return value.version;
  return INITIAL_VERSION;
}

/**
 * Compare two versions.
 *
 * Returns a negative number when `a` is older, zero when equal, and a positive
 * number when `a` is newer.
 */
export function compareVersions(a: number, b: number): number {
  return a - b;
}
