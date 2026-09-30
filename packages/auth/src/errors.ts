/**
 * Auth error mapping (Phase 2).
 *
 * Supabase error messages are internal detail; end users must receive a safe,
 * generic public message instead (ENVIRONMENT_CONFIG.md §24). The original
 * message is logged by the caller, never displayed.
 */
import type { AuthError } from "./client.js";

/** User-facing auth messages; never contain internal detail. */
export const AUTH_MESSAGES = {
  invalidCredentials: "Email atau kata sandi salah.",
  emailNotConfirmed: "Email belum dikonfirmasi. Periksa kotak masuk Anda.",
  userDisabled: "Akun ini dinonaktifkan. Hubungi administrator.",
  notAuthorized: "Akun ini tidak memiliki peran staf yang aktif.",
  rateLimited: "Terlalu banyak percobaan. Coba lagi nanti.",
  network: "Tidak dapat terhubung. Periksa koneksi jaringan Anda.",
  signOutFailed: "Gagal keluar. Coba lagi.",
  sessionExpired: "Sesi berakhir. Silakan masuk kembali.",
  unknown: "Terjadi kesalahan. Silakan coba lagi.",
} as const;

const KNOWN: ReadonlyArray<{ test: RegExp; message: string }> = [
  { test: /invalid login credentials/i, message: AUTH_MESSAGES.invalidCredentials },
  { test: /email not confirmed/i, message: AUTH_MESSAGES.emailNotConfirmed },
  { test: /user .*disabled|disabled.*user/i, message: AUTH_MESSAGES.userDisabled },
  { test: /rate limit|too many requests/i, message: AUTH_MESSAGES.rateLimited },
  { test: /network|fetch failed|failed to fetch/i, message: AUTH_MESSAGES.network },
  { test: /session.*expired|jwt expired/i, message: AUTH_MESSAGES.sessionExpired },
];

/** Map a raw Supabase auth error to a safe public message. */
export function toAuthMessage(error: AuthError | { message: string } | null | undefined): string {
  if (!error) return AUTH_MESSAGES.unknown;
  const raw = error.message ?? "";
  const hit = KNOWN.find((entry) => entry.test.test(raw));
  return hit ? hit.message : AUTH_MESSAGES.unknown;
}
