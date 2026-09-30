import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Root Vite configuration.
 *
 * Workspace apps each ship their own `vite.config.ts` that composes the shared
 * plugins defined here so every app can be built independently:
 *
 *   pnpm --filter @tepisawah/<app> build
 *
 * No app-specific aliases live at the root; package resolution goes through the
 * `@tepisawah/*` workspace packages declared in `pnpm-workspace.yaml`.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
  },
});
