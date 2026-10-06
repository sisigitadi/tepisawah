/**
 * Cart selector tests (Phase 4).
 *
 * The basket is projected through pure functions, so the suite covers them
 * directly (TESTING_STRATEGY.md Layer 1): catalog order, display money, and the
 * intent-only checkout contract.
 *
 * The security assertion is the one that matters most: a checkout line carries
 * no money field, so the request the customer's browser builds cannot carry a
 * price even by mistake (API_CONTRACT.md §10.1, §27).
 */
import { describe, expect, it } from "vitest";

import {
  cartItemCount,
  cartTotalPrice,
  clampNote,
  clampQuantity,
  decrementEntry,
  incrementEntry,
  isCartEmpty,
  removeEntry,
  resolveCartEntries,
  resolveCartLines,
  setEntryModifiers,
  setEntryNote,
  toCheckoutLines,
} from "./selectors.js";
import type {
  CartMap,
  PublicCatalogModifier,
  PublicCatalogProduct,
} from "./types.js";

/** A modifier row the catalog projection would return. */
function modifier(
  overrides: Partial<PublicCatalogModifier> = {},
): PublicCatalogModifier {
  return {
    modifierId: "m-x",
    name: "Pilihan",
    priceDelta: 0,
    isRequired: false,
    minSelect: 0,
    maxSelect: 1,
    sortOrder: 0,
    ...overrides,
  };
}

function product(
  overrides: Partial<PublicCatalogProduct> = {},
): PublicCatalogProduct {
  return {
    categoryId: "c-main",
    categoryName: "Menu Utama",
    categorySortOrder: 1,
    productId: "p-x",
    name: "Menu",
    description: null,
    price: 10000,
    imageUrl: null,
    isAvailable: true,
    sortOrder: 0,
    modifiers: [],
    ...overrides,
  };
}

const PRODUCTS: PublicCatalogProduct[] = [
  product({
    productId: "p-1",
    name: "Nasi Liwet",
    description: "Nasi liwet khas Tasikmalaya",
    price: 25000,
  }),
  product({
    productId: "p-2",
    name: "Ayam Bakar",
    description: "Ayam bakar bambu",
    price: 30000,
    imageUrl: "https://example.com/ayam.jpg",
    sortOrder: 1,
    modifiers: [
      modifier({
        modifierId: "m-spicy",
        name: "Pedas Sedang",
        priceDelta: 2000,
        isRequired: true,
      }),
      modifier({
        modifierId: "m-rice",
        name: "Nasi Tambah",
        priceDelta: 5000,
      }),
    ],
  }),
  product({
    productId: "p-9",
    name: "Gorengan",
    description: "Gorengan byar",
    price: 5000,
    isAvailable: false,
    categoryId: "c-snack",
    categoryName: "Camilan",
  }),
];

describe("resolveCartLines", () => {
  it("lists the basket in catalog order with display-only money", () => {
    const cart: CartMap = {
      "p-2": { quantity: 2, modifierIds: ["m-spicy"], notes: null },
      "p-1": { quantity: 1, modifierIds: [], notes: null },
    };

    const lines = resolveCartLines(cart, PRODUCTS);

    expect(lines.map((line) => line.productId)).toEqual(["p-1", "p-2"]);
    expect(lines[1]).toEqual({
      productId: "p-2",
      name: "Ayam Bakar",
      quantity: 2,
      modifierNames: ["Pedas Sedang"],
      notes: null,
      unitPrice: 32000,
      lineTotal: 64000,
      imageUrl: "https://example.com/ayam.jpg",
    });
  });

  it("sums every chosen modifier's delta into the line total", () => {
    const cart: CartMap = {
      "p-2": { quantity: 3, modifierIds: ["m-spicy", "m-rice"], notes: null },
    };

    const [line] = resolveCartLines(cart, PRODUCTS);

    expect(line?.unitPrice).toBe(37000);
    expect(line?.lineTotal).toBe(111000);
  });

  it("normalizes notes and drops whitespace-only ones", () => {
    const cart: CartMap = {
      "p-1": { quantity: 1, modifierIds: [], notes: "  tanpa bawang  " },
      "p-2": { quantity: 1, modifierIds: [], notes: "   " },
    };

    const lines = resolveCartLines(cart, PRODUCTS);

    expect(lines[0]?.notes).toBe("tanpa bawang");
    expect(lines[1]?.notes).toBe(null);
  });

  it("drops a product the catalog no longer lists and a zero-quantity entry", () => {
    const cart: CartMap = {
      "p-1": { quantity: 1, modifierIds: [], notes: null },
      "p-retired": { quantity: 5, modifierIds: [], notes: null },
      // A modifier chosen on a card the customer never added to the basket.
      "p-9": { quantity: 0, modifierIds: [], notes: null },
    };

    const lines = resolveCartLines(cart, PRODUCTS);

    expect(lines.map((line) => line.productId)).toEqual(["p-1"]);
  });
});

