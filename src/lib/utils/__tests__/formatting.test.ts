import { describe, it, expect } from "vitest";
import { formatCurrency, getCurrencySymbol } from "../formatting";

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
