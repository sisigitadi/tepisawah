/**
 * Catalog service (Phase 5).
 *
 * Bridges the admin UI to the @tepisawah/database catalog query layer. Every
 * call rides the RLS-enforced browser client, so a session without
 * catalog.read / catalog.update / categories.manage / modifiers.manage simply
 * receives empty results or an RLS error — the UI can never widen what the
 * database refuses (AUTH_RBAC_RLS.md §2.2).
 *
 * Catalog writes are sensitive (AUTH_RBAC_RLS.md §39): they change what
 * customers may order and at what price. The audit_logs table lands with
 * migration 014, so until then a successful change is recorded through the
 * application logger as a CATALOG_UPDATED event carrying the field-level diff;
 * Phase 14 swaps the logger for the audit writer without changing this shape.
 */
import {
  createCategory,
  createModifier,
  createProduct,
  fetchCategories,
  fetchModifiers,
  fetchProduct,
  fetchProductModifiers,
  fetchProducts,
  saveProductModifiers,
  updateCategory,
  updateModifier,
  updateProduct,
  type CatalogAuditEvent,
  type Category,
  type CategoryInput,
  type Modifier,
  type ModifierInput,
  type Product,
  type ProductInput,
  type ProductModifier,
  type ProductModifierInput,
} from "@tepisawah/database";

import { logger } from "../../lib/logger.js";
import { getSupabaseClient } from "../../lib/supabase.js";
import { isDemoMode } from "../../lib/demo-mode.js";
import {
  demoCategories,
  demoModifiers,
  demoProductModifiers,
  demoProducts,
  demoTimestamp,
} from "../../lib/demo-data.js";

export interface CatalogSnapshot {
  categories: Category[];
  products: Product[];
  modifiers: Modifier[];
}

export interface CatalogSaveResult<T> {
  record: T;
  audit: CatalogAuditEvent | null;
}

export interface LinksSaveResult {
  links: ProductModifier[];
  audit: CatalogAuditEvent[];
}

export type ServiceResult<T> = {
  data: T | null;
  error: string | null;
  fieldErrors: Record<string, string> | null;
};

/** Load the admin view: categories, products and modifiers in one round trip. */
export async function loadCatalog(): Promise<CatalogSnapshot & { error: string | null }> {
  if (isDemoMode()) {
    return {
      categories: demoCategories,
      products: demoProducts,
      modifiers: demoModifiers,
      error: null,
    };
  }

  const client = getSupabaseClient();
  const [categoriesResult, productsResult, modifiersResult] = await Promise.all([
    fetchCategories(client),
    fetchProducts(client),
    fetchModifiers(client),
  ]);

  const failure =
    categoriesResult.error ?? productsResult.error ?? modifiersResult.error;
  if (failure) {
    return { categories: [], products: [], modifiers: [], error: failure.message };
  }

  return {
    categories: categoriesResult.data ?? [],
    products: productsResult.data ?? [],
    modifiers: modifiersResult.data ?? [],
    error: null,
  };
}

/** Load one product with its modifier links (the product editor view). */
export async function loadProductEditor(
  productId: string,
): Promise<{ product: Product | null; links: ProductModifier[]; error: string | null }> {
  if (isDemoMode()) {
    return {
      product: demoProducts.find((product) => product.id === productId) ?? null,
      links: demoProductModifiers.filter((link) => link.productId === productId),
      error: null,
    };
  }

  const client = getSupabaseClient();
  const [productResult, linksResult] = await Promise.all([
    fetchProduct(client, productId),
    fetchProductModifiers(client, productId),
  ]);

  if (productResult.error) {
    return { product: null, links: [], error: productResult.error.message };
  }
  if (linksResult.error) {
    return { product: productResult.data, links: [], error: linksResult.error.message };
  }
  return { product: productResult.data, links: linksResult.data ?? [], error: null };
}

function logAudit(event: CatalogAuditEvent | null): void {
  if (event !== null && event.changedFields.length > 0) {
    logger.info("CATALOG_UPDATED", event);
  }
}

