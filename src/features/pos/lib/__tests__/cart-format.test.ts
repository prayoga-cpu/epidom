import { describe, it, expect } from "vitest";
import { discountSourceLabel, formatPax, formatRatePercent, itemsTotalOf } from "../cart-format";

describe("formatRatePercent", () => {
  it("renders a 0–1 fraction as a percentage", () => {
    expect(formatRatePercent(0.1)).toBe("10%");
    expect(formatRatePercent(0.15)).toBe("15%");
    expect(formatRatePercent(0.2)).toBe("20%");
    expect(formatRatePercent(0)).toBe("0%");
  });

  it("keeps a real fraction of a percent and drops float noise", () => {
    expect(formatRatePercent(0.055)).toBe("5.5%");
    expect(formatRatePercent(0.0825)).toBe("8.25%");
    expect(formatRatePercent(0.07)).toBe("7%");
  });

  it("uses the reader's decimal separator", () => {
    // fr-FR: comma decimal and a (narrow) no-break space before the percent sign.
    expect(formatRatePercent(0.055, "fr").replace(/\s/g, " ")).toBe("5,5 %");
    expect(formatRatePercent(0.1, "fr").replace(/\s/g, " ")).toBe("10 %");
  });

  it("never prints NaN", () => {
    expect(formatRatePercent(Number.NaN)).toBe("0%");
  });
});

describe("discountSourceLabel", () => {
  const coupon = (code: string) => `Coupon ${code}`;

  it("is null with no discount", () => {
    expect(discountSourceLabel(null, coupon)).toBeNull();
  });

  it("uses the reason for a manual discount, and nothing when it has none", () => {
    expect(discountSourceLabel({ kind: "manual", amount: 5, reason: " Regular " }, coupon)).toBe(
      "Regular"
    );
    expect(discountSourceLabel({ kind: "manual", amount: 5 }, coupon)).toBeNull();
    expect(discountSourceLabel({ kind: "manual", amount: 5, reason: "  " }, coupon)).toBeNull();
  });

  it("names a preset and labels a coupon by its code", () => {
    expect(
      discountSourceLabel(
        { kind: "preset", presetId: "p", name: "Member", type: "PERCENT", value: 10 },
        coupon
      )
    ).toBe("Member");
    expect(
      discountSourceLabel(
        {
          kind: "coupon",
          couponId: "c",
          code: "SAVE10",
          type: "FIXED",
          value: 5,
          minSubtotal: null,
        },
        coupon
      )
    ).toBe("Coupon SAVE10");
  });
});

describe("itemsTotalOf", () => {
  it("sums the lines before any discount or charge, without float drift", () => {
    expect(itemsTotalOf([])).toBe(0);
    expect(itemsTotalOf([{ lineTotal: 0.1 }, { lineTotal: 0.2 }])).toBe(0.3);
    expect(itemsTotalOf([{ lineTotal: 12.5 }, { lineTotal: 7.25 }])).toBe(19.75);
  });
});

describe("formatPax", () => {
  const t = (key: string) =>
    ({
      "cashierCart.header.paxCount": "{count} couverts",
      "cashierCart.header.paxCountOne": "1 couvert",
    })[key] ?? key;

  it("has its own singular (French: '1 couvert', never '1 couverts')", () => {
    expect(formatPax(t, 1)).toBe("1 couvert");
    expect(formatPax(t, 2)).toBe("2 couverts");
    expect(formatPax(t, 12)).toBe("12 couverts");
  });
});