describe("toCheckoutLines", () => {
  it("emits references and intent only — no money field can exist", () => {
    const cart: CartMap = {
      "p-2": { quantity: 2, modifierIds: ["m-spicy"], notes: "pedas banget" },
    };

    const lines = toCheckoutLines(cart, PRODUCTS);

    expect(lines).toHaveLength(1);
    const moneyKeys = Object.keys(lines[0] ?? {}).filter((key) =>
      ["price", "unitPrice", "lineTotal", "subtotal", "total", "amount"].includes(key),
    );
    expect(moneyKeys).toEqual([]);
    expect(lines[0]).toEqual({
      productId: "p-2",
      quantity: 2,
      modifierIds: ["m-spicy"],
      notes: "pedas banget",
    });
  });

  it("does not mutate the basket's modifier array", () => {
    const cart: CartMap = {
      "p-2": { quantity: 1, modifierIds: ["m-spicy"], notes: null },
    };

    const [line] = toCheckoutLines(cart, PRODUCTS);

    expect(line?.modifierIds).not.toBe(cart["p-2"]?.modifierIds);
    expect(line?.modifierIds).toEqual(["m-spicy"]);
  });
});

describe("resolveCartEntries", () => {
  it("pairs each checkout line with its catalog name", () => {
    const cart: CartMap = {
      "p-2": { quantity: 2, modifierIds: ["m-spicy"], notes: null },
    };

    const [entry] = resolveCartEntries(cart, PRODUCTS);

    expect(entry).toMatchObject({
      productId: "p-2",
      name: "Ayam Bakar",
      quantity: 2,
      modifierIds: ["m-spicy"],
    });
    // A name is the only non-intent field, and it is display-only.
    expect(Object.keys(entry ?? {})).toEqual(["productId", "quantity", "modifierIds", "notes", "name"]);
  });


});

describe("basket counts and totals", () => {
  it("counts units, not lines", () => {
    const cart: CartMap = {
      "p-1": { quantity: 2, modifierIds: [], notes: null },
      "p-2": { quantity: 3, modifierIds: [], notes: null },
    };

    expect(cartItemCount(cart)).toBe(5);
  });

  it("totals the display lines", () => {
    const lines = resolveCartLines(
      { "p-1": { quantity: 2, modifierIds: [], notes: null } },
      PRODUCTS,
    );

    expect(cartTotalPrice(lines)).toBe(50000);
    expect(cartTotalPrice([])).toBe(0);
  });

  it("knows when the basket has nothing submittable", () => {
    expect(isCartEmpty({})).toBe(true);
    expect(
      isCartEmpty({ "p-1": { quantity: 0, modifierIds: [], notes: null } }),
    ).toBe(true);
    expect(
      isCartEmpty({ "p-1": { quantity: 1, modifierIds: [], notes: null } }),
    ).toBe(false);
  });
});

describe("basket transitions", () => {
  it("increments a new and an existing entry within the quantity cap", () => {
    const cart: CartMap = { "p-1": { quantity: 99, modifierIds: [], notes: null } };

    expect(incrementEntry({}, "p-1")).toEqual({
      "p-1": { quantity: 1, modifierIds: [], notes: null },
    });
    // The cap holds; a long press cannot overrun the domain limit.
    expect(incrementEntry(cart, "p-1")["p-1"]?.quantity).toBe(99);
  });

  it("decrements and removes the entry at zero", () => {
    const cart: CartMap = { "p-1": { quantity: 2, modifierIds: [], notes: null } };

    const once = decrementEntry(cart, "p-1");
    expect(once["p-1"]?.quantity).toBe(1);

    const twice = decrementEntry(once, "p-1");
    expect(twice).toEqual({});
  });

  it("leaves an untouched basket when removing or decrementing an absent entry", () => {
    const cart: CartMap = { "p-1": { quantity: 1, modifierIds: [], notes: null } };

    expect(decrementEntry(cart, "p-9")).toBe(cart);
    expect(removeEntry(cart, "p-9")).toBe(cart);
  });

  it("clamps notes and sets them on the entry", () => {
    const cart: CartMap = { "p-1": { quantity: 1, modifierIds: [], notes: null } };
    const long = "a".repeat(300);

    const next = setEntryNote(cart, "p-1", long);

    expect(next["p-1"]?.notes).toBe("a".repeat(200));
    expect(next["p-1"]?.notes).not.toBe(cart["p-1"]?.notes);
  });

  it("sets modifiers without wiping the quantity, and creates the entry", () => {
    const cart: CartMap = { "p-1": { quantity: 2, modifierIds: [], notes: null } };

    expect(setEntryModifiers(cart, "p-1", ["m-spicy"])).toEqual({
      "p-1": { quantity: 2, modifierIds: ["m-spicy"], notes: null },
    });
    expect(setEntryModifiers({}, "p-2", ["m-spicy"])).toEqual({
      "p-2": { quantity: 0, modifierIds: ["m-spicy"], notes: null },
    });
  });

  it("never mutates the basket it was given", () => {
    const cart: CartMap = { "p-1": { quantity: 1, modifierIds: [], notes: null } };
    const snapshot = JSON.parse(JSON.stringify(cart)) as CartMap;

    incrementEntry(cart, "p-1");
    decrementEntry(cart, "p-1");
    removeEntry(cart, "p-1");
    setEntryNote(cart, "p-1", "x");
    setEntryModifiers(cart, "p-1", ["m-spicy"]);

    expect(cart).toEqual(snapshot);
  });
});

describe("input guards", () => {
  it("clamps a quantity to the domain range", () => {
    expect(clampQuantity(-1)).toBe(0);
    expect(clampQuantity(2.7)).toBe(2);
    expect(clampQuantity(999)).toBe(99);
  });

  it("clamps a note to the domain length", () => {
    expect(clampNote("a".repeat(300))).toBe("a".repeat(200));
  });

});