export async function saveCategory(
  id: string | null,
  input: CategoryInput,
  current: Category | null,
): Promise<ServiceResult<CatalogSaveResult<Category>>> {
  if (isDemoMode()) {
    return demoSaveCategory(id, input);
  }

  const client = getSupabaseClient();

  if (id === null) {
    const result = await createCategory(client, input);
    if (result.error || !result.data) {
      return toError(result.error?.message, result.error?.fieldErrors);
    }
    const audit: CatalogAuditEvent = {
      entity: "category",
      action: "create",
      entityId: result.data.id,
      label: result.data.name,
      changedFields: ["name", "description", "sortOrder", "isActive"],
    };
    logger.info("CATALOG_UPDATED", audit);
    return { data: { record: result.data, audit }, error: null, fieldErrors: null };
  }
  if (current === null) {
    return { data: null, error: "Kategori tidak ditemukan.", fieldErrors: null };
  }

  const result = await updateCategory(client, id, input, current);
  if (result.error || !result.data) {
    return toError(result.error?.message, result.error?.fieldErrors);
  }
  logAudit(result.data.audit);
  return { data: { record: result.data.category, audit: result.data.audit }, error: null, fieldErrors: null };
}

export async function saveProduct(
  id: string | null,
  input: ProductInput,
  current: Product | null,
): Promise<ServiceResult<CatalogSaveResult<Product>>> {
  if (isDemoMode()) {
    return demoSaveProduct(id, input);
  }

  const client = getSupabaseClient();

  if (id === null) {
    const result = await createProduct(client, input);
    if (result.error || !result.data) {
      return toError(result.error?.message, result.error?.fieldErrors);
    }
    const audit: CatalogAuditEvent = {
      entity: "product",
      action: "create",
      entityId: result.data.id,
      label: result.data.name,
      changedFields: ["name", "price", "categoryId"],
    };
    logger.info("CATALOG_UPDATED", audit);
    return { data: { record: result.data, audit }, error: null, fieldErrors: null };
  }
  if (current === null) {
    return { data: null, error: "Produk tidak ditemukan.", fieldErrors: null };
  }

  const result = await updateProduct(client, id, input, current);
  if (result.error || !result.data) {
    return toError(result.error?.message, result.error?.fieldErrors);
  }
  logAudit(result.data.audit);
  return { data: { record: result.data.product, audit: result.data.audit }, error: null, fieldErrors: null };
}

export async function saveModifier(
  id: string | null,
  input: ModifierInput,
  current: Modifier | null,
): Promise<ServiceResult<CatalogSaveResult<Modifier>>> {
  if (isDemoMode()) {
    return demoSaveModifier(id, input);
  }

  const client = getSupabaseClient();

  if (id === null) {
    const result = await createModifier(client, input);
    if (result.error || !result.data) {
      return toError(result.error?.message, result.error?.fieldErrors);
    }
    const audit: CatalogAuditEvent = {
      entity: "modifier",
      action: "create",
      entityId: result.data.id,
      label: result.data.name,
      changedFields: ["name", "priceDelta", "isActive"],
    };
    logger.info("CATALOG_UPDATED", audit);
    return { data: { record: result.data, audit }, error: null, fieldErrors: null };
  }
  if (current === null) {
    return { data: null, error: "Modifikasi tidak ditemukan.", fieldErrors: null };
  }

  const result = await updateModifier(client, id, input, current);
  if (result.error || !result.data) {
    return toError(result.error?.message, result.error?.fieldErrors);
  }
  logAudit(result.data.audit);
  return { data: { record: result.data.modifier, audit: result.data.audit }, error: null, fieldErrors: null };
}

/**
 * Replace one product's modifier links. The payload is the whole truth for this
 * product; the query layer unlinks whatever it no longer lists.
 */
export async function saveProductLinks(
  productId: string,
  inputs: readonly ProductModifierInput[],
  current: readonly ProductModifier[],
  modifierNames: ReadonlyMap<string, string>,
): Promise<ServiceResult<LinksSaveResult>> {
  if (isDemoMode()) {
    return demoSaveProductLinks(productId, inputs);
  }

  const client = getSupabaseClient();
  const result = await saveProductModifiers(
    client,
    productId,
    inputs,
    current,
    modifierNames,
  );
  if (result.error || !result.data) {
    return toError(result.error?.message, result.error?.fieldErrors);
  }
  for (const event of result.data.audit) {
    logger.info("CATALOG_UPDATED", event);
  }
  return { data: result.data, error: null, fieldErrors: null };
}

