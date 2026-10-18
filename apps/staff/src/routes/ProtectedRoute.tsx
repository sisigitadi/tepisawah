/**
 * @tepisawah/staff — protected route guard.
 *
 * UX/navigation only: shows the staff login panel to unauthenticated visitors
 * and access-denied for inactive accounts (§14) and for authenticated accounts
 * that hold no staff role (§15).
 *
 * If the database has 0 staff profiles (clean slate/first-time), it renders
 * the FirstTimeSetup component allowing the Owner to register the first account.
 */
import { useState, type ReactNode } from "react";
import { AccessDenied, LoginPanel, useAuth } from "@tepisawah/auth";
import { DEMO_ACCOUNTS, isDemoMode } from "@tepisawah/config";
import { FirstTimeSetup } from "../components/FirstTimeSetup.js";

export function ProtectedRoute({ children }: { children: ReactNode }): ReactNode {
  const { status, isLoading, user } = useAuth();
  const [showSetup, setShowSetup] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).has("setup");
  });

  if (isLoading) {
    return (
      <div
        aria-busy="true"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-sans, sans-serif)",
          color: "var(--c-deepmoss, #183a1d)",
          fontWeight: 600,
        }}
      >
        Memuat portal staf…
      </div>
    );
  }

  // If user is authenticated, always allow them through to their duty workspace
  if (user) {
    return children;
  }

  if (status === "disabled" || status === "unauthorized") return <AccessDenied />;

  if (status === "unauthenticated") {
    if (showSetup) {
      return (
        <FirstTimeSetup
          onSetupComplete={() => setShowSetup(false)}
          onBackToLogin={() => setShowSetup(false)}
        />
      );
    }
    return (
      <div className="staff-login">
        <LoginPanel
          title="Portal Staf: Masuk"
          demoAccounts={isDemoMode(import.meta.env as unknown as Record<string, string | undefined>) ? DEMO_ACCOUNTS : undefined}
        />
        <div className="staff-login__switch">
          <button
            type="button"
            className="staff-link-btn"
            onClick={() => setShowSetup(true)}
          >
            Belum punya akun? Inisialisasi Akun Pemilik Resto →
          </button>
        </div>
      </div>
    );
  }

  return children;
}
