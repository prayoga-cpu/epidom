import { describe, it, expect } from "vitest";
import {
  dashboardNavigation,
  posModeNavItems,
  grantableOnlyNavItems,
  getAllDashboardNavItems,
  getAllAppNavItems,
} from "../navigation.config";
import { minPlanFor } from "@/lib/plans/entitlements";

describe("Back Office rail vs. the full app page universe", () => {
  it("dashboardNavigation no longer contains POS Mode's own routes", () => {
    const hrefs = getAllDashboardNavItems().map((i) => i.href);
    for (const moved of ["/pos", "/pos/orders", "/pos/kds", "/tables"]) {
      expect(hrefs).not.toContain(moved);
    }
  });

  // Phase 2 (docs/back-office-revamp.md): /menu was retired as a standalone
  // rail item — it's the same MenuManager tree as Storefront's Menu tab, and
  // unlike /menu, that tab was never plan-gated (the actual FREE-tier path).
  it("dashboardNavigation no longer contains /menu — it's grantable-only now", () => {
    const hrefs = getAllDashboardNavItems().map((i) => i.href);
    expect(hrefs).not.toContain("/menu");
  });

  it("grantableOnlyNavItems covers /menu, still grantable with no rail entry", () => {
    const hrefs = grantableOnlyNavItems.map((i) => i.href);
    expect(hrefs).toContain("/menu");
  });

  // The multi-outlet roll-up is Finance's "All outlets" scope now; /owner is
  // only a redirect into it, so it has no rail item (and isn't grantable).
  it("dashboardNavigation has no /owner item — the roll-up lives inside Finance", () => {
    const hrefs = getAllAppNavItems().map((i) => i.href);
    expect(hrefs).not.toContain("/owner");
  });

  // Finance follows FEATURE_MIN_PLAN.finance, so the rail and the page gate
  // can't disagree about which plan unlocks it.
  it("/finance is gated at the same plan as FEATURE_MIN_PLAN.finance (Operations)", () => {
    const finance = getAllDashboardNavItems().find((i) => i.href === "/finance");
    expect(finance?.requiredPlan).toBe(minPlanFor("finance"));
    expect(finance?.requiredPlan).toBe("OPERATIONS");
  });

  it("/custom-development is open to every paying plan (POS and up)", () => {
    const customDev = getAllDashboardNavItems().find((i) => i.href === "/custom-development");
    expect(customDev?.requiredPlan).toBe(minPlanFor("customDevelopment"));
    expect(customDev?.requiredPlan).toBe("POS");
  });

  it("no Back Office item is gated to Enterprise — it is a custom-build tier, not a feature tier", () => {
    for (const item of getAllDashboardNavItems()) {
      expect(item.requiredPlan, item.href).not.toBe("ENTERPRISE");
    }
  });

  it("every gated Back Office item has a lockedHintKey (event-framed copy, not generic)", () => {
    for (const item of getAllDashboardNavItems()) {
      if (item.requiredPlan) {
        expect(item.lockedHintKey, `${item.href} is gated but has no lockedHintKey`).toBeTruthy();
      }
    }
  });

  // Customer records are captured at POS, so the page is POS-tier — the
  // promotion mechanics (presets, coupons, points) are the OPERATIONS part and
  // live on the Data page's Promotions tab, not here.
  it("dashboardNavigation contains /customers at POS tier, with its locked hint", () => {
    const customers = getAllDashboardNavItems().find((i) => i.href === "/customers");
    expect(customers).toBeDefined();
    expect(customers?.labelKey).toBe("nav.customers");
    expect(customers?.requiredPlan).toBe("POS");
    expect(customers?.lockedHintKey).toBe("nav.lockedHint.customers");
    expect(customers?.showBadge).toBe(false);
  });

  it("/customers is grantable to staff (ALL_STAFF_PAGES derives from the nav)", () => {
    expect(getAllAppNavItems().map((i) => i.href)).toContain("/customers");
  });

  it("no dashboardNavigation section is reduced to a single orphan item", () => {
    for (const section of dashboardNavigation) {
      expect(section.items.length).toBeGreaterThan(1);
    }
  });

  it("posModeNavItems covers every POS Mode route, including the light schedule view", () => {
    const hrefs = posModeNavItems.map((i) => i.href);
    expect(hrefs).toEqual(
      expect.arrayContaining(["/pos", "/pos/orders", "/pos/kds", "/tables", "/pos/schedule"])
    );
  });

  it("getAllAppNavItems reunites all three halves with no gaps or duplicates", () => {
    const hrefs = getAllAppNavItems().map((i) => i.href);
    for (const page of [
      "/menu",
      "/finance",
      "/pos",
      "/pos/orders",
      "/pos/kds",
      "/tables",
      "/pos/schedule",
    ]) {
      expect(hrefs).toContain(page);
    }
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("no dashboardNavigation section accidentally re-adds a POS Mode or grantable-only route", () => {
    for (const section of dashboardNavigation) {
      for (const item of section.items) {
        expect([
          "/pos",
          "/pos/orders",
          "/pos/kds",
          "/tables",
          "/pos/schedule",
          "/menu",
        ]).not.toContain(item.href);
      }
    }
  });
});
