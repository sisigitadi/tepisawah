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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@tepisawah/auth";
import { PERMISSIONS } from "@tepisawah/permissions";
import { useOrderBoardChannel } from "@tepisawah/database";

import { RootLayout } from "../../layouts/RootLayout.js";
import { PortalPage } from "../../pages/PortalPage.js";
import { PermissionRoute, ProtectedRoute } from "../../routes/index.js";
import { getAllowedRooms, useStaffNavigation, type StaffRoom } from "../../lib/navigation.js";
import { getSupabaseClient } from "../../lib/supabase.js";

// Embedded rooms from workspace apps
import { PosHomePage, ConfirmQueuePage, loadConfirmationQueue } from "@tepisawah/pos";
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
  StaffPage,
  TransactionsLedgerPage,
} from "@tepisawah/admin";

type AdminTab = "home" | "transactions" | "staff" | "reservations" | "cms" | "settings" | "catalog" | "tables" | "sessions";
export type FrontOfHouseTab = "confirm" | "serve" | "manual-order" | "terminal";

interface AdminTabDef {
  readonly id: AdminTab;
  readonly label: string;
  readonly icon: string;
}

const ADMIN_TABS: readonly AdminTabDef[] = [
  { id: "home", label: "Beranda", icon: "📊" },
  { id: "transactions", label: "Buku Transaksi", icon: "💰" },
  { id: "staff", label: "Kelola Staf", icon: "👥" },
  { id: "reservations", label: "Reservasi Meja", icon: "📅" },
  { id: "cms", label: "Konten Web", icon: "🌐" },
  { id: "settings", label: "Pengaturan", icon: "⚙️" },
  { id: "catalog", label: "Katalog Menu", icon: "📖" },
  { id: "tables", label: "Meja & QR", icon: "🪑" },
  { id: "sessions", label: "Sesi Meja", icon: "⏱️" },
];

