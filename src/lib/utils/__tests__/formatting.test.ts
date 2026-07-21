import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  getCurrencySymbol,
  roundToSixDecimals,
  formatDerivedUnitCost,
} from "../formatting";

describe("getCurrencySymbol", () => {
  it.each([
    ["IDR", "Rp"],
    ["USD", "$"],
    ["EUR", "€"],
    ["GBP", "£"],
  ])("returns the correct symbol for %s", (code, expected) => {
    expect(getCurrencySymbol(code)).toBe(expected);
  });

  it("returns a non-empty symbol for newly-added Southeast Asian currencies", () => {
    for (const code of ["THB", "MYR", "SGD", "KHR"]) {
      expect(getCurrencySymbol(code).length).toBeGreaterThan(0);
    }
  });

  it("falls back to the raw code for an invalid currency", () => {
    expect(getCurrencySymbol("NOTREAL")).toBe("NOTREAL");
  });
});

describe("formatCurrency", () => {
  it("uses 0 decimal places for IDR (regional override)", () => {
    expect(formatCurrency(50000, "IDR", "id-ID")).not.toMatch(/,00$/);
  });

  it("uses 2 decimal places for USD/EUR (ISO default)", () => {
    expect(formatCurrency(10, "USD", "en-US")).toBe("$10.00");
    expect(formatCurrency(10, "EUR", "en-US")).toContain(".00");
  });

  it("uses 0 decimal places for JPY without needing an explicit override", () => {
    const result = formatCurrency(1000, "JPY", "en-US");
    expect(result).not.toMatch(/\.00/);
  });

  it("returns an empty string for null/undefined", () => {
    expect(formatCurrency(null)).toBe("");
    expect(formatCurrency(undefined)).toBe("");
  });
});

describe("roundToSixDecimals", () => {
  it("rounds a clean pack-price division to exactly 6 decimals", () => {
    // e.g. a €2, 1000g pack of flour derives to €0.002/g
    expect(roundToSixDecimals(2 / 1000)).toBe(0.002);
  });

  it("collapses the classic floating-point 0.1 + 0.2 trap", () => {
    expect(roundToSixDecimals(0.1 + 0.2)).toBe(0.3);
  });

  it("rounds a repeating decimal to 6 places instead of truncating", () => {
    expect(roundToSixDecimals(1 / 3)).toBe(0.333333);
  });
});

describe("formatDerivedUnitCost", () => {
  it("shows up to 4 decimals for sub-1 values, trimming trailing zeros", () => {
    expect(formatDerivedUnitCost(0.002)).toBe("0.002");
    expect(formatDerivedUnitCost(0.1)).toBe("0.1");
  });

  it("shows up to 2 decimals for values >= 1, trimming trailing zeros", () => {
    expect(formatDerivedUnitCost(2.5)).toBe("2.5");
    expect(formatDerivedUnitCost(2)).toBe("2");
  });
});
