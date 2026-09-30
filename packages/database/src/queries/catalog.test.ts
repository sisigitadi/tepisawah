/**
 * Catalog admin query tests (Phase 5).
 *
 * Read/write paths against a fake RLS-enforcing client. The fake models the
 * security boundary the way Postgres would: a caller without the right grant
 * receives an empty result or an RLS error, and the query layer must degrade to
 * an explicit failure rather than a partial record (TESTING_STRATEGY Layer 2).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../generated/index.js";
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
} from "./catalog.js";
import type {
  CategoryRow,
  ModifierRow,
  ProductModifierRow,
  ProductRow,
} from "../models/index.js";
import type {
  Category,
  Modifier,
  Product,
  ProductModifier,
} from "../models/index.js";

type Table =
  | "categories"
  | "products"
  | "modifiers"
  | "product_modifiers";

interface FakeConfig {
  categoryRows?: CategoryRow[];
  productRows?: ProductRow[];
  modifierRows?: ModifierRow[];
  linkRows?: ProductModifierRow[];
  /** RLS denial on the given table. */
  deny?: Table;
  /** Records what the client was asked to write. */
  writes: { table: Table; rows: unknown[] }[];
  /** Records deletions (product_modifiers unlink path). */
  deletes: { table: Table; filter: string }[];
  /** Records RPC calls (the atomic product-modifier replace). */
  rpcCalls?: { fn: string; args: unknown }[];
}

const RLS_ERROR = {
  message: 'permission denied for table "products"',
  code: "42501",
};

const RPC_DENY_ERROR = {
  message: "permission denied for function replace_product_modifiers",
  code: "42501",
};

function fakeClient(config: FakeConfig): SupabaseClient<Database> {
  config.rpcCalls = config.rpcCalls ?? [];

  const rowsFor = (table: Table): unknown[] => {
    switch (table) {
      case "categories":
        return config.categoryRows ?? [];
      case "products":
        return config.productRows ?? [];
      case "modifiers":
        return config.modifierRows ?? [];
      default:
        return config.linkRows ?? [];
    }
  };

  const listResult = (table: Table) =>
    config.deny === table
      ? Promise.resolve({ data: null, error: RLS_ERROR })
      : Promise.resolve({ data: rowsFor(table), error: null });

  const singleResult = (table: Table) => {
    if (config.deny === table) {
      return Promise.resolve({ data: null, error: RLS_ERROR });
    }
    const rows = rowsFor(table);
    return Promise.resolve({ data: rows[0] ?? null, error: null });
  };

  // A mutation records its payload, then answers like a fresh read. Reads
  // (no pending payload) never record a write.
  const writeOne = (table: Table, pending?: unknown[]) => {
    if (pending !== undefined) config.writes.push({ table, rows: pending });
    return singleResult(table);
  };

  const writeAll = (table: Table, pending?: unknown[]) => {
    if (pending !== undefined) config.writes.push({ table, rows: pending });
    return listResult(table);
  };

  // One chain shape covers every call site: `.eq()`/`.select()`/`.order()`
  // return the same chain (as filters), and only `.single()`/`.maybeSingle()`/
  // `.order()` as terminals resolve a promise. This mirrors the real client,
  // where any of those can appear in any order before the request fires.
  const chain = (table: Table, pending?: unknown[]): Record<string, unknown> => {
    const self: Record<string, unknown> = {
      eq: () => self,
      in: () => self,
      select: () => self,
      single: () => writeOne(table, pending),
      maybeSingle: () => writeOne(table, pending),
      order: () => writeAll(table, pending),
    };
    return self;
  };

  // `replace_product_modifiers` is one server-side transaction: it commits the
  // whole new link set or, when it is denied, leaves the stored links exactly
  // as they were. Modelling that here is what makes the atomicity regression
  // test meaningful — the old two-step path deleted first and would have left
  // the product with no links after a failed replace.
  const rpc = (fn: string, args: Record<string, unknown>) => {
    config.rpcCalls?.push({ fn, args });
    if (fn !== "replace_product_modifiers") {
      return Promise.resolve({ data: null, error: RLS_ERROR });
    }
    if (config.deny === "product_modifiers") {
      return Promise.resolve({ data: null, error: RPC_DENY_ERROR });
    }
    const committed = ((args.pLinks ?? []) as Record<string, unknown>[]).map((row) => ({
      ...row,
      created_at: "2026-01-01T00:00:00Z",
    }));
    config.linkRows = committed as ProductModifierRow[];
    return Promise.resolve({ data: committed, error: null });
  };

  const client = {
    rpc,
    from: (table: Table) => ({
      select: () => chain(table),
      insert: (rows: unknown[]) => chain(table, rows),
      update: (rows: unknown) => chain(table, [rows]),
      upsert: (rows: unknown[]) => chain(table, rows),
      delete: () => ({
        eq: () => ({
          in: (_column: string, values: readonly string[]) => {
            config.deletes.push({ table, filter: `${values.length} removed` });
            if (config.deny === table) {
              return Promise.resolve({ error: RLS_ERROR });
            }
            return Promise.resolve({ error: null });
          },
        }),
      }),
    }),
  };

  return client as unknown as SupabaseClient<Database>;
}

