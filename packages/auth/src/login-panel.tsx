/**
 * @tepisawah/auth — staff login panel (Phase 2).
 *
 * Staff-only surface for the internal apps. It renders no role assignment or
 * admin features — those come with RBAC. Errors are shown as safe public
 * messages only (ENVIRONMENT_CONFIG.md §24).
 *
 * Demo support: when a hosted deployment enables demo mode, the app passes
 * the generic role accounts from `@tepisawah/config` (`DEMO_ACCOUNTS`) as the
 * `demoAccounts` prop, and the panel renders a click-to-fill hint card so a
 * presenter can enter any role instantly. Production builds never pass the
 * prop (the `VITE_DEMO_MODE` flag is unset), so nothing demo-related renders
 * and the panel is identical to the plain staff login.
 */
import { useState, type FormEvent } from "react";

import type { DemoAccount } from "@tepisawah/config";

import { useAuth } from "./auth-context.js";

/** Email + password staff login form. */
export function LoginPanel({
  title = "Staff Login",
  demoAccounts,
}: {
  title?: string;
  /** Rendered only for demo deployments (see packages/config/src/demo.ts). */
  demoAccounts?: readonly DemoAccount[];
}): React.ReactNode {
  const { signIn, error, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
    } catch {
      // `error` is surfaced through context as a safe public message.
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = submitting || isLoading;

  return (
    <form onSubmit={handleSubmit} aria-busy={disabled} noValidate>
      <h1>{title}</h1>
      <label>
        Email
        <input
          type="email"
          name="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          disabled={disabled}
        />
      </label>
      <label>
        Kata sandi
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          disabled={disabled}
        />
      </label>
      {error ? (
        <p role="alert" aria-live="assertive">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={disabled}>
        {submitting ? "Memproses…" : "Masuk"}
      </button>
      {demoAccounts?.length ? (
        <section aria-label="Akun demo" data-testid="demo-accounts">
          <div
            style={{
              marginBottom: "1rem",
              padding: "0.75rem",
              background: "rgba(16, 185, 129, 0.08)",
              border: "1px solid #10b981",
              borderRadius: "0.5rem",
            }}
          >
            <p style={{ margin: "0 0 0.5rem 0", fontWeight: 600, color: "#065f46" }}>
              🔑 Akun Utama Aktif (Database Supabase):
            </p>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setEmail("admin@tepisawah.id");
                setPassword("TepiSawah#Admin2026");
              }}
              style={{
                background: "#059669",
                color: "#ffffff",
                padding: "0.4rem 0.8rem",
                borderRadius: "0.375rem",
                border: "none",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              👑 Isi Admin Utama (admin@tepisawah.id)
            </button>
            <small style={{ display: "block", marginTop: "0.35rem", color: "#047857" }}>
              Password: <code>TepiSawah#Admin2026</code> (Akses Penuh Semua Ruangan)
            </small>
          </div>
          <p>
            <strong>Mode demo</strong> — pilih peran untuk mengisi form:
          </p>
          <ul>
            {demoAccounts.map((account) => (
              <li key={account.email}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setEmail(account.email);
                    setPassword(account.password);
                  }}
                >
                  {account.label}
                </button>{" "}
                <small>
                  {account.email} — {account.blurb}
                </small>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </form>
  );
}
