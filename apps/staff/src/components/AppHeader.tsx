/**
 * @tepisawah/staff — application header (Production Soft Opening).
 *
 * Portal chrome: brand on the left, active room navigation in center, and
 * staff identity with sign-out on the right. 100% clean production mode.
 */
import { useState, type ReactNode } from "react";

import { useAuth } from "@tepisawah/auth";

import { ROLE_ROOMS, ROOM_METAS, getPrimaryRoomForRoles, type StaffRoom } from "../lib/navigation.js";
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Compute allowed rooms for this staff member
  const allowedRooms = new Set<StaffRoom>();
  for (const role of roles) {
    for (const r of ROLE_ROOMS[role] ?? []) allowedRooms.add(r);
  }

  // Only display operational rooms (pos, kitchen, admin) that this user holds rights to
  const navItems: readonly StaffRoom[] = (
    ["pos", "kitchen", "admin"] as const
  ).filter((r) => allowedRooms.has(r));

  const handleSignOut = async () => {
    try {
      localStorage.removeItem("tepisawah_staff_room");
      localStorage.removeItem("tepisawah_staff_admin_tab");
      localStorage.removeItem("tepisawah_staff_foh_tab");
    } catch {
      // ignore
    }
    await signOut();
  };

  const primaryRoom = getPrimaryRoomForRoles(roles);

  return (
    <header className="staff-header">
      <a
        className="staff-brand"
        href={primaryRoom === "portal" ? "/" : `/${primaryRoom}`}
        onClick={(e) => {
          if (onNavigate) {
            e.preventDefault();
            onNavigate(primaryRoom);
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
        <>
          {/* Desktop Room Navigation */}
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

          {/* Mobile Room Selector Dropdown */}
          <div className="staff-mobile-room-selector">
            <button
              type="button"
              className="staff-mobile-room-trigger"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              aria-label="Pilih Ruangan Staf"
            >
              <span className="staff-mobile-room-emoji" aria-hidden="true">
                {ROOM_METAS[currentRoom].emoji}
              </span>
              <span className="staff-mobile-room-label">
                {ROOM_METAS[currentRoom].label}
              </span>
              <span className="staff-mobile-room-arrow" aria-hidden="true">
                {mobileMenuOpen ? "▴" : "▾"}
              </span>
            </button>

            {mobileMenuOpen && (
              <>
                <div
                  className="staff-mobile-room-backdrop"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-hidden="true"
                />
                <div className="staff-mobile-room-menu" role="menu">
                  <div className="staff-mobile-room-menu-title">Pilih Ruangan Kerja</div>
                  {navItems.map((room) => {
                    const meta = ROOM_METAS[room];
                    const isActive = currentRoom === room;
                    return (
                      <button
                        key={room}
                        type="button"
                        role="menuitem"
                        className={`staff-mobile-room-item ${isActive ? "staff-mobile-room-item--active" : ""}`}
                        onClick={() => {
                          setMobileMenuOpen(false);
                          onNavigate?.(room);
                        }}
                      >
                        <span className="staff-mobile-room-item-emoji">{meta.emoji}</span>
                        <span className="staff-mobile-room-item-text">{meta.label}</span>
                        {isActive && <span className="staff-mobile-room-item-check">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </>
      ) : null}

      {user ? (
        <div className="staff-identity">
          <div className="staff-identity-user">
            <span
              className="staff-identity-name"
              title={(profile?.display_name || user.email || "Staf").replace(/\s*\(Demo\)/gi, "").trim()}
            >
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
              aria-label="Pasang Aplikasi PWA"
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
            title="Keluar dari akun staf"
            aria-label="Keluar dari akun staf"
          >
            Keluar
          </button>
        </div>
      ) : null}
    </header>
  );
}
