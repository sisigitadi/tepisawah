/**
 * Restaurant settings and operating hours models (Phase 4).
 *
 * Mirrors migration `004_restaurant_settings` and
 * docs/database/DATABASE_SCHEMA.md §11-§12. Database snake_case rows are
 * mapped to camelCase application records; nullability is preserved so an
 * unreadable column never degrades into a fake value.
 *
 * Public/private boundary (AUTH_RBAC_RLS.md §17, §46): the admin record is
 * internal; {@link PublicRestaurantSettings} is the only customer-safe
 * projection and mirrors the `public_restaurant_settings()` SQL function.
 */
import type { RestaurantSettings, OperatingHours } from "./settings-types.js";

export type { RestaurantSettings, OperatingHours } from "./settings-types.js";

/** Raw `select * from restaurant_settings` shape. */
export interface RestaurantSettingsRow {
  id: string | null;
  restaurant_name: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  timezone: string | null;
  currency: string | null;
  logo_url: string | null;
  primary_color: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/** Raw `select * from operating_hours` shape. */
export interface OperatingHoursRow {
  id: string | null;
  day_of_week: number | null;
  is_closed: boolean | null;
  open_time: string | null;
  close_time: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/** Raw `public_restaurant_settings()` RPC row shape. */
export interface PublicSettingsRow {
  restaurant_name: string | null;
  timezone: string | null;
  currency: string | null;
  is_open: boolean | null;
}

/** The only customer-safe settings projection (API_CONTRACT.md §8.2). */
export interface PublicRestaurantSettings {
  restaurantName: string;
  timezone: string;
  currency: string;
  /** Explicit true only; unconfigured means closed (fail closed). */
  isOpen: boolean;
}

/**
 * Normalize an admin settings row. Required columns fall back to empty
 * strings so a partially unreadable row never yields `undefined` fields.
 */
export function toRestaurantSettings(row: RestaurantSettingsRow): RestaurantSettings {
  return {
    id: row.id ?? "",
    restaurantName: row.restaurant_name ?? "",
    address: row.address ?? "",
    phone: row.phone,
    email: row.email,
    timezone: row.timezone ?? "",
    currency: row.currency ?? "",
    logoUrl: row.logo_url,
    primaryColor: row.primary_color,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
  };
}

/**
 * Normalize one operating-hours row. `is_closed` fails closed: only an
 * explicit `false` means open, so a NULL flag (an unreadable row) reads as
 * closed and availability never opens on data the caller could not verify. A
 * NULL `day_of_week` reads as 0 (Sunday) — the grid key stays stable.
 */
export function toOperatingHours(row: OperatingHoursRow): OperatingHours {
  return {
    id: row.id ?? "",
    dayOfWeek: clampDayOfWeek(row.day_of_week),
    isClosed: row.is_closed !== false,
    openTime: row.open_time,
    closeTime: row.close_time,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
  };
}

function clampDayOfWeek(value: number | null): OperatingHours["dayOfWeek"] {
  if (value === null || value === undefined) return 0;
  if (!Number.isInteger(value) || value < 0 || value > 6) return 0;
  return value as OperatingHours["dayOfWeek"];
}

/**
 * Map the public RPC row. Returns null when there is no configuration row at
 * all — callers must treat that as unconfigured and closed, never as open.
 */
export function toPublicRestaurantSettings(
  row: PublicSettingsRow | null,
): PublicRestaurantSettings | null {
  if (!row) return null;
  if (row.restaurant_name === null || row.timezone === null || row.currency === null) {
    return null;
  }
  return {
    restaurantName: row.restaurant_name,
    timezone: row.timezone,
    currency: row.currency,
    isOpen: row.is_open === true,
  };
}
