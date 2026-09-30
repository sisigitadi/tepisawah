/**
 * Catalog view model (Phase 5).
 *
 * Pure mapping between the @tepisawah/database records and the admin form state,
 * plus the loader hook the pages share. Keeping this free of React lets the
 * mappers be unit-tested directly and keeps the pages presentational.
 *
 * A product form starts as a draft: an unsaved product has no id, so the
 * category select defaults to the first category and the toggles default to
 * visible + available — the least surprising state for a new menu item.
 */
import { useCallback, useEffect, useState } from "react";

import type {
  Category,
  Modifier,
  Product,
  ProductModifier,
} from "@tepisawah/database";

export interface CategoryForm {
  name: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
}

export interface ProductForm {
  categoryId: string;
  name: string;
  description: string;
  imageUrl: string;
  price: string;
  isActive: boolean;
  isAvailable: boolean;
  sortOrder: number;
}

export interface ModifierForm {
  name: string;
  description: string;
  priceDelta: string;
  isActive: boolean;
}

export interface LinkRow {
  modifierId: string;
  isRequired: boolean;
  minSelect: string;
  maxSelect: string;
  sortOrder: number;
}

export type LoadStatus = "loading" | "ready" | "error";

export interface LoaderResult {
  status: LoadStatus;
  error: string | null;
  categories: Category[];
  products: Product[];
  modifiers: Modifier[];
}

export const EMPTY_CATEGORY_FORM: CategoryForm = {
  name: "",
  description: "",
  sortOrder: 0,
  isActive: true,
};

export const EMPTY_PRODUCT_FORM: ProductForm = {
  categoryId: "",
  name: "",
  description: "",
  imageUrl: "",
  price: "",
  isActive: true,
  isAvailable: true,
  sortOrder: 0,
};

export const EMPTY_MODIFIER_FORM: ModifierForm = {
  name: "",
  description: "",
  priceDelta: "0",
  isActive: true,
};

export function toCategoryForm(category: Category | null): CategoryForm {
  if (category === null) return { ...EMPTY_CATEGORY_FORM };
  return {
    name: category.name,
    description: category.description ?? "",
    sortOrder: category.sortOrder,
    isActive: category.isActive,
  };
}

export function toCategoryInput(form: CategoryForm): import("@tepisawah/database").CategoryInput {
  return {
    name: form.name,
    description: form.description.trim() === "" ? null : form.description.trim(),
    sortOrder: form.sortOrder,
    isActive: form.isActive,
  };
}

export function toProductForm(
  product: Product | null,
  categories: readonly Category[],
  products: readonly Product[],
): ProductForm {
  if (product === null) {
    return {
      ...EMPTY_PRODUCT_FORM,
      categoryId: categories[0]?.id ?? "",
      sortOrder: nextSortOrder(products.map((entry) => entry.sortOrder)),
    };
  }
  return {
    categoryId: product.categoryId,
    name: product.name,
    description: product.description ?? "",
    imageUrl: product.imageUrl ?? "",
    price: String(product.price),
    isActive: product.isActive,
    isAvailable: product.isAvailable,
    sortOrder: product.sortOrder,
  };
}

export function toProductInput(form: ProductForm): import("@tepisawah/database").ProductInput {
  return {
    categoryId: form.categoryId,
    name: form.name,
    description: form.description.trim() === "" ? null : form.description.trim(),
    imageUrl: form.imageUrl.trim() === "" ? null : form.imageUrl.trim(),
    price: Number.parseInt(form.price, 10) || 0,
    isActive: form.isActive,
    isAvailable: form.isAvailable,
    sortOrder: form.sortOrder,
  };
}

export function toModifierForm(modifier: Modifier | null): ModifierForm {
  if (modifier === null) return { ...EMPTY_MODIFIER_FORM };
  return {
    name: modifier.name,
    description: modifier.description ?? "",
    priceDelta: String(modifier.priceDelta),
    isActive: modifier.isActive,
  };
}

export function toModifierInput(form: ModifierForm): import("@tepisawah/database").ModifierInput {
  return {
    name: form.name,
    description: form.description.trim() === "" ? null : form.description.trim(),
    priceDelta: Number.parseInt(form.priceDelta, 10) || 0,
    isActive: form.isActive,
  };
}

export function toLinkRows(links: readonly ProductModifier[]): LinkRow[] {
  return links.map((link) => ({
    modifierId: link.modifierId,
    isRequired: link.isRequired,
    minSelect: String(link.minSelect),
    maxSelect: String(link.maxSelect),
    sortOrder: link.sortOrder,
  }));
}

export function toLinkInputs(
  productId: string,
  rows: readonly LinkRow[],
): import("@tepisawah/database").ProductModifierInput[] {
  return rows.map((row) => ({
    productId,
    modifierId: row.modifierId,
    isRequired: row.isRequired,
    minSelect: Number.parseInt(row.minSelect, 10) || 0,
    maxSelect: Number.parseInt(row.maxSelect, 10) || 1,
    sortOrder: row.sortOrder,
  }));
}

/** Next sort order after the current maximum, so a new row lands last. */
export function nextSortOrder(values: readonly number[]): number {
  return values.length === 0 ? 0 : Math.max(...values) + 1;
}

/**
 * Shared loader state. `reload` re-runs the loader and `setStatus` lets a page
 * flag a save in flight without a full reload.
 */
export function useCatalogState(loader: () => Promise<LoaderResult>): {
  state: LoaderResult;
  reload: () => void;
  setStatus: (patch: Partial<LoaderResult>) => void;
} {
  const [state, setState] = useState<LoaderResult>({
    status: "loading",
    error: null,
    categories: [],
    products: [],
    modifiers: [],
  });

  const run = useCallback(async () => {
    setState((previous) => ({ ...previous, status: "loading", error: null }));
    const result = await loader();
    setState(result);
  }, [loader]);

  useEffect(() => {
    void run();
  }, [run]);

  return {
    state,
    reload: () => void run(),
    setStatus: (patch) => setState((previous) => ({ ...previous, ...patch })),
  };
}
