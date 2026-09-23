import { describe, expect, it } from "vitest";
import { suggestedLoyaltyValues } from "../loyalty-defaults";

describe("suggestedLoyaltyValues", () => {
  it("suggests 10.000 to earn a point and 100 per point for IDR", () => {
    expect(suggestedLoyaltyValues("IDR")).toEqual({ spendPerPoint: 10_000, pointValue: 100 });
  });

  it("suggests 1 per point and 0.05 per point for EUR and USD", () => {
    expect(suggestedLoyaltyValues("EUR")).toEqual({ spendPerPoint: 1, pointValue: 0.05 });
    expect(suggestedLoyaltyValues("USD")).toEqual({ spendPerPoint: 1, pointValue: 0.05 });
  });

  it("falls back to the EUR/USD style for any other currency", () => {
    for (const currency of ["GBP", "CHF", "JPY", "XYZ"]) {
      expect(suggestedLoyaltyValues(currency)).toEqual({ spendPerPoint: 1, pointValue: 0.05 });
    }
  });

  it("is case- and whitespace-insensitive on the code", () => {
    expect(suggestedLoyaltyValues("idr")).toEqual(suggestedLoyaltyValues("IDR"));
    expect(suggestedLoyaltyValues(" eur ")).toEqual({ spendPerPoint: 1, pointValue: 0.05 });
  });

  it("hands out a copy, so a caller can't corrupt the shared table", () => {
    const first = suggestedLoyaltyValues("IDR");
    first.spendPerPoint = 1;
    expect(suggestedLoyaltyValues("IDR").spendPerPoint).toBe(10_000);

    const fallback = suggestedLoyaltyValues("GBP");
    fallback.pointValue = 99;
    expect(suggestedLoyaltyValues("EUR").pointValue).toBe(0.05);
  });
});
