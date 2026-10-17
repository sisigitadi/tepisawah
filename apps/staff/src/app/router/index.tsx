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
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [showQuickMenu, setShowQuickMenu] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 15);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 15);
  }, []);

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [checkScroll]);

  // Handle Escape key to close quick menu
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && showQuickMenu) {
        setShowQuickMenu(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showQuickMenu]);

  const scrollByAmount = (delta: number) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: delta, behavior: "smooth" });
    }
  };

  // Scroll active tab into view smoothly
  useEffect(() => {
    if (scrollRef.current) {
      const activeBtn = scrollRef.current.querySelector<HTMLElement>(".staff-subnav-btn--active");
      if (activeBtn) {
        activeBtn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
    }
    const timer = setTimeout(checkScroll, 300);
    return () => clearTimeout(timer);
  }, [activeTab, checkScroll]);

  const currentTabMeta: AdminTabDef = ADMIN_TABS.find((t) => t.id === activeTab) ?? {
    id: "home",
    label: "Beranda",
    icon: "📊",
  };

  return (
    <div className="staff-admin-nav-container">
      {/* Top Mobile Quick Row: Current Tab indicator + "Menu Cepat" Button */}
      <div className="staff-admin-quick-header">
        <div className="staff-admin-active-badge">
          <span className="staff-admin-active-icon" aria-hidden="true">{currentTabMeta.icon}</span>
          <span className="staff-admin-active-title">{currentTabMeta.label}</span>
        </div>
        <div className="staff-quick-jump-wrapper">
          <button
            type="button"
            className="staff-quick-jump-trigger"
            onClick={() => setShowQuickMenu((prev) => !prev)}
            aria-expanded={showQuickMenu}
            aria-haspopup="true"
            aria-label="Pilih menu pengelola secara cepat"
          >
            <span>Pilih Menu</span>
            <span className="staff-quick-jump-arrow">{showQuickMenu ? "▲" : "▼"}</span>
          </button>

          {showQuickMenu && (
            <>
              <div
                className="staff-quick-nav-backdrop"
                onClick={() => setShowQuickMenu(false)}
                aria-hidden="true"
              />
              <div className="staff-quick-nav-popover" role="menu">
                <div className="staff-quick-nav-popover-header">
                  Pilih Modul Pengelola
                </div>
                {ADMIN_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="menuitem"
                    className={`staff-quick-nav-item ${activeTab === tab.id ? "staff-quick-nav-item--active" : ""}`}
                    onClick={() => {
                      onSelectTab(tab.id);
                      setShowQuickMenu(false);
                    }}
                  >
                    <span className="staff-quick-nav-icon" aria-hidden="true">{tab.icon}</span>
                    <span className="staff-quick-nav-label">{tab.label}</span>
                    {activeTab === tab.id && <span className="staff-quick-nav-check">✓</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main Tab Scroller with Left & Right Arrow Buttons */}
      <div className="staff-subnav-scroll-wrapper">
        <button
          type="button"
          className={`staff-nav-arrow-btn staff-nav-arrow-btn--left ${canScrollLeft ? "staff-nav-arrow-btn--visible" : ""}`}
          onClick={() => scrollByAmount(-220)}
          aria-label="Geser tab ke kiri"
          title="Geser ke kiri"
        >
          ‹
        </button>

        {canScrollLeft && <div className="staff-subnav-fade-left" aria-hidden="true" />}

        <div
          ref={scrollRef}
          className="staff-subnav-bar"
          onScroll={checkScroll}
          role="tablist"
        >
          {ADMIN_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`staff-subnav-btn ${activeTab === tab.id ? "staff-subnav-btn--active" : ""}`}
              onClick={() => onSelectTab(tab.id)}
            >
              <span className="staff-tab-icon" aria-hidden="true">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {canScrollRight && <div className="staff-subnav-fade-right" aria-hidden="true" />}

        <button
          type="button"
          className={`staff-nav-arrow-btn staff-nav-arrow-btn--right ${canScrollRight ? "staff-nav-arrow-btn--visible" : ""}`}
          onClick={() => scrollByAmount(220)}
          aria-label="Geser tab ke kanan"
          title="Geser ke kanan"
        >
          ›
        </button>
      </div>
    </div>
  );
}

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

  // Smart Route Redirection: if current room is not permitted for the active role,
  // automatically redirect to their primary operational room (e.g. cashier to pos, kitchen to kitchen)
  useEffect(() => {
    if (!user) return;
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
          allowedRooms.has("admin") ? (
            <PermissionRoute permission={PERMISSIONS.SETTINGS_READ}>
              <div className="staff-admin-room">
                <AdminSubnavBar
                  activeTab={adminTab}
                  onSelectTab={(tab) => setAdminTab(tab)}
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
                  <AdminHomePage onNavigate={(tab) => setAdminTab(tab as AdminTab)} />
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
