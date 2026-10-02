/**
 * @tepisawah/web — demo hub page at `/demo`.
 *
 * A single presentation entry point: every staff app in one place, plus the
 * generic role accounts that walk a presenter or reviewer through each
 * workflow. The page only renders on demo deployments (`VITE_DEMO_MODE=true`)
 * — AppRouter falls back to the homepage otherwise, so a production build
 * never surfaces demo credentials (ENVIRONMENT_CONFIG.md §37).
 *
 * App links come from `VITE_DEMO_APP_URLS` (read via `lib/env.ts`) when the
 * deployment sets them (e.g. `pos=https://pos-demo.tepisawah.id,admin=...`).
 * Unset links fall back to the local dev ports, which is how the page stays
 * useful on a workstation.
 */
import type { ReactNode } from "react";

import { DEMO_ACCOUNTS } from "@tepisawah/config";

import { env } from "../lib/env.js";

/** Staff apps a presenter can jump into, in demo order. */
const STAFF_APPS = [
  { id: "pos", name: "Cashier POS", blurb: "Konfirmasi pesanan masuk & proses pembayaran", emoji: "🧾" },
  { id: "admin", name: "Admin Console", blurb: "Kelola katalog, meja, sesi & pengguna", emoji: "⚙️" },
  { id: "waiter", name: "Waiter App", blurb: "Buat pesanan manual & tandai antar", emoji: "🍽️" },
  { id: "kitchen", name: "Kitchen Display", blurb: "Antrian masak: mulai → siap saji", emoji: "👨‍🍳" },
] as const;

/** Local dev port for each app, used when the deployment sets no URL. */
const LOCAL_PORTS: Record<string, number> = {
  pos: 5175,
  admin: 5176,
  waiter: 5177,
  kitchen: 5178,
};

/**
 * Per-app override URLs, `id=url,id=url`. Optional: a hosted demo sets the
 * deployed addresses; a workstation leaves it empty for the local ports.
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

function appUrl(id: string, overrides: Record<string, string>): string {
  return overrides[id] ?? `http://127.0.0.1:${LOCAL_PORTS[id]}`;
}

export function DemoPage(): ReactNode {
  const overrides = parseAppUrls(env.demoAppUrls);

  return (
    <main className="web-main">
      <section className="web-shell web-section demo-hub">
        <div className="web-head-center">
          <span className="web-eyebrow">Mode Presentasi</span>
          <h1 className="web-section-title web-section-title-lg">Demo Tepi Sawah</h1>
          <p className="web-head-center-sub">
            Satu pintu masuk untuk semua aplikasi staf. Klik salah satu untuk
            membuka layar login — kartu peran di sana mengisi kredensial otomatis.
          </p>
        </div>

        <div className="demo-app-grid">
          {STAFF_APPS.map((app) => (
            <a
              key={app.id}
              className="demo-app-card web-panel"
              href={appUrl(app.id, overrides)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="demo-app-emoji" aria-hidden="true">{app.emoji}</span>
              <span className="demo-app-name">{app.name}</span>
              <span className="demo-app-blurb">{app.blurb}</span>
              <span className="demo-app-open">Buka →</span>
            </a>
          ))}
        </div>

        <div className="demo-accounts web-panel web-panel-lg">
          <div className="web-menu-head">
            <div>
              <span className="web-eyebrow">Kredensial Generic</span>
              <h2 className="web-section-title">Akun Demo per Role</h2>
              <p className="web-menu-head-sub">
                Email ini hanya ada di backend demo (staging). Klik kartu peran
                di layar login aplikasi — form terisi otomatis.
              </p>
            </div>
          </div>

          <div className="demo-table-wrap">
            <table className="demo-table">
              <thead>
                <tr>
                  <th scope="col">Role</th>
                  <th scope="col">Email</th>
                  <th scope="col">Password</th>
                  <th scope="col">Alur kerja</th>
                </tr>
              </thead>
              <tbody>
                {DEMO_ACCOUNTS.map((account) => (
                  <tr key={account.role}>
                    <th scope="row" className="demo-role-cell">{account.label}</th>
                    <td className="demo-mono">{account.email}</td>
                    <td className="demo-mono">{account.password}</td>
                    <td className="demo-blurb-cell">{account.blurb}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="demo-note">
            Mode demo diaktifkan via <code>VITE_DEMO_MODE=true</code>. Production
            tidak men-set flag ini, jadi halaman ini dan kartu login tidak pernah
            muncul di deployment production — kode yang sama, tanpa cabang.
          </p>
        </div>

        <div className="demo-back">
          <a className="web-btn web-btn-forest-line" href="/">
            ← Kembali ke beranda
          </a>
        </div>
      </section>
    </main>
  );
}
