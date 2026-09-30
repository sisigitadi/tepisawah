/**
 * Settings queries (Phase 4 — Restaurant Configuration).
 *
 * Read and write paths for `restaurant_settings` and `operating_hours`, plus
 * the public projection. All of them ride the RLS-enforced browser client, so
 * RLS answers the six questions from AUTH_RBAC_RLS.md §21 server-side:
 *
 *   - `restaurant_settings`: SELECT needs `settings.read`, UPDATE needs
 *     `settings.manage`; anon has no grant at all (migration 004 part 1).
 *   - `operating_hours`: same permission split, with an INSERT path for
 *     `settings.manage` so an unconfigured day can be created (part 2).
 *   - the public payload comes from the `public_restaurant_settings()` RPC,
 *     a SECURITY DEFINER projection that returns only the customer-safe
 *     fields (API_CONTRACT.md §8.2; AUTH_RBAC_RLS.md §46).
 *
 * Validation runs before any write (AUTH_RBAC_RLS.md §47): a rejected patch
 * returns field errors and never reaches the network. Results never throw —
 * an error degrades to an explicit failure so callers fail closed.
 *
 * Settings changes are sensitive (AUTH_RBAC_RLS.md §39): the admin service
 * layer turns the before/after pair into a `SETTINGS_UPDATED` audit descriptor
 * (see models/settings-validation) for the Phase 14 audit writer.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../generated/index.js";
import {
  describeOperatingHoursChange,
  describeSettingsChange,
  isValidTimeOfDay,
  toOperatingHours,
  toPublicRestaurantSettings,
  toRestaurantSettings,
  validateOperatingHours,
  validateRestaurantSettings,
  type OperatingHours,
  type OperatingHoursErrors,
  type OperatingHoursInput,
  type OperatingHoursRow,
  type PublicRestaurantSettings,
  type PublicSettingsRow,
  type RestaurantSettings,
  type RestaurantSettingsErrors,
  type RestaurantSettingsInput,
  type RestaurantSettingsRow,
  type SettingsAuditEvent,
} from "../models/index.js";

/**
 * Query failure with optional field-keyed validation detail. Field errors are
 * keyed by the input field name, so settings and operating-hours errors share
 * one shape.
 */
export interface SettingsQueryError {
  message: string;
  fieldErrors?: Record<string, string>;
}

/**
 * Flat result: `data` is null whenever `error` is set. Mirrors the shape the
 * other queries in this package already use (see queries/authorization.ts) so
 * callers have one failure-handling pattern.
 */
export interface SettingsQueryResult<T> {
  data: T | null;
  error: SettingsQueryError | null;
}

/**
 * Generated table types are not available in this environment yet (the
 * Supabase CLI is absent, see scripts/generate-types.mjs), so `from(...)`
 * resolves to a `never`-typed builder. Until generation lands, the write
 * chains are typed against this local row-shaped builder; reads cast their
 * rows the way queries/authorization.ts does. Nothing here weakens the runtime
 * contract — the browser client still sends exactly one parameterized query.
 */
interface SupabaseFailure {
  message: string;
  code?: string;
}

interface SelectChain {
  maybeSingle: <T>() => Promise<{ data: T | null; error: SupabaseFailure | null }>;
  single: <T>() => Promise<{ data: T | null; error: SupabaseFailure | null }>;
  order: (
    column: string,
    options?: { ascending?: boolean },
  ) => Promise<{ data: unknown[] | null; error: SupabaseFailure | null }>;
}

interface UntypedTable {
  select: (columns?: string) => SelectChain;
  update: (row: Record<string, string | null>) => {
    eq: (column: string, value: string) => { select: (columns?: string) => SelectChain };
  };
  upsert: (
    rows: Record<string, unknown>[],
    options?: { onConflict?: string },
  ) => { select: (columns?: string) => SelectChain };
}

function untypedTable(client: SupabaseClient<Database>, name: string): UntypedTable {
  return (client as unknown as { from: (table: string) => UntypedTable }).from(name);
}

/** Writeable settings columns, in the column GRANT order from migration 004. */
const SETTINGS_COLUMNS = [
  "restaurant_name",
  "address",
  "phone",
  "email",
  "timezone",
  "currency",
  "logo_url",
  "primary_color",
] as const;

function toRow(input: RestaurantSettingsInput): Record<string, string | null> {
  return {
    restaurant_name: input.restaurantName.trim(),
    address: input.address.trim(),
    phone: input.phone === null ? null : input.phone.trim() || null,
    email: input.email === null ? null : input.email.trim() || null,
    timezone: input.timezone.trim(),
    currency: input.currency.trim().toUpperCase(),
    logo_url: input.logoUrl === null ? null : input.logoUrl.trim() || null,
    primary_color: input.primaryColor,
  };
}

/**
 * Read the restaurant configuration (admin view; requires `settings.read`).
 * Returns `data: null` when the restaurant is not yet configured.
 */
export async function fetchRestaurantSettings(
  client: SupabaseClient<Database>,
): Promise<SettingsQueryResult<RestaurantSettings | null>> {
  const { data, error } = await untypedTable(client, "restaurant_settings")
    .select("*")
    .maybeSingle<RestaurantSettingsRow>();

  if (error) return { data: null, error: { message: error.message } };
  if (!data) return { data: null, error: null };
  return { data: toRestaurantSettings(data), error: null };
}

