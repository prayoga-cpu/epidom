import { describe, it, expect } from "vitest";
import {
  buildDiscountReason,
  checkCouponEligibility,
  checkRedeem,
  composeOrderDiscount,
  computeRuleDiscount,
  DISCOUNT_REASON_MAX,
  maxRedeemablePoints,
  pointsEarnedFor,
  pointsToValue,
  type CouponRules,
  type LoyaltyRules,
} from "../discounts";

const loyalty: LoyaltyRules = {
  enabled: true,
  spendPerPoint: 10_000,
  pointValue: 100,
  minRedeemPoints: 0,
};

describe("computeRuleDiscount", () => {
  it("PERCENT takes that share of the base", () => {
    expect(computeRuleDiscount({ type: "PERCENT", value: 10 }, 50_000)).toBe(5_000);
  });

  it("FIXED takes the literal amount", () => {
    expect(computeRuleDiscount({ type: "FIXED", value: 5_000 }, 50_000)).toBe(5_000);
  });

  it("FIXED is literal in the store's currency — a 5 EUR preset is 5, not converted", () => {
    expect(computeRuleDiscount({ type: "FIXED", value: 5 }, 42)).toBe(5);
  });

  it("never exceeds the base, so a bill can't go negative", () => {
    expect(computeRuleDiscount({ type: "FIXED", value: 90_000 }, 50_000)).toBe(50_000);
    expect(computeRuleDiscount({ type: "PERCENT", value: 150 }, 50_000)).toBe(50_000);
  });

  it("treats negative, NaN and empty bases as no discount", () => {
    expect(computeRuleDiscount({ type: "FIXED", value: -5 }, 100)).toBe(0);
    expect(computeRuleDiscount({ type: "PERCENT", value: Number.NaN }, 100)).toBe(0);
    expect(computeRuleDiscount({ type: "PERCENT", value: 10 }, 0)).toBe(0);
    expect(computeRuleDiscount({ type: "PERCENT", value: 10 }, Number.NaN)).toBe(0);
  });

  it("rounds to cents", () => {
    expect(computeRuleDiscount({ type: "PERCENT", value: 7 }, 19.99)).toBe(1.4);
  });
});

describe("checkCouponEligibility", () => {
  const now = new Date("2026-09-19T10:00:00Z");
  const ok: CouponRules = {
    isActive: true,
    validFrom: null,
    validUntil: null,
    maxUses: null,
    usedCount: 0,
    minSubtotal: null,
  };

  it("accepts an open coupon", () => {
    expect(checkCouponEligibility(ok, 10_000, now)).toBeNull();
  });

  it("rejects an inactive coupon first", () => {
    expect(
      checkCouponEligibility({ ...ok, isActive: false, maxUses: 1, usedCount: 1 }, 1, now)
    ).toBe("INACTIVE");
  });

  it("rejects before validFrom and after validUntil, but accepts exactly at the end", () => {
    expect(
      checkCouponEligibility({ ...ok, validFrom: new Date("2026-09-20T00:00:00Z") }, 1, now)
    ).toBe("NOT_STARTED");
    expect(
      checkCouponEligibility({ ...ok, validUntil: new Date("2026-09-18T00:00:00Z") }, 1, now)
    ).toBe("EXPIRED");
    expect(checkCouponEligibility({ ...ok, validUntil: now }, 1, now)).toBeNull();
  });

  it("rejects once usedCount reaches maxUses", () => {
    expect(checkCouponEligibility({ ...ok, maxUses: 5, usedCount: 4 }, 1, now)).toBeNull();
    expect(checkCouponEligibility({ ...ok, maxUses: 5, usedCount: 5 }, 1, now)).toBe("USED_UP");
  });

  it("enforces the minimum subtotal", () => {
    expect(checkCouponEligibility({ ...ok, minSubtotal: 50_000 }, 49_999, now)).toBe(
      "BELOW_MINIMUM"
    );
    expect(checkCouponEligibility({ ...ok, minSubtotal: 50_000 }, 50_000, now)).toBeNull();
  });
});

