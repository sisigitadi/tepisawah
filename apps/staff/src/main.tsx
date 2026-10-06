/**
 * @tepisawah/staff — application entry.
 *
 * The portal is the single front door to the internal apps: it owns staff
 * login and, post-auth, a role-based launcher (docs/product/USER_ROLES.md).
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App.js";
import "./styles/index.css";
import "../../pos/src/styles/index.css";
import "../../kitchen/src/styles/index.css";
import "../../waiter/src/styles/index.css";
import "../../admin/src/styles/index.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root container '#root' not found in index.html");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
