/**
 * Tables validation (Phase 6).
 *
 * Validation runs on the client before any write so a rejected patch returns
 * field errors without a round trip (AUTH_RBAC_RLS.md §47 — the client
 * duplicates the database's checks; the database remains the authority and
 * enforces them again in CHECK constraints and the unique indexes from
 * migration 006 part 1).
 *
 * Rules mirror migration 006:
 *   - the code and name are required and never blank-after-trim,
 *   - capacity is null or a non-negative integer,
 *   - status must be one of the five vocabulary values,
 *   - the code is compared case-insensitively, because that is how the
 *     database's unique index treats it.
 */
import type {
  RestaurantTable,
  TableErrors,
  TableInput,
  TableQr,
  TablesAuditEvent,
  TableStatus,
} from "./tables-types.js";
import { TABLE_STATUSES } from "./tables-types.js";

export const MAX_TABLE_CODE_LENGTH = 32;
export const MAX_TABLE_NAME_LENGTH = 100;
export const MAX_CAPACITY = 999;

/** A value is usable only when something remains after trimming. */
export function isBlankValue(value: string | null | undefined): boolean {
  return typeof value !== "string" || value.trim() === "";
}

/** True when the value is one of the five documented statuses. */
const TABLE_STATUS_VALUES: readonly TableStatus[] = TABLE_STATUSES;

export function isValidTableStatus(value: string): value is TableStatus {
  return TABLE_STATUS_VALUES.includes(value as TableStatus);
}

export function validateTable(input: TableInput): TableErrors {
  const errors: TableErrors = {};

  if (isBlankValue(input.tableCode)) {
    errors.tableCode = "Kode meja wajib diisi.";
  } else if (input.tableCode.trim().length > MAX_TABLE_CODE_LENGTH) {
    errors.tableCode = `Kode meja maksimal ${MAX_TABLE_CODE_LENGTH} karakter.`;
  }

  if (isBlankValue(input.name)) {
    errors.name = "Nama meja wajib diisi.";
  } else if (input.name.trim().length > MAX_TABLE_NAME_LENGTH) {
    errors.name = `Nama meja maksimal ${MAX_TABLE_NAME_LENGTH} karakter.`;
  }

  if (input.capacity !== null) {
    if (!Number.isInteger(input.capacity) || input.capacity < 0 || input.capacity > MAX_CAPACITY) {
      errors.capacity = `Kapasitas harus bilangan bulat 0-${MAX_CAPACITY} atau dikosongkan.`;
    }
  }

  if (!isValidTableStatus(input.status)) {
    errors.status = "Status meja tidak valid.";
  }

  if (typeof input.isActive !== "boolean") {
    errors.isActive = "Status aktif wajib diisi.";
  }

  return errors;
}

/**
 * Normalize a code the way the database does (migration 006 part 1 compares it
 * lower-cased and trimmed) so two codes that the database would clash on are
 * caught before the round trip.
 */
export function normalizeTableCode(code: string): string {
  return code.trim().toLowerCase();
}

/**
 * Audit descriptors (AUTH_RBAC_RLS.md §39-§40): table configuration and QR
 * state change where a customer order lands, so each helper turns a
 * before/after pair into a descriptor listing the changed fields for the
 * Phase 14 audit writer.
 */
function compareFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: readonly string[],
): string[] {
  return fields.filter((field) => !isSameValue(before[field], after[field]));
}

function isSameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a === "number" && typeof b === "number") return Object.is(a, b);
  return false;
}

const TABLE_FIELDS = ["tableCode", "name", "capacity", "status", "isActive"] as const;

/** "archive" when the record went inactive, "restore" when it came back. */
function archiveAction(
  before: { isActive: boolean },
  after: { isActive: boolean },
  fallback: string,
): string {
  if (before.isActive && !after.isActive) return "archive";
  if (!before.isActive && after.isActive) return "restore";
  return fallback;
}

export function describeTableChange(
  before: RestaurantTable,
  after: RestaurantTable,
): TablesAuditEvent {
  const changedFields = compareFields(
    before as unknown as Record<string, unknown>,
    after as unknown as Record<string, unknown>,
    TABLE_FIELDS,
  );
  return {
    entity: "table",
    action: archiveAction(before, after, "update"),
    entityId: after.id,
    label: `${after.tableCode} · ${after.name}`,
    changedFields,
  };
}

/** QR mint/retire events. These change which printed stickers still work. */
export function describeQrMint(table: RestaurantTable, token: string): TablesAuditEvent {
  return {
    entity: "table_qr",
    action: "qr_mint",
    entityId: table.id,
    label: `${table.tableCode} · ${afterMask(token)}`,
    changedFields: ["token", "isActive"],
  };
}

export function describeQrRetire(
  table: RestaurantTable,
  qr: TableQr | null,
): TablesAuditEvent | null {
  if (qr === null) return null;
  return {
    entity: "table_qr",
    action: "qr_retire",
    entityId: table.id,
    label: `${table.tableCode} · ${afterMask(qr.token)}`,
    changedFields: ["isActive"],
  };
}

/** The token is a secret; the audit trail keeps only a short, unusable prefix. */
function afterMask(token: string): string {
  const safe = token.slice(0, 6);
  return `${safe}…`;
}
