/**
 * @tepisawah/web — realtime operating-hours status.
 *
 * The restaurant is open 09:00–22:00 WIB (UTC+7) every day. The check runs
 * on mount and on an interval so the badge stays correct on long-lived tabs.
 */
import { useEffect, useState } from "react";

const OPEN_HOUR = 9;
const CLOSE_HOUR = 22;
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
/** Re-check at most once a minute — cheap and matches the reference. */
const CHECK_INTERVAL_MS = 60_000;

export interface OpenStatus {
  /** true while the restaurant is serving right now. */
  isOpen: boolean;
  /** true until the first WIB computation has run. */
  loading: boolean;
}

function computeIsOpen(): boolean {
  const now = new Date();
  const wib = new Date(now.getTime() + WIB_OFFSET_MS);
  const decimal = wib.getUTCHours() + wib.getUTCMinutes() / 60;
  return decimal >= OPEN_HOUR && decimal < CLOSE_HOUR;
}

export function useOpenStatus(): OpenStatus {
  const [isOpen, setIsOpen] = useState<boolean>(() => computeIsOpen());
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    setIsOpen(computeIsOpen());
    setLoading(false);
    const timer = window.setInterval(() => {
      setIsOpen(computeIsOpen());
    }, CHECK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  return { isOpen, loading };
}