const CATEGORY_ROW: CategoryRow = {
  id: "cat-1",
  name: "Makanan",
  description: null,
  sort_order: 1,
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const CATEGORY: Category = {
  id: "cat-1",
  name: "Makanan",
  description: null,
  sortOrder: 1,
  isActive: true,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

describe("catalog admin queries", () => {
  describe("categories", () => {
    it("reads the stored rows", async () => {
      const client = fakeClient({
        writes: [],
        deletes: [],
        categoryRows: [CATEGORY_ROW],
      });
      const result = await fetchCategories(client);
      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0]?.name).toBe("Makanan");
    });

    it("returns an empty list when nothing is configured", async () => {
      const client = fakeClient({ writes: [], deletes: [] });
      const result = await fetchCategories(client);
      expect(result.data).toEqual([]);
      expect(result.error).toBeNull();
    });

    it("fails closed under an RLS denial", async () => {
      const client = fakeClient({
        writes: [],
        deletes: [],
        deny: "categories",
      });
      const result = await fetchCategories(client);
      expect(result.data).toBeNull();
      expect(result.error?.message).toMatch(/permission denied/);
    });

    it("creates a valid category", async () => {
      const config: FakeConfig = {
        writes: [],
        deletes: [],
        categoryRows: [CATEGORY_ROW],
      };
      const client = fakeClient(config);
      const result = await createCategory(client, {
        name: "Minuman",
        description: null,
        sortOrder: 2,
        isActive: true,
      });
      expect(result.error).toBeNull();
      expect(config.writes).toHaveLength(1);
      expect(config.writes[0]?.table).toBe("categories");
    });

    it("rejects an invalid category before any network call", async () => {
      const config: FakeConfig = { writes: [], deletes: [] };
      const client = fakeClient(config);
      const result = await createCategory(client, {
        name: "",
        description: null,
        sortOrder: 2,
        isActive: true,
      });
      expect(result.data).toBeNull();
      expect(result.error?.fieldErrors?.name).toBeDefined();
      expect(config.writes).toEqual([]);
    });

    it("updates a category and audits the change", async () => {
      const config: FakeConfig = {
        writes: [],
        deletes: [],
        categoryRows: [{ ...CATEGORY_ROW, name: "Makanan Baru" }],
      };
      const client = fakeClient(config);
      const result = await updateCategory(
        client,
        "cat-1",
        { name: "Makanan Baru", description: null, sortOrder: 1, isActive: true },
        CATEGORY,
      );
      expect(result.error).toBeNull();
      expect(result.data?.category.name).toBe("Makanan Baru");
      expect(result.data?.audit?.changedFields).toEqual(["name"]);
      expect(config.writes).toHaveLength(1);
    });

    it("rejects an empty id", async () => {
      const client = fakeClient({ writes: [], deletes: [] });
      const result = await updateCategory(
        client,
        "",
        { name: "Makanan", description: null, sortOrder: 1, isActive: true },
        CATEGORY,
      );
      expect(result.error?.message).toBeDefined();
    });

    it("produces no audit event when nothing changed", async () => {
      const client = fakeClient({
        writes: [],
        deletes: [],
        categoryRows: [CATEGORY_ROW],
      });
      const result = await updateCategory(
        client,
        "cat-1",
        { name: "Makanan", description: null, sortOrder: 1, isActive: true },
        CATEGORY,
      );
      expect(result.error).toBeNull();
      expect(result.data?.audit).toBeNull();
    });

    it("fails closed when the write is denied", async () => {
      const config: FakeConfig = {
        writes: [],
        deletes: [],
        deny: "categories",
      };
      const client = fakeClient(config);
      const result = await updateCategory(
        client,
        "cat-1",
        { name: "Makanan Baru", description: null, sortOrder: 1, isActive: true },
        CATEGORY,
      );
      expect(result.data).toBeNull();
      expect(result.error?.message).toMatch(/permission denied/);
    });
  });

  describe("products", () => {
    const PRODUCT_ROW: ProductRow = {
      id: "prod-1",
      category_id: "cat-1",
      name: "Nasi Goreng",
      description: null,
      image_url: null,
      price: 45000,
      is_active: true,
      is_available: true,
      sort_order: 1,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    const PRODUCT: Product = {
      id: "prod-1",
      categoryId: "cat-1",
      name: "Nasi Goreng",
      description: null,
      imageUrl: null,
      price: 45000,
      isActive: true,
      isAvailable: true,
      sortOrder: 1,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };

    it("reads all products", async () => {
      const client = fakeClient({
        writes: [],
        deletes: [],
        productRows: [PRODUCT_ROW],
      });
      const result = await fetchProducts(client);
      expect(result.error).toBeNull();
      expect(result.data?.[0]?.price).toBe(45000);
    });

    it("reads a single product", async () => {
      const client = fakeClient({
        writes: [],
        deletes: [],
        productRows: [PRODUCT_ROW],
      });
      const result = await fetchProduct(client, "prod-1");
      expect(result.error).toBeNull();
      expect(result.data?.name).toBe("Nasi Goreng");
    });

    it("reads null for a missing product", async () => {
      const client = fakeClient({ writes: [], deletes: [] });
      const result = await fetchProduct(client, "prod-1");
      expect(result.data).toBeNull();
      expect(result.error).toBeNull();
    });

    it("rejects an empty id", async () => {
      const client = fakeClient({ writes: [], deletes: [] });
      const result = await fetchProduct(client, "");
      expect(result.error?.message).toBeDefined();
    });

    it("creates a valid product", async () => {
      const config: FakeConfig = {
        writes: [],
        deletes: [],
        productRows: [PRODUCT_ROW],
      };
      const client = fakeClient(config);
      const result = await createProduct(client, {
        categoryId: "cat-1",
        name: "Mie Goreng",
        description: null,
        imageUrl: null,
        price: 40000,
        isActive: true,
        isAvailable: true,
        sortOrder: 2,
      });
      expect(result.error).toBeNull();
      expect(config.writes[0]?.rows[0]).toMatchObject({
        category_id: "cat-1",
        price: 40000,
      });
    });

    it("rejects a negative price before any network call", async () => {
      const config: FakeConfig = { writes: [], deletes: [] };
      const client = fakeClient(config);
      const result = await createProduct(client, {
        categoryId: "cat-1",
        name: "Mie Goreng",
        description: null,
        imageUrl: null,
        price: -1000,
        isActive: true,
        isAvailable: true,
        sortOrder: 2,
      });
      expect(result.data).toBeNull();
      expect(result.error?.fieldErrors?.price).toBeDefined();
      expect(config.writes).toEqual([]);
    });

    it("updates a product and audits a price change", async () => {
      const config: FakeConfig = {
        writes: [],
        deletes: [],
        productRows: [{ ...PRODUCT_ROW, price: 50000 }],
      };
      const client = fakeClient(config);
      const result = await updateProduct(
        client,
        "prod-1",
        {
          categoryId: "cat-1",
          name: "Nasi Goreng",
          description: null,
          imageUrl: null,
          price: 50000,
          isActive: true,
          isAvailable: true,
          sortOrder: 1,
        },
        PRODUCT,
      );
      expect(result.error).toBeNull();
      expect(result.data?.product.price).toBe(50000);
      expect(result.data?.audit?.changedFields).toEqual(["price"]);
    });

    it("fails closed when the write is denied", async () => {
      const config: FakeConfig = {
        writes: [],
        deletes: [],
        deny: "products",
      };
      const client = fakeClient(config);
      const result = await createProduct(client, {
        categoryId: "cat-1",
        name: "Mie Goreng",
        description: null,
        imageUrl: null,
        price: 40000,
        isActive: true,
        isAvailable: true,
        sortOrder: 2,
      });
      expect(result.data).toBeNull();
      expect(result.error?.message).toMatch(/permission denied/);
    });
  });

  describe("modifiers", () => {
    const MODIFIER_ROW: ModifierRow = {
      id: "mod-1",
      name: "Pedas",
      description: null,
      price_delta: 2000,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    const MODIFIER: Modifier = {
      id: "mod-1",
      name: "Pedas",
      description: null,
      priceDelta: 2000,
      isActive: true,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };

    it("reads the stored modifiers", async () => {
      const client = fakeClient({
        writes: [],
        deletes: [],
        modifierRows: [MODIFIER_ROW],
      });
      const result = await fetchModifiers(client);
      expect(result.error).toBeNull();
      expect(result.data?.[0]?.priceDelta).toBe(2000);
    });

    it("creates a valid modifier", async () => {
      const config: FakeConfig = {
        writes: [],
        deletes: [],
        modifierRows: [MODIFIER_ROW],
      };
      const client = fakeClient(config);
      const result = await createModifier(client, {
        name: "Level 1",
        description: null,
        priceDelta: 0,
        isActive: true,
      });
      expect(result.error).toBeNull();
      expect(config.writes[0]?.rows[0]).toMatchObject({
        name: "Level 1",
        price_delta: 0,
      });
    });

    it("updates a modifier and audits the change", async () => {
      const config: FakeConfig = {
        writes: [],
        deletes: [],
        modifierRows: [{ ...MODIFIER_ROW, price_delta: 3000 }],
      };
      const client = fakeClient(config);
      const result = await updateModifier(
        client,
        "mod-1",
        { name: "Pedas", description: null, priceDelta: 3000, isActive: true },
        MODIFIER,
      );
      expect(result.error).toBeNull();
      expect(result.data?.audit?.changedFields).toEqual(["priceDelta"]);
    });

    it("fails closed when the write is denied", async () => {
      const config: FakeConfig = {
        writes: [],
        deletes: [],
        deny: "modifiers",
      };
      const client = fakeClient(config);
      const result = await createModifier(client, {
        name: "Pedas",
        description: null,
        priceDelta: 2000,
        isActive: true,
      });      expect(result.data).toBeNull();
      expect(result.error?.message).toMatch(/permission denied/);
    });
  });

  describe("product modifiers", () => {
    const LINK_ROW: ProductModifierRow = {
      product_id: "prod-1",
      modifier_id: "mod-1",
      is_required: false,
      min_select: 0,
      max_select: 1,
      sort_order: 1,
      created_at: "2026-01-01T00:00:00Z",
    };

    const LINK: ProductModifier = {
      productId: "prod-1",
      modifierId: "mod-1",
      isRequired: false,
      minSelect: 0,
      maxSelect: 1,
      sortOrder: 1,
      createdAt: "2026-01-01T00:00:00Z",
    };

    it("reads the links for one product", async () => {
      const client = fakeClient({
        writes: [],
        deletes: [],
        linkRows: [LINK_ROW],
      });
      const result = await fetchProductModifiers(client, "prod-1");
      expect(result.error).toBeNull();
      expect(result.data?.[0]?.modifierId).toBe("mod-1");
    });

    it("links a new modifier and audits it", async () => {
      const config: FakeConfig = {
        writes: [],
        deletes: [],
        linkRows: [LINK_ROW],
      };
      const client = fakeClient(config);
      const result = await saveProductModifiers(
        client,
        "prod-1",
        [
          {
            productId: "prod-1",
            modifierId: "mod-1",
            isRequired: false,
            minSelect: 0,
            maxSelect: 1,
            sortOrder: 1,
          },
        ],
        [],
        new Map([["mod-1", "Pedas"]]),
      );
      expect(result.error).toBeNull();
      expect(result.data?.links).toHaveLength(1);
      expect(result.data?.audit[0]?.action).toBe("link");
      expect(result.data?.audit[0]?.label).toBe("Pedas");
    });

    it("unlinks modifiers the payload no longer lists", async () => {
      const config: FakeConfig = {
        writes: [],
        deletes: [],
        linkRows: [],
      };
      const client = fakeClient(config);
      const result = await saveProductModifiers(
        client,
        "prod-1",
        [],
        [LINK],
        new Map([["mod-1", "Pedas"]]),
      );
      expect(result.error).toBeNull();
      expect(config.rpcCalls).toHaveLength(1);
      expect(config.rpcCalls?.[0]?.fn).toBe("replace_product_modifiers");
      expect((config.rpcCalls?.[0]?.args as { pLinks: unknown[] }).pLinks)
        .toEqual([]);
      expect(result.data?.audit[0]?.action).toBe("unlink");
    });

    it("audits a changed bound without relinking", async () => {
      const config: FakeConfig = {
        writes: [],
        deletes: [],
        linkRows: [{ ...LINK_ROW, max_select: 3 }],
      };
      const client = fakeClient(config);
      const result = await saveProductModifiers(
        client,
        "prod-1",
        [
          {
            productId: "prod-1",
            modifierId: "mod-1",
            isRequired: false,
            minSelect: 0,
            maxSelect: 3,
            sortOrder: 1,
          },
        ],
        [LINK],
        new Map([["mod-1", "Pedas"]]),
      );
      expect(result.error).toBeNull();
      expect(result.data?.audit[0]?.changedFields).toEqual(["maxSelect"]);
      expect(config.rpcCalls).toHaveLength(1);
    });

    it("drops duplicate modifier ids in one payload", async () => {
      const config: FakeConfig = {
        writes: [],
        deletes: [],
        linkRows: [LINK_ROW],
      };
      const client = fakeClient(config);
      const result = await saveProductModifiers(
        client,
        "prod-1",
        [
          {
            productId: "prod-1",
            modifierId: "mod-1",
            isRequired: false,
            minSelect: 0,
            maxSelect: 1,
            sortOrder: 1,
          },
          {
            productId: "prod-1",
            modifierId: "mod-1",
            isRequired: true,
            minSelect: 1,
            maxSelect: 2,
            sortOrder: 2,
          },
        ],
        [],
        new Map([["mod-1", "Pedas"]]),
      );
      expect(result.error).toBeNull();
      expect(
        (config.rpcCalls?.[0]?.args as { pLinks: unknown[] }).pLinks,
      ).toHaveLength(1);
    });

    it("aborts the whole write when a link is invalid", async () => {
      const config: FakeConfig = { writes: [], deletes: [] };
      const client = fakeClient(config);
      const result = await saveProductModifiers(
        client,
        "prod-1",
        [
          {
            productId: "prod-1",
            modifierId: "mod-1",
            isRequired: false,
            minSelect: 5,
            maxSelect: 1,
            sortOrder: 1,
          },
        ],
        [],
        new Map(),
      );
      expect(result.data).toBeNull();
      expect(result.error?.fieldErrors).toBeDefined();
      expect(config.rpcCalls).toEqual([]);
    });

    it("rejects an empty product id", async () => {
      const client = fakeClient({ writes: [], deletes: [] });
      const result = await saveProductModifiers(client, "", [], [], new Map());
      expect(result.error?.message).toBeDefined();
    });

    it("fails closed when the replace is denied", async () => {
      const config: FakeConfig = {
        writes: [],
        deletes: [],
        deny: "product_modifiers",
      };
      const client = fakeClient(config);
      const result = await saveProductModifiers(
        client,
        "prod-1",
        [],
        [LINK],
        new Map([["mod-1", "Pedas"]]),
      );
      expect(result.data).toBeNull();
      expect(result.error?.message).toMatch(/permission denied/);
    });

    it("leaves the previous links in place when the replace fails", async () => {
      // Regression: the replace used to unlink in one round trip and relink in
      // a second. A failure in the second request was too late — the product
      // was already half-linked and the caller could do nothing about it. The
      // atomic RPC must fail whole, so the stored links survive the failure.
      const config: FakeConfig = {
        writes: [],
        deletes: [],
        linkRows: [LINK_ROW],
        deny: "product_modifiers",
      };
      const client = fakeClient(config);
      const result = await saveProductModifiers(
        client,
        "prod-1",
        [
          {
            productId: "prod-1",
            modifierId: "mod-2",
            isRequired: false,
            minSelect: 0,
            maxSelect: 1,
            sortOrder: 1,
          },
        ],
        [LINK],
        new Map([
          ["mod-1", "Pedas"],
          ["mod-2", "Tingkat Pedas"],
        ]),
      );
      expect(result.data).toBeNull();
      expect(result.error?.message).toMatch(/permission denied/);
      expect(config.rpcCalls).toHaveLength(1);
      expect(config.deletes).toEqual([]);
      expect(config.linkRows).toHaveLength(1);
      expect(config.linkRows?.[0]?.modifier_id).toBe("mod-1");
    });
  });
});
