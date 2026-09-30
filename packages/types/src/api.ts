/**
 * Shared API envelope types used by package API contracts.
 *
 * Business logic is owned by the backend command layer; these types only
 * describe the shape of request/response payloads (REPOSITORY_STRUCTURE.md §34).
 */
import type { Result } from "./common.js";

export interface ApiSuccess<T> {
  data: T;
}

export interface ApiError {
  /** Machine-readable error code, e.g. "orders.invalid_transition". */
  code: string;
  /** Human-readable message safe to surface in the UI. */
  message: string;
}

export type ApiResponse<T> = Result<ApiSuccess<T>, ApiError>;
