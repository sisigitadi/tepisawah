/**
 * Settings query tests (Phase 4).
 *
 * Exercises the query layer against a fake RLS-enforcing client. The fake
 * models the security boundary exactly the way Postgres would: a caller
 * without the right grant receives an empty result or an RLS error, and the
 * query layer must degrade to an explicit failure rather than a partial
 * record (docs/qa/TESTING_STRATEGY.md Layer 2).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../generated/index.js";
import {
  fetchOperatingHours,
  fetchPublicRestaurantSettings,
  fetchRestaurantOpenState,
  fetchRestaurantSettings,
  saveOperatingHours,
  updateRestaurantSettings,
} from "./settings.js";
import type {
  OperatingHoursRow,
  PublicSettingsRow,
  RestaurantSettingsRow,
} from "../models/index.js";

type Table = "restaurant_settings" | "operating_hours";

interface FakeConfig {
  settingsRow?: RestaurantSettingsRow | null;
  hoursRows?: OperatingHoursRow[];
  /** Simulates an RLS denial on the given table. */
  deny?: Table;
  /** Simulates an RPC failure. */
  denyRpc?: string;
  publicRow?: PublicSettingsRow | null;
  openState?: boolean;
  /** Records what the client was asked to write. */
  writes: { table: Table; rows: unknown[] }[];
}

const SETTINGS_ID = "11111111-1111-1111-1111-111111111111";

function fakeClient(config: FakeConfig): SupabaseClient<Database> {
  const rlsError = {
    message: 'permission denied for table "restaurant_settings"',
    code: "42501",
  };

  const selectAll = (table: Table) => {
    if (config.deny === table) {
      return Promise.resolve({ data: null, error: rlsError });
    }
    if (table === "restaurant_settings") {
      return Promise.resolve({ data: config.settingsRow ?? null, error: null });
    }
    return Promise.resolve({ data: config.hoursRows ?? [], error: null });
  };

  const write = (table: Table, rows: unknown[]) => {
    config.writes.push({ table, rows });
    if (config.deny === table) {
      return Promise.resolve({ data: null, error: rlsError });
    }
    if (table === "restaurant_settings") {
      return Promise.resolve({ data: config.settingsRow, error: null });
    }
    return Promise.resolve({ data: config.hoursRows ?? [], error: null });
  };

  const client = {
    from: (table: Table) => {
      const chain = {
        select: () => ({
          maybeSingle: () => selectAll(table),
          single: () => selectAll(table),
          order: () => selectAll(table),
        }),
        update: (rows: unknown[]) => ({
          eq: () => ({
            select: () => ({
              single: () => write(table, rows),
            }),
          }),
        }),
        upsert: (rows: unknown[]) => ({
          select: () => ({
            order: () => write(table, rows),
          }),
        }),
      };
      return chain;
    },
    rpc: (name: string) => {
      const denied = config.denyRpc === name;
      if (name === "public_restaurant_settings") {
        const payload = denied
          ? { data: null, error: rlsError }
          : { data: config.publicRow ?? null, error: null };
        return {
          ...payload,
          maybeSingle: () => Promise.resolve(payload),
        };
      }
      if (denied) return { data: null, error: rlsError };
      return { data: config.openState ?? false, error: null };
    },
  };

  return client as unknown as SupabaseClient<Database>;
}

const VALID_INPUT = {
  restaurantName: "Tepi Sawah",
  address: "Jl. Raya Sawah",
  phone: null,
  email: null,
  timezone: "Asia/Jakarta",
  currency: "IDR",
  logoUrl: null,
  primaryColor: null,
};

