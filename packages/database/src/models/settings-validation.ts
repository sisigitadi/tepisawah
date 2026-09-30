/**
 * Settings validation and audit descriptors (Phase 4).
 *
 * Validation is duplicated here on purpose (AUTH_RBAC_RLS.md §47: business
 * validation is not a replacement for RLS, both are required). The database
 * CHECK constraints are the last line of defence; these validators give the
 * caller actionable field errors before a round trip, and stop a tampered
 * client from submitting values the admin form would have rejected.
 *
 * Timezone and currency are validated against the platform's own lists
 * (`Intl.supportedValuesOf`) rather than a hand-written list, so no value is
 * invented or accidentally forbidden here.
 */

import type {
  DayOfWeek,
  OperatingHours,
  OperatingHoursErrors,
  OperatingHoursInput,
  RestaurantSettings,
  RestaurantSettingsErrors,
  RestaurantSettingsInput,
} from "./settings-types.js";

const NAME_MAX = 120;
const ADDRESS_MAX = 500;
const CONTACT_MAX = 40;
const EMAIL_RE = /^[^@\s]+@[^@\s]+$/;
const CURRENCY_RE = /^[A-Z]{3}$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const URL_RE = /^https?:\/\/\S+$/i;
/** `HH:MM` or `HH:MM:SS`, 24-hour, zero-padded. */
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

