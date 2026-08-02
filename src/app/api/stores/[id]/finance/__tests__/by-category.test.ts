import { describe, it, expect } from "vitest";
import { bucketItemsByCategory } from "@/lib/finance/report-aggregation";
import { categoryFilter, shiftFilter, UNCATEGORIZED } from "@/lib/finance/report-filters";

describe("bucketItemsByCategory", () => {
  it("groups items under their menu category, revenue summed", () => {
    const result = bucketItemsByCategory([
      { total: 50_000, quantity: 2, menuItem: { category: { id: "kitchen", name: "Kitchen" } } },
      { total: 30_000, quantity: 1, menuItem: { category: { id: "kitchen", name: "Kitchen" } } },
      { total: 20_000, quantity: 1, menuItem: { category: { id: "bar", name: "Bar" } } },
    ]);

    const kitchen = result.find((r) => r.categoryId === "kitchen");
    const bar = result.find((r) => r.categoryId === "bar");
    expect(kitchen).toMatchObject({ orderItemCount: 2, totalQuantity: 3, totalRevenue: 80_000 });
    expect(bar).toMatchObject({ orderItemCount: 1, totalQuantity: 1, totalRevenue: 20_000 });
  });

  it("buckets items with no menuItem (aggregator-email orders) under Uncategorized", () => {
    const result = bucketItemsByCategory([{ total: 15_000, quantity: 1, menuItem: null }]);
    expect(result).toEqual([
      {
        categoryId: null,
        categoryName: "Uncategorized",
        orderItemCount: 1,
        totalQuantity: 1,
        totalRevenue: 15_000,
      },
    ]);
  });

  it("buckets a menuItem with no category assigned under Uncategorized", () => {
    const result = bucketItemsByCategory([
      { total: 10_000, quantity: 1, menuItem: { category: null } },
    ]);
    expect(result[0].categoryId).toBeNull();
    expect(result[0].categoryName).toBe("Uncategorized");
  });

  it("merges the no-menuItem and no-category cases into the same Uncategorized bucket", () => {
    const result = bucketItemsByCategory([
      { total: 10_000, quantity: 1, menuItem: null },
      { total: 5_000, quantity: 1, menuItem: { category: null } },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].totalRevenue).toBe(15_000);
    expect(result[0].orderItemCount).toBe(2);
  });

  it("sorts categories by revenue descending", () => {
    const result = bucketItemsByCategory([
      { total: 10_000, quantity: 1, menuItem: { category: { id: "a", name: "A" } } },
      { total: 90_000, quantity: 1, menuItem: { category: { id: "b", name: "B" } } },
    ]);
    expect(result.map((r) => r.categoryId)).toEqual(["b", "a"]);
  });

  it("rounds totalRevenue to 2 decimal places", () => {
    const result = bucketItemsByCategory([
      { total: 33.333, quantity: 1, menuItem: { category: { id: "a", name: "A" } } },
      { total: 33.333, quantity: 1, menuItem: { category: { id: "a", name: "A" } } },
    ]);
    expect(result[0].totalRevenue).toBe(66.67);
  });
});

describe("categoryFilter", () => {
  it("returns no filter when category is null", () => {
    expect(categoryFilter(null)).toEqual({});
  });

  it("filters to a specific category id via the menuItem relation", () => {
    expect(categoryFilter("kitchen-id")).toEqual({ menuItem: { categoryId: "kitchen-id" } });
  });

  it("the uncategorized sentinel matches items with no menuItem or no category", () => {
    expect(categoryFilter(UNCATEGORIZED)).toEqual({
      OR: [{ menuItemId: null }, { menuItem: { categoryId: null } }],
    });
  });
});

describe("shiftFilter", () => {
  it("returns no filter when neither shiftId nor staffId is present", () => {
    expect(shiftFilter(new URLSearchParams())).toEqual({});
  });

  it("shiftId takes precedence and filters a single session", () => {
    const params = new URLSearchParams({ shiftId: "shift-1", staffId: "staff-1" });
    expect(shiftFilter(params)).toEqual({ shiftId: "shift-1" });
  });

  it("staffId alone aggregates across all of that staff member's shifts", () => {
    const params = new URLSearchParams({ staffId: "staff-1" });
    expect(shiftFilter(params)).toEqual({ shift: { staffMemberId: "staff-1" } });
  });
});
