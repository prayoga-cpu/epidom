import { describe, it, expect } from "vitest";
import {
  dashboardNavigation,
  posModeNavItems,
  getAllDashboardNavItems,
  getAllAppNavItems,
} from "../navigation.config";

describe("Back Office rail vs. the full app page universe", () => {
  it("dashboardNavigation no longer contains POS Mode's own routes", () => {
    const hrefs = getAllDashboardNavItems().map((i) => i.href);
    for (const moved of ["/pos", "/pos/orders", "/pos/kds", "/tables"]) {
      expect(hrefs).not.toContain(moved);
    }
    // /menu stays — it's menu management, a Back Office concern.
    expect(hrefs).toContain("/menu");
  });

  it("posModeNavItems covers every POS Mode route, including the new light schedule view", () => {
    const hrefs = posModeNavItems.map((i) => i.href);
    expect(hrefs).toEqual(
      expect.arrayContaining(["/pos", "/pos/orders", "/pos/kds", "/tables", "/pos/schedule"])
    );
  });

  it("getAllAppNavItems reunites both halves with no gaps or duplicates", () => {
    const hrefs = getAllAppNavItems().map((i) => i.href);
    for (const page of ["/menu", "/pos", "/pos/orders", "/pos/kds", "/tables", "/pos/schedule"]) {
      expect(hrefs).toContain(page);
    }
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("no dashboardNavigation section accidentally re-adds a POS Mode route", () => {
    for (const section of dashboardNavigation) {
      for (const item of section.items) {
        expect(["/pos", "/pos/orders", "/pos/kds", "/tables", "/pos/schedule"]).not.toContain(
          item.href
        );
      }
    }
  });
});
