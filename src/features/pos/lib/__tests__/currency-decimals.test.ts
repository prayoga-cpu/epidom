import { describe, it, expect } from "vitest";
import { getCurrencyDecimals } from "../currency-decimals";

describe("getCurrencyDecimals", () => {
  it("IDR has no decimals even though Intl reports two", () => {
    expect(getCurrencyDecimals("IDR")).toBe(0);
    expect(getCurrencyDecimals("idr")).toBe(0);
  });

  it("uses the currency's real fraction digits otherwise", () => {
    expect(getCurrencyDecimals("EUR")).toBe(2);
    expect(getCurrencyDecimals("USD")).toBe(2);
    expect(getCurrencyDecimals("JPY")).toBe(0);
  });

  it("falls back to 2 for a code Intl cannot format", () => {
    expect(getCurrencyDecimals("not-a-code")).toBe(2);
  });
});
