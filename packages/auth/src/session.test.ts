/**
 * Session helper tests (Layer 2 — docs/qa/TESTING_STRATEGY.md).
 *
 * Covers the required auth flows against a fake Supabase auth surface: login
 * success, invalid login, session refresh and logout. No production database
 * is involved.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { AUTH_MESSAGES } from "./errors.js";
import {
  getCurrentSession,
  refreshCurrentSession,
  signInWithEmail,
  signOutCurrent,
} from "./session.js";
import { setAuthClient } from "./client.js";
import { FakeAuth } from "./__tests__/fake-auth.js";

const EMAIL = "siti@tepisawah.id";
const PASSWORD = "correct-horse-battery-staple";

describe("session helpers", () => {
  let auth: FakeAuth;

  beforeEach(() => {
    auth = new FakeAuth();
    setAuthClient(auth);
  });

  describe("login", () => {
    it("succeeds and resolves the user", async () => {
      const result = await signInWithEmail(EMAIL, PASSWORD);

      expect(result.error).toBeNull();
      expect(result.user?.email).toBe(EMAIL);
      expect(auth.currentUser?.email).toBe(EMAIL);
      expect(auth.signedOut).toBe(false);
    });

    it("does not store the password anywhere", async () => {
      await signInWithEmail(EMAIL, PASSWORD);
      expect(JSON.stringify(auth)).not.toContain(PASSWORD);
    });

    it("fails safely on invalid credentials without throwing", async () => {
      auth.signInError = { message: "Invalid login credentials", code: undefined };

      const result = await signInWithEmail(EMAIL, "wrong-password");

      expect(result.user).toBeNull();
      expect(result.error?.message).toBe(AUTH_MESSAGES.invalidCredentials);
      expect(auth.currentUser).toBeNull();
    });

    it("maps an unconfirmed email to the public message", async () => {
      auth.signInError = { message: "Email not confirmed", code: undefined };

      const result = await signInWithEmail(EMAIL, PASSWORD);

      expect(result.user).toBeNull();
      expect(result.error?.message).toBe(AUTH_MESSAGES.emailNotConfirmed);
    });

    it("reports the current session without a user when signed out", async () => {
      // supabase-js throws AuthSessionMissingError locally when there is no
      // session; that is the normal anonymous state, not an error, so the
      // login screen must stay clean (no spurious "Terjadi kesalahan").
      auth.sessionError = { message: "Auth session missing!", code: undefined };

      const result = await getCurrentSession();
      expect(result.user).toBeNull();
      expect(result.error).toBeNull();
    });

    it("maps a real session error to a safe public message", async () => {
      auth.sessionError = { message: "network request failed", code: undefined };

      const result = await getCurrentSession();
      expect(result.user).toBeNull();
      expect(result.error?.message).toBe(AUTH_MESSAGES.network);
    });
  });

  describe("session refresh", () => {
    it("returns the user after token rotation", async () => {
      await signInWithEmail(EMAIL, PASSWORD);

      const result = await refreshCurrentSession();

      expect(auth.refreshCalls).toBe(1);
      expect(result.error).toBeNull();
      expect(result.user?.email).toBe(EMAIL);
    });

    it("maps a failed refresh to a safe message without throwing", async () => {
      auth.refreshError = { message: "JWT expired", code: undefined };

      const result = await refreshCurrentSession();

      expect(auth.refreshCalls).toBe(1);
      expect(result.user).toBeNull();
      expect(result.error?.message).toBe(AUTH_MESSAGES.sessionExpired);
    });
  });

  describe("logout", () => {
    it("clears the session", async () => {
      await signInWithEmail(EMAIL, PASSWORD);
      expect(auth.currentUser).not.toBeNull();

      const result = await signOutCurrent();

      expect(result.error).toBeNull();
      expect(auth.signedOut).toBe(true);
      expect(auth.currentUser).toBeNull();
    });

    it("surfaces a safe message when sign out fails", async () => {
      auth.signOutError = { message: "network request failed", code: undefined };

      const result = await signOutCurrent();

      expect(result.error).toBe(AUTH_MESSAGES.network);
      expect(auth.signedOut).toBe(false);
    });
  });
});
