import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Prisma mock ───────────────────────────────────────────────────────────────
// var (not const/let) avoids TDZ when the vi.mock factory is hoisted.

var prismaMock: any;

vi.mock("@/lib/prisma", () => {
  prismaMock = {
    store: { findUnique: vi.fn() },
    discountPreset: { findFirst: vi.fn() },
    coupon: { findFirst: vi.fn() },
    customer: { findFirst: vi.fn() },
    storeLoyaltySettings: { findUnique: vi.fn() },
  };
  return { prisma: prismaMock };
});

import { resolveOrderDiscount, PromotionsPlanError } from "../pos-discount.service";
import { OrderBuildError } from "../pos-order-builder";

function withPlan(plan: string, status = "ACTIVE") {
  prismaMock.store.findUnique.mockResolvedValue({
    business: { user: { subscription: { plan, status } } },
  });
}

function withLoyalty(rules: Partial<Record<string, unknown>> | null) {
  prismaMock.storeLoyaltySettings.findUnique.mockResolvedValue(
    rules && {
      enabled: true,
      spendPerPoint: "10",
      pointValue: "1",
      minRedeemPoints: 0,
      ...rules,
    }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  withPlan("OPERATIONS");
  withLoyalty(null);
});

describe("resolveOrderDiscount — manual discount (unchanged behaviour)", () => {
  it("passes the cashier's flat amount and reason straight through", async () => {
    const result = await resolveOrderDiscount({
      storeId: "store-1",
      itemsTotal: 100,
      discountAmount: 15,
      discountReason: "Staff discount",
      tolerant: false,
    });

    expect(result.discountAmount).toBe(15);
    expect(result.discountReason).toBe("Staff discount");
    expect(result.couponId).toBeNull();
    expect(result.pointsRedeemed).toBe(0);
  });

  it("never touches the plan gate when no promotion is involved", async () => {
    await resolveOrderDiscount({
      storeId: "store-1",
      itemsTotal: 100,
      discountAmount: 15,
      tolerant: false,
    });
    // The manual discount is deliberately NOT gated — see FEATURE_MIN_PLAN.
    expect(prismaMock.store.findUnique).not.toHaveBeenCalled();
  });

  it("clamps a discount larger than the bill", async () => {
    const result = await resolveOrderDiscount({
      storeId: "store-1",
      itemsTotal: 20,
      discountAmount: 500,
      tolerant: false,
    });
    expect(result.discountAmount).toBe(20);
  });
});

describe("resolveOrderDiscount — plan gate", () => {
  it("rejects a preset/coupon/points on a below-tier store", async () => {
    withPlan("POS");
    await expect(
      resolveOrderDiscount({
        storeId: "store-1",
        itemsTotal: 100,
        presetId: "preset-1",
        tolerant: false,
      })
    ).rejects.toBeInstanceOf(PromotionsPlanError);
  });

  it("treats an inactive subscription as FREE", async () => {
    withPlan("OPERATIONS", "PAST_DUE");
    await expect(
      resolveOrderDiscount({
        storeId: "store-1",
        itemsTotal: 100,
        couponCode: "SAVE10",
        tolerant: false,
      })
    ).rejects.toBeInstanceOf(PromotionsPlanError);
  });

  it("degrades instead of throwing on an offline replay", async () => {
    withPlan("POS");
    const result = await resolveOrderDiscount({
      storeId: "store-1",
      itemsTotal: 100,
      presetId: "preset-1",
      // The customer already paid 90 on a disconnected till.
      discountAmount: 10,
      tolerant: true,
    });

    expect(result.discountAmount).toBe(10);
    expect(result.warnings).toContain("Promotions are not available on this plan");
    expect(prismaMock.discountPreset.findFirst).not.toHaveBeenCalled();
  });
});

