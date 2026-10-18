import { describe, expect, it } from "vitest";
import { getTenderPresets, suggestDenomination } from "./terminal.js";

describe("POS Cash Tender & Denomination Helpers", () => {
  describe("getTenderPresets", () => {
    it("generates dynamic exact and round presets for a small bill (e.g. 12.000)", () => {
      const presets = getTenderPresets(12000);
      expect(presets).toHaveLength(3);
      expect(presets[0]).toEqual({ label: "[Pas] 12.000", value: 12000 });
      expect(presets[1]).toEqual({ label: "Rp 20.000", value: 20000 });
      expect(presets[2]).toEqual({ label: "Rp 50.000", value: 50000 });
    });

    it("generates dynamic exact and round presets for a larger bill (e.g. 260.000)", () => {
      const presets = getTenderPresets(260000);
      expect(presets).toHaveLength(3);
      expect(presets[0]).toEqual({ label: "[Pas] 260.000", value: 260000 });
      expect(presets[1]).toEqual({ label: "Rp 300.000", value: 300000 });
      expect(presets[2]?.value).toBeGreaterThan(presets[1]?.value ?? 0);
    });

    it("handles zero or negative grand total gracefully", () => {
      const presets = getTenderPresets(0);
      expect(presets).toHaveLength(3);
      expect(presets[0]).toEqual({ label: "[Pas] 0", value: 0 });
    });
  });

  describe("suggestDenomination", () => {
    it("breaks down Rp 248.000 into exact denominations without omitting small notes", () => {
      const result = suggestDenomination(248000);
      expect(result).toBe("2x 100k + 2x 20k + 1x 5k + 1x 2k + 1x 1k");

      // Verify the sum of the suggested notes matches 248.000 exactly
      const sum = 2 * 100000 + 2 * 20000 + 1 * 5000 + 1 * 2000 + 1 * 1000;
      expect(sum).toBe(248000);
    });

    it("returns dash for zero or negative change", () => {
      expect(suggestDenomination(0)).toBe("—");
      expect(suggestDenomination(-12000)).toBe("—");
    });

    it("handles smaller change correctly (e.g. 8.000)", () => {
      expect(suggestDenomination(8000)).toBe("1x 5k + 1x 2k + 1x 1k");
    });
  });
});