/**
 * Update the restaurant configuration (requires `settings.manage`).
 *
 * Validates first and returns field errors without a round trip when the patch
 * is invalid. The update is scoped to `id` and returns the resulting row, so
 * the caller can describe the change for audit.
 */
export async function updateRestaurantSettings(
  client: SupabaseClient<Database>,
  id: string,
  input: RestaurantSettingsInput,
): Promise<SettingsQueryResult<RestaurantSettings>> {
  if (!id) return { data: null, error: { message: "Id konfigurasi wajib diisi." } };

  const fieldErrors = validateRestaurantSettings(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      data: null,
      error: { message: "Validasi gagal.", fieldErrors },
    };
  }

  const { data, error } = await untypedTable(client, "restaurant_settings")
    .update(toRow(input))
    .eq("id", id)
    .select("*")
    .single<RestaurantSettingsRow>();

  if (error) return { data: null, error: { message: error.message } };
  if (!data) return { data: null, error: { message: "Konfigurasi tidak ditemukan." } };
  return { data: toRestaurantSettings(data), error: null };
}

/**
 * Read the full week schedule, ordered Sunday-first (requires
 * `settings.read`). Missing days are absent from the array, not synthesised:
 * an unconfigured day is closed, and the UI renders it that way.
 */
export async function fetchOperatingHours(
  client: SupabaseClient<Database>,
): Promise<SettingsQueryResult<OperatingHours[]>> {
  const { data, error } = await untypedTable(client, "operating_hours")
    .select("*")
    .order("day_of_week", { ascending: true });

  if (error) return { data: [], error: { message: error.message } };

  const rows = (data ?? []) as unknown as OperatingHoursRow[];
  return { data: rows.map(toOperatingHours), error: null };
}

/**
 * Save the week schedule in one round trip (requires `settings.manage`).
 *
 * Each day upserts on `day_of_week` — the UNIQUE constraint from migration 004
 * part 2 keeps exactly one schedule per day. Every day is validated first; the
 * first invalid day aborts the whole write so a schedule is never partially
 * applied. Returns the stored rows and one audit descriptor per changed day.
 */
export async function saveOperatingHours(
  client: SupabaseClient<Database>,
  inputs: readonly OperatingHoursInput[],
  current: readonly OperatingHours[],
): Promise<
  SettingsQueryResult<{
    hours: OperatingHours[];
    audit: SettingsAuditEvent[];
  }>
> {
  const fieldErrors = new Map<OperatingHours["dayOfWeek"], OperatingHoursErrors>();
  for (const input of inputs) {
    const errors = validateOperatingHours(input);
    if (Object.keys(errors).length > 0) fieldErrors.set(input.dayOfWeek, errors);
  }
  if (fieldErrors.size > 0) {
    return {
      data: null,
      error: {
        message: "Validasi jam operasional gagal.",
        fieldErrors: fieldErrors.values().next().value,
      },
    };
  }

  const rows = inputs.map((input) => ({
    day_of_week: input.dayOfWeek,
    is_closed: input.isClosed,
    open_time: normalizeTime(input.openTime),
    close_time: normalizeTime(input.closeTime),
  }));

  const { data, error } = await untypedTable(client, "operating_hours")
    .upsert(rows, { onConflict: "day_of_week" })
    .select("*")
    .order("day_of_week", { ascending: true });

  if (error) return { data: null, error: { message: error.message } };

  const stored = (data ?? []) as unknown as OperatingHoursRow[];
  const hours = stored.map(toOperatingHours);

  const audit: SettingsAuditEvent[] = [];
  for (const after of hours) {
    const before = current.find((row) => row.dayOfWeek === after.dayOfWeek);
    if (!before) continue;
    const event = describeOperatingHoursChange(before, after);
    if (event.changedFields.length > 0) audit.push(event);
  }

  return { data: { hours, audit }, error: null };
}

/** `HH:MM` from a time input becomes `HH:MM:SS` for Postgres `time`. */
function normalizeTime(value: string | null): string | null {
  if (value === null) return null;
  if (!isValidTimeOfDay(value)) return null;
  return value.length === 5 ? `${value}:00` : value;
}

/**
 * Public-safe settings for the customer flow (API_CONTRACT.md §8.2).
 *
 * Readable by anonymous callers through the projection RPC: they receive name,
 * timezone, currency and open state only — never address, phone, email, ids or
 * the raw schedule (AUTH_RBAC_RLS.md §17).
 */
export async function fetchPublicRestaurantSettings(
  client: SupabaseClient<Database>,
): Promise<SettingsQueryResult<PublicRestaurantSettings | null>> {
  const { data, error } = await client
    .rpc("public_restaurant_settings")
    .maybeSingle<PublicSettingsRow>();

  if (error) return { data: null, error: { message: error.message } };
  return { data: toPublicRestaurantSettings(data), error: null };
}

/**
 * Ordering availability right now, computed by the database in the
 * restaurant's own timezone. Fails closed: an error or an unconfigured
 * restaurant reads as closed, never open.
 */
export async function fetchRestaurantOpenState(
  client: SupabaseClient<Database>,
): Promise<SettingsQueryResult<boolean>> {
  const { data, error } = await client.rpc("is_restaurant_open");

  if (error) return { data: false, error: { message: error.message } };
  return { data: data === true, error: null };
}

/** Re-exported so the service layer can build audit descriptors. */
export { describeSettingsChange, describeOperatingHoursChange };
