/**
 * @tepisawah/staff — unified staff router (Production Soft Opening).
 *
 * Implements the 3 primary operational surfaces:
 * - /         → Portal Launcher (Beranda Staf)
 * - /pos      → Kasir & Layanan Meja (Front of House: Antrean, Siap Antar, Catat Menu, Kasir Bayar)
 * - /kitchen  → Layar Pesanan Dapur (Back of House: KDS tiket masak)
 * - /admin    → Panel Pengelola Restoran (Manajemen, Katalog, Meja, CMS, Pengaturan)
 *
 * All rooms share the same authenticated session, protected by ProtectedRoute
 * and server-enforced RLS.
 */
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@tepisawah/auth";
import { PERMISSIONS } from "@tepisawah/permissions";

import { RootLayout } from "../../layouts/RootLayout.js";
import { PortalPage } from "../../pages/PortalPage.js";
import { PermissionRoute, ProtectedRoute } from "../../routes/index.js";
import { getAllowedRooms, useStaffNavigation, type StaffRoom } from "../../lib/navigation.js";

// Embedded rooms from workspace apps
import { PosHomePage, ConfirmQueuePage } from "@tepisawah/pos";
import { KitchenHomePage } from "@tepisawah/kitchen";
import { WaiterHomePage, ManualOrderPage } from "@tepisawah/waiter";
import {
  AdminHomePage,
  SettingsPage,
  CatalogPage,
  TablesPage,
  SessionsPage,
  ReservationsPage,
  CmsPage,
} from "@tepisawah/admin";

type AdminTab = "home" | "reservations" | "cms" | "settings" | "catalog" | "tables" | "sessions";
export type FrontOfHouseTab = "confirm" | "serve" | "manual-order" | "terminal";