describe("loyalty points", () => {
  it("earns one point per spendPerPoint, rounding down", () => {
    expect(pointsEarnedFor(100_000, loyalty)).toBe(10);
    expect(pointsEarnedFor(9_999, loyalty)).toBe(0);
    expect(pointsEarnedFor(19_999, loyalty)).toBe(1);
  });

  it("does not lose a point to float error", () => {
    expect(pointsEarnedFor(0.3, { enabled: true, spendPerPoint: 0.1 })).toBe(3);
  });

  it("earns nothing when disabled, unconfigured, or the total is empty", () => {
    expect(pointsEarnedFor(100_000, { ...loyalty, enabled: false })).toBe(0);
    expect(pointsEarnedFor(100_000, { ...loyalty, spendPerPoint: 0 })).toBe(0);
    expect(pointsEarnedFor(0, loyalty)).toBe(0);
  });

  it("values points at pointValue each", () => {
    expect(pointsToValue(50, 100)).toBe(5_000);
    expect(pointsToValue(0, 100)).toBe(0);
    expect(pointsToValue(50, 0)).toBe(0);
  });

  describe("maxRedeemablePoints", () => {
    it("is capped by the balance", () => {
      expect(maxRedeemablePoints({ balance: 120, payable: 30_000, rules: loyalty })).toBe(120);
    });

    it("is capped by what is still payable", () => {
      expect(maxRedeemablePoints({ balance: 500, payable: 30_000, rules: loyalty })).toBe(300);
    });

    it("is zero below the store's minimum redemption", () => {
      expect(
        maxRedeemablePoints({
          balance: 500,
          payable: 30_000,
          rules: { ...loyalty, minRedeemPoints: 400 },
        })
      ).toBe(0);
    });

    it("is zero when disabled or there is nothing to pay", () => {
      expect(
        maxRedeemablePoints({
          balance: 500,
          payable: 30_000,
          rules: { ...loyalty, enabled: false },
        })
      ).toBe(0);
      expect(maxRedeemablePoints({ balance: 500, payable: 0, rules: loyalty })).toBe(0);
      expect(maxRedeemablePoints({ balance: 0, payable: 30_000, rules: loyalty })).toBe(0);
    });
  });

  describe("checkRedeem", () => {
    const base = { balance: 200, payable: 30_000 };

    it("accepts a valid redemption", () => {
      expect(checkRedeem({ ...base, points: 100, rules: loyalty })).toBeNull();
    });

    it("rejects each way it can be invalid", () => {
      expect(checkRedeem({ ...base, points: 100, rules: { ...loyalty, enabled: false } })).toBe(
        "DISABLED"
      );
      expect(checkRedeem({ ...base, points: 5, rules: { ...loyalty, minRedeemPoints: 10 } })).toBe(
        "BELOW_MINIMUM"
      );
      expect(checkRedeem({ ...base, points: 201, rules: loyalty })).toBe("EXCEEDS_BALANCE");
      expect(checkRedeem({ balance: 999, payable: 1_000, points: 11, rules: loyalty })).toBe(
        "EXCEEDS_PAYABLE"
      );
    });
  });
});

describe("composeOrderDiscount", () => {
  it("adds points on top of the primary discount", () => {
    expect(
      composeOrderDiscount({
        itemsTotal: 50_000,
        primaryAmount: 5_000,
        redeemPoints: 20,
        rules: loyalty,
      })
    ).toEqual({
      primaryAmount: 5_000,
      pointsRedeemed: 20,
      pointsValue: 2_000,
      discountAmount: 7_000,
    });
  });

  it("points can only cover what the primary discount left payable", () => {
    const out = composeOrderDiscount({
      itemsTotal: 10_000,
      primaryAmount: 4_000,
      redeemPoints: 100,
      rules: loyalty,
    });
    expect(out.pointsRedeemed).toBe(60);
    expect(out.pointsValue).toBe(6_000);
    expect(out.discountAmount).toBe(10_000);
  });

  it("clamps a primary discount that exceeds the items", () => {
    expect(composeOrderDiscount({ itemsTotal: 8_000, primaryAmount: 20_000 }).discountAmount).toBe(
      8_000
    );
  });

  it("ignores points when loyalty rules are absent or disabled", () => {
    const off = composeOrderDiscount({
      itemsTotal: 10_000,
      primaryAmount: 1_000,
      redeemPoints: 50,
    });
    expect(off).toEqual({
      primaryAmount: 1_000,
      pointsRedeemed: 0,
      pointsValue: 0,
      discountAmount: 1_000,
    });
    const disabled = composeOrderDiscount({
      itemsTotal: 10_000,
      primaryAmount: 1_000,
      redeemPoints: 50,
      rules: { ...loyalty, enabled: false },
    });
    expect(disabled.pointsRedeemed).toBe(0);
  });
});

describe("buildDiscountReason", () => {
  it("joins the non-empty parts", () => {
    expect(buildDiscountReason(["Member", null, " Coupon SAVE10 ", "", undefined])).toBe(
      "Member + Coupon SAVE10"
    );
  });

  it("is undefined when there is nothing to say", () => {
    expect(buildDiscountReason([null, "  "])).toBeUndefined();
  });

  it("stays within the API's 200-char limit", () => {
    expect(buildDiscountReason(["x".repeat(500)])!.length).toBe(DISCOUNT_REASON_MAX);
  });
});
