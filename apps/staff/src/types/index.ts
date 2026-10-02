/**
 * App-local type ambient declarations.
 *
 * Vite client types plus the custom public env vars consumed by
 * `src/lib/env.ts`. App-local types live here; types shared across apps belong
 * in @tepisawah/types.
 */
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_DEMO_MODE: string;
  readonly VITE_DEMO_APP_URLS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