describe("settings queries", () => {
  describe("fetchRestaurantSettings", () => {
    it("returns the configured row", async () => {
      const client = fakeClient({
        writes: [],
        settingsRow: {
          id: SETTINGS_ID,
          restaurant_name: "Tepi Sawah",
          address: "Jl. Raya Sawah",
          phone: null,
          email: null,
          timezone: "Asia/Jakarta",
          currency: "IDR",
          logo_url: null,
          primary_color: null,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      });
      const result = await fetchRestaurantSettings(client);
      expect(result.error).toBeNull();
      expect(result.data?.restaurantName).toBe("Tepi Sawah");
    });

    it("returns null data when the restaurant is unconfigured", async () => {
      const client = fakeClient({ writes: [], settingsRow: null });
      const result = await fetchRestaurantSettings(client);
      expect(result.data).toBeNull();
      expect(result.error).toBeNull();
    });

    it("fails closed under an RLS denial", async () => {
      const client = fakeClient({ writes: [], deny: "restaurant_settings" });
      const result = await fetchRestaurantSettings(client);
      expect(result.data).toBeNull();
      expect(result.error?.message).toMatch(/permission denied/);
    });
  });

  describe("updateRestaurantSettings", () => {
    it("rejects an invalid patch before any network call", async () => {
      const config: FakeConfig = { writes: [] };
      const client = fakeClient(config);
      const result = await updateRestaurantSettings(client, SETTINGS_ID, {
        ...VALID_INPUT,
        restaurantName: "",
        timezone: "Not/AZone",
      });
      expect(result.data).toBeNull();
      expect(result.error?.fieldErrors?.restaurantName).toBeDefined();
      expect(result.error?.fieldErrors?.timezone).toBeDefined();
      expect(config.writes).toEqual([]);
    });

    it("writes a valid patch and returns the stored row", async () => {
      const config: FakeConfig = {
        writes: [],
        settingsRow: {
          id: SETTINGS_ID,
          restaurant_name: "Tepi Sawah",
          address: "Jl. Raya Sawah",
          phone: null,
          email: null,
          timezone: "Asia/Jakarta",
          currency: "IDR",
          logo_url: null,
          primary_color: null,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      };
      const client = fakeClient(config);
      const result = await updateRestaurantSettings(client, SETTINGS_ID, VALID_INPUT);
      expect(result.error).toBeNull();
      expect(result.data?.id).toBe(SETTINGS_ID);
      expect(config.writes).toHaveLength(1);
    });

    it("fails closed under an RLS denial on write", async () => {
      const config: FakeConfig = { writes: [], deny: "restaurant_settings" };
      const client = fakeClient(config);
      const result = await updateRestaurantSettings(client, SETTINGS_ID, VALID_INPUT);
      expect(result.data).toBeNull();
      expect(result.error?.message).toMatch(/permission denied/);
    });

    it("rejects an empty id", async () => {
      const client = fakeClient({ writes: [] });
      const result = await updateRestaurantSettings(client, "", VALID_INPUT);
      expect(result.error?.message).toBeDefined();
    });
  });

  describe("fetchOperatingHours", () => {
    it("returns the stored schedule ordered Sunday-first", async () => {
      const client = fakeClient({
        writes: [],
        hoursRows: [
          {
            id: "a",
            day_of_week: 1,
            is_closed: false,
            open_time: "09:00:00",
            close_time: "21:00:00",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        ],
      });
      const result = await fetchOperatingHours(client);
      expect(result.error).toBeNull();
      const rows = result.data ?? [];
      expect(rows).toHaveLength(1);
      expect(rows[0]?.dayOfWeek).toBe(1);
    });

    it("returns an empty list for an unconfigured week", async () => {
      const client = fakeClient({ writes: [] });
      const result = await fetchOperatingHours(client);
      expect(result.data).toEqual([]);
      expect(result.error).toBeNull();
    });

    it("fails closed under an RLS denial", async () => {
      const client = fakeClient({ writes: [], deny: "operating_hours" });
      const result = await fetchOperatingHours(client);
      expect(result.data).toEqual([]);
      expect(result.error?.message).toMatch(/permission denied/);
    });
  });

  describe("saveOperatingHours", () => {
    it("upserts a valid week and audits the changed days", async () => {
      const config: FakeConfig = {
        writes: [],
        hoursRows: [
          {
            id: "a",
            day_of_week: 1,
            is_closed: false,
            open_time: "09:00:00",
            close_time: "22:00:00",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        ],
      };
      const client = fakeClient(config);
      const result = await saveOperatingHours(
        client,
        [
          { dayOfWeek: 1, isClosed: false, openTime: "09:00", closeTime: "22:00" },
          { dayOfWeek: 2, isClosed: true, openTime: null, closeTime: null },
        ],
        [
          {
            id: "a",
            dayOfWeek: 1,
            isClosed: false,
            openTime: "09:00:00",
            closeTime: "21:00:00",
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:00:00Z",
          },
        ],
      );
      expect(result.error).toBeNull();
      expect(result.data?.audit).toHaveLength(1);
      expect(result.data?.audit[0]?.changedFields).toEqual(["closeTime"]);
      expect(config.writes[0]?.rows).toEqual([
        { day_of_week: 1, is_closed: false, open_time: "09:00:00", close_time: "22:00:00" },
        { day_of_week: 2, is_closed: true, open_time: null, close_time: null },
      ]);
    });

    it("aborts the whole write when any day is invalid", async () => {
      const config: FakeConfig = { writes: [] };
      const client = fakeClient(config);
      const result = await saveOperatingHours(
        client,
        [
          { dayOfWeek: 1, isClosed: false, openTime: "09:00", closeTime: "22:00" },
          { dayOfWeek: 0, isClosed: false, openTime: "22:00", closeTime: "09:00" },
        ],
        [],
      );
      expect(result.data).toBeNull();
      expect(result.error?.fieldErrors).toBeDefined();
      expect(config.writes).toEqual([]);
    });

    it("fails closed under an RLS denial on write", async () => {
      const config: FakeConfig = { writes: [], deny: "operating_hours" };
      const client = fakeClient(config);
      const result = await saveOperatingHours(
        client,
        [{ dayOfWeek: 1, isClosed: true, openTime: null, closeTime: null }],
        [],
      );
      expect(result.data).toBeNull();
      expect(result.error?.message).toMatch(/permission denied/);
    });
  });

  describe("public boundary", () => {
    it("returns only the customer-safe projection", async () => {
      const client = fakeClient({
        writes: [],
        publicRow: {
          restaurant_name: "Tepi Sawah",
          timezone: "Asia/Jakarta",
          currency: "IDR",
          is_open: true,
        },
      });
      const result = await fetchPublicRestaurantSettings(client);
      expect(result.data).toEqual({
        restaurantName: "Tepi Sawah",
        timezone: "Asia/Jakarta",
        currency: "IDR",
        isOpen: true,
      });
      expect(result.data).not.toHaveProperty("address");
      expect(result.data).not.toHaveProperty("phone");
      expect(result.data).not.toHaveProperty("email");
    });

    it("fails closed when the RPC is denied", async () => {
      const client = fakeClient({
        writes: [],
        denyRpc: "public_restaurant_settings",
      });
      const result = await fetchPublicRestaurantSettings(client);
      expect(result.data).toBeNull();
      expect(result.error).not.toBeNull();
    });

    it("reads an unconfigured restaurant as closed", async () => {
      const client = fakeClient({ writes: [], openState: false });
      const result = await fetchRestaurantOpenState(client);
      expect(result.data).toBe(false);
      expect(result.error).toBeNull();
    });

    it("fails closed when the open-state RPC errors", async () => {
      const client = fakeClient({ writes: [], denyRpc: "is_restaurant_open" });
      const result = await fetchRestaurantOpenState(client);
      expect(result.data).toBe(false);
      expect(result.error).not.toBeNull();
    });
  });
});
