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

/**
 * A POS Custom Item has no MenuItem at all, so its prep area lives on the
 * OrderItem row. "No prep area" must mean no ticket — the line is already
 * created SERVED, so a ticket nobody can ever close would jam the board.
 */
describe("itemDepartment — lines with no MenuItem", () => {
  function customItem(
    overrides: Partial<PosOrderItemDisplay> = {}
  ): PosOrderItemDisplay {
    return {
      id: "item-2",
      menuItemId: null,
      name: "Corkage",
      quantity: 1,
      unitPrice: 50000,
      total: 50000,
      status: "SERVED",
      isCustom: true,
      department: null,
      menuItem: null,
      ...overrides,
    };
  }

  it("routes a Custom Item by its own department", () => {
    expect(itemDepartment(customItem({ department: "BAR", status: "PENDING" }))).toBe("BAR");
    expect(itemDepartment(customItem({ department: "KITCHEN", status: "PENDING" }))).toBe("KITCHEN");
  });

  it("gives a Custom Item with no department no KDS ticket at all", () => {
    expect(itemDepartment(customItem())).toBeNull();
  });

  it("still defaults a NON-custom line with no MenuItem to Kitchen", () => {
    // Legacy/manual rows (menuItemId null, isCustom false) must not silently
    // disappear from both stations.
    expect(itemDepartment(customItem({ isCustom: false, status: "PENDING" }))).toBe("KITCHEN");
  });
});