export function AppRouter(): ReactNode {
  const { currentRoom, navigateTo } = useStaffNavigation();
  const { user, roles } = useAuth();
  const allowedRooms = useMemo(() => getAllowedRooms(roles), [roles]);

  // Auto-reset room to portal whenever user session changes (switch user/login)
  const prevUserIdRef = useRef<string | undefined>(user?.id);
  useEffect(() => {
    if (user?.id && prevUserIdRef.current && prevUserIdRef.current !== user.id) {
      navigateTo("portal");
    }
    prevUserIdRef.current = user?.id;
  }, [user?.id, navigateTo]);

  // Auto-redirect if current room is not permitted for the active role
  useEffect(() => {
    if (user && currentRoom !== "portal" && !allowedRooms.has(currentRoom)) {
      navigateTo("portal");
    }
  }, [user, currentRoom, allowedRooms, navigateTo]);

  // Internal sub-tab state for Front of House (Kasir & Layanan Meja)
  const [fohTab, setFohTab] = useState<FrontOfHouseTab>(() => {
    if (typeof window === "undefined") return "confirm";
    const params = new URLSearchParams(window.location.search);
    if (params.has("order")) return "manual-order";
    if (params.has("terminal")) return "terminal";
    if (params.has("serve") || params.has("waiter")) return "serve";
    return "confirm";
  });

  const [adminTab, setAdminTab] = useState<AdminTab>("home");

  return (
    <RootLayout currentRoom={currentRoom} onNavigate={navigateTo}>
      <ProtectedRoute>
        {currentRoom === "portal" && (
          <PortalPage onSelectRoom={(appId) => navigateTo(appId as StaffRoom)} />
        )}

        {currentRoom === "pos" && (
          <PermissionRoute permission={PERMISSIONS.ORDERS_READ}>
            {/* Top Subnav Bar for Desktop & Tablet */}
            <div className="staff-subnav-bar">
              <button
                type="button"
                className={`staff-subnav-btn ${fohTab === "confirm" ? "staff-subnav-btn--active" : ""}`}
                onClick={() => setFohTab("confirm")}
              >
                📥 Antrean Masuk (QR)
              </button>
              <button
                type="button"
                className={`staff-subnav-btn ${fohTab === "serve" ? "staff-subnav-btn--active" : ""}`}
                onClick={() => setFohTab("serve")}
              >
                🍽️ Siap Antar ke Meja
              </button>
              <button
                type="button"
                className={`staff-subnav-btn ${fohTab === "manual-order" ? "staff-subnav-btn--active" : ""}`}
                onClick={() => setFohTab("manual-order")}
              >
                ✍️ Catat Pesanan Meja
              </button>
              <button
                type="button"
                className={`staff-subnav-btn ${fohTab === "terminal" ? "staff-subnav-btn--active" : ""}`}
                onClick={() => setFohTab("terminal")}
              >
                💳 Meja Kasir & Bayar
              </button>
            </div>

            {/* Main Content Area */}
            <div className="staff-foh-content">
              {fohTab === "confirm" ? (
                <ConfirmQueuePage />
              ) : fohTab === "serve" ? (
                <WaiterHomePage />
              ) : fohTab === "manual-order" ? (
                <PermissionRoute permission={PERMISSIONS.ORDERS_CREATE_MANUAL}>
                  <ManualOrderPage />
                </PermissionRoute>
              ) : (
                <PosHomePage />
              )}
            </div>

            {/* Mobile Thumb-Friendly Bottom Navigation Bar */}
            <nav className="staff-bottom-nav" aria-label="Navigasi Bawah Layanan Kasir & Meja">
              <button
                type="button"
                className={`staff-bottom-nav-item ${fohTab === "confirm" ? "staff-bottom-nav-item--active" : ""}`}
                onClick={() => setFohTab("confirm")}
              >
                <span className="staff-bottom-nav-icon" aria-hidden="true">📥</span>
                <span className="staff-bottom-nav-label">Antrean</span>
              </button>
              <button
                type="button"
                className={`staff-bottom-nav-item ${fohTab === "serve" ? "staff-bottom-nav-item--active" : ""}`}
                onClick={() => setFohTab("serve")}
              >
                <span className="staff-bottom-nav-icon" aria-hidden="true">🍽️</span>
                <span className="staff-bottom-nav-label">Siap Antar</span>
              </button>
              <button
                type="button"
                className={`staff-bottom-nav-item ${fohTab === "manual-order" ? "staff-bottom-nav-item--active" : ""}`}
                onClick={() => setFohTab("manual-order")}
              >
                <span className="staff-bottom-nav-icon" aria-hidden="true">✍️</span>
                <span className="staff-bottom-nav-label">Catat Menu</span>
              </button>
              <button
                type="button"
                className={`staff-bottom-nav-item ${fohTab === "terminal" ? "staff-bottom-nav-item--active" : ""}`}
                onClick={() => setFohTab("terminal")}
              >
                <span className="staff-bottom-nav-icon" aria-hidden="true">💳</span>
                <span className="staff-bottom-nav-label">Kasir</span>
              </button>
            </nav>
          </PermissionRoute>
        )}

        {currentRoom === "kitchen" && (
          <PermissionRoute permission={PERMISSIONS.ORDERS_READ}>
            <div className="staff-room-kitchen">
              <KitchenHomePage />
            </div>
          </PermissionRoute>
        )}

        {currentRoom === "admin" && (
          <PermissionRoute permission={PERMISSIONS.SETTINGS_READ}>
            <div className="staff-admin-room">
              <div className="staff-subnav-bar">
                <button
                  type="button"
                  className={`staff-subnav-btn ${adminTab === "home" ? "staff-subnav-btn--active" : ""}`}
                  onClick={() => setAdminTab("home")}
                >
                  Beranda
                </button>
                <button
                  type="button"
                  className={`staff-subnav-btn ${adminTab === "reservations" ? "staff-subnav-btn--active" : ""}`}
                  onClick={() => setAdminTab("reservations")}
                >
                  📅 Reservasi Meja
                </button>
                <button
                  type="button"
                  className={`staff-subnav-btn ${adminTab === "cms" ? "staff-subnav-btn--active" : ""}`}
                  onClick={() => setAdminTab("cms")}
                >
                  🌐 Konten Web
                </button>
                <button
                  type="button"
                  className={`staff-subnav-btn ${adminTab === "settings" ? "staff-subnav-btn--active" : ""}`}
                  onClick={() => setAdminTab("settings")}
                >
                  Pengaturan
                </button>
                <button
                  type="button"
                  className={`staff-subnav-btn ${adminTab === "catalog" ? "staff-subnav-btn--active" : ""}`}
                  onClick={() => setAdminTab("catalog")}
                >
                  Katalog Menu
                </button>
                <button
                  type="button"
                  className={`staff-subnav-btn ${adminTab === "tables" ? "staff-subnav-btn--active" : ""}`}
                  onClick={() => setAdminTab("tables")}
                >
                  Meja &amp; QR
                </button>
                <button
                  type="button"
                  className={`staff-subnav-btn ${adminTab === "sessions" ? "staff-subnav-btn--active" : ""}`}
                  onClick={() => setAdminTab("sessions")}
                >
                  Sesi Meja
                </button>
              </div>

              {adminTab === "reservations" ? (
                <ReservationsPage />
              ) : adminTab === "cms" ? (
                <CmsPage />
              ) : adminTab === "settings" ? (
                <SettingsPage />
              ) : adminTab === "catalog" ? (
                <CatalogPage />
              ) : adminTab === "tables" ? (
                <TablesPage />
              ) : adminTab === "sessions" ? (
                <SessionsPage />
              ) : (
                <AdminHomePage onNavigate={(tab) => setAdminTab(tab as AdminTab)} />
              )}
            </div>
          </PermissionRoute>
        )}
      </ProtectedRoute>
    </RootLayout>
  );
}
