/**
 * @tepisawah/staff — post-login launcher.
 *
 * One screen per signed-in staff member: the internal apps their roles grant,
 * as cards. The portal is navigation only — every linked app re-runs its own
 * `ProtectedRoute` + `PermissionRoute` on arrival, and the backend enforces the
 * real authorization under RLS, so this map hiding an app never protects it
 * (AUTH_RBAC_RLS.md §2.2). It exists so a staff member sees the one door they
 * actually use instead of four URLs to remember.
 *
 * Which app a role can reach follows the Fase 1 matrix (docs/product/
 * USER_ROLES.md): cashier → POS, waiter → Waiter, kitchen → Kitchen, and the
 * operational roles (supervisor/admin/owner) → POS + Admin. A user holding
 * several roles gets the union.
 *
 * App links come from `VITE_DEMO_APP_URLS` (read via `lib/env.ts`) when the
 * deployment sets them (e.g. `pos=https://pos.tepisawah.id,admin=...`).
 * Unset links fall back to the local dev ports, which is how the portal stays
 * useful on a workstation — the same override contract the `/demo` hub uses.
 */
import type { ReactNode } from "react";
import { useState } from "react";

import { useAuth } from "@tepisawah/auth";
import { DEMO_ACCOUNTS } from "@tepisawah/config";
import type { Role } from "@tepisawah/permissions";

import { env } from "../lib/env.js";

/** The internal apps the portal can launch. */
type AppId = "pos" | "admin" | "waiter" | "kitchen";

/** One launchable app, in canonical display order. */
interface PortalApp {
  readonly id: AppId;
  readonly name: string;
  readonly blurb: string;
  readonly emoji: string;
}

const APPS: readonly PortalApp[] = [
  { id: "pos", name: "Meja Kasir & Pembayaran", blurb: "Konfirmasi pesanan masuk, layanan meja & proses pembayaran", emoji: "🧾" },
  { id: "admin", name: "Panel Pengelola Restoran", blurb: "Kelola katalog, meja & QR, staf, serta laporan bisnis", emoji: "⚙️" },
  { id: "kitchen", name: "Layar Pesanan Dapur", blurb: "Antrean masak dapur: mulai masak → siap saji", emoji: "👨‍🍳" },
  { id: "waiter", name: "Layanan Meja & Antar", blurb: "Monitor hidangan siap saji & pesanan meja manual", emoji: "🍽️" },
];

const ROLE_LABELS: Record<string, string> = {
  owner: "Pemilik (Owner)",
  admin: "Pengelola",
  supervisor: "Pengelola",
  cashier: "Kasir",
  waiter: "Pelayan",
  kitchen: "Dapur",
};

/**
 * Apps each role may launch:
 * - Owner: Akses penuh (Panel Pengelola, Meja Kasir, Layar Dapur, Layanan Meja)
 * - Kasir: Meja Kasir & Layanan Meja
 * - Dapur: Layar Pesanan Dapur
 */
const ROLE_APPS: Record<Role, readonly AppId[]> = {
  owner: ["admin", "pos", "kitchen", "waiter"],
  admin: ["admin", "pos", "kitchen", "waiter"],
  supervisor: ["admin", "pos", "kitchen", "waiter"],
  cashier: ["pos", "waiter"],
  waiter: ["pos", "waiter"],
  kitchen: ["kitchen"],
};

/** Local dev port for each app, used when the deployment sets no URL. */
const LOCAL_PORTS: Record<AppId, number> = {
  pos: 5175,
  admin: 5176,
  waiter: 5177,
  kitchen: 5178,
};

/**
 * Per-app override URLs, `id=url,id=url`. Optional: a hosted deployment sets
 * the deployed addresses; a workstation leaves it empty for the local ports.
 */
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
  const { user, profile, roles, signIn } = useAuth();
  const [switching, setSwitching] = useState(false);
  const overrides = parseAppUrls(env.demoAppUrls);
  const apps = visibleApps(roles);
  const greeting = profile?.display_name || user?.email || "Staf";

  const handleDemoSwitch = async (email: string) => {
    const acc = DEMO_ACCOUNTS.find((a) => a.email === email);
    if (!acc) return;
    setSwitching(true);
    try {
      await signIn(acc.email, acc.password);
    } catch (err) {
      console.error("Gagal berpindah peran demo:", err);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <section className="staff-portal">
      <div className="staff-portal-head">
        <span className="staff-eyebrow">Pintu Masuk Staf</span>
        <h1 className="staff-title">Selamat datang, {greeting}</h1>
        <p className="staff-sub">
          Pilih aplikasi yang kamu butuhkan — aksesnya diatur oleh peranmu.
        </p>
        {roles.length ? (
          <ul className="staff-role-chips" aria-label="Peran Anda">
            {roles.map((role) => (
              <li key={role} className="staff-role-chip">{ROLE_LABELS[role] ?? role}</li>
            ))}
          </ul>
        ) : null}

        {env.demoMode ? (
          <div className="staff-portal-demo-bar">
            <span className="staff-portal-demo-label">Ganti Peran Langsung (Demo):</span>
            <div className="staff-portal-demo-chips">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  disabled={switching}
                  className={`staff-portal-demo-btn ${user?.email === acc.email ? "staff-portal-demo-btn--active" : ""}`}
                  onClick={() => void handleDemoSwitch(acc.email)}
                >
                  {acc.label}
                </button>
              ))}
            </div>
          </div>
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
              <span className="staff-app-open">Buka →</span>
            </a>
          ))}
        </div>
      ) : (
        <p className="staff-empty">
          Peran Anda belum terdaftarkan pada aplikasi internal mana pun. Hubungi
          admin untuk mendapatkan akses.
        </p>
      )}
    </section>
  );
}