function AdminSubnavBar({
  activeTab,
  onSelectTab,
}: {
  activeTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
}): ReactNode {
  const currentTabMeta: AdminTabDef = ADMIN_TABS.find((t) => t.id === activeTab) ?? {
    id: "home",
    label: "Beranda",
    icon: "📊",
  };

  return (
    <div className="staff-admin-nav-container">
      <div className="staff-admin-dropdown-bar">
        <div className="staff-admin-dropdown-current">
          <span className="staff-admin-dropdown-icon" aria-hidden="true">{currentTabMeta.icon}</span>
          <div className="staff-admin-dropdown-text">
            <span className="staff-admin-dropdown-label">Modul Pengelola</span>
            <span className="staff-admin-dropdown-title">{currentTabMeta.label}</span>
          </div>
        </div>

        <div className="staff-admin-dropdown-select-wrap">
          <label htmlFor="staff-admin-tab-select" className="staff-admin-dropdown-accessible-label">
            Pilih Modul:
          </label>
          <div className="staff-admin-select-field">
            <select
              id="staff-admin-tab-select"
              className="staff-admin-dropdown-select"
              value={activeTab}
              onChange={(e) => onSelectTab(e.target.value as AdminTab)}
              aria-label="Pilih Modul Pengelola"
            >
              {ADMIN_TABS.map((tab) => (
                <option key={tab.id} value={tab.id}>
                  {tab.icon} {tab.label}
                </option>
              ))}
            </select>
            <span className="staff-admin-dropdown-arrow" aria-hidden="true">▾</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppRouter(): ReactNode {
  const { currentRoom, navigateTo } = useStaffNavigation();
  const { user, roles, isLoading } = useAuth();
  const allowedRooms = useMemo(() => getAllowedRooms(roles), [roles]);

  // Auto-reset room to portal whenever user session changes (switch user/login)
  const prevUserIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (user?.id && prevUserIdRef.current && prevUserIdRef.current !== user.id) {
      navigateTo("portal");
    }
    prevUserIdRef.current = user?.id;
  }, [user?.id, navigateTo]);

  // Smart Route Redirection: if current room is not permitted for the active role,
  // automatically redirect to their primary operational room (e.g. cashier to pos, kitchen to kitchen).
  // IMPORTANT: Wait until auth has settled (isLoading === false) so refreshing a subpage (e.g. /admin, /pos)
  // does not prematurely kick the user back to portal before their roles finish fetching.
  useEffect(() => {
    if (isLoading || !user) return;
    if (currentRoom !== "portal" && !allowedRooms.has(currentRoom)) {
      if (allowedRooms.has("pos")) {
        navigateTo("pos");
      } else if (allowedRooms.has("kitchen")) {
        navigateTo("kitchen");
      } else if (allowedRooms.has("admin")) {
        navigateTo("admin");
      } else {
        navigateTo("portal");
      }
    }
  }, [isLoading, user, currentRoom, allowedRooms, navigateTo]);

  // Internal sub-tab state for Front of House (Kasir & Layanan Meja)
  const [fohTab, setFohTab] = useState<FrontOfHouseTab>(() => {
    if (typeof window === "undefined") return "confirm";
    const params = new URLSearchParams(window.location.search);
    if (params.has("confirm") || params.get("tab") === "confirm") return "confirm";
    if (params.has("order")) return "manual-order";
    if (params.has("terminal")) return "terminal";
    if (params.has("serve") || params.has("waiter")) return "serve";
    const tabParam = params.get("tab") as FrontOfHouseTab | null;
    if (tabParam && (["confirm", "serve", "manual-order", "terminal"] as const).includes(tabParam)) return tabParam;
    try {
      const saved = localStorage.getItem("tepisawah_staff_foh_tab") as FrontOfHouseTab | null;
      if (saved && (["confirm", "serve", "manual-order", "terminal"] as const).includes(saved)) return saved;
    } catch {
      // ignore
    }
    return "confirm";
  });

  const handleSelectFohTab = useCallback((tab: FrontOfHouseTab) => {
    setFohTab(tab);
    try {
      localStorage.setItem("tepisawah_staff_foh_tab", tab);
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.replaceState({}, "", url.toString());
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const handleSwitchFohTab = (e: Event) => {
      const customEvent = e as CustomEvent<FrontOfHouseTab>;
      if (customEvent.detail) {
        handleSelectFohTab(customEvent.detail);
      }
    };
    window.addEventListener("tepisawah:switch-foh-tab", handleSwitchFohTab);
    return () => window.removeEventListener("tepisawah:switch-foh-tab", handleSwitchFohTab);
  }, [handleSelectFohTab]);

  const [adminTab, setAdminTab] = useState<AdminTab>(() => {
    if (typeof window === "undefined") return "home";
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab") as AdminTab | null;
    if (tabParam && ADMIN_TABS.some((t) => t.id === tabParam)) return tabParam;
    try {
      const saved = localStorage.getItem("tepisawah_staff_admin_tab") as AdminTab | null;
      if (saved && ADMIN_TABS.some((t) => t.id === saved)) return saved;
    } catch {
      // ignore
    }
    return "home";
  });

  const handleSelectAdminTab = useCallback((tab: AdminTab) => {
    setAdminTab(tab);
    try {
      localStorage.setItem("tepisawah_staff_admin_tab", tab);
      const url = new URL(window.location.href);
      if (tab === "home") {
        url.searchParams.delete("tab");
      } else {
        url.searchParams.set("tab", tab);
      }
      window.history.replaceState({}, "", url.toString());
    } catch {
      // ignore
    }
  }, []);

  const [pendingConfirmCount, setPendingConfirmCount] = useState<number>(0);

  const refreshPendingCount = useCallback(async () => {
    try {
      const res = await loadConfirmationQueue();
      if (res.data) {
        setPendingConfirmCount(res.data.length);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void refreshPendingCount();
  }, [refreshPendingCount]);

  useOrderBoardChannel(getSupabaseClient(), refreshPendingCount);

  const showServeTab = useMemo(() => {
    return (
      roles.includes("waiter") ||
      roles.includes("admin") ||
      roles.includes("owner") ||
      roles.includes("supervisor")
    );
  }, [roles]);

  return (
    <RootLayout currentRoom={currentRoom} onNavigate={navigateTo}>
      <ProtectedRoute>
        {currentRoom === "portal" && (
          <PortalPage onSelectRoom={(appId) => navigateTo(appId as StaffRoom)} />
        )}

        {currentRoom === "pos" && (
          <PermissionRoute permission={PERMISSIONS.ORDERS_READ}>
            {/* Top Subnav Bar for Desktop & Tablet */}
            <div className="staff-subnav-container">
              <div className="staff-subnav-bar">
                <div className="staff-subnav-segmented">
                  <button
                    type="button"
                    className={`staff-subnav-btn ${fohTab === "confirm" ? "staff-subnav-btn--active" : ""}`}
                    onClick={() => handleSelectFohTab("confirm")}
                  >
                    <span>📥 Antrean Masuk (QR)</span>
                    {pendingConfirmCount > 0 && (
                      <span className="staff-subnav-badge" aria-label={`${pendingConfirmCount} antrean menunggu`}>
                        {pendingConfirmCount}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    className={`staff-subnav-btn ${fohTab === "terminal" ? "staff-subnav-btn--active" : ""}`}
                    onClick={() => handleSelectFohTab("terminal")}
                  >
                    <span>💳 Meja Kasir &amp; Bayar</span>
                  </button>

                  {showServeTab && (
                    <button
                      type="button"
                      className={`staff-subnav-btn ${fohTab === "serve" ? "staff-subnav-btn--active" : ""}`}
                      onClick={() => handleSelectFohTab("serve")}
                    >
                      <span>🍽️ Siap Antar ke Meja</span>
                    </button>
                  )}
                </div>

                <div className="staff-subnav-actions">
                  <button
                    type="button"
                    className={`staff-subnav-quick-btn ${fohTab === "manual-order" ? "staff-subnav-quick-btn--active" : ""}`}
                    onClick={() => handleSelectFohTab("manual-order")}
                    title="Catat pesanan tamu langsung dari meja atau kasir"
                  >
                    <span aria-hidden="true">✍️</span>
                    <span>Catat Menu Manual</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="staff-foh-content">
              {fohTab === "confirm" ? (
                <ConfirmQueuePage />
              ) : fohTab === "serve" ? (
                <WaiterHomePage />
              ) : fohTab === "manual-order" ? (
                <PermissionRoute permission={PERMISSIONS.ORDERS_CREATE_MANUAL}>
                  <div className="staff-manual-order-container">
                    <div className="staff-manual-order-bar">
                      <button
                        type="button"
                        className="staff-back-to-terminal-btn"
                        onClick={() => handleSelectFohTab("terminal")}
                      >
                        ← Kembali ke Meja Kasir &amp; Bayar
                      </button>
                      <span className="staff-manual-order-mode-badge">Mode Catat Pesanan Meja / Pelayan</span>
                    </div>
                    <ManualOrderPage />
                  </div>
                </PermissionRoute>
              ) : (
                <PosHomePage onNavigateToConfirm={() => handleSelectFohTab("confirm")} />
              )}
            </div>

            {/* Mobile Thumb-Friendly Bottom Navigation Bar */}
            <nav className="staff-bottom-nav" aria-label="Navigasi Bawah Layanan Kasir & Meja">
              <button
                type="button"
                className={`staff-bottom-nav-item ${fohTab === "confirm" ? "staff-bottom-nav-item--active" : ""}`}
                onClick={() => handleSelectFohTab("confirm")}
              >
                <span className="staff-bottom-nav-icon-wrap">
                  <span className="staff-bottom-nav-icon" aria-hidden="true">📥</span>
                  {pendingConfirmCount > 0 && (
                    <span className="staff-bottom-nav-badge">{pendingConfirmCount}</span>
                  )}
                </span>
                <span className="staff-bottom-nav-label">Antrean</span>
              </button>

              <button
                type="button"
                className={`staff-bottom-nav-item ${fohTab === "terminal" ? "staff-bottom-nav-item--active" : ""}`}
                onClick={() => handleSelectFohTab("terminal")}
              >
                <span className="staff-bottom-nav-icon" aria-hidden="true">💳</span>
                <span className="staff-bottom-nav-label">Kasir</span>
              </button>

              <button
                type="button"
                className={`staff-bottom-nav-item ${fohTab === "manual-order" ? "staff-bottom-nav-item--active" : ""}`}
                onClick={() => handleSelectFohTab("manual-order")}
              >
                <span className="staff-bottom-nav-icon" aria-hidden="true">✍️</span>
                <span className="staff-bottom-nav-label">Catat Menu</span>
              </button>

              {showServeTab && (
                <button
                  type="button"
                  className={`staff-bottom-nav-item ${fohTab === "serve" ? "staff-bottom-nav-item--active" : ""}`}
                  onClick={() => handleSelectFohTab("serve")}
                >
                  <span className="staff-bottom-nav-icon" aria-hidden="true">🍽️</span>
                  <span className="staff-bottom-nav-label">Siap Antar</span>
                </button>
              )}
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
          allowedRooms.has("admin") ? (
            <PermissionRoute permission={PERMISSIONS.SETTINGS_READ}>
              <div className="staff-admin-room">
                <AdminSubnavBar
                  activeTab={adminTab}
                  onSelectTab={handleSelectAdminTab}
                />

                {adminTab === "transactions" ? (
                  <TransactionsLedgerPage />
                ) : adminTab === "staff" ? (
                  <StaffPage />
                ) : adminTab === "reservations" ? (
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
                  <AdminHomePage onNavigate={(tab) => handleSelectAdminTab(tab as AdminTab)} />
                )}
              </div>
            </PermissionRoute>
          ) : (
            <div style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>
              <p>Mengalihkan ke ruangan tugas operasional Anda...</p>
            </div>
          )
        )}
      </ProtectedRoute>
    </RootLayout>
  );
}
