/**
 * Catalog model + validation tests (Phase 5).
 *
 * Layer 2 of docs/qa/TESTING_STRATEGY.md: the field rules that mirror the
 * migration CHECKs, and the mappers that protect the public boundary. The
 * mapper tests assert the security-relevant defaults — a NULL or malformed
 * value never upgrades into a more permissive record (an unreadable price is
 * 0 and flagged, a corrupt modifier group never widens its bounds).
 */
import { describe, expect, it } from "vitest";

import {
  describeCategoryChange,
  describeModifierChange,
  describeProductChange,
  describeProductModifierChange,
  isBlankName,
  selectionSatisfiesBounds,
  validateCategory,
  validateModifier,
  validateProduct,
  validateProductModifier,
} from "./catalog-validation.js";
import {
  toCategory,
  toModifier,
  toOrderItemSnapshot,
  toProduct,
  toProductModifier,
  toPublicCatalogProduct,
  type CategoryRow,
  type ModifierRow,
  type OrderItemSnapshotRow,
  type ProductModifierRow,
  type ProductRow,
  type PublicCatalogRow,
} from "./catalog.js";

const NOW = "2026-01-01T00:00:00Z";

describe("catalog validation", () => {
  describe("validateCategory", () => {
    it("accepts a valid category", () => {
      const errors = validateCategory({
        name: "Menu Utama",
        description: null,
        sortOrder: 10,
        isActive: true,
      });
      expect(errors).toEqual({});
    });

    it("rejects a blank name", () => {
      const errors = validateCategory({ name: "   ", description: null, sortOrder: 0, isActive: true });
      expect(errors.name).toBeDefined();
    });

    it("rejects a negative and non-integer sort order", () => {
      expect(
        validateCategory({ name: "A", description: null, sortOrder: -1, isActive: true }).sortOrder,
      ).toBeDefined();
      expect(
        validateCategory({ name: "A", description: null, sortOrder: 1.5, isActive: true }).sortOrder,
      ).toBeDefined();
    });

    it("rejects an over-long name and description", () => {
      const name = "x".repeat(101);
      const description = "y".repeat(501);
      const errors = validateCategory({ name, description, sortOrder: 0, isActive: true });
      expect(errors.name).toBeDefined();
      expect(errors.description).toBeDefined();
    });
  });

  describe("validateProduct", () => {
    it("accepts a valid product", () => {
      const errors = validateProduct({
        categoryId: "cat-1",
        name: "Nasi Liwet",
        description: null,
        imageUrl: null,
        price: 45000,
        isActive: true,
        isAvailable: true,
        sortOrder: 1,
      });
      expect(errors).toEqual({});
    });

    it("rejects a blank category id", () => {
      const errors = validateProduct({
        categoryId: "",
        name: "Nasi",
        description: null,
        imageUrl: null,
        price: 1000,
        isActive: true,
        isAvailable: true,
        sortOrder: 0,
      });
      expect(errors.categoryId).toBeDefined();
    });

    it("rejects a negative, non-finite and oversized price", () => {
      const base = {
        categoryId: "cat-1",
        name: "Nasi",
        description: null,
        imageUrl: null,
        isActive: true,
        isAvailable: true,
        sortOrder: 0,
      } as const;
      expect(validateProduct({ ...base, price: -1 }).price).toBeDefined();
      expect(validateProduct({ ...base, price: Number.NaN }).price).toBeDefined();
      expect(validateProduct({ ...base, price: Number.POSITIVE_INFINITY }).price).toBeDefined();
      expect(validateProduct({ ...base, price: 100_000_000 }).price).toBeDefined();
    });

    it("accepts a zero price but not a blank name", () => {
      const base = {
        categoryId: "cat-1",
        description: null,
        imageUrl: null,
        price: 0,
        isActive: true,
        isAvailable: true,
        sortOrder: 0,
      } as const;
      expect(validateProduct({ ...base, name: "Nasi" })).toEqual({});
      expect(validateProduct({ ...base, name: "" }).name).toBeDefined();
    });
  });

  describe("validateModifier", () => {
    it("accepts a negative price delta", () => {
      expect(
        validateModifier({ name: "Kecil", description: null, priceDelta: -5000, isActive: true }),
      ).toEqual({});
    });

    it("rejects a blank name", () => {
      expect(
        validateModifier({ name: "", description: null, priceDelta: 0, isActive: true }).name,
      ).toBeDefined();
    });
  });

  describe("validateProductModifier", () => {
    it("accepts valid bounds", () => {
      expect(
        validateProductModifier({
          productId: "p1",
          modifierId: "m1",
          isRequired: true,
          minSelect: 1,
          maxSelect: 1,
          sortOrder: 0,
        }),
      ).toEqual({});
    });

    it("rejects max below min", () => {
      const errors = validateProductModifier({
        productId: "p1",
        modifierId: "m1",
        isRequired: false,
        minSelect: 2,
        maxSelect: 1,
        sortOrder: 0,
      });
      expect(errors.maxSelect).toBeDefined();
    });

    it("rejects a required group with a zero minimum", () => {
      const errors = validateProductModifier({
        productId: "p1",
        modifierId: "m1",
        isRequired: true,
        minSelect: 0,
        maxSelect: 2,
        sortOrder: 0,
      });
      expect(errors.minSelect).toBeDefined();
    });

    it("rejects a zero maximum", () => {
      const errors = validateProductModifier({
        productId: "p1",
        modifierId: "m1",
        isRequired: false,
        minSelect: 0,
        maxSelect: 0,
        sortOrder: 0,
      });
      expect(errors.maxSelect).toBeDefined();
    });

    it("rejects missing ids", () => {
      const errors = validateProductModifier({
        productId: "",
        modifierId: "",
        isRequired: false,
        minSelect: 0,
        maxSelect: 1,
        sortOrder: 0,
      });
      expect(errors.productId).toBeDefined();
      expect(errors.modifierId).toBeDefined();
    });
  });

  describe("helpers", () => {
    it("isBlankName treats only trimmed-empty strings as blank", () => {
      expect(isBlankName("")).toBe(true);
      expect(isBlankName("  ")).toBe(true);
      expect(isBlankName(null)).toBe(true);
      expect(isBlankName(undefined)).toBe(true);
      expect(isBlankName(" x ")).toBe(false);
    });

    it("selectionSatisfiesBounds enforces both ends", () => {
      expect(selectionSatisfiesBounds(1, 1, 1)).toBe(true);
      expect(selectionSatisfiesBounds(2, 0, 3)).toBe(true);
      expect(selectionSatisfiesBounds(0, 1, 1)).toBe(false);
      expect(selectionSatisfiesBounds(4, 0, 3)).toBe(false);
      expect(selectionSatisfiesBounds(-1, 0, 3)).toBe(false);
    });
  });
});

