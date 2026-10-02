/**
 * @tepisawah/staff — Vite build configuration.
 *
 * The portal is the single front door to the internal apps, so its dev port
 * (5179) is the one printed staff material and the `/demo` hub point at. The
 * port is overridable per machine via STAFF_PORT in a gitignored .env.local,
 * and strictPort fails loudly if it is taken instead of silently shifting.
 *
 * Each workspace app builds independently:
 *
 *   pnpm --filter @tepisawah/staff build
 */
/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const port = Number(env.STAFF_PORT ?? 5179);

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
    test: {
      environment: "jsdom",
      setupFiles: ["../../tests/setup.ts"],
      include: ["src/**/*.{test,spec}.{ts,tsx}"],
      clearMocks: true,
    },
  };
});
