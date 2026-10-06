/**
 * @tepisawah/admin — public package exports.
 *
 * Exposes the Admin management views and router for embedding inside the
 * unified Staff Portal (@tepisawah/staff) or standalone execution.
 */
export { App as AdminApp } from "./app/App.js";
export { AppRouter as AdminRouter } from "./app/router/index.js";
export { HomePage as AdminHomePage } from "./pages/HomePage.js";
export { SettingsPage } from "./features/settings/index.js";
export { CatalogPage } from "./features/catalog/index.js";
export { TablesPage } from "./features/tables/index.js";
export { SessionsPage } from "./features/sessions/index.js";
