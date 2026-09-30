/**
 * Restaurant settings type contracts (Phase 4).
 *
 * Canonical field list comes from docs/database/DATABASE_SCHEMA.md §11-§12.
 * No operational value is invented here: tax, service charge, payment
 * provider and promotions stay out of scope until explicitly configured
 * (CLINE_IMPLEMENTATION_PLAN.md §10, API_CONTRACT.md §38).
 */

/** Day of week: 0 = Sunday ... 6 = Saturday (migration 004 part 2). */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** All seven canonical days, in index order. */
export const DAY_OF_WEEKS: readonly DayOfWeek[] = [0, 1, 2, 3, 4, 5, 6];

/** Admin record for `restaurant_settings` (internal; not public-safe). */
export interface RestaurantSettings {
  id: string;
  restaurantName: string;
  address: string;
  phone: string | null;
  email: string | null;
  timezone: string;
  currency: string;
  logoUrl: string | null;
  primaryColor: string | null;
  createdAt: string;
  updatedAt: string;
}

/** One day's schedule from `operating_hours`. */
export interface OperatingHours {
  id: string;
  dayOfWeek: DayOfWeek;
  isClosed: boolean;
  /** `HH:MM:SS` from Postgres `time`, null on closed days. */
  openTime: string | null;
  closeTime: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Client-writable settings patch. The id and timestamps are never accepted
 * from a client; the RLS column GRANT in migration 004 part 1 mirrors this.
 */
export interface RestaurantSettingsInput {
  restaurantName: string;
  address: string;
  phone: string | null;
  email: string | null;
  timezone: string;
  currency: string;
  logoUrl: string | null;
  primaryColor: string | null;
}

/** Client-writable schedule for one day. `dayOfWeek` identifies the row. */
export interface OperatingHoursInput {
  dayOfWeek: DayOfWeek;
  isClosed: boolean;
  openTime: string | null;
  closeTime: string | null;
}

/** Field-keyed validation errors; an empty object means valid. */
export type RestaurantSettingsErrors = Partial<
  Record<keyof RestaurantSettingsInput, string>
>;

export type OperatingHoursErrors = Partial<
  Record<keyof OperatingHoursInput, string>
>;
