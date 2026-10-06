/**
 * @tepisawah/waiter — public package exports.
 *
 * Exposes the Waiter service console and manual order views for embedding
 * inside the unified Staff Portal (@tepisawah/staff) or standalone execution.
 */
export { App as WaiterApp } from "./app/App.js";
export { AppRouter as WaiterRouter } from "./app/router/index.js";
export { HomePage as WaiterHomePage } from "./pages/HomePage.js";
export { ManualOrderPage } from "./features/manual-order/index.js";
