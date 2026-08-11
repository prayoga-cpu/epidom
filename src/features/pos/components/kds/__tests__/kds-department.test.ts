import { describe, it, expect } from "vitest";
import { itemDepartment } from "../kds-department";
import type { PosOrderItemDisplay } from "../../../types/pos.types";

function makeItem(
  overrides: Partial<PosOrderItemDisplay["menuItem"]> = {}
): PosOrderItemDisplay {
  return {
    id: "item-1",
    menuItemId: "menu-1",
    name: "Test Item",
    quantity: 1,
    unitPrice: 10,
    total: 10,
    status: "PENDING",
    menuItem: { name: "Test Item", department: "KITCHEN", ...overrides },
  };
}

describe("itemDepartment", () => {
  it("returns KITCHEN for a KITCHEN-department item", () => {
    expect(itemDepartment(makeItem({ department: "KITCHEN" }))).toBe("KITCHEN");
  });

  it("returns BAR for a BAR-department item", () => {
    expect(itemDepartment(makeItem({ department: "BAR" }))).toBe("BAR");
  });

  it("defaults to KITCHEN when department is unset", () => {
    expect(itemDepartment(makeItem({ department: null }))).toBe("KITCHEN");
  });

  it("returns null for a CUSTOM-productLine item regardless of its stored department", () => {
    expect(
      itemDepartment(
        makeItem({ department: "BAR", product: { productLine: "CUSTOM" } })
      )
    ).toBeNull();
  });

  it("returns KITCHEN for a STANDARD-productLine item", () => {
    expect(
      itemDepartment(
        makeItem({ department: "KITCHEN", product: { productLine: "STANDARD" } })
      )
    ).toBe("KITCHEN");
  });
});
