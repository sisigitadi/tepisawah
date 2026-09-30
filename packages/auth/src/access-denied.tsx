/**
 * @tepisawah/auth — access-denied screen (Phase 2, extended in Phase 3).
 *
 * Shown when authentication succeeded but the account is not authorized to
 * reach the internal application (AUTH_RBAC_RLS.md §15, §41):
 *   - `profiles.is_active` is false (§14)
 *   - the account holds no active staff role — a customer never enters an
 *     internal application (§15, §17)
 *
 * The message is deliberately generic: no role name, permission name or
 * internal detail is disclosed (§41 — do not reveal what the caller is
 * missing). Offers sign-out so the user can leave cleanly.
 */
import { useAuth } from "./auth-context.js";

/** Screen for an authenticated but unauthorized account. */
export function AccessDenied(): React.ReactNode {
  const { signOut, error } = useAuth();

  return (
    <section role="alert" aria-live="assertive">
      <h1>Akses Ditolak</h1>
      <p>{error ?? "Akun ini tidak diizinkan mengakses aplikasi."}</p>
      <button type="button" onClick={() => void signOut()}>
        Keluar
      </button>
    </section>
  );
}
