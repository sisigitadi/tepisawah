import { useEffect, useState } from "react";
import { getSupabaseClient } from "../lib/supabase.js";

const OPEN_HOUR = 9;
const CLOSE_HOUR = 22;
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
/** Re-check at most once a minute — cheap and keeps badge fresh. */
const CHECK_INTERVAL_MS = 60_000;

export interface OpenStatus {
  /** true while the restaurant is serving right now. */
  isOpen: boolean;
  /** true until the first WIB/DB computation has run. */
  loading: boolean;
}

function computeFallbackIsOpen(): boolean {
  const now = new Date();
  const wib = new Date(now.getTime() + WIB_OFFSET_MS);
  const decimal = wib.getUTCHours() + wib.getUTCMinutes() / 60;
  return decimal >= OPEN_HOUR && decimal < CLOSE_HOUR;
}

export function useOpenStatus(): OpenStatus {
  const [isOpen, setIsOpen] = useState<boolean>(() => computeFallbackIsOpen());
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;

    async function checkStatus() {
      try {
        const client = getSupabaseClient();
        const { data, error } = await client.rpc("is_restaurant_open");
        if (!active) return;
        if (!error && typeof data === "boolean") {
          setIsOpen(data);
        } else {
          setIsOpen(computeFallbackIsOpen());
        }
      } catch {
        if (active) {
          setIsOpen(computeFallbackIsOpen());
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void checkStatus();
    const timer = window.setInterval(() => {
      void checkStatus();
    }, CHECK_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return { isOpen, loading };
}

