/**
 * @tepisawah/web — Vite build configuration
 *
 * Phase 0 scaffold: structure and tooling only. Business logic arrives in later
 * phases per docs/architecture/REPOSITORY_STRUCTURE.md.
 */

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

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
    plugins: [react()],
    base: "./",
    server: { port, strictPort: true },
    build: {
      outDir: "dist",
      emptyOutDir: true,
      sourcemap: true,
      rollupOptions: {},
    },
  };
});
