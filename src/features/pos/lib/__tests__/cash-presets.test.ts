import { describe, it, expect } from "vitest";
import { getCashPresets, MAX_CASH_PRESETS } from "../cash-presets";

describe("getCashPresets", () => {
  it("IDR: exact first, then the round-ups a customer hands over (Moka's 36.000 example)", () => {
    expect(getCashPresets(36_000, "IDR")).toEqual([36_000, 40_000, 50_000, 100_000]);
  });

  it("IDR: a large odd total offers 5k/10k/50k/100k round-ups", () => {
    expect(getCashPresets(112_000, "IDR")).toEqual([112_000, 115_000, 120_000, 150_000, 200_000]);
  });

  it("IDR: a total already on a boundary still gets bigger options, never a single button", () => {
    expect(getCashPresets(100_000, "IDR")).toEqual([100_000, 105_000, 110_000, 150_000, 200_000]);
  });

  it("IDR: a tiny total reaches the common 50k/100k notes", () => {
    expect(getCashPresets(3_500, "IDR")).toEqual([3_500, 5_000, 10_000, 50_000, 100_000]);
  });

  it("USD: rounds up to 5/10/20/50/100 notes", () => {
    expect(getCashPresets(14.5, "USD")).toEqual([14.5, 15, 20, 50, 100]);
  });

  it("EUR: rounds up to 5/10/20/50/100 notes", () => {
    expect(getCashPresets(8.9, "EUR")).toEqual([8.9, 10, 20, 50, 100]);
  });

  it("EUR: a total exactly on a note offers the next ones up", () => {
    expect(getCashPresets(20, "EUR")).toEqual([20, 25, 30, 40, 50]);
  });

  it("EUR: cent-level totals stay exact and float-safe", () => {
    expect(getCashPresets(19.99, "EUR")).toEqual([19.99, 20, 50, 100]);
  });

  it("matches the currency code case-insensitively", () => {
    expect(getCashPresets(8.9, "eur")).toEqual(getCashPresets(8.9, "EUR"));
  });

  it("falls back to magnitude-scaled steps for a currency with no table", () => {
    expect(getCashPresets(36, "GBP")).toEqual([36, 40, 50, 100]);
  });

  it("returns nothing for a zero, negative or non-finite total", () => {
    expect(getCashPresets(0, "IDR")).toEqual([]);
    expect(getCashPresets(-5, "EUR")).toEqual([]);
    expect(getCashPresets(Number.NaN, "USD")).toEqual([]);
    expect(getCashPresets(Number.POSITIVE_INFINITY, "USD")).toEqual([]);
  });

  it.each([
    [1, "EUR"],
    [7.35, "USD"],
    [48_500, "IDR"],
    [250_000, "IDR"],
    [999.99, "EUR"],
  ])(
    "every option covers the bill and the list is ascending and capped (%s %s)",
    (total, currency) => {
      const presets = getCashPresets(total, currency);
      expect(presets[0]).toBe(total);
      expect(presets.length).toBeLessThanOrEqual(MAX_CASH_PRESETS);
      expect(presets.every((p) => p >= total)).toBe(true);
      expect([...presets].sort((a, b) => a - b)).toEqual(presets);
      expect(new Set(presets).size).toBe(presets.length);
    }
  );
});
