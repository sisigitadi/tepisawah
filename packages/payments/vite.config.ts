import { defineConfig } from "vite";

/**
 * Build configuration for the @tepisawah/payments workspace package.
 *
 * Packages export an ES module barrel from `src/index.ts`. Workspace
 * dependencies are kept external so consumers resolve them through the
 * pnpm workspace graph rather than bundling a duplicate copy.
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
});