describe("catalog mappers", () => {
  describe("toCategory", () => {
    it("maps a full row", () => {
      const row: CategoryRow = {
        id: "c1",
        name: "Menu Utama",
        description: "Nasi",
        sort_order: 10,
        is_active: true,
        created_at: NOW,
        updated_at: NOW,
      };
      expect(toCategory(row)).toEqual({
        id: "c1",
        name: "Menu Utama",
        description: "Nasi",
        sortOrder: 10,
        isActive: true,
        createdAt: NOW,
        updatedAt: NOW,
      });
    });

    it("fails closed: NULL reads inactive and unsorted, not default-active", () => {
      const category = toCategory({
        id: null,
        name: null,
        description: null,
        sort_order: null,
        is_active: null,
        created_at: null,
        updated_at: null,
      });
      expect(category.id).toBe("");
      expect(category.name).toBe("");
      expect(category.isActive).toBe(false);
      expect(category.sortOrder).toBe(0);
    });
  });

  describe("toProduct", () => {
    it("parses a numeric and string price identically", () => {
      const base: ProductRow = {
        id: "p1",
        category_id: "c1",
        name: "Nasi",
        description: null,
        image_url: null,
        price: 45000,
        is_active: true,
        is_available: true,
        sort_order: 0,
        created_at: NOW,
        updated_at: NOW,
      };
      expect(toProduct(base).price).toBe(45000);
      expect(toProduct({ ...base, price: "45000" }).price).toBe(45000);
      expect(toProduct({ ...base, price: "45000.50" }).price).toBe(45000.5);
    });

    it("reads an unreadable price as 0, never as free", () => {
      const product = toProduct({
        id: "p1",
        category_id: "c1",
        name: "Nasi",
        description: null,
        image_url: null,
        price: null,
        is_active: true,
        is_available: true,
        sort_order: 0,
        created_at: NOW,
        updated_at: NOW,
      });
      expect(product.price).toBe(0);
      expect(product.isActive).toBe(true);
    });
  });

  describe("toModifier", () => {
    it("preserves a signed delta", () => {
      const row: ModifierRow = {
        id: "m1",
        name: "Tambah Nasi",
        description: null,
        price_delta: "-5000",
        is_active: true,
        created_at: NOW,
        updated_at: NOW,
      };
      expect(toModifier(row).priceDelta).toBe(-5000);
    });
  });

  describe("toProductModifier", () => {
    it("fails closed on NULL bounds", () => {
      const link = toProductModifier({
        product_id: null,
        modifier_id: null,
        is_required: null,
        min_select: null,
        max_select: null,
        sort_order: null,
        created_at: null,
      });
      expect(link.productId).toBe("");
      expect(link.isRequired).toBe(false);
      expect(link.minSelect).toBe(0);
      expect(link.maxSelect).toBe(1);
    });
  });

  describe("toPublicCatalogProduct", () => {
    const row = (overrides: Partial<PublicCatalogRow> = {}): PublicCatalogRow => ({
      category_id: "c1",
      category_name: "Menu Utama",
      category_sort: 10,
      product_id: "p1",
      product_name: "Nasi Liwet",
      description: "Khas sawah",
      price: 45000,
      image_url: null,
      is_available: true,
      product_sort: 1,
      modifiers: [],
      ...overrides,
    });

    it("maps a full public row", () => {
      const product = toPublicCatalogProduct(row());
      expect(product).not.toBeNull();
      expect(product?.name).toBe("Nasi Liwet");
      expect(product?.price).toBe(45000);
      expect(product?.modifiers).toEqual([]);
    });

    it("drops a row without an id, name or price", () => {
      expect(toPublicCatalogProduct(row({ product_id: null }))).toBeNull();
      expect(toPublicCatalogProduct(row({ product_name: null }))).toBeNull();
      expect(toPublicCatalogProduct(row({ price: null }))).toBeNull();
    });

    it("maps nested modifier objects", () => {
      const product = toPublicCatalogProduct(
        row({
          modifiers: [
            {
              modifierId: "m1",
              name: "Level Pedas",
              priceDelta: 0,
              isRequired: true,
              minSelect: 1,
              maxSelect: 1,
              sortOrder: 10,
            },
          ],
        }),
      );
      expect(product?.modifiers).toEqual([
        {
          modifierId: "m1",
          name: "Level Pedas",
          priceDelta: 0,
          isRequired: true,
          minSelect: 1,
          maxSelect: 1,
          sortOrder: 10,
        },
      ]);
    });

    it("drops malformed modifier entries instead of widening bounds", () => {
      const product = toPublicCatalogProduct(
        row({
          modifiers: [
            { modifierId: "m1" },
            { name: "NoId" },
            null,
            { modifierId: "m2", name: "Bad", minSelect: 5, maxSelect: 0, priceDelta: "x" },
          ],
        }),
      );
      expect(product?.modifiers.map((modifier) => modifier.modifierId)).toEqual(["m2"]);
      const bad = product?.modifiers[0];
      expect(bad?.priceDelta).toBe(0);
      expect(bad?.maxSelect).toBe(5);
    });
  });

  describe("toOrderItemSnapshot", () => {
    it("maps a resolved snapshot", () => {
      const snapshot = toOrderItemSnapshot({
        product_id: "p1",
        product_name_snapshot: "Nasi Liwet",
        category_id: "c1",
        unit_price_snapshot: 45000,
        quantity: 2,
        modifier_ids: ["m1"],
        modifier_names: ["Tambah Nasi"],
        modifier_deltas: [5000],
        modifiers_subtotal: 5000,
        subtotal: 100000,
      });
      expect(snapshot).not.toBeNull();
      expect(snapshot?.unitPriceSnapshot).toBe(45000);
      expect(snapshot?.subtotal).toBe(100000);
      expect(snapshot?.modifierDeltas).toEqual([5000]);
    });

    it("refuses to build a snapshot without a computed price", () => {
      expect(
        toOrderItemSnapshot({
          product_id: "p1",
          product_name_snapshot: "Nasi",
          category_id: "c1",
          unit_price_snapshot: null,
          quantity: 1,
          modifier_ids: null,
          modifier_names: null,
          modifier_deltas: null,
          modifiers_subtotal: null,
          subtotal: null,
        }),
      ).toBeNull();
      expect(toOrderItemSnapshot(null)).toBeNull();
    });
  });
});

