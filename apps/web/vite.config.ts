/**
 * @tepisawah/web — Vite build configuration
 *
 * Phase 0 scaffold: structure and tooling only. Business logic arrives in later
 * phases per docs/architecture/REPOSITORY_STRUCTURE.md.
 */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Each workspace app builds independently:
 *
 *   pnpm --filter @tepisawah/web build
 */
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: false },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime", /^@tepisawah\//],
    },
  },
});
