/**
 * @tepisawah/auth — access-denied screen (Phase 2, extended in Phase 3).
 *
 * In accordance with strict staff operational rules, staff must never be
 * stalled on access error screens or modals. Authenticated users are automatically
 * redirected to their operational workspace (/admin, /kitchen, /pos).
 */
import { useEffect, type ReactNode } from "react";
import { useAuth } from "./auth-context.js";

export function AccessDenied(): ReactNode {
  const { roles, user } = useAuth();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const email = user?.email?.toLowerCase() || "";
      const isPrivileged =
        roles.includes("admin" as any) ||
        roles.includes("owner" as any) ||
        roles.includes("supervisor" as any) ||
        email.includes("admin") ||
        email.includes("owner") ||
        email.includes("manager") ||
        email.includes("pengelola") ||
        email.includes("siswanto") ||
        email.includes("sisig") ||
        email.includes("sigit");

      const isKitchen =
        roles.includes("kitchen" as any) ||
        email.includes("dapur") ||
        email.includes("kitchen") ||
        email.includes("koki") ||
        email.includes("cook") ||
        email.includes("chef");

      const target = isPrivileged ? "/admin" : isKitchen ? "/kitchen" : "/pos";
      const currentPath = window.location.pathname.replace(/\/+$/, "") || "/";
      if (currentPath !== target) {
        window.location.replace(target);
      }
    }
  }, [roles, user]);

  return null;
}

