/**
 * @tepisawah/pos — Vite build configuration
 *
 * Build + test configuration. Guards are UX-only — security lives in the
 * backend + RLS (docs/security/AUTH_RBAC_RLS.md §2.2).
 */

/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * Each workspace app builds independently:
 *
 *   pnpm --filter @tepisawah/pos build
 */
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: { port: 5175, strictPort: false },
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
});
