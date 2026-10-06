/**
 * @tepisawah/staff — internal room navigation.
 *
 * Manages the active operational room (portal launcher, POS cashier, KDS kitchen,
 * waiter handheld, admin console) within the single Staff Portal application.
 *
 * Resolves room from:
 * 1. URL pathname (/pos, /kitchen, /waiter, /admin)
 * 2. URL search param (?room=pos, etc.)
 * 3. Default: "portal"
 */
import { useEffect, useState, useCallback } from "react";

import type { Role } from "@tepisawah/permissions";

export type StaffRoom = "portal" | "pos" | "kitchen" | "waiter" | "admin";

export const STAFF_ROOMS: readonly StaffRoom[] = [
  "portal",
  "pos",
  "kitchen",
  "waiter",
  "admin",
];

export interface RoomMeta {
  readonly id: StaffRoom;
  readonly label: string;
  readonly path: string;
  readonly emoji: string;
}

export const ROOM_METAS: Record<StaffRoom, RoomMeta> = {
  portal: { id: "portal", label: "Pintu Masuk", path: "/", emoji: "🏠" },
  pos: { id: "pos", label: "Meja Kasir", path: "/pos", emoji: "🧾" },
  kitchen: { id: "kitchen", label: "Layar Dapur", path: "/kitchen", emoji: "👨‍🍳" },
  waiter: { id: "waiter", label: "Pelayan Meja", path: "/waiter", emoji: "🍽️" },
  admin: { id: "admin", label: "Panel Pengelola", path: "/admin", emoji: "⚙️" },
};

/** Rooms that each role may enter in Staff Portal */
export const ROLE_ROOMS: Record<Role, readonly StaffRoom[]> = {
  owner: ["pos", "kitchen", "waiter", "admin"],
  admin: ["pos", "kitchen", "waiter", "admin"],
  supervisor: ["pos", "kitchen", "waiter", "admin"],
  cashier: ["pos", "waiter"],
  waiter: ["pos", "waiter"],
  kitchen: ["kitchen"],
};

export function getAllowedRooms(roles: readonly Role[]): Set<StaffRoom> {
  const allowed = new Set<StaffRoom>(["portal"]);
  for (const role of roles) {
    for (const r of ROLE_ROOMS[role] ?? []) {
      allowed.add(r);
    }
  }
  return allowed;
}

function resolveCurrentRoom(): StaffRoom {
  if (typeof window === "undefined") return "portal";

  const path = window.location.pathname.replace(/^\/+|\/+$/g, "").toLowerCase();
  if (path === "pos") return "pos";
  if (path === "kitchen") return "kitchen";
  if (path === "waiter") return "waiter";
  if (path === "admin") return "admin";

  const searchParam = new URLSearchParams(window.location.search).get("room")?.toLowerCase();
  if (searchParam && (STAFF_ROOMS as readonly string[]).includes(searchParam)) {
    return searchParam as StaffRoom;
  }

  return "portal";
}

export function useStaffNavigation() {
  const [currentRoom, setCurrentRoom] = useState<StaffRoom>(resolveCurrentRoom);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentRoom(resolveCurrentRoom());
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigateTo = useCallback((room: StaffRoom, search = "") => {
    const targetPath = room === "portal" ? "/" : `/${room}`;
    const fullPath = search ? `${targetPath}?${search}` : targetPath;
    window.history.pushState({}, "", fullPath);
    setCurrentRoom(room);
  }, []);

  return {
    currentRoom,
    navigateTo,
  };
}
