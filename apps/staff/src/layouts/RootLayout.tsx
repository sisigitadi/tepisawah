/**
 * @tepisawah/staff — root layout.
 *
 * Unified staff chrome + room navigation.
 */
import type { ReactNode } from "react";
import { AppHeader } from "../components/AppHeader.js";
import type { StaffRoom } from "../lib/navigation.js";

export interface RootLayoutProps {
  children: ReactNode;
  currentRoom?: StaffRoom;
  onNavigate?: (room: StaffRoom) => void;
}

export function RootLayout({
  children,
  currentRoom = "portal",
  onNavigate,
}: RootLayoutProps): ReactNode {
  const isFullWidth = currentRoom !== "portal";

  return (
    <div className={`app-shell app-shell--room-${currentRoom}`}>
      <AppHeader currentRoom={currentRoom} onNavigate={onNavigate} />
      <main
        className={`app-main ${isFullWidth ? "app-main--fullwidth" : ""}`}
      >
        {children}
      </main>
    </div>
  );
}
