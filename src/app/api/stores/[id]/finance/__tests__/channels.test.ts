import { describe, it, expect } from "vitest";
import { commissionRate } from "@/config/aggregator.config";
import type { OrderSource } from "@prisma/client";

/**
 * Pure logic tests for per-channel commission calculations.
 * Mirrors the formula in finance/channels/route.ts.
 */

function calcChannel(source: OrderSource, revenue: number) {
  const commission = commissionRate(source);
  const commissionAmount = Math.round(revenue * commission * 100) / 100;
  const netRevenue = Math.round((revenue - commissionAmount) * 100) / 100;
  return { source, revenue, commissionPct: commission * 100, commissionAmount, netRevenue };
}

describe("per-channel commission calculations", () => {
  it("GoFood: 20% commission deducted from net revenue", () => {
    const result = calcChannel("GOFOOD", 1_000_000);
    expect(result.commissionPct).toBe(20);
    expect(result.commissionAmount).toBe(200_000);
    expect(result.netRevenue).toBe(800_000);
  });

  it("GrabFood: 20% commission", () => {
    const result = calcChannel("GRABFOOD", 500_000);
    expect(result.commissionAmount).toBe(100_000);
    expect(result.netRevenue).toBe(400_000);
  });

  it("ShopeeFood: 20% commission", () => {
    const result = calcChannel("SHOPEEFOOD", 750_000);
    expect(result.commissionAmount).toBe(150_000);
    expect(result.netRevenue).toBe(600_000);
  });

  it("Tokopedia: 15% commission (lower than others)", () => {
    const result = calcChannel("TOKOPEDIA", 1_000_000);
    expect(result.commissionPct).toBe(15);
    expect(result.commissionAmount).toBe(150_000);
    expect(result.netRevenue).toBe(850_000);
  });

  it("MANUAL / STOREFRONT / POS: 0% commission, netRevenue = revenue", () => {
    for (const source of ["MANUAL", "STOREFRONT", "POS"] as OrderSource[]) {
      const result = calcChannel(source, 250_000);
      expect(result.commissionPct).toBe(0);
      expect(result.commissionAmount).toBe(0);
      expect(result.netRevenue).toBe(250_000);
    }
  });

  it("rounds commission amounts to 2 decimal places", () => {
    // 20% of 99,999 = 19,999.8
    const result = calcChannel("GOFOOD", 99_999);
    expect(result.commissionAmount).toBe(19_999.8);
    expect(result.netRevenue).toBe(79_999.2);
    expect(Number.isInteger(result.commissionAmount * 100)).toBe(true);
  });

  it("netRevenue + commissionAmount = revenue (within floating point tolerance)", () => {
    const result = calcChannel("GOFOOD", 1_234_567);
    expect(result.netRevenue + result.commissionAmount).toBeCloseTo(result.revenue, 1);
  });
});
