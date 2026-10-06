/**
 * @tepisawah/pos — terminal chrome.
 *
 * Fixed deep-moss header (logo, live clock, cashier context, live-sync pills)
 * and the operational sidebar nav with the quick-hotkey legend, ported from
 * the Stitch POS reference.
 */

import type { ReactNode } from "react";
import {
  BadgeIcon,
  BellIcon,
  ChartIcon,
  HistoryIcon,
  LogoutIcon,
  ReceiptLongIcon,
  ReportIcon,
  TableIcon,
  TerminalIcon,
  UserIcon,
} from "@tepisawah/ui";

interface NavItem {
  label: string;
  icon: ReactNode;
  active?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Kasir Pembayaran", icon: <TerminalIcon />, active: true },
  { label: "Alur Pesanan", icon: <ReceiptLongIcon /> },
  { label: "Tata Letak Meja", icon: <TableIcon /> },
  { label: "Ringkasan", icon: <ChartIcon /> },
  { label: "Riwayat Transaksi", icon: <HistoryIcon /> },
  { label: "Laporan Harian", icon: <ReportIcon /> },
  { label: "Kas & Giliran Kerja", icon: <BadgeIcon /> },
];

interface TerminalChromeProps {
  children: ReactNode;
  now: string;
}

export function TerminalChrome({ children, now }: TerminalChromeProps): ReactNode {
  return (
    <>
      <header className="pos-header">
        <div className="pos-header__brand">
          <img src="/logo.png" alt="Logo Tepi Sawah" className="pos-header__logo" />
          <span className="pos-header__name">Tepi Sawah</span>
          <span className="pos-header__division">Meja Kasir</span>
        </div>

        <div className="pos-header__context">
          <div className="pos-clock">
            <span className="pos-clock__dot" aria-hidden="true" />
            <span className="pos-clock__text">{now}</span>
          </div>
          <div className="pos-cashier">
            <span className="pos-cashier__dot" aria-hidden="true" />
            <span className="pos-cashier__name">Kasir: Sigit</span>
            <span className="pos-cashier__sep" aria-hidden="true">•</span>
            <span className="pos-cashier__shift">Giliran 1 Pagi — Aktif</span>
          </div>
          <div className="pos-live">
            <span className="pos-live__dot" aria-hidden="true" />
            <span>Dapur: Terhubung</span>
          </div>
          <div className="pos-live">
            <span className="pos-live__dot" aria-hidden="true" />
            <span>Meja: Sinkron</span>
          </div>
        </div>

        <div className="pos-header__actions">
          <button type="button" className="pos-bell" aria-label="Notifikasi kasir">
            <BellIcon />
            <span className="pos-bell__count">3</span>
          </button>
          <div className="pos-avatar" aria-hidden="true">
            <UserIcon />
          </div>
        </div>
      </header>

      <aside className="pos-sidebar" aria-label="Navigasi terminal">
        <nav className="pos-sidebar__nav">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.label}
              href="#"
              className={`pos-nav-item ${item.active ? "pos-nav-item--active" : ""}`}
              aria-current={item.active ? "page" : undefined}
            >
              <span className="pos-nav-item__icon" aria-hidden="true">{item.icon}</span>
              <span className="pos-nav-item__label">{item.label}</span>
            </a>
          ))}
        </nav>

        <div className="pos-hotkeys">
          <div className="pos-hotkeys__title">Pintasan Tombol</div>
          <div className="pos-hotkeys__grid">
            <span><strong className="pos-kbd pos-kbd--go">F1</strong> Cari</span>
            <span><strong className="pos-kbd pos-kbd--go">F2</strong> Baru</span>
            <span><strong className="pos-kbd pos-kbd--go">F3</strong> Bayar</span>
            <span><strong className="pos-kbd pos-kbd--go">F4</strong> Segarkan</span>
            <span className="pos-hotkeys__wide"><strong className="pos-kbd pos-kbd--stop">ESC</strong> Batal</span>
          </div>
          <button type="button" className="pos-shift-close">
            <LogoutIcon />
            <span>Tutup Giliran Kerja</span>
          </button>
        </div>
      </aside>

      <div className="pos-shell__main">
        <main className="pos-main">{children}</main>
      </div>
    </>
  );
}