describe("resolveOrderDiscount — presets", () => {
  it("prices a PERCENT preset server-side and builds the reason", async () => {
    prismaMock.discountPreset.findFirst.mockResolvedValue({
      id: "preset-1",
      name: "Happy hour",
      type: "PERCENT",
      value: "20",
      isActive: true,
    });

    const result = await resolveOrderDiscount({
      storeId: "store-1",
      itemsTotal: 250,
      presetId: "preset-1",
      // A tampered client amount must be ignored entirely.
      discountAmount: 249,
      tolerant: false,
    });

    expect(result.discountAmount).toBe(50);
    expect(result.discountReason).toBe("Preset: Happy hour");
  });

  /**
   * Currency is LITERAL: a FIXED preset of 5 in a EUR store is €5, never
   * run through the IDR base-currency conversion that bit this codebase
   * before. Nothing in this path may look at a currency at all.
   */
  it("treats a FIXED preset as a literal amount in the store's own currency", async () => {
    prismaMock.discountPreset.findFirst.mockResolvedValue({
      id: "preset-1",
      name: "Remise fidélité",
      type: "FIXED",
      value: "5",
      isActive: true,
    });

    const result = await resolveOrderDiscount({
      storeId: "store-1",
      itemsTotal: 20, // €20 bill in a French store
      presetId: "preset-1",
      tolerant: false,
    });

    expect(result.discountAmount).toBe(5);
  });

  it("rejects a missing or deactivated preset", async () => {
    prismaMock.discountPreset.findFirst.mockResolvedValue(null);
    await expect(
      resolveOrderDiscount({
        storeId: "store-1",
        itemsTotal: 100,
        presetId: "preset-1",
        tolerant: false,
      })
    ).rejects.toBeInstanceOf(OrderBuildError);
  });

  it("falls back to the flat amount already charged on a replay", async () => {
    prismaMock.discountPreset.findFirst.mockResolvedValue(null);
    const result = await resolveOrderDiscount({
      storeId: "store-1",
      itemsTotal: 100,
      presetId: "preset-1",
      discountAmount: 20,
      discountReason: "Happy hour",
      tolerant: true,
    });

    expect(result.discountAmount).toBe(20);
    expect(result.discountReason).toBe("Happy hour");
    expect(result.warnings).toHaveLength(1);
  });
});

describe("resolveOrderDiscount — coupons", () => {
  const validCoupon = {
    id: "cp-1",
    code: "SAVE10",
    type: "FIXED",
    value: "10",
    minSubtotal: null,
    maxUses: 5,
    usedCount: 1,
    validFrom: null,
    validUntil: null,
    isActive: true,
  };

  it("uppercases the code, prices it, and reports what to consume", async () => {
    prismaMock.coupon.findFirst.mockResolvedValue(validCoupon);

    const result = await resolveOrderDiscount({
      storeId: "store-1",
      itemsTotal: 100,
      couponCode: " save10 ",
      tolerant: false,
    });

    expect(prismaMock.coupon.findFirst).toHaveBeenCalledWith({
      where: { storeId: "store-1", code: "SAVE10" },
    });
    expect(result.discountAmount).toBe(10);
    expect(result.discountReason).toBe("Coupon: SAVE10");
    expect(result.couponId).toBe("cp-1");
    // Needed so the usedCount bump inside the order transaction can be
    // conditional on `usedCount < maxUses`.
    expect(result.couponMaxUses).toBe(5);
  });

  it("rejects an expired coupon", async () => {
    prismaMock.coupon.findFirst.mockResolvedValue({
      ...validCoupon,
      validUntil: new Date("2020-01-01"),
    });
    await expect(
      resolveOrderDiscount({
        storeId: "store-1",
        itemsTotal: 100,
        couponCode: "SAVE10",
        tolerant: false,
      })
    ).rejects.toThrow(/expired/i);
  });

  it("rejects a coupon below its minimum subtotal", async () => {
    prismaMock.coupon.findFirst.mockResolvedValue({ ...validCoupon, minSubtotal: "200" });
    await expect(
      resolveOrderDiscount({
        storeId: "store-1",
        itemsTotal: 100,
        couponCode: "SAVE10",
        tolerant: false,
      })
    ).rejects.toBeInstanceOf(OrderBuildError);
  });

  it("keeps the money but drops the redemption on a replay", async () => {
    prismaMock.coupon.findFirst.mockResolvedValue({ ...validCoupon, usedCount: 5 });
    const result = await resolveOrderDiscount({
      storeId: "store-1",
      itemsTotal: 100,
      couponCode: "SAVE10",
      discountAmount: 10,
      tolerant: true,
    });

    expect(result.discountAmount).toBe(10);
    expect(result.couponId).toBeNull();
    expect(result.warnings).toHaveLength(1);
  });

  it("prefers the coupon when a payload carries both a preset and a coupon", async () => {
    prismaMock.coupon.findFirst.mockResolvedValue(validCoupon);
    const result = await resolveOrderDiscount({
      storeId: "store-1",
      itemsTotal: 100,
      presetId: "preset-1",
      couponCode: "SAVE10",
      tolerant: false,
    });

    expect(prismaMock.discountPreset.findFirst).not.toHaveBeenCalled();
    expect(result.couponId).toBe("cp-1");
    expect(result.warnings).toHaveLength(1);
  });
});

