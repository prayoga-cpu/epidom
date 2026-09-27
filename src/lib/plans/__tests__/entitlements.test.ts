import { describe, it, expect } from "vitest";
import {
  FEATURE_MIN_PLAN,
  PLAN_MAX_STORES,
  minPlanForStores,
  planHasFeature,
  planAtLeast,
} from "../entitlements";
import { canCreateStore, getStoreLimit } from "@/config/stripe.config";

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

describe("finance, custom development and the Enterprise tier", () => {
  // Operations sells the recipe/COGS engine and unlimited outlets; Finance (and
  // its All outlets roll-up) is where both pay off, so it ships with them.
  it("Finance is an Operations feature", () => {
    expect(FEATURE_MIN_PLAN.finance).toBe("OPERATIONS");
    expect(planHasFeature("POS", "finance")).toBe(false);
    expect(planHasFeature("OPERATIONS", "finance")).toBe(true);
  });

  // Asking for a custom build is how an Enterprise engagement starts, so it
  // can't itself require Enterprise.
  it("Custom Development is open to every paying plan", () => {
    expect(FEATURE_MIN_PLAN.customDevelopment).toBe("POS");
    expect(planHasFeature("FREE", "customDevelopment")).toBe(false);
    expect(planHasFeature("POS", "customDevelopment")).toBe(true);
  });

  it("no self-serve feature is gated to Enterprise — it is the custom-build tier", () => {
    expect(Object.values(FEATURE_MIN_PLAN)).not.toContain("ENTERPRISE");
  });
});

describe("store limits per plan", () => {
  it("Operations covers up to three outlets; a fourth is Enterprise", () => {
    expect(PLAN_MAX_STORES).toEqual({ FREE: 1, POS: 1, OPERATIONS: 3, ENTERPRISE: Infinity });
  });

  it("minPlanForStores names the lowest plan that fits the store count", () => {
    expect(minPlanForStores(1)).toBe("FREE");
    expect(minPlanForStores(2)).toBe("OPERATIONS");
    expect(minPlanForStores(3)).toBe("OPERATIONS");
    expect(minPlanForStores(4)).toBe("ENTERPRISE");
    expect(minPlanForStores(40)).toBe("ENTERPRISE");
  });

  it("the store limits the creation checks read are the same table", () => {
    for (const plan of ["FREE", "POS", "OPERATIONS", "ENTERPRISE"] as const) {
      expect(getStoreLimit(plan)).toBe(PLAN_MAX_STORES[plan]);
    }
    expect(canCreateStore("OPERATIONS", 2)).toBe(true);
    expect(canCreateStore("OPERATIONS", 3)).toBe(false);
    expect(canCreateStore("ENTERPRISE", 3)).toBe(true);
  });
});
