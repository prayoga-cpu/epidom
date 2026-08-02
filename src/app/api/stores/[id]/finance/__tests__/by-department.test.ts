import { describe, it, expect } from "vitest";
import { bucketItemsByDepartment } from "@/lib/finance/report-aggregation";
import { departmentFilter } from "@/lib/finance/report-filters";

describe("bucketItemsByDepartment", () => {
  it("groups items under Kitchen and Bar, revenue summed separately", () => {
    const result = bucketItemsByDepartment([
      { total: 50_000, quantity: 2, menuItem: { department: "KITCHEN" } },
      { total: 30_000, quantity: 1, menuItem: { department: "KITCHEN" } },
      { total: 20_000, quantity: 1, menuItem: { department: "BAR" } },
    ]);

    const kitchen = result.find((r) => r.department === "KITCHEN");
    const bar = result.find((r) => r.department === "BAR");
    expect(kitchen).toMatchObject({ orderItemCount: 2, totalQuantity: 3, totalRevenue: 80_000 });
    expect(bar).toMatchObject({ orderItemCount: 1, totalQuantity: 1, totalRevenue: 20_000 });
  });

  it("buckets items with no menuItem (aggregator-email orders) under Unassigned", () => {
    const result = bucketItemsByDepartment([{ total: 15_000, quantity: 1, menuItem: null }]);
    expect(result).toEqual([
      { department: null, orderItemCount: 1, totalQuantity: 1, totalRevenue: 15_000 },
    ]);
  });

  it("buckets a menuItem with no department assigned under Unassigned", () => {
    const result = bucketItemsByDepartment([
      { total: 10_000, quantity: 1, menuItem: { department: null } },
    ]);
    expect(result[0].department).toBeNull();
  });

  it("merges the no-menuItem and no-department cases into the same Unassigned bucket", () => {
    const result = bucketItemsByDepartment([
      { total: 10_000, quantity: 1, menuItem: null },
      { total: 5_000, quantity: 1, menuItem: { department: null } },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].totalRevenue).toBe(15_000);
    expect(result[0].orderItemCount).toBe(2);
  });

  it("sorts departments by revenue descending", () => {
    const result = bucketItemsByDepartment([
      { total: 10_000, quantity: 1, menuItem: { department: "BAR" } },
      { total: 90_000, quantity: 1, menuItem: { department: "KITCHEN" } },
    ]);
    expect(result.map((r) => r.department)).toEqual(["KITCHEN", "BAR"]);
  });

  it("rounds totalRevenue to 2 decimal places", () => {
    const result = bucketItemsByDepartment([
      { total: 33.333, quantity: 1, menuItem: { department: "BAR" } },
      { total: 33.333, quantity: 1, menuItem: { department: "BAR" } },
    ]);
    expect(result[0].totalRevenue).toBe(66.67);
  });
});

describe("departmentFilter", () => {
  it("returns no filter when department is null", () => {
    expect(departmentFilter(null)).toEqual({});
  });

  it("filters to a specific department via the menuItem relation", () => {
    expect(departmentFilter("KITCHEN")).toEqual({ menuItem: { department: "KITCHEN" } });
  });

  it("the unassigned sentinel matches items with no menuItem or no department", () => {
    expect(departmentFilter("none")).toEqual({
      OR: [{ menuItemId: null }, { menuItem: { department: null } }],
    });
  });
});