describe("catalog audit descriptors", () => {
  it("reports a changed category field", () => {
    const event = describeCategoryChange(
      { id: "c1", name: "Lama", description: null, sortOrder: 1, isActive: true, createdAt: NOW, updatedAt: NOW },
      { id: "c1", name: "Baru", description: null, sortOrder: 1, isActive: true, createdAt: NOW, updatedAt: NOW },
    );
    expect(event.entity).toBe("category");
    expect(event.changedFields).toEqual(["name"]);
    expect(event.action).toBe("update");
  });

  it("classifies an archival as archive, not update", () => {
    const event = describeCategoryChange(
      { id: "c1", name: "A", description: null, sortOrder: 1, isActive: true, createdAt: NOW, updatedAt: NOW },
      { id: "c1", name: "A", description: null, sortOrder: 1, isActive: false, createdAt: NOW, updatedAt: NOW },
    );
    expect(event.action).toBe("archive");
    expect(event.changedFields).toContain("isActive");
  });

  it("classifies a price change and archival on products", () => {
    const before = {
      id: "p1", categoryId: "c1", name: "Nasi", description: null, imageUrl: null,
      price: 1000, isActive: true, isAvailable: true, sortOrder: 0, createdAt: NOW, updatedAt: NOW,
    };
    expect(describeProductChange(before, { ...before, price: 2000 }).changedFields).toEqual(["price"]);
    expect(describeProductChange(before, { ...before, isActive: false }).action).toBe("archive");
    expect(describeProductChange(before, { ...before, isAvailable: false }).action).toBe("update");
  });

  it("reports modifier and link changes", () => {
    const before = { id: "m1", name: "A", description: null, priceDelta: 0, isActive: true, createdAt: NOW, updatedAt: NOW };
    expect(describeModifierChange(before, { ...before, priceDelta: 500 }).changedFields).toEqual(["priceDelta"]);

    const linkBefore = { productId: "p1", modifierId: "m1", isRequired: false, minSelect: 0, maxSelect: 1, sortOrder: 0, createdAt: NOW };
    const linkAfter = { ...linkBefore, maxSelect: 3 };
    const event = describeProductModifierChange(linkBefore, linkAfter, "Level Pedas");
    expect(event.entity).toBe("product_modifier");
    expect(event.entityId).toBe("p1");
    expect(event.label).toBe("Level Pedas");
    expect(event.changedFields).toEqual(["maxSelect"]);
  });
});
