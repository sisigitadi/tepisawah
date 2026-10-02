/**
 * @tepisawah/staff — application header.
 *
 * Portal chrome: brand on the left, the resolved staff identity on the right.
 * The identity block only renders for a signed-in user, so the login screen
 * shows brand chrome without a dangling sign-out button.
 */
import type { ReactNode } from "react";

import { useAuth } from "@tepisawah/auth";

/** Indonesian label for a role code, shown as a chip next to the identity. */
const ROLE_LABELS: Record<string, string> = {
  waiter: "Pelayan",
  cashier: "Kasir",
  kitchen: "Dapur",
  supervisor: "Supervisor",
  admin: "Admin",
  owner: "Owner",
};

export function AppHeader(): ReactNode {
  const { user, profile, roles, signOut } = useAuth();

  return (
    <header className="staff-header">
      <a className="staff-brand" href="/">
        <img className="staff-brand-mark" src="/logo.png" alt="Tepi Sawah" />
        <span className="staff-brand-text">
          <span className="staff-brand-name">Tepi Sawah</span>
          <span className="staff-brand-tag">Staff Portal</span>
        </span>
      </a>

      {user ? (
        <div className="staff-identity">
          <div className="staff-identity-user">
            <span className="staff-identity-name">
              {profile?.display_name || user.email}
            </span>
            <span className="staff-identity-roles">
              {roles.map((role) => ROLE_LABELS[role] ?? role).join(" · ") ||
                "Staff"}
            </span>
          </div>
          <button
            type="button"
            className="staff-signout"
            onClick={() => void signOut()}
          >
            Keluar
          </button>
        </div>
      ) : null}
    </header>
  );
}
