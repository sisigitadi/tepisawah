/**
 * @tepisawah/pos — public package exports.
 *
 * Exposes the POS terminal views and router for embedding inside the unified
 * Staff Portal (@tepisawah/staff) or standalone execution.
 */
export { App as PosApp } from "./app/App.js";
export { AppRouter as PosRouter } from "./app/router/index.js";
export { HomePage as PosHomePage } from "./pages/HomePage.js";
export { ConfirmQueuePage } from "./features/orders/index.js";