describe("resolveOrderDiscount — loyalty points", () => {
  beforeEach(() => {
    withLoyalty({ spendPerPoint: "10", pointValue: "1", minRedeemPoints: 10 });
    prismaMock.customer.findFirst.mockResolvedValue({ points: 500 });
  });

  it("stacks points on top of the primary discount and names both", async () => {
    prismaMock.discountPreset.findFirst.mockResolvedValue({
      id: "preset-1",
      name: "Happy hour",
      type: "FIXED",
      value: "20",
      isActive: true,
    });

    const result = await resolveOrderDiscount({
      storeId: "store-1",
      itemsTotal: 100,
      presetId: "preset-1",
      customerId: "cus-1",
      redeemPoints: 30,
      tolerant: false,
    });

    expect(result.discountAmount).toBe(50); // 20 preset + 30 × 1
    expect(result.pointsRedeemed).toBe(30);
    expect(result.discountReason).toBe("Preset: Happy hour + Points: 30");
  });

  it("rejects redeeming more than the balance", async () => {
    prismaMock.customer.findFirst.mockResolvedValue({ points: 10 });
    await expect(
      resolveOrderDiscount({
        storeId: "store-1",
        itemsTotal: 100,
        customerId: "cus-1",
        redeemPoints: 50,
        tolerant: false,
      })
    ).rejects.toThrow(/does not have that many points/i);
  });

  it("rejects a redemption below the store's minimum", async () => {
    await expect(
      resolveOrderDiscount({
        storeId: "store-1",
        itemsTotal: 100,
        customerId: "cus-1",
        redeemPoints: 5,
        tolerant: false,
      })
    ).rejects.toThrow(/minimum/i);
  });

  it("rejects points when the store has loyalty off", async () => {
    withLoyalty(null);
    await expect(
      resolveOrderDiscount({
        storeId: "store-1",
        itemsTotal: 100,
        customerId: "cus-1",
        redeemPoints: 30,
        tolerant: false,
      })
    ).rejects.toThrow(/not enabled/i);
  });

  it("degrades a short balance on a replay instead of losing the sale", async () => {
    prismaMock.customer.findFirst.mockResolvedValue({ points: 0 });
    const result = await resolveOrderDiscount({
      storeId: "store-1",
      itemsTotal: 100,
      customerId: "cus-1",
      redeemPoints: 30,
      discountAmount: 30,
      tolerant: true,
    });

    expect(result.pointsRedeemed).toBe(0);
    // The customer was already charged 70 offline; that stands.
    expect(result.discountAmount).toBe(30);
    expect(result.warnings).toHaveLength(1);
  });

  it("lets points cover exactly what the primary discount left payable", async () => {
    const result = await resolveOrderDiscount({
      storeId: "store-1",
      itemsTotal: 40,
      discountAmount: 30,
      customerId: "cus-1",
      redeemPoints: 10,
      tolerant: false,
    });

    // 30 manual + 10 points × 1 = the whole bill, never more.
    expect(result.discountAmount).toBe(40);
    expect(result.pointsRedeemed).toBe(10);
  });

  it("refuses to burn more points than the remaining bill is worth", async () => {
    await expect(
      resolveOrderDiscount({
        storeId: "store-1",
        itemsTotal: 40,
        discountAmount: 30,
        customerId: "cus-1",
        redeemPoints: 100,
        tolerant: false,
      })
    ).rejects.toThrow(/more than the bill/i);

    // On a replay the burn is dropped rather than clamped — the money the
    // customer was charged (the flat amount) is what stands.
    const replayed = await resolveOrderDiscount({
      storeId: "store-1",
      itemsTotal: 40,
      discountAmount: 30,
      customerId: "cus-1",
      redeemPoints: 100,
      tolerant: true,
    });
    expect(replayed.pointsRedeemed).toBe(0);
    expect(replayed.discountAmount).toBe(30);
    expect(replayed.warnings).toHaveLength(1);
  });
});
