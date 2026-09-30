/**
 * Catalog validation (Phase 5).
 *
 * Validation runs on the client before any write so a rejected patch returns
 * field errors without a round trip (AUTH_RBAC_RLS.md §47 — the client
 * duplicates the database's checks; the database remains the authority and
 * enforces them again in CHECK constraints).
 *
 * Rules mirror the CHECK constraints in migration 005 parts 1-4:
 *   - names are required and never blank-after-trim,
 *   - prices and sort orders are non-negative,
 *   - modifier deltas may be negative,
 *   - selection bounds: minSelect >= 0, maxSelect >= 1, maxSelect >= minSelect,
 *     and a required group implies minSelect >= 1.
 *
 * Nothing here trusts a price from a customer: validation only rejects bad
 * input; the authoritative price is always read server-side (API_CONTRACT.md
 * §27).
 */
import type {
  CatalogAuditEvent,
  Category,
  CategoryErrors,
  CategoryInput,
  Modifier,
  ModifierErrors,
  ModifierInput,
  Product,
  ProductErrors,
  ProductInput,
  ProductModifier,
  ProductModifierErrors,
  ProductModifierInput,
} from "./catalog-types.js";

/** Products must stay orderable in sane quantities (migration 005 part 5). */
export const MIN_PRODUCT_PRICE = 0;
export const MAX_PRODUCT_PRICE = 99_999_999;
export const MAX_SORT_ORDER = 9999;

/** A name is usable only when something remains after trimming. */
export function isBlankName(value: string | null | undefined): boolean {
  return typeof value !== "string" || value.trim() === "";
}

/** True for a finite non-negative number; NaN and Infinity are rejected. */
export function isNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

export function validateCategory(input: CategoryInput): CategoryErrors {
  const errors: CategoryErrors = {};

  if (isBlankName(input.name)) {
    errors.name = "Nama kategori wajib diisi.";
  } else if (input.name.trim().length > 100) {
    errors.name = "Nama kategori maksimal 100 karakter.";
  }

  if (input.description !== null && input.description.trim().length > 500) {
    errors.description = "Deskripsi maksimal 500 karakter.";
  }

  if (!Number.isInteger(input.sortOrder) || input.sortOrder < 0 || input.sortOrder > MAX_SORT_ORDER) {
    errors.sortOrder = `Urutan harus bilangan bulat 0-${MAX_SORT_ORDER}.`;
  }

  if (typeof input.isActive !== "boolean") {
    errors.isActive = "Status aktif wajib diisi.";
  }

  return errors;
}

export function validateProduct(input: ProductInput): ProductErrors {
  const errors: ProductErrors = {};

  if (isBlankName(input.categoryId)) {
    errors.categoryId = "Kategori wajib dipilih.";
  }

  if (isBlankName(input.name)) {
    errors.name = "Nama produk wajib diisi.";
  } else if (input.name.trim().length > 100) {
    errors.name = "Nama produk maksimal 100 karakter.";
  }

  if (input.description !== null && input.description.trim().length > 500) {
    errors.description = "Deskripsi maksimal 500 karakter.";
  }

  if (
    !Number.isFinite(input.price) ||
    input.price < MIN_PRODUCT_PRICE ||
    input.price > MAX_PRODUCT_PRICE
  ) {
    errors.price = `Harga harus berupa angka ${MIN_PRODUCT_PRICE}-${MAX_PRODUCT_PRICE}.`;
  }

  if (typeof input.isActive !== "boolean") {
    errors.isActive = "Status aktif wajib diisi.";
  }

  if (typeof input.isAvailable !== "boolean") {
    errors.isAvailable = "Status ketersediaan wajib diisi.";
  }

  if (!Number.isInteger(input.sortOrder) || input.sortOrder < 0 || input.sortOrder > MAX_SORT_ORDER) {
    errors.sortOrder = `Urutan harus bilangan bulat 0-${MAX_SORT_ORDER}.`;
  }

  return errors;
}

export function validateModifier(input: ModifierInput): ModifierErrors {
  const errors: ModifierErrors = {};

  if (isBlankName(input.name)) {
    errors.name = "Nama modifikasi wajib diisi.";
  } else if (input.name.trim().length > 100) {
    errors.name = "Nama modifikasi maksimal 100 karakter.";
  }

  if (input.description !== null && input.description.trim().length > 500) {
    errors.description = "Deskripsi maksimal 500 karakter.";
  }

  if (
    !Number.isFinite(input.priceDelta) ||
    Math.abs(input.priceDelta) > MAX_PRODUCT_PRICE
  ) {
    errors.priceDelta = "Penyesuaian harga tidak valid.";
  }

  if (typeof input.isActive !== "boolean") {
    errors.isActive = "Status aktif wajib diisi.";
  }

  return errors;
}

