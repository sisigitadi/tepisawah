/**
 * @tepisawah/admin — router composition.
 *
 * Guards stay UX-only — security lives in the backend + RLS; the full route
 * table is composed as feature phases land.
 */
import type { ReactNode } from "react";
import { useState } from "react";
import { RootLayout } from "../../layouts/RootLayout.js";
import { HomePage } from "../../pages/HomePage.js";
import { SettingsPage } from "../../features/settings/index.js";
import { GalleryPage } from "../../features/gallery/GalleryPage.js";
import { CatalogPage } from "../../features/catalog/index.js";
import { TablesPage, QrTablesPage } from "../../features/tables/index.js";
import { SessionsPage } from "../../features/sessions/index.js";

export type AdminPage = "home" | "settings" | "gallery" | "catalog" | "tables" | "sessions" | "qr-tables";

export function AppRouter(): ReactNode {
  const [page, setPage] = useState<AdminPage>("home");

  return (
    <RootLayout
      nav={
        <>
          <button
            type="button"
            className="app-nav-link"
            aria-current={page === "home" ? "page" : undefined}
            onClick={() => setPage("home")}
          >
            Beranda
          </button>
          <button
            type="button"
            className="app-nav-link"
            aria-current={page === "qr-tables" ? "page" : undefined}
            onClick={() => setPage("qr-tables")}
          >
            🖨️ Lihat &amp; Cetak QR Meja
          </button>
          <button
            type="button"
            className="app-nav-link"
            aria-current={page === "settings" ? "page" : undefined}
            onClick={() => setPage("settings")}
          >
            Pengaturan
          </button>
          <button
            type="button"
            className="app-nav-link"
            aria-current={page === "gallery" ? "page" : undefined}
            onClick={() => setPage("gallery")}
          >
            Dokumentasi &amp; Galeri
          </button>
          <button
            type="button"
            className="app-nav-link"
            aria-current={page === "catalog" ? "page" : undefined}
            onClick={() => setPage("catalog")}
          >
            Katalog
          </button>
          <button
            type="button"
            className="app-nav-link"
            aria-current={page === "tables" ? "page" : undefined}
            onClick={() => setPage("tables")}
          >
            Meja
          </button>
          <button
            type="button"
            className="app-nav-link"
            aria-current={page === "sessions" ? "page" : undefined}
            onClick={() => setPage("sessions")}
          >
            Sesi
          </button>
        </>
      }
    >
      {page === "qr-tables" ? (
        <QrTablesPage />
      ) : page === "settings" ? (
        <SettingsPage />
      ) : page === "gallery" ? (
        <GalleryPage />
      ) : page === "catalog" ? (
        <CatalogPage />
      ) : page === "tables" ? (
        <TablesPage />
      ) : page === "sessions" ? (
        <SessionsPage />
      ) : (
        <HomePage />
      )}
    </RootLayout>
  );
}
