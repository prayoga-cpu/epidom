import { describe, it, expect } from "vitest";
import { computeTrend, computeRate } from "../storefront-metrics";

describe("computeTrend", () => {
  it("computes a positive percent change", () => {
    expect(computeTrend(120, 100)).toBe(20);
  });

  it("computes a negative percent change", () => {
    expect(computeTrend(80, 100)).toBe(-20);
  });

  it("returns 0 when nothing changed", () => {
    expect(computeTrend(50, 50)).toBe(0);
  });

  it("returns +100 when there was no traffic last period but there is now", () => {
    expect(computeTrend(10, 0)).toBe(100);
  });

  it("returns 0 when there was no traffic in either period", () => {
    expect(computeTrend(0, 0)).toBe(0);
  });

  it("rounds to one decimal place", () => {
    // (10 - 3) / 3 * 100 = 233.333...
    expect(computeTrend(10, 3)).toBe(233.3);
  });
});

describe("computeRate", () => {
  it("computes a percentage of the denominator", () => {
    expect(computeRate(25, 100)).toBe(25);
  });

  it("returns 0 when the denominator is 0 (no divide-by-zero)", () => {
    expect(computeRate(5, 0)).toBe(0);
  });

  it("rounds to one decimal place", () => {
    // 1/3 * 100 = 33.333...
    expect(computeRate(1, 3)).toBe(33.3);
  });

  it("can exceed 100% (e.g. repeat visitors clicking WhatsApp more than once)", () => {
    expect(computeRate(15, 10)).toBe(150);
  });
});
