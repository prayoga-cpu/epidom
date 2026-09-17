import { describe, it, expect } from "vitest";
import {
  dashboardNavigation,
  posModeNavItems,
  grantableOnlyNavItems,
  getAllDashboardNavItems,
  getAllAppNavItems,
} from "../navigation.config";

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

  // Phase 2: /owner (the multi-outlet rollup) moved into the shell — see
  // docs/back-office-revamp.md's "orphaned outside the shell" finding.
  it("dashboardNavigation now contains /owner, ENTERPRISE-gated", () => {
    const ownerItem = getAllDashboardNavItems().find((i) => i.href === "/owner");
    expect(ownerItem).toBeDefined();
    expect(ownerItem?.requiredPlan).toBe("ENTERPRISE");
  });

  it("every gated Back Office item has a lockedHintKey (event-framed copy, not generic)", () => {
    for (const item of getAllDashboardNavItems()) {
      if (item.requiredPlan) {
        expect(item.lockedHintKey, `${item.href} is gated but has no lockedHintKey`).toBeTruthy();
      }
    }
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
      "/owner",
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
