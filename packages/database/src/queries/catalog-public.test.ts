/**
 * Catalog public query tests (Phase 5).
 *
 * Exercises the customer-facing read paths and the order-item snapshot seam.
 * The fake RPC client models the SECURITY DEFINER boundary: anonymous callers
 * only ever see the projection rows, and every failure degrades to an explicit
 * error so a customer is never quoted a client-invented price
 * (API_CONTRACT.md §27, AUTH_RBAC_RLS.md §17).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../generated/index.js";
import {
  fetchPublicCatalog,
  groupCatalogByCategory,
  resolveOrderItem,
} from "./catalog-public.js";
import type { PublicCatalogRow } from "../models/index.js";

interface RpcConfig {
  catalogRows?: PublicCatalogRow[];
  snapshotRow?: unknown;
  /** Simulates an RPC failure, keyed by function name. */
  deny?: string;
}

function fakeClient(config: RpcConfig): SupabaseClient<Database> {
  const error = {
    message: 'permission denied for function "public_catalog"',
    code: "42501",
  };

  const rpc = (name: string) => {
    if (config.deny === name) {
      return Promise.resolve({ data: null, error });
    }
    if (name === "public_catalog") {
      return Promise.resolve({ data: config.catalogRows ?? [], error: null });
    }
    // resolve_order_item
    return Promise.resolve({ data: config.snapshotRow ?? null, error: null });
  };

  const chain = (name: string) => ({
    data: null as unknown,
    error: null as { message: string; code?: string } | null,
    maybeSingle: () => rpc(name),
    order: () => rpc(name),
  });

  const client = {
    rpc: (name: string) => chain(name),
  };

  return client as unknown as SupabaseClient<Database>;
}

const CATALOG_ROW: PublicCatalogRow = {
  category_id: "cat-1",
  category_name: "Makanan",
  category_sort: 1,
  product_id: "prod-1",
  product_name: "Nasi Goreng",
  description: null,
  price: 45000,
  image_url: null,
  is_available: true,
  product_sort: 1,
  modifiers: [
    {
      modifierId: "mod-1",
      name: "Pedas",
      priceDelta: 2000,
      isRequired: false,
      minSelect: 0,
      maxSelect: 1,
      sortOrder: 1,
    },
  ],
};

describe("catalog public queries", () => {
  describe("fetchPublicCatalog", () => {
    it("maps the projection rows", async () => {
      const client = fakeClient({ catalogRows: [CATALOG_ROW] });
      const result = await fetchPublicCatalog(client);
      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(1);
      const product = result.data?.[0];
      expect(product?.productId).toBe("prod-1");
      expect(product?.categoryName).toBe("Makanan");
      expect(product?.price).toBe(45000);
      expect(product?.modifiers).toHaveLength(1);
      expect(product?.modifiers[0]?.priceDelta).toBe(2000);
    });

    it("fails closed when the RPC is denied", async () => {
      const client = fakeClient({ deny: "public_catalog" });
      const result = await fetchPublicCatalog(client);
      expect(result.data).toBeNull();
      expect(result.error).not.toBeNull();
    });

    it("reads an empty menu as an empty array", async () => {
      const client = fakeClient({});
      const result = await fetchPublicCatalog(client);
      expect(result.data).toEqual([]);
      expect(result.error).toBeNull();
    });

    it("drops rows the projection could not resolve", async () => {
      const client = fakeClient({
        catalogRows: [
          CATALOG_ROW,
          { ...CATALOG_ROW, product_id: null, product_name: null },
          { ...CATALOG_ROW, price: null },
        ],
      });
      const result = await fetchPublicCatalog(client);
      expect(result.data).toHaveLength(1);
    });

    it("drops malformed modifier entries instead of widening bounds", async () => {
      const client = fakeClient({
        catalogRows: [
          {
            ...CATALOG_ROW,
            modifiers: [
              { modifierId: "mod-1", name: "Pedas", minSelect: 3, maxSelect: 1 },
              { notAModifier: true },
              { modifierId: "mod-2", name: "Besar" },
            ],
          },
        ],
      });
      const result = await fetchPublicCatalog(client);
      const modifiers = result.data?.[0]?.modifiers ?? [];
      expect(modifiers).toHaveLength(2);
      expect(modifiers[0]?.maxSelect).toBe(3);
      expect(modifiers[1]?.priceDelta).toBe(0);
    });
  });

  describe("groupCatalogByCategory", () => {
    it("groups products by category in server order", () => {
      const grouped = groupCatalogByCategory([
        {
          categoryId: "cat-1",
          categoryName: "Makanan",
          categorySortOrder: 1,
          productId: "prod-1",
          name: "Nasi Goreng",
          description: null,
          price: 45000,
          imageUrl: null,
          isAvailable: true,
          sortOrder: 1,
          modifiers: [],
        },
        {
          categoryId: "cat-2",
          categoryName: "Minuman",
          categorySortOrder: 0,
          productId: "prod-2",
          name: "Es Teh",
          description: null,
          price: 8000,
          imageUrl: null,
          isAvailable: true,
          sortOrder: 1,
          modifiers: [],
        },
      ]);
      expect(grouped).toHaveLength(2);
      expect(grouped[0]?.name).toBe("Minuman");
      expect(grouped[1]?.products).toHaveLength(1);
    });

    it("emits nothing for an empty catalog", () => {
      expect(groupCatalogByCategory([])).toEqual([]);
    });
  });

  describe("resolveOrderItem", () => {
    it("returns the server-computed snapshot", async () => {
      const client = fakeClient({
        snapshotRow: {
          product_id: "prod-1",
          product_name_snapshot: "Nasi Goreng",
          category_id: "cat-1",
          unit_price_snapshot: 45000,
          quantity: 2,
          modifier_ids: ["mod-1"],
          modifier_names: ["Pedas"],
          modifier_deltas: [2000],
          modifiers_subtotal: 4000,
          subtotal: 94000,
        },
      });
      const result = await resolveOrderItem(client, "prod-1", 2, ["mod-1"]);
      expect(result.error).toBeNull();
      expect(result.data?.unitPriceSnapshot).toBe(45000);
      expect(result.data?.subtotal).toBe(94000);
      expect(result.data?.modifierNames).toEqual(["Pedas"]);
    });

    it("fails closed when the item cannot be resolved", async () => {
      const client = fakeClient({ snapshotRow: null });
      const result = await resolveOrderItem(client, "prod-1", 1, []);
      expect(result.data).toBeNull();
      expect(result.error).not.toBeNull();
    });

    it("fails closed when the RPC is denied", async () => {
      const client = fakeClient({ deny: "resolve_order_item" });
      const result = await resolveOrderItem(client, "prod-1", 1, []);
      expect(result.data).toBeNull();
      expect(result.error).not.toBeNull();
    });

    it("rejects an empty product id before any RPC", async () => {
      const client = fakeClient({});
      const result = await resolveOrderItem(client, "", 1, []);
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe("P0001");
    });

    it("parses numeric prices that arrive as strings", async () => {
      const client = fakeClient({
        snapshotRow: {
          product_id: "prod-1",
          product_name_snapshot: "Nasi Goreng",
          category_id: "cat-1",
          unit_price_snapshot: "45000",
          quantity: 1,
          modifier_ids: [],
          modifier_names: [],
          modifier_deltas: [],
          modifiers_subtotal: "0",
          subtotal: "45000",
        },
      });
      const result = await resolveOrderItem(client, "prod-1", 1, []);
      expect(result.data?.subtotal).toBe(45000);
    });
  });
});
