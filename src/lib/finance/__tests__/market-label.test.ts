import { describe, it, expect } from "vitest";
import { marketLabelKey } from "../market-label";

describe("marketLabelKey", () => {
  it("names each PaymentMarket value with its own profile.feesAndTaxes.market.* key", () => {
    expect(marketLabelKey("INDONESIA")).toBe("profile.feesAndTaxes.market.indonesia");
    expect(marketLabelKey("FRANCE")).toBe("profile.feesAndTaxes.market.france");
    expect(marketLabelKey("INTERNATIONAL")).toBe("profile.feesAndTaxes.market.international");
  });

  it("reads a missing or unknown market as Indonesia, the finance settings' default", () => {
    expect(marketLabelKey(undefined)).toBe("profile.feesAndTaxes.market.indonesia");
    expect(marketLabelKey(null)).toBe("profile.feesAndTaxes.market.indonesia");
    expect(marketLabelKey("")).toBe("profile.feesAndTaxes.market.indonesia");
    expect(marketLabelKey("WORLDWIDE")).toBe("profile.feesAndTaxes.market.indonesia");
  });
});
