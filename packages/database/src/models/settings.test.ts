/**
 * Settings model tests (Phase 4).
 *
 * Covers the public/private boundary, fail-closed mappers, field validation and
 * the audit descriptor (docs/qa/TESTING_STRATEGY.md Layer 2).
 */
import { describe, expect, it } from "vitest";

import {
  describeOperatingHoursChange,
  describeSettingsChange,
  isValidCurrency,
  isValidTimeOfDay,
  isValidTimezone,
  validateOperatingHours,
  validateRestaurantSettings,
} from "./settings-validation.js";
import {
  toOperatingHours,
  toPublicRestaurantSettings,
  toRestaurantSettings,
  type OperatingHoursRow,
  type PublicSettingsRow,
  type RestaurantSettingsRow,
} from "./settings.js";
import { DAY_OF_WEEKS } from "./settings-types.js";
import type {
  OperatingHours,
  OperatingHoursInput,
  RestaurantSettings,
  RestaurantSettingsInput,
} from "./settings-types.js";

const VALID_INPUT: RestaurantSettingsInput = {
  restaurantName: "Tepi Sawah Resto & Cafe",
  address: "Jl. Raya Sawah No. 1",
  phone: "+62 21 1234567",
  email: "halo@tepisawah.id",
  timezone: "Asia/Jakarta",
  currency: "IDR",
  logoUrl: "https://tepisawah.id/logo.png",
  primaryColor: "#16a34a",
};

const SETTINGS_ROW: RestaurantSettingsRow = {
  id: "11111111-1111-1111-1111-111111111111",
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
};

