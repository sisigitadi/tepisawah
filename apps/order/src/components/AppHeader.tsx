/**
 * @tepisawah/order — application header.
 *
 * Reusable chrome shared across pages; cross-app primitives belong in
 * @tepisawah/ui.
 */
import type { ReactNode } from "react";
import { appOrigin } from "@tepisawah/config";

export function AppHeader(): ReactNode {
  return (
    <header className="order-global-header">
      <div className="order-global-header-inner">
        <a
          href={appOrigin("web")}
          className="order-global-brand"
          title="Ke Halaman Utama Tepi Sawah"
        >
          <span className="order-brand-icon" aria-hidden="true">🌾</span>
          <div className="order-brand-text">
            <span className="order-brand-name">Tepi Sawah</span>
            <span className="order-brand-tag">Pemesanan Mandiri</span>
          </div>
        </a>
        <div className="order-global-nav">
          <a
            href={appOrigin("web")}
            className="order-global-link"
            title="Buka Website Utama Tepi Sawah"
          >
            Web Utama ↗
          </a>
        </div>
      </div>
    </header>
  );
}
