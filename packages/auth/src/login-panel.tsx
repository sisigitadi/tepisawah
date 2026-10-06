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
          <p>
            <strong>Mode demo</strong> — pilih peran untuk mengisi form otomatis:
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
