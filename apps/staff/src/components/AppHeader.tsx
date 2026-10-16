/**
 * @tepisawah/staff — application header (Production Soft Opening).
 *
 * Portal chrome: brand on the left, active room navigation in center, and
 * staff identity with sign-out on the right. 100% clean production mode.
 */
import type { ReactNode } from "react";

import { useAuth } from "@tepisawah/auth";

import { ROLE_ROOMS, ROOM_METAS, type StaffRoom } from "../lib/navigation.js";
import { usePwaInstall } from "../lib/pwa.js";

export interface AppHeaderProps {
  readonly currentRoom?: StaffRoom;
  readonly onNavigate?: (room: StaffRoom) => void;
}

export function AppHeader({
  currentRoom = "portal",
  onNavigate,
}: AppHeaderProps): ReactNode {
  const { user, profile, roles, signOut } = useAuth();
  const { canInstall, isInstalled, triggerInstall } = usePwaInstall();

  // Compute allowed rooms for this staff member
  const allowedRooms = new Set<StaffRoom>(["portal"]);
  for (const role of roles) {
    for (const r of ROLE_ROOMS[role] ?? []) allowedRooms.add(r);
  }

  const navItems: readonly StaffRoom[] = (
    ["portal", "pos", "kitchen", "admin"] as const
  ).filter((r) => allowedRooms.has(r));

  const handleSignOut = async () => {
    if (onNavigate) {
      onNavigate("portal");
    } else {
      window.history.pushState({}, "", "/");
    }
    await signOut();
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
          <div className="staff-identity-user">
            <span className="staff-identity-name">
              {(profile?.display_name || user.email || "Staf").replace(/\s*\(Demo\)/gi, "").trim()}
            </span>
            <span className="staff-identity-roles">
              {roles.includes("owner")
                ? "Pemilik Restoran"
                : roles.includes("admin") || roles.includes("supervisor")
                ? "Pengelola Restoran"
                : roles.includes("cashier") || roles.includes("waiter")
                ? "Kasir & Layanan Meja"
                : roles.includes("kitchen")
                ? "Dapur (KDS)"
                : "Staf Operasional"}
            </span>
          </div>
          {canInstall ? (
            <button
              type="button"
              className="staff-header-install-btn"
              onClick={() => void triggerInstall()}
              title="Pasang aplikasi di layar utama perangkat ini"
            >
              <span aria-hidden="true">📲</span>
              <span>Pasang App</span>
            </button>
          ) : isInstalled ? (
            <span className="staff-header-pwa-badge" title="Berjalan dalam mode aplikasi terpasang">
              ✓ App
            </span>
          ) : null}
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
