import { describe, it, expect } from "vitest";
import { ACTIVE_POS_STATUSES, NON_REVENUE_STATUSES } from "../order-status";

/**
 * These two constants are the single source of truth for which order
 * statuses count as "active" (Active Queue / KDS feed) vs. "non-revenue"
 * (excluded from analytics/finance aggregation). A HELD order silently
 * counting as revenue is exactly the bug class this file exists to prevent.
 */
describe("ACTIVE_POS_STATUSES", () => {
  it("includes HELD (so it reaches the Active Queue / SSE feed)", () => {
    expect(ACTIVE_POS_STATUSES).toContain("HELD");
  });

  it("includes the normal in-flight statuses", () => {
    expect(ACTIVE_POS_STATUSES).toEqual(
      expect.arrayContaining(["PENDING", "CONFIRMED", "IN_PRODUCTION", "READY"])
    );
  });

  it("excludes terminal statuses", () => {
    expect(ACTIVE_POS_STATUSES).not.toContain("DELIVERED");
    expect(ACTIVE_POS_STATUSES).not.toContain("CANCELLED");
  });
});

describe("NON_REVENUE_STATUSES", () => {
  it("includes HELD (unpaid orders must not count as revenue)", () => {
    expect(NON_REVENUE_STATUSES).toContain("HELD");
  });

  it("includes CANCELLED", () => {
    expect(NON_REVENUE_STATUSES).toContain("CANCELLED");
  });

  it("excludes DELIVERED (a completed sale is real revenue)", () => {
    expect(NON_REVENUE_STATUSES).not.toContain("DELIVERED");
  });
});
