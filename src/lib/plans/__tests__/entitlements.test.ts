import { describe, it, expect } from "vitest";
import { FEATURE_MIN_PLAN, planHasFeature, planAtLeast } from "../entitlements";

describe("discounts plan gate (POS Mode upgrade banner)", () => {
  // Before this phase, pos-cart.tsx's discount handler had zero plan check
  // at all — any Cashier, regardless of tier, could apply a discount. /pos
  // itself only requires POS tier while Staff creation only requires
  // Operations tier to CREATE a Cashier, not to keep one after a downgrade,
  // so a POS-tier store with an existing Cashier is a real reachable state.
  it("requires OPERATIONS tier, matching the Schedule/Staff feature it sits beside", () => {
    expect(FEATURE_MIN_PLAN.discounts).toBe("OPERATIONS");
  });

  it("FREE and POS tiers do not have the discounts feature", () => {
    expect(planHasFeature("FREE", "discounts")).toBe(false);
    expect(planHasFeature("POS", "discounts")).toBe(false);
  });

  it("OPERATIONS and ENTERPRISE tiers do have it", () => {
    expect(planHasFeature("OPERATIONS", "discounts")).toBe(true);
    expect(planHasFeature("ENTERPRISE", "discounts")).toBe(true);
  });

  it("planAtLeast(currentPlan, FEATURE_MIN_PLAN.discounts) — the exact check pos-cart.tsx runs", () => {
    expect(planAtLeast("POS", FEATURE_MIN_PLAN.discounts)).toBe(false);
    expect(planAtLeast("OPERATIONS", FEATURE_MIN_PLAN.discounts)).toBe(true);
  });
});
