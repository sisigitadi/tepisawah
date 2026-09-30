/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * Build + test configuration for the @tepisawah/auth workspace package.
 *
 * Auth context and guards are authored in TSX, so the React plugin transforms
 * JSX at build time. The React runtime and workspace dependencies stay
 * external so apps resolve them through the pnpm workspace graph.
 *
 * Tests run in the jsdom environment because the package owns React context
 * and the staff login / access-denied screens.
 */
export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
    },
    sourcemap: true,
    emptyOutDir: true,
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime", /^@tepisawah\//],
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["../../tests/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    clearMocks: true,
  },
});