/** True for a real IANA zone name, decided by the runtime, not by us. */
export function isValidTimezone(value: string): boolean {
  if (!value) return false;
  try {
    // Throws RangeError on an unknown zone.
    void new Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** True for a supported ISO 4217 code. */
export function isValidCurrency(value: string): boolean {
  if (!CURRENCY_RE.test(value)) return false;
  return Intl.supportedValuesOf("currency").includes(value);
}

/** True for a Postgres `time`-shaped string. */
export function isValidTimeOfDay(value: string): boolean {
  return TIME_RE.test(value);
}

/**
 * Validate a settings patch. Trimming is part of validation: a whitespace-only
 * name is empty. Returns the field error map; empty means valid.
 */
export function validateRestaurantSettings(
  input: RestaurantSettingsInput,
): RestaurantSettingsErrors {
  const errors: RestaurantSettingsErrors = {};

  const name = input.restaurantName.trim();
  if (!name) errors.restaurantName = "Nama restoran wajib diisi.";
  else if (name.length > NAME_MAX)
    errors.restaurantName = `Maksimal ${NAME_MAX} karakter.`;

  const address = input.address.trim();
  if (!address) errors.address = "Alamat wajib diisi.";
  else if (address.length > ADDRESS_MAX)
    errors.address = `Maksimal ${ADDRESS_MAX} karakter.`;

  if (input.phone !== null && input.phone.trim() !== "" && input.phone.length > CONTACT_MAX) {
    errors.phone = `Maksimal ${CONTACT_MAX} karakter.`;
  }

  if (input.email !== null && input.email.trim() !== "" && !EMAIL_RE.test(input.email.trim())) {
    errors.email = "Format email tidak valid.";
  }

  if (!isValidTimezone(input.timezone)) {
    errors.timezone = "Zona waktu tidak valid (gunakan nama IANA, mis. Asia/Jakarta).";
  }

  if (!isValidCurrency(input.currency)) {
    errors.currency = "Mata uang tidak valid (kode ISO 4217, mis. IDR).";
  }

  if (input.logoUrl !== null && input.logoUrl.trim() !== "" && !URL_RE.test(input.logoUrl.trim())) {
    errors.logoUrl = "URL logo tidak valid (http atau https).";
  }

  if (input.primaryColor !== null && !COLOR_RE.test(input.primaryColor)) {
    errors.primaryColor = "Warna harus dalam format #RRGGBB.";
  }

  return errors;
}

/**
 * Validate one day's schedule.
 *
 * Consistency mirrors the database constraints exactly: a closed day carries
 * no times, an open day carries both, and the window must not be empty or
 * wrap past midnight. Zero-padded 24-hour strings compare lexicographically.
 */
export function validateOperatingHours(
  input: OperatingHoursInput,
): OperatingHoursErrors {
  const errors: OperatingHoursErrors = {};

  if (
    !Number.isInteger(input.dayOfWeek) ||
    input.dayOfWeek < 0 ||
    input.dayOfWeek > 6
  ) {
    errors.dayOfWeek = "Hari harus 0-6.";
  }

  if (input.isClosed) {
    if (input.openTime !== null || input.closeTime !== null) {
      errors.openTime = "Hari tutup tidak boleh memiliki jam buka.";
      errors.closeTime = "Hari tutup tidak boleh memiliki jam buka.";
    }
    return errors;
  }

  if (input.openTime === null || input.closeTime === null) {
    errors.openTime = "Jam buka dan tutup wajib diisi.";
    errors.closeTime = "Jam buka dan tutup wajib diisi.";
    return errors;
  }

  if (!isValidTimeOfDay(input.openTime)) errors.openTime = "Format jam tidak valid.";
  if (!isValidTimeOfDay(input.closeTime)) errors.closeTime = "Format jam tidak valid.";
  if (isValidTimeOfDay(input.openTime) && isValidTimeOfDay(input.closeTime)) {
    if (input.openTime >= input.closeTime) {
      errors.closeTime = "Jam tutup harus setelah jam buka.";
    }
  }

  return errors;
}

/** True when every day passes validation. */
export function validateOperatingHoursList(
  inputs: readonly OperatingHoursInput[],
): Map<DayOfWeek, OperatingHoursErrors> {
  const all = new Map<DayOfWeek, OperatingHoursErrors>();
  for (const input of inputs) {
    all.set(input.dayOfWeek, validateOperatingHours(input));
  }
  return all;
}

/**
 * Settings change audit descriptor (AUTH_RBAC_RLS.md §39, §40).
 *
 * A settings change is a sensitive action that must generate a
 * `SETTINGS_UPDATED` audit event. The `audit_logs` table lands with migration
 * 014, so this module produces the reviewable event payload today and the
 * Phase 14 audit writer consumes it; nothing is silently dropped.
 */
export interface SettingsAuditEvent {
  action: "SETTINGS_UPDATED";
  entityType: "restaurant_settings" | "operating_hours";
  entityId: string;
  changedFields: string[];
  metadata: Record<string, { from: unknown; to: unknown }>;
}

type WritableSettings = Partial<Record<keyof RestaurantSettingsInput, string | null>>;

/** Diff two admin records into an audit descriptor. */
export function describeSettingsChange(
  before: RestaurantSettings,
  after: RestaurantSettings,
): SettingsAuditEvent {
  const fields: WritableSettings = {
    restaurantName: before.restaurantName,
    address: before.address,
    phone: before.phone,
    email: before.email,
    timezone: before.timezone,
    currency: before.currency,
    logoUrl: before.logoUrl,
    primaryColor: before.primaryColor,
  };

  const changedFields: string[] = [];
  const metadata: SettingsAuditEvent["metadata"] = {};

  (Object.keys(fields) as (keyof WritableSettings)[]).forEach((key) => {
    const from = fields[key] as string | null;
    const to = after[key as keyof RestaurantSettings] as string | null;
    if (from !== to) {
      changedFields.push(key);
      metadata[key] = { from, to };
    }
  });

  return {
    action: "SETTINGS_UPDATED",
    entityType: "restaurant_settings",
    entityId: before.id,
    changedFields,
    metadata,
  };
}

/** Diff one day's schedule into an audit descriptor. */
export function describeOperatingHoursChange(
  before: OperatingHours,
  after: OperatingHours,
): SettingsAuditEvent {
  const changedFields: string[] = [];
  const metadata: SettingsAuditEvent["metadata"] = {};

  if (before.isClosed !== after.isClosed) {
    changedFields.push("isClosed");
    metadata.isClosed = { from: before.isClosed, to: after.isClosed };
  }
  if (before.openTime !== after.openTime) {
    changedFields.push("openTime");
    metadata.openTime = { from: before.openTime, to: after.openTime };
  }
  if (before.closeTime !== after.closeTime) {
    changedFields.push("closeTime");
    metadata.closeTime = { from: before.closeTime, to: after.closeTime };
  }

  return {
    action: "SETTINGS_UPDATED",
    entityType: "operating_hours",
    entityId: before.id,
    changedFields,
    metadata,
  };
}
