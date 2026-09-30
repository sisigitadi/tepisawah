/**
 * Settings service (Phase 4).
 *
 * Bridges the admin UI to the @tepisawah/database query layer. Every call rides
 * the RLS-enforced browser client, so a session without settings.read /
 * settings.manage simply receives empty results or an RLS error — the UI can
 * never widen what the database refuses (AUTH_RBAC_RLS.md §2.2).
 *
 * Settings changes are sensitive actions (AUTH_RBAC_RLS.md §39) and must be
 * audited. The audit_logs table lands with migration 014, so until then a
 * successful change is recorded through the application logger as a
 * SETTINGS_UPDATED event carrying the field-level diff; Phase 14 swaps the
 * logger for the audit writer without changing this call shape.
 */
import {
  describeSettingsChange,
  fetchOperatingHours,
  fetchRestaurantSettings,
  saveOperatingHours,
  updateRestaurantSettings,
  type OperatingHours,
  type OperatingHoursInput,
  type RestaurantSettings,
  type RestaurantSettingsInput,
  type SettingsAuditEvent,
} from "@tepisawah/database";

import { logger } from "../../lib/logger.js";
import { getSupabaseClient } from "../../lib/supabase.js";

export interface SettingsSnapshot {
  /** Null until the restaurant is configured (server-side seeded). */
  settings: RestaurantSettings | null;
  hours: OperatingHours[];
}

export interface SettingsSaveResult {
  settings: RestaurantSettings;
  audit: SettingsAuditEvent | null;
}

export interface HoursSaveResult {
  hours: OperatingHours[];
  audit: SettingsAuditEvent[];
}

/** Load the admin view: the configuration row plus the full week schedule. */
export async function loadSettings(): Promise<SettingsSnapshot & { error: string | null }> {
  const client = getSupabaseClient();
  const [settingsResult, hoursResult] = await Promise.all([
    fetchRestaurantSettings(client),
    fetchOperatingHours(client),
  ]);

  if (settingsResult.error) {
    return { settings: null, hours: [], error: settingsResult.error.message };
  }
  if (hoursResult.error) {
    return { settings: settingsResult.data, hours: [], error: hoursResult.error.message };
  }

  return { settings: settingsResult.data, hours: hoursResult.data ?? [], error: null };
}

/**
 * Save the configuration row. Field-level validation runs in the query layer
 * before any network call; a rejected patch surfaces here as `fieldErrors`.
 */
export async function saveSettings(
  id: string,
  input: RestaurantSettingsInput,
): Promise<{ data: SettingsSaveResult | null; error: string | null; fieldErrors: Record<string, string> | null }> {
  const client = getSupabaseClient();
  const before = await fetchRestaurantSettings(client);
  if (before.error) return { data: null, error: before.error.message, fieldErrors: null };
  if (!before.data) return { data: null, error: "Konfigurasi belum ada.", fieldErrors: null };

  const result = await updateRestaurantSettings(client, id, input);
  if (result.error) {
    return { data: null, error: result.error.message, fieldErrors: result.error.fieldErrors ?? null };
  }
  if (!result.data) {
    // No error and no row: the configuration vanished between read and write.
    return { data: null, error: "Konfigurasi belum ada.", fieldErrors: null };
  }

  const audit = describeSettingsChange(before.data, result.data);
  if (audit.changedFields.length > 0) {
    logger.info("SETTINGS_UPDATED", audit);
  }

  return { data: { settings: result.data, audit }, error: null, fieldErrors: null };
}

/** Save the week schedule; the query layer audits every changed day. */
export async function saveHours(
  inputs: readonly OperatingHoursInput[],
  current: readonly OperatingHours[],
): Promise<{ data: HoursSaveResult | null; error: string | null; fieldErrors: Record<string, string> | null }> {
  const client = getSupabaseClient();
  const result = await saveOperatingHours(client, inputs, current);
  if (result.error) {
    return { data: null, error: result.error.message, fieldErrors: result.error.fieldErrors ?? null };
  }
  if (!result.data) {
    return { data: null, error: "Jam operasional belum ada.", fieldErrors: null };
  }
  for (const event of result.data.audit) {
    logger.info("SETTINGS_UPDATED", event);
  }
  return { data: result.data, error: null, fieldErrors: null };
}
