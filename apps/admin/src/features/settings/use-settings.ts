/**
 * Settings view model (Phase 4).
 *
 * Owns the load/save state machine for the admin settings page and exposes the
 * editable rows the forms bind to. Time input values travel as "HH:MM"
 * strings on the wire and as 4-digit times inside the model, so the UI never
 * has to reason about timezones; the server is authoritative for the current
 * offset (API_CONTRACT.md §5).
 */
import type {
  DayOfWeek,
  OperatingHours,
  OperatingHoursInput,
  RestaurantSettings,
  RestaurantSettingsInput,
} from "@tepisawah/database";
import { useCallback, useEffect, useState } from "react";

export const DAY_OF_WEEK_LABELS: Record<DayOfWeek, string> = {
  0: "Minggu",
  1: "Senin",
  2: "Selasa",
  3: "Rabu",
  4: "Kamis",
  5: "Jumat",
  6: "Sabtu",
};

export type LoadStatus = "loading" | "ready" | "error";

/**
 * Editable grid row. Carries the full server record so the row doubles as
 * the audit "before" snapshot (timestamps stay at their loaded values while
 * only the schedule fields are edited) and stays fresh after a save.
 */
export interface HoursRow extends OperatingHours {
  openTime: string;
  closeTime: string;
}

export interface SettingsForm {
  restaurantName: string;
  address: string;
  phone: string;
  email: string;
  timezone: string;
  currency: string;
  logoUrl: string;
  primaryColor: string;
}

export function toHoursRows(hours: readonly OperatingHours[]): HoursRow[] {
  return hours.map((row) => ({
    id: row.id,
    dayOfWeek: row.dayOfWeek,
    isClosed: row.isClosed,
    openTime: row.openTime ?? "",
    closeTime: row.closeTime ?? "",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

export function toSettingsForm(settings: RestaurantSettings | null): SettingsForm {
  return {
    restaurantName: settings?.restaurantName ?? "",
    address: settings?.address ?? "",
    phone: settings?.phone ?? "",
    email: settings?.email ?? "",
    timezone: settings?.timezone || "Asia/Jakarta",
    currency: settings?.currency || "IDR",
    logoUrl: settings?.logoUrl ?? "",
    primaryColor: settings?.primaryColor ?? "",
  };
}

export function toSettingsInput(form: SettingsForm): RestaurantSettingsInput {
  return {
    restaurantName: form.restaurantName.trim(),
    address: form.address.trim(),
    phone: form.phone.trim() || null,
    email: form.email.trim() || null,
    timezone: form.timezone.trim() || "Asia/Jakarta",
    currency: form.currency.trim().toUpperCase() || "IDR",
    logoUrl: form.logoUrl.trim() || null,
    primaryColor: form.primaryColor.trim() || null,
  };
}

export function toHoursInputs(rows: readonly HoursRow[]): OperatingHoursInput[] {
  return rows.map((row) => ({
    dayOfWeek: row.dayOfWeek,
    isClosed: row.isClosed,
    openTime: (row.openTime ?? "").trim() || null,
    closeTime: (row.closeTime ?? "").trim() || null,
  }));
}

export interface SettingsState {
  status: LoadStatus;
  error: string | null;
  settings: RestaurantSettings | null;
  rows: HoursRow[];
  saving: boolean;
}

export const EMPTY_SETTINGS_FORM: SettingsForm = {
  restaurantName: "",
  address: "",
  phone: "",
  email: "",
  timezone: "Asia/Jakarta",
  currency: "IDR",
  logoUrl: "",
  primaryColor: "",
};

export interface LoaderResult {
  status: LoadStatus;
  error: string | null;
  settings: RestaurantSettings | null;
  rows: HoursRow[];
}

/** Over-rideable loader; tests swap it to avoid the browser Supabase client. */
export type SettingsLoader = () => Promise<LoaderResult>;

export function useSettingsState(loader: SettingsLoader): {
  state: SettingsState;
  reload: () => void;
  setStatus: (next: Partial<SettingsState>) => void;
} {
  const [state, setState] = useState<SettingsState>({
    status: "loading",
    error: null,
    settings: null,
    rows: [],
    saving: false,
  });

  const load = useCallback(() => {
    let active = true;
    setState((previous) => ({ ...previous, status: "loading", error: null }));
    loader()
      .then((result) => {
        if (!active) return;
        setState({
          status: result.status,
          error: result.error,
          settings: result.settings,
          rows: result.rows,
          saving: false,
        });
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setState({
          status: "error",
          error: cause instanceof Error ? cause.message : "Gagal memuat konfigurasi.",
          settings: null,
          rows: [],
          saving: false,
        });
      });
    return () => {
      active = false;
    };
  }, [loader]);

  useEffect(() => load(), [load]);

  return { state, reload: () => load(), setStatus: (next) => setState((previous) => ({ ...previous, ...next })) };
}
