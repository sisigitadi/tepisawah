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
import { useEffect, useState, type ReactNode } from "react";
import { AccessDenied, LoginPanel, useAuth } from "@tepisawah/auth";
import { FirstTimeSetup } from "../components/FirstTimeSetup.js";
import { getSupabaseClient } from "../lib/supabase.js";

export function ProtectedRoute({ children }: { children: ReactNode }): ReactNode {
  const { status, isLoading } = useAuth();
  const [needsSetup, setNeedsSetup] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function checkSetupNeeded() {
      if (status !== "unauthenticated") {
        setNeedsSetup(false);
        return;
      }

      setCheckingSetup(true);
      try {
        const client = getSupabaseClient() as any;
        const { count, error } = await client
          .from("profiles")
          .select("id", { count: "exact", head: true });

        if (isMounted && !error && count === 0) {
          setNeedsSetup(true);
        } else if (isMounted) {
          setNeedsSetup(false);
        }
      } catch {
        if (isMounted) setNeedsSetup(false);
      } finally {
        if (isMounted) setCheckingSetup(false);
      }
    }

    void checkSetupNeeded();
    return () => {
      isMounted = false;
    };
  }, [status]);

  if (isLoading || checkingSetup) {
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

  if (status === "disabled" || status === "unauthorized") return <AccessDenied />;

  if (status === "unauthenticated") {
    if (needsSetup) {
      return <FirstTimeSetup onSetupComplete={() => setNeedsSetup(false)} />;
    }
    return (
      <div className="staff-login">
        <LoginPanel title="Portal Staf — Masuk" />
      </div>
    );
  }

  return children;
}
