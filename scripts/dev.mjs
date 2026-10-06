/**
 * scripts/dev.mjs — run every workspace app's dev server at once.
 *
 *   pnpm dev          (root package.json -> `node scripts/dev.mjs`)
 *
 * Starts one Vite dev server per app in apps/, each with its canonical port
 * (or the *_PORT override from that app's gitignored .env.local, which is how
 * this box moves web from 5173 to 5180), then serves a small hub page that
 * links to all of them with live up/down status:
 *
 *   http://localhost:5170        (override with DEV_HUB_PORT)
 *
 * Ports are pinned with --strictPort so the hub's links stay truthful: if a
 * port is taken the app fails loudly instead of silently drifting elsewhere.
 * Ctrl+C stops the whole stack.
 */

import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HUB_PORT = Number(process.env.DEV_HUB_PORT ?? 5170);

/** id, one-line purpose (hub card copy), canonical dev port. */
const APPS = [
  { id: "web", desc: "Situs publik (tepisawah.id) + showcase /demo", port: 5173 },
  { id: "order", desc: "Pemesanan pelanggan QR meja (order.tepisawah.id)", port: 5174 },
  { id: "staff", desc: "Staff portal terpadu: Kasir, Dapur, Pelayan, Admin (staff.tepisawah.id)", port: 5175 },
];

const COLORS = ["\x1b[36m", "\x1b[32m", "\x1b[33m", "\x1b[35m", "\x1b[34m", "\x1b[31m", "\x1b[90m"];
const RESET = "\x1b[0m";
const color = (i) => `${COLORS[i % COLORS.length]}[${APPS[i].id}...]${RESET} `;

/** Resolve the shared vite binary once; every app uses the root devDependency.
 *  (`vite` exports do not include `./bin/vite.js`, so resolve the package dir.) */
const require = createRequire(import.meta.url);
const viteBin = join(dirname(require.resolve("vite/package.json")), "bin", "vite.js");

/** Canonical port unless the app's gitignored .env.local overrides it (WEB_PORT=5180 on this box). */
function portFor(app) {
  const envLocal = join(ROOT, "apps", app.id, ".env.local");
  if (!existsSync(envLocal)) return app.port;
  const match = readFileSync(envLocal, "utf8").match(/^\s*[A-Z0-9_]*PORT\s*=\s*(\d+)\s*$/m);
  return match ? Number(match[1]) : app.port;
}

const children = new Map(); // id -> ChildProcess
let shuttingDown = false;

function tag(app, port) {
  const c = COLORS[APPS.indexOf(app) % COLORS.length];
  return `${c}[${app.id}:${port}]${RESET}`;
}

function pipe(app, port, stream) {
  let buffer = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) if (line.trim()) console.log(`${tag(app, port)} ${line}`);
  });
  if (buffer.trim()) console.log(`${tag(app, port)} ${buffer}`);
}

function startApp(app, port) {
  const child = spawn(process.execPath, [viteBin, "--host", "--strictPort"], {
    cwd: join(ROOT, "apps", app.id),
    env: { ...process.env, FORCE_COLOR: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.set(app.id, child);
  pipe(app, port, child.stdout);
  pipe(app, port, child.stderr);
  child.on("exit", (code, signal) => {
    if (!shuttingDown) console.log(`${tag(app, port)} exited (code=${code} signal=${signal})`);
    children.delete(app.id);
  });
  return child;
}

/** Vite answers HTTP on 127.0.0.1 once ready; poll until then (or 60s). */
function waitReady(port, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    (function poll() {
      fetch(`http://127.0.0.1:${port}/`, { cache: "no-store" })
        .then((res) => (res.ok ? resolve() : retry()))
        .catch(retry);
      function retry() {
        if (Date.now() > deadline) return reject(new Error(`port ${port} never became ready`));
        setTimeout(poll, 500);
      }
    })();
  });
}

function stopAll() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children.values()) {
    try {
      child.kill();
    } catch {
      /* already gone */
    }
  }
}

