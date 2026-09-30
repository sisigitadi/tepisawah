/**
 * @tepisawah/auth — Supabase auth client, session management and route guards.
 *
 * Barrel import only: `import { useAuth, userHasPermission } from "@tepisawah/auth"`.
 * Deep imports into internal modules are not supported (§43).
 */
export * from "./client.js";
export * from "./session.js";
export * from "./auth-context.js";
export * from "./guards.js";
export * from "./authorization.js";
export * from "./errors.js";
export * from "./profile.js";
export * from "./login-panel.js";
export * from "./access-denied.js";
export * from "./permission-route.js";
