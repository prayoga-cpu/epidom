import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Prisma mock ───────────────────────────────────────────────────────────────
// var (not const/let) avoids TDZ when vi.mock factory is hoisted above declarations.

var prismaMock: any;

vi.mock("@/lib/prisma", () => {
  prismaMock = {
    menuItem: { findMany: vi.fn() },
  };
  return { prisma: prismaMock };
});

import { validateAndBuildOrderItems, OrderBuildError } from "../pos-order-builder";

describe("validateAndBuildOrderItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reprices from the current menu, never trusting the client-sent unitPrice", async () => {
    prismaMock.menuItem.findMany.mockResolvedValue([
      { id: "menu-1", name: "Croissant", price: 15000 },
    ]);

    const { orderItems, subtotal } = await validateAndBuildOrderItems("store-1", [
      {
        menuItemId: "menu-1",
        name: "Croissant",
        quantity: 2,
        unitPrice: 1, // deliberately wrong — must be ignored
      },
    ] as any);

    expect(orderItems).toEqual([
      {
        menuItemId: "menu-1",
        name: "Croissant",
        quantity: 2,
        unit: "pcs",
        unitPrice: 15000,
        total: 30000,
      },
    ]);
    expect(subtotal).toBe(30000);
  });

  it("adds selected option price-adjustments into the unit price and total", async () => {
    prismaMock.menuItem.findMany.mockResolvedValue([
      { id: "menu-1", name: "Coffee", price: 20000 },
    ]);

    const { orderItems, subtotal } = await validateAndBuildOrderItems("store-1", [
      {
        menuItemId: "menu-1",
        name: "Coffee",
        quantity: 1,
        unitPrice: 20000,
        selectedOptions: [{ groupName: "Size", optionName: "Large", priceAdjustment: 5000 }],
      },
    ] as any);

    expect(orderItems[0].unitPrice).toBe(25000);
    expect(orderItems[0].total).toBe(25000);
    expect(subtotal).toBe(25000);
  });

  it("passes notes and selectedOptions through onto the built order item", async () => {
    prismaMock.menuItem.findMany.mockResolvedValue([
      { id: "menu-1", name: "Coffee", price: 20000 },
    ]);

    const selectedOptions = [
      { groupName: "Size", optionName: "Large", priceAdjustment: 5000, materialId: "mat-1", materialQty: 5 },
    ];

    const { orderItems } = await validateAndBuildOrderItems("store-1", [
      {
        menuItemId: "menu-1",
        name: "Coffee",
        quantity: 1,
        unitPrice: 20000,
        selectedOptions,
        notes: "no ice",
      },
    ] as any);

    expect(orderItems[0].notes).toBe("no ice");
    expect(orderItems[0].selectedOptions).toEqual(selectedOptions);
  });

  it("sums totals across multiple line items", async () => {
    prismaMock.menuItem.findMany.mockResolvedValue([
      { id: "menu-1", name: "A", price: 10000 },
      { id: "menu-2", name: "B", price: 5000 },
    ]);

    const { subtotal } = await validateAndBuildOrderItems("store-1", [
      { menuItemId: "menu-1", name: "A", quantity: 2, unitPrice: 1 },
      { menuItemId: "menu-2", name: "B", quantity: 3, unitPrice: 1 },
    ] as any);

    expect(subtotal).toBe(2 * 10000 + 3 * 5000);
  });

  it("throws OrderBuildError when a menu item is missing or unavailable", async () => {
    prismaMock.menuItem.findMany.mockResolvedValue([]); // none matched (missing / unavailable)

    await expect(
      validateAndBuildOrderItems("store-1", [
        { menuItemId: "missing", name: "Ghost", quantity: 1, unitPrice: 1 },
      ] as any)
    ).rejects.toThrow(OrderBuildError);
  });
});
