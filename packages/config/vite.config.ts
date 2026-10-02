/// <reference types="vitest/config" />
import { defineConfig } from "vite";

/**
 * Build + test configuration for the @tepisawah/config workspace package.
 *
 * Packages export an ES module barrel from `src/index.ts`. Workspace
 * dependencies are kept external so consumers resolve them through the
 * pnpm workspace graph rather than bundling a duplicate copy.
 *
 * Tests run in the node environment: the package is pure configuration logic
 * with no DOM or React surface.
 */
export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
    },
    sourcemap: true,
    emptyOutDir: true,
    rollupOptions: {
      external: /^@tepisawah\//,
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    clearMocks: true,
  },
});