describe("settings models", () => {
  describe("toRestaurantSettings", () => {
    it("maps a complete row", () => {
      const record = toRestaurantSettings(SETTINGS_ROW);
      expect(record.restaurantName).toBe("Tepi Sawah");
      expect(record.timezone).toBe("Asia/Jakarta");
      expect(record.phone).toBeNull();
    });

    it("fails closed on unreadable columns", () => {
      const record = toRestaurantSettings({
        id: null,
        restaurant_name: null,
        address: null,
        phone: null,
        email: null,
        timezone: null,
        currency: null,
        logo_url: null,
        primary_color: null,
        created_at: null,
        updated_at: null,
      });
      expect(record.restaurantName).toBe("");
      expect(record.timezone).toBe("");
      expect(record.id).toBe("");
    });
  });

  describe("toOperatingHours", () => {
    it("maps an open day", () => {
      const row: OperatingHoursRow = {
        id: "22222222-2222-2222-2222-222222222222",
        day_of_week: 1,
        is_closed: false,
        open_time: "09:00:00",
        close_time: "21:00:00",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      };
      expect(toOperatingHours(row)).toMatchObject({
        dayOfWeek: 1,
        isClosed: false,
        openTime: "09:00:00",
        closeTime: "21:00:00",
      });
    });

    it("reads a NULL is_closed as closed (fail closed)", () => {
      const row: OperatingHoursRow = {
        id: "x",
        day_of_week: 0,
        is_closed: null,
        open_time: null,
        close_time: null,
        created_at: null,
        updated_at: null,
      };
      expect(toOperatingHours(row).isClosed).toBe(true);
    });

    it.each([[-1], [7], [99], [null]])("clamps an out-of-range day to 0", (value) => {
      const row: OperatingHoursRow = {
        id: "x",
        day_of_week: value,
        is_closed: true,
        open_time: null,
        close_time: null,
        created_at: null,
        updated_at: null,
      };
      expect(toOperatingHours(row).dayOfWeek).toBe(0);
    });

    it("keeps every canonical day available", () => {
      expect(DAY_OF_WEEKS).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });
  });

  describe("toPublicRestaurantSettings", () => {
    it("projects only customer-safe fields", () => {
      const row: PublicSettingsRow = {
        restaurant_name: "Tepi Sawah",
        timezone: "Asia/Jakarta",
        currency: "IDR",
        is_open: true,
      };
      const publicSettings = toPublicRestaurantSettings(row);
      expect(publicSettings).toEqual({
        restaurantName: "Tepi Sawah",
        timezone: "Asia/Jakarta",
        currency: "IDR",
        isOpen: true,
      });
      expect(publicSettings).not.toHaveProperty("address");
      expect(publicSettings).not.toHaveProperty("phone");
    });

    it("fails closed on an unconfigured restaurant", () => {
      expect(toPublicRestaurantSettings(null)).toBeNull();
      expect(
        toPublicRestaurantSettings({
          restaurant_name: null,
          timezone: null,
          currency: null,
          is_open: null,
        }),
      ).toBeNull();
    });

    it("treats a NULL is_open as closed", () => {
      const publicSettings = toPublicRestaurantSettings({
        restaurant_name: "Tepi Sawah",
        timezone: "Asia/Jakarta",
        currency: "IDR",
        is_open: null,
      });
      expect(publicSettings?.isOpen).toBe(false);
    });
  });

  describe("validators", () => {
    it("accepts a valid settings patch", () => {
      expect(validateRestaurantSettings(VALID_INPUT)).toEqual({});
    });

    it("rejects a whitespace-only name and address", () => {
      const errors = validateRestaurantSettings({
        ...VALID_INPUT,
        restaurantName: "   ",
        address: " ",
      });
      expect(errors.restaurantName).toBeDefined();
      expect(errors.address).toBeDefined();
    });

    it("rejects an invented timezone", () => {
      expect(
        validateRestaurantSettings({ ...VALID_INPUT, timezone: "Asia/Jakarta/" })
          .timezone,
      ).toBeDefined();
      expect(isValidTimezone("Asia/Makassar")).toBe(true);
      expect(isValidTimezone("Mars/Olympus_Mons")).toBe(false);
    });

    it("rejects an invented currency", () => {
      expect(validateRestaurantSettings({ ...VALID_INPUT, currency: "XYZ" }).currency).toBeDefined();
      expect(isValidCurrency("IDR")).toBe(true);
      expect(isValidCurrency("AAA")).toBe(false);
    });

    it("rejects a malformed color and logo url", () => {
      expect(
        validateRestaurantSettings({ ...VALID_INPUT, primaryColor: "green" })
          .primaryColor,
      ).toBeDefined();
      expect(
        validateRestaurantSettings({ ...VALID_INPUT, logoUrl: "notaurl" }).logoUrl,
      ).toBeDefined();
    });

    it("accepts optional contact fields as null", () => {
      const input: RestaurantSettingsInput = {
        ...VALID_INPUT,
        phone: null,
        email: null,
        logoUrl: null,
        primaryColor: null,
      };
      expect(validateRestaurantSettings(input)).toEqual({});
    });

    it("rejects an invalid email without touching other fields", () => {
      const errors = validateRestaurantSettings({ ...VALID_INPUT, email: "nope" });
      expect(errors.email).toBeDefined();
      expect(errors.restaurantName).toBeUndefined();
    });

    it("validates a full open day", () => {
      expect(
        validateOperatingHours({ dayOfWeek: 1, isClosed: false, openTime: "09:00", closeTime: "21:00" }),
      ).toEqual({});
    });

    it("rejects a close time at or before open time", () => {
      const same = validateOperatingHours({
        dayOfWeek: 1,
        isClosed: false,
        openTime: "09:00",
        closeTime: "09:00",
      });
      expect(same.closeTime).toBeDefined();
      const before = validateOperatingHours({
        dayOfWeek: 1,
        isClosed: false,
        openTime: "21:00",
        closeTime: "09:00",
      });
      expect(before.closeTime).toBeDefined();
    });

    it("rejects an open day missing a time", () => {
      const errors = validateOperatingHours({
        dayOfWeek: 2,
        isClosed: false,
        openTime: null,
        closeTime: null,
      });
      expect(errors.openTime).toBeDefined();
      expect(errors.closeTime).toBeDefined();
    });

    it("rejects times on a closed day", () => {
      const errors = validateOperatingHours({
        dayOfWeek: 0,
        isClosed: true,
        openTime: "09:00",
        closeTime: "21:00",
      });
      expect(errors.openTime).toBeDefined();
      expect(errors.closeTime).toBeDefined();
    });

    it("accepts a closed day with no times", () => {
      expect(
        validateOperatingHours({ dayOfWeek: 0, isClosed: true, openTime: null, closeTime: null }),
      ).toEqual({});
    });

    it("rejects malformed time strings", () => {
      expect(isValidTimeOfDay("9:00")).toBe(false);
      expect(isValidTimeOfDay("25:00")).toBe(false);
      expect(isValidTimeOfDay("09:60")).toBe(false);
      expect(isValidTimeOfDay("09:00")).toBe(true);
      expect(isValidTimeOfDay("09:00:30")).toBe(true);
    });

    it("rejects an out-of-range day", () => {
      const errors = validateOperatingHours({
        dayOfWeek: 9 as OperatingHoursInput["dayOfWeek"],
        isClosed: true,
        openTime: null,
        closeTime: null,
      });
      expect(errors.dayOfWeek).toBeDefined();
    });
  });

  describe("audit descriptors", () => {
    const before: RestaurantSettings = {
      id: "11111111-1111-1111-1111-111111111111",
      restaurantName: "Tepi Sawah",
      address: "Jl. Lama",
      phone: null,
      email: null,
      timezone: "Asia/Jakarta",
      currency: "IDR",
      logoUrl: null,
      primaryColor: null,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };

    it("describes a settings change with old and new values", () => {
      const event = describeSettingsChange(before, {
        ...before,
        restaurantName: "Tepi Sawah Baru",
        primaryColor: "#16a34a",
      });
      expect(event.action).toBe("SETTINGS_UPDATED");
      expect(event.entityType).toBe("restaurant_settings");
      expect(event.entityId).toBe(before.id);
      expect(event.changedFields).toEqual(["restaurantName", "primaryColor"]);
      expect(event.metadata.restaurantName).toEqual({
        from: "Tepi Sawah",
        to: "Tepi Sawah Baru",
      });
    });

    it("records no change when nothing changed", () => {
      const event = describeSettingsChange(before, before);
      expect(event.changedFields).toEqual([]);
      expect(event.metadata).toEqual({});
    });

    it("describes an operating-hours change", () => {
      const dayBefore: OperatingHours = {
        id: "22222222-2222-2222-2222-222222222222",
        dayOfWeek: 1,
        isClosed: false,
        openTime: "09:00:00",
        closeTime: "20:00:00",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      };
      const event = describeOperatingHoursChange(dayBefore, {
        ...dayBefore,
        closeTime: "21:00:00",
      });
      expect(event.entityType).toBe("operating_hours");
      expect(event.changedFields).toEqual(["closeTime"]);
      expect(event.metadata.closeTime).toEqual({ from: "20:00:00", to: "21:00:00" });
    });
  });
});
