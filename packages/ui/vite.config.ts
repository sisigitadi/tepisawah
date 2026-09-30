import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Build configuration for the @tepisawah/ui workspace package.
 *
 * UI primitives are authored in TSX, so the React plugin transforms JSX at
 * build time. The React runtime and workspace dependencies stay external so
 * apps resolve them through the pnpm workspace graph.
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
});
