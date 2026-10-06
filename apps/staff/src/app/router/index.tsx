/**
 * @tepisawah/staff — unified staff router.
 *
 * Implements the single Staff Portal surface containing all internal rooms:
 * - /         → Portal Launcher (role-based card tiles)
 * - /pos      → Cashier POS Terminal & Confirmation Queue
 * - /kitchen  → Kitchen Display System (KDS)
 * - /waiter   → Waiter Handheld & Manual Order Entry
 * - /admin    → Admin Console (Catalog, Tables, Settings, Sessions)
 *
 * All rooms share the same authenticated session, protected by ProtectedRoute
 * and server-enforced RLS.
 */
import type { ReactNode } from "react";
import { useState } from "react";

import { PERMISSIONS } from "@tepisawah/permissions";

import { RootLayout } from "../../layouts/RootLayout.js";
import { PortalPage } from "../../pages/PortalPage.js";
import { PermissionRoute, ProtectedRoute } from "../../routes/index.js";
import { useStaffNavigation, type StaffRoom } from "../../lib/navigation.js";

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
} from "@tepisawah/admin";

type AdminTab = "home" | "settings" | "catalog" | "tables" | "sessions";
type PosTab = "terminal" | "confirm" | "waiter-console" | "manual-order";
type WaiterTab = "console" | "manual-order";

export function AppRouter(): ReactNode {
  const { currentRoom, navigateTo } = useStaffNavigation();

  // Internal sub-tab state for multi-view rooms
  const [posTab, setPosTab] = useState<PosTab>(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).has("confirm")
      ? "confirm"
      : typeof window !== "undefined" && new URLSearchParams(window.location.search).has("order")
        ? "manual-order"
        : "terminal"
  );

  const [waiterTab, setWaiterTab] = useState<WaiterTab>(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).has("order")
      ? "manual-order"
      : "console"
  );

  const [adminTab, setAdminTab] = useState<AdminTab>("home");

  return (
    <RootLayout currentRoom={currentRoom} onNavigate={navigateTo}>
      <ProtectedRoute>
        {currentRoom === "portal" && (
          <PortalPage onSelectRoom={(appId) => navigateTo(appId as StaffRoom)} />
        )}

        {currentRoom === "pos" && (
          <PermissionRoute permission={PERMISSIONS.ORDERS_READ}>
            <div className="staff-subnav-bar">
              <button
                type="button"
                className={`staff-subnav-btn ${posTab === "terminal" ? "staff-subnav-btn--active" : ""}`}
                onClick={() => setPosTab("terminal")}
              >
                💳 Terminal Kasir
              </button>
              <button
                type="button"
                className={`staff-subnav-btn ${posTab === "confirm" ? "staff-subnav-btn--active" : ""}`}
                onClick={() => setPosTab("confirm")}
              >
                📥 Antrean Konfirmasi
              </button>
              <button
                type="button"
                className={`staff-subnav-btn ${posTab === "waiter-console" ? "staff-subnav-btn--active" : ""}`}
                onClick={() => setPosTab("waiter-console")}
              >
                🍽️ Layanan Meja & Saji
              </button>
              <button
                type="button"
                className={`staff-subnav-btn ${posTab === "manual-order" ? "staff-subnav-btn--active" : ""}`}
                onClick={() => setPosTab("manual-order")}
              >
                ✍️ Catat Order Walk-In / Meja
              </button>
            </div>

            {posTab === "confirm" ? (
              <ConfirmQueuePage />
            ) : posTab === "waiter-console" ? (
              <WaiterHomePage />
            ) : posTab === "manual-order" ? (
              <PermissionRoute permission={PERMISSIONS.ORDERS_CREATE_MANUAL}>
                <ManualOrderPage />
              </PermissionRoute>
            ) : (
              <PosHomePage />
            )}
          </PermissionRoute>
        )}

        {currentRoom === "kitchen" && (
          <PermissionRoute permission={PERMISSIONS.ORDERS_READ}>
            <div className="staff-room-kitchen">
              <KitchenHomePage />
            </div>
          </PermissionRoute>
        )}

        {currentRoom === "waiter" && (
          <PermissionRoute permission={PERMISSIONS.ORDERS_READ}>
            <div className="staff-subnav-bar">
              <button
                type="button"
                className={`staff-subnav-btn ${waiterTab === "console" ? "staff-subnav-btn--active" : ""}`}
                onClick={() => setWaiterTab("console")}
              >
                📋 Meja & Pesanan Siap Saji
              </button>
              <button
                type="button"
                className={`staff-subnav-btn ${waiterTab === "manual-order" ? "staff-subnav-btn--active" : ""}`}
                onClick={() => setWaiterTab("manual-order")}
              >
                ✍️ Catat Pesanan Manual
              </button>
            </div>

            {waiterTab === "manual-order" ? (
              <PermissionRoute permission={PERMISSIONS.ORDERS_CREATE_MANUAL}>
                <ManualOrderPage />
              </PermissionRoute>
            ) : (
              <WaiterHomePage />
            )}
          </PermissionRoute>
        )}

        {currentRoom === "admin" && (
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
                Meja & QR
              </button>
              <button
                type="button"
                className={`staff-subnav-btn ${adminTab === "sessions" ? "staff-subnav-btn--active" : ""}`}
                onClick={() => setAdminTab("sessions")}
              >
                Sesi Meja
              </button>
            </div>

            {adminTab === "settings" ? (
              <SettingsPage />
            ) : adminTab === "catalog" ? (
              <CatalogPage />
            ) : adminTab === "tables" ? (
              <TablesPage />
            ) : adminTab === "sessions" ? (
              <SessionsPage />
            ) : (
              <AdminHomePage />
            )}
          </div>
        )}
      </ProtectedRoute>
    </RootLayout>
  );
}
