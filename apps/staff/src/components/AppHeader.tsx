/**
 * @tepisawah/staff — application header.
 *
 * Portal chrome: brand on the left, the resolved staff identity on the right.
 * The identity block only renders for a signed-in user, so the login screen
 * shows brand chrome without a dangling sign-out button.
 */
import { useState, type ReactNode } from "react";

import { useAuth } from "@tepisawah/auth";
import { DEMO_ACCOUNTS } from "@tepisawah/config";

import { env } from "../lib/env.js";
import { ROLE_ROOMS, ROOM_METAS, type StaffRoom } from "../lib/navigation.js";

/** Indonesian label for a role code, shown as a chip next to the identity. */
const ROLE_LABELS: Record<string, string> = {
  owner: "Pemilik (Owner)",
  admin: "Pengelola",
  supervisor: "Pengelola",
  cashier: "Kasir",
  waiter: "Pelayan",
  kitchen: "Dapur",
};

export interface AppHeaderProps {
  readonly currentRoom?: StaffRoom;
  readonly onNavigate?: (room: StaffRoom) => void;
}

export function AppHeader({
  currentRoom = "portal",
  onNavigate,
}: AppHeaderProps): ReactNode {
  const { user, profile, roles, signIn, signOut } = useAuth();
  const [switchingRole, setSwitchingRole] = useState(false);

  // Compute allowed rooms for this staff member
  const allowedRooms = new Set<StaffRoom>(["portal"]);
  for (const role of roles) {
    for (const r of ROLE_ROOMS[role] ?? []) allowedRooms.add(r);
  }

  const navItems: readonly StaffRoom[] = (
    ["portal", "pos", "kitchen", "waiter", "admin"] as const
  ).filter((r) => allowedRooms.has(r));

  const handleSignOut = async () => {
    if (onNavigate) {
      onNavigate("portal");
    } else {
      window.history.pushState({}, "", "/");
    }
    await signOut();
  };

  const handleSwitchDemoRole = async (targetEmail: string) => {
    const account = DEMO_ACCOUNTS.find((a) => a.email === targetEmail);
    if (!account) return;
    setSwitchingRole(true);
    try {
      if (onNavigate) {
        onNavigate("portal");
      }
      window.history.pushState({}, "", "/");
      await signIn(account.email, account.password);
    } catch (err) {
      console.error("Gagal berpindah peran demo:", err);
    } finally {
      setSwitchingRole(false);
    }
  };

  return (
    <header className="staff-header">
      <a
        className="staff-brand"
        href="/"
        onClick={(e) => {
          if (onNavigate) {
            e.preventDefault();
            onNavigate("portal");
          }
        }}
      >
        <img className="staff-brand-mark" src="/logo.png" alt="Tepi Sawah" />
        <span className="staff-brand-text">
          <span className="staff-brand-name">Tepi Sawah</span>
          <span className="staff-brand-tag">Portal Staf</span>
        </span>
      </a>

      {user && navItems.length > 1 ? (
        <nav className="staff-nav-rooms" aria-label="Menu Ruangan">
          {navItems.map((room) => {
            const meta = ROOM_METAS[room];
            const isActive = currentRoom === room;
            return (
              <button
                key={room}
                type="button"
                className={`staff-nav-room-btn ${isActive ? "staff-nav-room-btn--active" : ""}`}
                aria-current={isActive ? "page" : undefined}
                onClick={() => onNavigate?.(room)}
              >
                <span className="staff-nav-room-emoji" aria-hidden="true">
                  {meta.emoji}
                </span>
                <span className="staff-nav-room-label">{meta.label}</span>
              </button>
            );
          })}
        </nav>
      ) : null}

      {user ? (
        <div className="staff-identity">
          {env.demoMode ? (
            <div className="staff-demo-role-select" title="Ganti Peran Cepat (Mode Demo)">
              <span className="staff-demo-role-label">Peran Demo:</span>
              <select
                className="staff-demo-role-dropdown"
                value={user.email ?? ""}
                disabled={switchingRole}
                onChange={(e) => void handleSwitchDemoRole(e.target.value)}
                aria-label="Pilih Peran Demo"
              >
                {DEMO_ACCOUNTS.map((acc) => (
                  <option key={acc.email} value={acc.email}>
                    {acc.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="staff-identity-user">
            <span className="staff-identity-name">
              {profile?.display_name || user.email}
            </span>
            <span className="staff-identity-roles">
              {roles.map((role) => ROLE_LABELS[role] ?? role).join(" · ") ||
                "Staf"}
            </span>
          </div>
          <button
            type="button"
            className="staff-signout"
            onClick={() => void handleSignOut()}
          >
            Keluar
          </button>
        </div>
      ) : null}
    </header>
  );
}

