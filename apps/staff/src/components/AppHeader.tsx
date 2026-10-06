/**
 * @tepisawah/staff — application header.
 *
 * Portal chrome: brand on the left, the resolved staff identity on the right.
 * The identity block only renders for a signed-in user, so the login screen
 * shows brand chrome without a dangling sign-out button.
 */
import type { ReactNode } from "react";

import { useAuth } from "@tepisawah/auth";
import type { Role } from "@tepisawah/permissions";

import { ROOM_METAS, type StaffRoom } from "../lib/navigation.js";

/** Indonesian label for a role code, shown as a chip next to the identity. */
const ROLE_LABELS: Record<string, string> = {
  waiter: "Pelayan",
  cashier: "Kasir",
  kitchen: "Dapur",
  supervisor: "Supervisor",
  admin: "Admin",
  owner: "Owner",
};

/** Rooms that each role may enter. Operational roles get all internal rooms. */
const ROLE_ROOMS: Record<Role, readonly StaffRoom[]> = {
  waiter: ["waiter"],
  kitchen: ["kitchen"],
  cashier: ["pos", "waiter"],
  supervisor: ["pos", "kitchen", "waiter", "admin"],
  admin: ["pos", "kitchen", "waiter", "admin"],
  owner: ["pos", "kitchen", "waiter", "admin"],
};

export interface AppHeaderProps {
  readonly currentRoom?: StaffRoom;
  readonly onNavigate?: (room: StaffRoom) => void;
}

export function AppHeader({
  currentRoom = "portal",
  onNavigate,
}: AppHeaderProps): ReactNode {
  const { user, profile, roles, signOut } = useAuth();

  // Compute allowed rooms for this staff member
  const allowedRooms = new Set<StaffRoom>(["portal"]);
  for (const role of roles) {
    for (const r of ROLE_ROOMS[role] ?? []) allowedRooms.add(r);
  }

  const navItems: readonly StaffRoom[] = (
    ["portal", "pos", "kitchen", "waiter", "admin"] as const
  ).filter((r) => allowedRooms.has(r));

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
          <span className="staff-brand-tag">Staff Portal</span>
        </span>
      </a>

      {user && navItems.length > 1 ? (
        <nav className="staff-nav-rooms" aria-label="Navigasi Ruangan">
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

