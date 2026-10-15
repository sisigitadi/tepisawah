/**
 * @tepisawah/web — Vite build configuration
 *
 * Phase 0 scaffold: structure and tooling only. Business logic arrives in later
 * phases per docs/architecture/REPOSITORY_STRUCTURE.md.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

function cmsSyncPlugin(): Plugin {
  const filePath = join(process.cwd(), "public", "landing-content.json");
  return {
    name: "cms-sync-plugin",
    configureServer(server) {
      server.middlewares.use("/api/landing-content", (req, res) => {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");

        if (req.method === "OPTIONS") {
          res.statusCode = 204;
          res.end();
          return;
        }

        if (req.method === "GET") {
          res.setHeader("Content-Type", "application/json");
          if (existsSync(filePath)) {
            res.end(readFileSync(filePath, "utf8"));
          } else {
            res.end(JSON.stringify({}));
          }
          return;
        }

        if (req.method === "POST") {
          let body = "";
          req.on("data", (chunk: Buffer) => {
            body += chunk.toString();
          });
          req.on("end", () => {
            try {
              if (body) {
                writeFileSync(filePath, body, "utf8");
              }
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ success: true }));
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: String(err) }));
            }
          });
          return;
        }

        res.statusCode = 405;
        res.end();
      });
    },
  };
}

/**
 * Each workspace app builds independently:
 *
 *   pnpm --filter @tepisawah/web build
 */
export default defineConfig(({ mode }) => {
  // The dev port is overridable per machine via WEB_PORT in a gitignored
  // .env.local. This box runs another project's Vite on [::1]:5173, which
  // Windows prefers when resolving `localhost`, so it sets WEB_PORT=5180 to
  // keep `localhost` pointing here. strictPort fails loudly if the chosen port
  // is taken instead of silently shifting to a different one.
  const env = loadEnv(mode, process.cwd(), "");
  const port = Number(env.WEB_PORT ?? 5173);

  return {
    plugins: [react(), cmsSyncPlugin()],
    base: "/",
    server: { port, strictPort: true },
    build: {
      outDir: "dist",
      emptyOutDir: true,
      sourcemap: true,
      rollupOptions: {},
    },
  };
});
