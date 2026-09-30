/**
 * Pagination types shared by list API contracts.
 */
import type { NumericId } from "./common.js";

/** Cursor used for keyset pagination (stable ordering by id). */
export interface Cursor {
  /** Row id immediately after the cursor position. */
  afterId?: NumericId;
  /** Number of rows requested in a page. */
  limit: number;
}

/** Envelope returned by paginated list endpoints. */
export interface PaginatedResult<T> {
  rows: T[];
  /** Cursor to fetch the next page, or undefined when at the end. */
  nextCursor?: Cursor;
  /** Total row count, when the backend chose to compute it. */
  total?: number;
}