function hubHtml() {
  const cards = APPS.map((app) => {
    const port = portFor(app);
    return `      <a class="card" href="http://localhost:${port}/" target="_blank" rel="noreferrer">
        <span class="dot" data-port="${port}"></span>
        <span class="name">${app.id}</span>
        <span class="desc">${app.desc}</span>
        <span class="port">localhost:${port}</span>
      </a>`;
  }).join("\n");

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Tepi Sawah — Dev Hub</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; min-height: 100vh; font-family: system-ui, sans-serif;
         background: #101613; color: #e8efe9; display: grid; place-items: center; padding: 32px; }
  main { width: min(880px, 100%); }
  h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: .04em; }
  h1 span { color: #7fd6a4; }
  p.sub { margin: 0 0 24px; color: #9db3a5; font-size: 14px; }
  .grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
  .card { display: grid; gap: 4px; padding: 16px; border: 1px solid #24312a; border-radius: 12px;
          background: #16201b; color: inherit; text-decoration: none; transition: border-color .15s; }
  .card:hover { border-color: #7fd6a4; }
  .name { font-weight: 700; font-size: 16px; text-transform: uppercase; letter-spacing: .06em; }
  .desc { font-size: 13px; color: #9db3a5; }
  .port { font-size: 12px; color: #6f8a7b; font-family: ui-monospace, monospace; }
  .dot { width: 9px; height: 9px; border-radius: 50%; background: #555; justify-self: end; margin-bottom: -18px; }
  .dot.on { background: #46d17e; box-shadow: 0 0 6px #46d17e; }
  .dot.off { background: #e05252; }
  .demo { margin-top: 20px; font-size: 14px; color: #9db3a5; }
  .demo a { color: #7fd6a4; }
</style>
</head>
<body>
  <main>
    <h1>Tepi Sawah <span>— Dev Hub</span></h1>
    <p class="sub">Tiga surface produksi terpadu. Status diperbarui tiap 5 detik.</p>
    <div class="grid">
${cards}
    </div>
    <div style="margin-top: 18px; padding: 12px 16px; border: 1px solid #24312a; border-radius: 8px; background: #16201b; font-size: 13px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
      <span style="color: #9db3a5; font-weight: 600;">Pintas Ruangan Staf:</span>
      <a href="http://localhost:${portFor(APPS[2])}/pos" target="_blank" rel="noreferrer" style="color: #7fd6a4;">🧾 Kasir (/pos)</a>
      <a href="http://localhost:${portFor(APPS[2])}/kitchen" target="_blank" rel="noreferrer" style="color: #7fd6a4;">👨‍🍳 Dapur (/kitchen)</a>
      <a href="http://localhost:${portFor(APPS[2])}/waiter" target="_blank" rel="noreferrer" style="color: #7fd6a4;">🍽️ Pelayan (/waiter)</a>
      <a href="http://localhost:${portFor(APPS[2])}/admin" target="_blank" rel="noreferrer" style="color: #7fd6a4;">⚙️ Admin (/admin)</a>
    </div>
    <p class="demo">Presentasi satu halaman: <a href="http://localhost:${portFor(APPS[0])}/demo" target="_blank" rel="noreferrer">/demo di web app</a></p>
  </main>
  <script>
    async function ping(dot) {
      try {
        await fetch("http://127.0.0.1:" + dot.dataset.port + "/", { mode: "no-cors", cache: "no-store" });
        dot.className = "dot on";
      } catch {
        dot.className = "dot off";
      }
    }
    const dots = document.querySelectorAll(".dot");
    function tick() { dots.forEach(ping); }
    tick();
    setInterval(tick, 5000);
  </script>
</body>
</html>`;
}

const hub = createServer((_req, res) => {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  res.end(hubHtml());
});

process.on("SIGINT", () => {
  stopAll();
  process.exit(0);
});
process.on("exit", stopAll);

// --- main -------------------------------------------------------------------

console.log("Tepi Sawah dev stack — starting 7 apps…\n");

for (const app of APPS) {
  const port = portFor(app);
  const note = port === app.port ? "" : ` (override dari .env.local)`;
  console.log(`  ${app.id.padEnd(8)} http://localhost:${port}/${note}`);
  startApp(app, port);
}

await new Promise((resolve) => hub.listen(HUB_PORT, "127.0.0.1", resolve));
console.log(`\n  hub      http://localhost:${HUB_PORT}/  ← buka ini untuk navigasi\n`);

const results = await Promise.allSettled(APPS.map((app) => waitReady(portFor(app))));
const down = results.filter((r) => r.status === "rejected");
if (down.length) {
  for (const failure of down) console.error(`\n  ! ${failure.reason?.message ?? failure.reason}`);
} else {
  console.log("  ✓ semua app siap.\n");
}
