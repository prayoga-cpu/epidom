import { describe, expect, it } from "vitest";
import { PLAN_PRICING } from "@/lib/constants/plan-pricing";
import {
  clamp,
  computeMargin,
  defaultInputs,
  PAYMENT_FEE,
  savingBucket,
} from "../margin-calculator";
import { availablePaths, CURRENT_POS_OPTIONS, recommend } from "../migration";

describe("computeMargin", () => {
  it("follows the spec's formula on its default inputs (EUR, POS)", () => {
    const input = defaultInputs("EUR");
    expect(input).toMatchObject({
      revenue: 30_000,
      deliveryShare: 0.25,
      commission: 0.3,
      movedShare: 0.2,
      averageOrder: 22,
      currentPosFee: 0,
      currentMargin: 0.03,
      plan: "POS",
    });

    const r = computeMargin(input, "EUR");
    // delivery_revenue = R × d
    expect(r.deliveryRevenue).toBe(7_500);
    // commission_now = delivery_revenue × c
    expect(r.commissionNow).toBeCloseTo(2_250, 6);
    // moved_revenue = delivery_revenue × m; moved_orders = moved_revenue / a
    expect(r.movedRevenue).toBeCloseTo(1_500, 6);
    expect(r.movedOrders).toBeCloseTo(1_500 / 22, 6);
    // direct_cost = moved_revenue × 1.5 % + moved_orders × 0.25 €
    const directCost = 1_500 * 0.015 + (1_500 / 22) * 0.25;
    expect(r.directCost).toBeCloseTo(directCost, 6);
    // commission_saved = moved_revenue × c − direct_cost
    expect(r.commissionSaved).toBeCloseTo(1_500 * 0.3 - directCost, 6);
    // pos_fee_delta = P − live plan price
    expect(r.planPrice).toBe(PLAN_PRICING.POS.EUR.monthly);
    expect(r.posFeeDelta).toBeCloseTo(-13.99, 6);
    const monthly = 1_500 * 0.3 - directCost - 13.99;
    expect(r.monthlySaving).toBeCloseTo(monthly, 6);
    expect(r.yearlySaving).toBeCloseTo(monthly * 12, 6);
    expect(r.marginPoints).toBeCloseTo(monthly / 30_000, 9);
    expect(r.newMargin).toBeCloseTo(0.03 + monthly / 30_000, 9);
  });

  it("goes negative, and says so, when nothing moves off the delivery apps", () => {
    const r = computeMargin({ ...defaultInputs("EUR"), movedShare: 0, plan: "OPERATIONS" }, "EUR");
    expect(r.commissionSaved).toBe(0);
    expect(r.monthlySaving).toBeCloseTo(-PLAN_PRICING.OPERATIONS.EUR.monthly, 6);
    expect(r.newMargin).toBeLessThan(0.03);
  });

  it("counts a current POS fee the visitor would drop as a saving", () => {
    const withFee = computeMargin({ ...defaultInputs("EUR"), currentPosFee: 60 }, "EUR");
    const without = computeMargin(defaultInputs("EUR"), "EUR");
    expect(withFee.monthlySaving - without.monthlySaving).toBeCloseTo(60, 6);
  });

  it("uses each currency's own plan price and payment fee", () => {
    for (const currency of ["EUR", "USD", "IDR"] as const) {
      const r = computeMargin(defaultInputs(currency), currency);
      expect(r.planPrice).toBe(PLAN_PRICING.POS[currency].monthly);
      const fee = PAYMENT_FEE[currency];
      expect(r.directCost).toBeCloseTo(r.movedRevenue * fee.percent + r.movedOrders * fee.flat, 6);
    }
  });

  it("does not divide by zero on a zero average order or zero revenue", () => {
    const r = computeMargin({ ...defaultInputs("EUR"), averageOrder: 0, revenue: 0 }, "EUR");
    expect(r.movedOrders).toBe(0);
    expect(r.marginPoints).toBe(0);
    expect(Number.isFinite(r.monthlySaving)).toBe(true);
  });
});

describe("clamp", () => {
  it("keeps a value inside its range and treats NaN as the minimum", () => {
    expect(clamp(150, { min: 0, max: 100 })).toBe(100);
    expect(clamp(-5, { min: 0, max: 100 })).toBe(0);
    expect(clamp(Number.NaN, { min: 5, max: 100 })).toBe(5);
  });
});

describe("savingBucket", () => {
  it("never reports the exact figure", () => {
    expect(savingBucket(-10, "EUR")).toBe("negative");
    expect(savingBucket(50, "EUR")).toBe("0-100");
    expect(savingBucket(396, "EUR")).toBe("100-500");
    expect(savingBucket(9_000, "USD")).toBe("5000+");
    expect(savingBucket(2_000_000, "IDR")).toBe("1500000-7500000");
  });
});

describe("migration recommendation", () => {
  it("keep my till + online ordering is POS, not Free (ordering is a POS feature)", () => {
    expect(recommend({ currentPos: "zelty", path: "A", outlets: "1" })).toEqual({
      plan: "POS",
      keepsTill: true,
      upgradedForOutlets: false,
      cta: "trial",
    });
  });

  it("margin and recipes is Operations, whatever the outlet count below four", () => {
    for (const outlets of ["1", "2-3"] as const) {
      expect(recommend({ currentPos: "sumup", path: "B", outlets })).toMatchObject({
        plan: "OPERATIONS",
        keepsTill: true,
        cta: "operations",
      });
    }
  });

  it("2 to 3 outlets moves a POS path up to Operations, and says why", () => {
    expect(recommend({ currentPos: "tiller", path: "C", outlets: "2-3" })).toEqual({
      plan: "OPERATIONS",
      keepsTill: false,
      upgradedForOutlets: true,
      cta: "operations",
    });
  });

  it("4 or more outlets is an Enterprise conversation on WhatsApp", () => {
    for (const path of ["A", "B", "C"] as const) {
      expect(recommend({ currentPos: "other", path, outlets: "4+" })).toMatchObject({
        plan: "ENTERPRISE",
        cta: "whatsapp",
      });
    }
  });

  it("someone without a till keeps no till", () => {
    expect(recommend({ currentPos: "none", path: "A", outlets: "1" }).keepsTill).toBe(false);
  });

  it("does not offer the full switch on the French site until NF525 is settled", () => {
    expect(availablePaths("fr")).toEqual(["A", "B"]);
    expect(availablePaths("en")).toEqual(["A", "B", "C"]);
    expect(availablePaths("id")).toEqual(["A", "B", "C"]);
  });

  it("offers the tills each market actually leaves", () => {
    expect(CURRENT_POS_OPTIONS.fr).toContain("zelty");
    expect(CURRENT_POS_OPTIONS.id).toContain("moka");
    for (const list of Object.values(CURRENT_POS_OPTIONS)) {
      expect(list.at(-1)).toBe("none");
    }
  });
});