function demoSaveCategory(
  id: string | null,
  input: CategoryInput,
): ServiceResult<CatalogSaveResult<Category>> {
  if (id === null) {
    const record: Category = {
      id: `cat-${Date.now()}`,
      ...input,
      createdAt: demoTimestamp(),
      updatedAt: demoTimestamp(),
    };
    demoCategories.push(record);
    return {
      data: {
        record,
        audit: {
          entity: "category",
          action: "create",
          entityId: record.id,
          label: record.name,
          changedFields: ["name", "description", "sortOrder", "isActive"],
        },
      },
      error: null,
      fieldErrors: null,
    };
  }
  const existing = demoCategories.find((category) => category.id === id);
  if (!existing) {
    return { data: null, error: "Kategori tidak ditemukan.", fieldErrors: null };
  }
  const changedFields = Object.keys(input).filter(
    (field) => input[field as keyof CategoryInput] !== existing[field as keyof Category],
  );
  Object.assign(existing, input, { updatedAt: demoTimestamp() });
  return {
    data: {
      record: existing,
      audit: {
        entity: "category",
        action: "update",
        entityId: existing.id,
        label: existing.name,
        changedFields,
      },
    },
    error: null,
    fieldErrors: null,
  };
}

function demoSaveProduct(
  id: string | null,
  input: ProductInput,
): ServiceResult<CatalogSaveResult<Product>> {
  if (id === null) {
    const record: Product = {
      id: `prod-${Date.now()}`,
      ...input,
      createdAt: demoTimestamp(),
      updatedAt: demoTimestamp(),
    };
    demoProducts.push(record);
    return {
      data: {
        record,
        audit: {
          entity: "product",
          action: "create",
          entityId: record.id,
          label: record.name,
          changedFields: ["name", "price", "categoryId"],
        },
      },
      error: null,
      fieldErrors: null,
    };
  }
  const existing = demoProducts.find((product) => product.id === id);
  if (!existing) {
    return { data: null, error: "Produk tidak ditemukan.", fieldErrors: null };
  }
  const changedFields = Object.keys(input).filter(
    (field) => input[field as keyof ProductInput] !== existing[field as keyof Product],
  );
  Object.assign(existing, input, { updatedAt: demoTimestamp() });
  return {
    data: {
      record: existing,
      audit: {
        entity: "product",
        action: "update",
        entityId: existing.id,
        label: existing.name,
        changedFields,
      },
    },
    error: null,
    fieldErrors: null,
  };
}

function demoSaveModifier(
  id: string | null,
  input: ModifierInput,
): ServiceResult<CatalogSaveResult<Modifier>> {
  if (id === null) {
    const record: Modifier = {
      id: `mod-${Date.now()}`,
      ...input,
      createdAt: demoTimestamp(),
      updatedAt: demoTimestamp(),
    };
    demoModifiers.push(record);
    return {
      data: {
        record,
        audit: {
          entity: "modifier",
          action: "create",
          entityId: record.id,
          label: record.name,
          changedFields: ["name", "priceDelta", "isActive"],
        },
      },
      error: null,
      fieldErrors: null,
    };
  }
  const existing = demoModifiers.find((modifier) => modifier.id === id);
  if (!existing) {
    return { data: null, error: "Modifikasi tidak ditemukan.", fieldErrors: null };
  }
  const changedFields = Object.keys(input).filter(
    (field) => input[field as keyof ModifierInput] !== existing[field as keyof Modifier],
  );
  Object.assign(existing, input, { updatedAt: demoTimestamp() });
  return {
    data: {
      record: existing,
      audit: {
        entity: "modifier",
        action: "update",
        entityId: existing.id,
        label: existing.name,
        changedFields,
      },
    },
    error: null,
    fieldErrors: null,
  };
}

function demoSaveProductLinks(
  productId: string,
  inputs: readonly ProductModifierInput[],
): ServiceResult<LinksSaveResult> {
  for (let index = demoProductModifiers.length - 1; index >= 0; index -= 1) {
    const link = demoProductModifiers[index];
    if (link && link.productId === productId) {
      demoProductModifiers.splice(index, 1);
    }
  }
  const links: ProductModifier[] = inputs.map((input, index) => ({
    productId: input.productId,
    modifierId: input.modifierId,
    isRequired: input.isRequired,
    minSelect: input.minSelect,
    maxSelect: input.maxSelect,
    sortOrder: input.sortOrder,
    createdAt: demoTimestamp(),
  }));
  demoProductModifiers.push(...links);
  return {
    data: {
      links,
      audit: [
        {
          entity: "product_modifier",
          action: "update",
          entityId: productId,
          label: productId,
          changedFields: ["modifierIds"],
        },
      ],
    },
    error: null,
    fieldErrors: null,
  };
}

function toError(
  message: string | undefined,
  fieldErrors: Record<string, string> | undefined,
): ServiceResult<never> {
  return {
    data: null,
    error: message ?? "Operasi katalog gagal.",
    fieldErrors: fieldErrors ?? null,
  };
}
