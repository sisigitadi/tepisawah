/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";

/**
 * Build + test configuration for the @tepisawah/database workspace package.
 *
 * Packages export an ES module barrel from `src/index.ts`. Workspace
 * dependencies are kept external so consumers resolve them through the
 * pnpm workspace graph rather than bundling a duplicate copy.
 *
 * Model and query tests are pure functions over injected clients, so the
 * default node environment is enough.
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
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    clearMocks: true,
  },
});
