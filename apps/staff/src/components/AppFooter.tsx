/**
 * @tepisawah/staff — application footer.
 *
 * Operational footer for staff portal chrome: displays restaurant operational
 * badge, system status, and copyright. Styled to sit statically at the bottom
 * of the viewport when content does not fill the screen.
 */
import type { ReactNode } from "react";
import { ROOM_METAS, type StaffRoom } from "../lib/navigation.js";

export interface AppFooterProps {
  readonly currentRoom?: StaffRoom;
  readonly onNavigate?: (room: StaffRoom) => void;
}

export function AppFooter({
  currentRoom = "portal",
  onNavigate,
}: AppFooterProps): ReactNode {
  const currentMeta = ROOM_METAS[currentRoom];

  return (
    <footer className="staff-footer" aria-label="Informasi Operasional Staf">
      <div className="staff-footer-inner">
        <div className="staff-footer-status">
          <span className="staff-footer-dot" aria-hidden="true" />
          <span className="staff-footer-system">Sistem Operasional Aktif</span>
          {currentRoom !== "portal" && (
            <span className="staff-footer-room">
              • Ruangan: <strong>{currentMeta.label}</strong>
            </span>
          )}
        </div>

        <div className="staff-footer-links">
          {currentRoom !== "portal" && onNavigate ? (
            <button
              type="button"
              className="staff-footer-link-btn"
              onClick={() => onNavigate("portal")}
            >
              ← Kembali ke Beranda Staf
            </button>
          ) : null}
          <span className="staff-footer-copy">
            © 2026 Tepi Sawah Resto &amp; Coffee
          </span>
        </div>
      </div>
    </footer>
  );
}
