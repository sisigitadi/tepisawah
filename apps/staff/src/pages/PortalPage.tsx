/**
 * @tepisawah/staff — post-login launcher (Production Soft Opening).
 *
 * One screen per signed-in staff member: the internal apps their roles grant,
 * as cards. Consolidated into 3 primary operational surfaces:
 * 1. Kasir & Layanan Meja (pos) — Front of House: confirmation, serving, POS payment, manual order
 * 2. Layar Pesanan Dapur (kitchen) — Back of House: KDS tickets & ready actions
 * 3. Panel Pengelola Restoran (admin) — Management: summary, catalog, tables, CMS, settings
 */
import type { ReactNode } from "react";

import { useAuth } from "@tepisawah/auth";
import type { Role } from "@tepisawah/permissions";

import { env } from "../lib/env.js";

/** The 3 canonical operational apps the portal launches. */
type AppId = "pos" | "admin" | "kitchen";

/** One launchable app, in canonical display order. */
interface PortalApp {
  readonly id: AppId;
  readonly name: string;
  readonly blurb: string;
  readonly emoji: string;
}

const APPS: readonly PortalApp[] = [
  {
    id: "pos",
    name: "Kasir & Layanan Meja",
    blurb: "Konfirmasi pesanan QR meja, catat pesanan manual, hidangan siap saji, dan bayar tagihan",
    emoji: "🧾",
  },
  {
    id: "kitchen",
    name: "Layar Pesanan Dapur",
    blurb: "Antrean masak koki: tiket pesanan masuk → mulai masak → siap saji ke pelayan",
    emoji: "👨‍🍳",
  },
  {
    id: "admin",
    name: "Panel Pengelola Restoran",
    blurb: "Ringkasan operasional, reservasi online, CMS web publik, katalog menu & harga, dan pengaturan",
    emoji: "⚙️",
  },
];

const ROLE_LABELS: Record<string, string> = {
  owner: "Pemilik (Owner)",
  admin: "Pengelola",
  supervisor: "Pengelola",
  cashier: "Kasir",
  waiter: "Pelayan Meja",
  kitchen: "Dapur",
};

/**
 * Consolidated role access for Soft Opening:
 * - Owner / Admin / Supervisor: Akses penuh (Panel Pengelola, Kasir & Meja, Layar Dapur)
 * - Kasir & Waiter (Front of House): Kasir & Layanan Meja terpadu
 * - Dapur (Back of House): Layar Pesanan Dapur
 */
const ROLE_APPS: Record<Role, readonly AppId[]> = {
  owner: ["admin", "pos", "kitchen"],
  admin: ["admin", "pos", "kitchen"],
  supervisor: ["admin", "pos", "kitchen"],
  cashier: ["pos"],
  waiter: ["pos"],
  kitchen: ["kitchen"],
};

/** Local dev port for each app, used when the deployment sets no URL. */
const LOCAL_PORTS: Record<AppId, number> = {
  pos: 5175,
  admin: 5176,
  kitchen: 5178,
};

function parseAppUrls(raw: string): Record<string, string> {
  if (!raw) return {};
  const map: Record<string, string> = {};
  for (const pair of String(raw).split(",")) {
    const [id, url] = pair.split("=");
    if (id && url) map[id.trim()] = url.trim();
  }
  return map;
}

function appUrl(id: AppId, overrides: Record<string, string>): string {
  return overrides[id] ?? `http://127.0.0.1:${LOCAL_PORTS[id]}`;
}

/** Apps the given roles may launch, in canonical display order. */
function visibleApps(roles: readonly Role[]): readonly PortalApp[] {
  const granted = new Set<AppId>();
  for (const role of roles) {
    for (const id of ROLE_APPS[role] ?? []) granted.add(id);
  }
  return APPS.filter((app) => granted.has(app.id));
}

export interface PortalPageProps {
  readonly onSelectRoom?: (appId: AppId) => void;
}

export function PortalPage({ onSelectRoom }: PortalPageProps = {}): ReactNode {
  const { user, profile, roles } = useAuth();
  const overrides = parseAppUrls(env.demoAppUrls);
  const apps = visibleApps(roles);
  const greeting = (profile?.display_name || user?.email || "Staf")
    .replace(/\s*\(Demo\)/gi, "")
    .trim();

  const uniqueRoleLabels = Array.from(
    new Set(roles.map((role) => ROLE_LABELS[role] ?? role))
  );

  return (
    <section className="staff-portal">
      <div className="staff-portal-head">
        <span className="staff-eyebrow">Pintu Masuk Operasional</span>
        <h1 className="staff-title">Selamat datang, {greeting}</h1>
        <p className="staff-sub">
          Akses operasional restoran aktif. Pilih pintu kerja sesuai penugasan Anda.
        </p>
        {uniqueRoleLabels.length ? (
          <ul className="staff-role-chips" aria-label="Peran Anda">
            {uniqueRoleLabels.map((label) => (
              <li key={label} className="staff-role-chip">{label}</li>
            ))}
          </ul>
        ) : null}
      </div>

      {apps.length ? (
        <div className="staff-app-grid">
          {apps.map((app) => (
            <a
              key={app.id}
              className="staff-app-card"
              href={onSelectRoom ? `/${app.id}` : appUrl(app.id, overrides)}
              target={onSelectRoom ? undefined : "_blank"}
              rel={onSelectRoom ? undefined : "noopener noreferrer"}
              onClick={(e) => {
                if (onSelectRoom) {
                  e.preventDefault();
                  onSelectRoom(app.id);
                }
              }}
            >
              <span className="staff-app-emoji" aria-hidden="true">{app.emoji}</span>
              <span className="staff-app-name">{app.name}</span>
              <span className="staff-app-blurb">{app.blurb}</span>
              <span className="staff-app-open">Buka Ruangan</span>
            </a>
          ))}
        </div>
      ) : (
        <p className="staff-empty">
          Peran Anda belum terdaftarkan pada aplikasi internal mana pun. Hubungi
          pemilik atau admin untuk mendapatkan akses operasional.
        </p>
      )}
    </section>
  );
}
