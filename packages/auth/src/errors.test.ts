/**
 * Auth error mapping tests (Layer 2 — docs/qa/TESTING_STRATEGY.md).
 *
 * Supabase error strings are internal detail; users must only ever see the
 * safe Indonesian public messages (ENVIRONMENT_CONFIG.md §24). These tests
 * pin the mapping so a backend wording change cannot leak internals.
 */
import { describe, expect, it } from "vitest";

import { AUTH_MESSAGES, toAuthMessage } from "./errors.js";

describe("toAuthMessage", () => {
  it("maps invalid login credentials", () => {
    expect(toAuthMessage({ message: "Invalid login credentials", code: undefined })).toBe(
      AUTH_MESSAGES.invalidCredentials,
    );
  });

  it("maps an unconfirmed email", () => {
    expect(toAuthMessage({ message: "Email not confirmed", code: undefined })).toBe(
      AUTH_MESSAGES.emailNotConfirmed,
    );
  });

  it("maps a disabled user", () => {
    expect(toAuthMessage({ message: "User is disabled", code: undefined })).toBe(
      AUTH_MESSAGES.userDisabled,
    );
  });

  it("maps a rate-limit response", () => {
    expect(toAuthMessage({ message: "Too many requests, rate limit reached", code: undefined })).toBe(
      AUTH_MESSAGES.rateLimited,
    );
  });

  it("maps a network failure", () => {
    expect(toAuthMessage({ message: "fetch failed", code: undefined })).toBe(AUTH_MESSAGES.network);
  });

  it("maps an expired session", () => {
    expect(toAuthMessage({ message: "JWT expired", code: undefined })).toBe(
      AUTH_MESSAGES.sessionExpired,
    );
  });

  it("falls back to the generic message for unknown errors", () => {
    expect(toAuthMessage({ message: "something unexpected happened", code: undefined })).toBe(
      AUTH_MESSAGES.unknown,
    );
  });

  it("falls back to the generic message when there is no error", () => {
    expect(toAuthMessage(null)).toBe(AUTH_MESSAGES.unknown);
    expect(toAuthMessage(undefined)).toBe(AUTH_MESSAGES.unknown);
  });

  it("never echoes the raw backend message", () => {
    const raw = "Database connection refused at 10.0.0.1:5432";
    expect(toAuthMessage({ message: raw, code: undefined })).not.toContain(raw);
  });
});

describe("AUTH_MESSAGES", () => {
  it("are non-empty and free of internal detail", () => {
    for (const message of Object.values(AUTH_MESSAGES)) {
      expect(message.length).toBeGreaterThan(0);
      expect(message).not.toMatch(/postgres|supabase|jwt|database|http|localhost|\d{3}/i);
    }
  });
});