/**
 * Validate one product-modifier link. The bounds are the same four CHECKs from
 * migration 005 part 4, so a client cannot describe a group the database would
 * reject: a required group must demand at least one selection, and the maximum
 * can never sit below the minimum.
 */
export function validateProductModifier(input: ProductModifierInput): ProductModifierErrors {
  const errors: ProductModifierErrors = {};

  if (isBlankName(input.productId)) {
    errors.productId = "Produk wajib dipilih.";
  }

  if (isBlankName(input.modifierId)) {
    errors.modifierId = "Modifikasi wajib dipilih.";
  }

  if (!Number.isInteger(input.minSelect) || input.minSelect < 0) {
    errors.minSelect = "Jumlah minimal minimal 0.";
  }

  if (!Number.isInteger(input.maxSelect) || input.maxSelect < 1) {
    errors.maxSelect = "Jumlah maksimal minimal 1.";
  }

  if (
    Number.isInteger(input.minSelect) &&
    Number.isInteger(input.maxSelect) &&
    input.maxSelect < input.minSelect
  ) {
    errors.maxSelect = "Jumlah maksimal tidak boleh kurang dari jumlah minimal.";
  }

  if (input.isRequired && Number.isInteger(input.minSelect) && input.minSelect < 1) {
    errors.minSelect = "Modifikasi wajib memerlukan jumlah minimal 1.";
  }

  if (!Number.isInteger(input.sortOrder) || input.sortOrder < 0 || input.sortOrder > MAX_SORT_ORDER) {
    errors.sortOrder = `Urutan harus bilangan bulat 0-${MAX_SORT_ORDER}.`;
  }

  return errors;
}

/**
 * True when a customer selection honours one group's bounds. Mirrors the loop
 * in `resolve_order_item()` so the UI can pre-validate before submitting.
 */
export function selectionSatisfiesBounds(
  picked: number,
  minSelect: number,
  maxSelect: number,
): boolean {
  if (!Number.isInteger(picked) || picked < 0) return false;
  return picked >= minSelect && picked <= maxSelect;
}

/**
 * Audit descriptors (AUTH_RBAC_RLS.md §39-§40): catalog writes are sensitive
 * because they change what customers may order and at what price. Each helper
 * turns a before/after pair into a descriptor listing the changed fields, so
 * the admin service layer can hand the event to the Phase 14 audit writer.
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
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((entry, index) => isSameValue(entry, b[index]));
  return false;
}

const CATEGORY_FIELDS = ["name", "description", "sortOrder", "isActive"] as const;

/** "archive" when the record went inactive, "restore" when it came back. */
function archiveAction(before: { isActive: boolean }, after: { isActive: boolean }, fallback: string): string {
  if (before.isActive && !after.isActive) return "archive";
  if (!before.isActive && after.isActive) return "restore";
  return fallback;
}

export function describeCategoryChange(before: Category, after: Category): CatalogAuditEvent {
  const changedFields = compareFields(
    before as unknown as Record<string, unknown>,
    after as unknown as Record<string, unknown>,
    CATEGORY_FIELDS,
  );
  return {
    entity: "category",
    action: archiveAction(before, after, "update"),
    entityId: after.id,
    label: after.name,
    changedFields,
  };
}

const PRODUCT_FIELDS = [
  "categoryId",
  "name",
  "description",
  "imageUrl",
  "price",
  "isActive",
  "isAvailable",
  "sortOrder",
] as const;

export function describeProductChange(before: Product, after: Product): CatalogAuditEvent {
  const changedFields = compareFields(
    before as unknown as Record<string, unknown>,
    after as unknown as Record<string, unknown>,
    PRODUCT_FIELDS,
  );
  return {
    entity: "product",
    action: archiveAction(before, after, "update"),
    entityId: after.id,
    label: after.name,
    changedFields,
  };
}

const MODIFIER_FIELDS = ["name", "description", "priceDelta", "isActive"] as const;

export function describeModifierChange(before: Modifier, after: Modifier): CatalogAuditEvent {
  const changedFields = compareFields(
    before as unknown as Record<string, unknown>,
    after as unknown as Record<string, unknown>,
    MODIFIER_FIELDS,
  );
  return {
    entity: "modifier",
    action: archiveAction(before, after, "update"),
    entityId: after.id,
    label: after.name,
    changedFields,
  };
}

const LINK_FIELDS = ["isRequired", "minSelect", "maxSelect", "sortOrder"] as const;

/** A link audit event is keyed by the product, labelled with the modifier. */
export function describeProductModifierChange(
  before: ProductModifier,
  after: ProductModifier,
  modifierName: string,
): CatalogAuditEvent {
  const changedFields = compareFields(
    before as unknown as Record<string, unknown>,
    after as unknown as Record<string, unknown>,
    LINK_FIELDS,
  );
  return {
    entity: "product_modifier",
    action: "link",
    entityId: after.productId,
    label: modifierName,
    changedFields,
  };
}
