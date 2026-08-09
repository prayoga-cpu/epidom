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

import {
  validateAndBuildOrderItems,
  resolveSettledOrderStatus,
  OrderBuildError,
} from "../pos-order-builder";

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

  it("does not flag an available item as missing when it spans multiple cart lines", async () => {
    // Prisma's `id: { in }` returns one row per unique id even when the
    // filter array repeats an id — the cart can list the same menu item
    // twice (e.g. same drink, different notes for different customers).
    prismaMock.menuItem.findMany.mockResolvedValue([
      { id: "menu-1", name: "Latte", price: 20000 },
    ]);

    const { orderItems, subtotal } = await validateAndBuildOrderItems("store-1", [
      { menuItemId: "menu-1", name: "Latte", quantity: 1, unitPrice: 1, notes: "no sugar" },
      { menuItemId: "menu-1", name: "Latte", quantity: 1, unitPrice: 1, notes: "extra hot" },
    ] as any);

    expect(orderItems).toHaveLength(2);
    expect(subtotal).toBe(40000);
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

/**
 * The Active Queue toggle (kitchenDisplayEnabled) is the single shared
 * switch behind both the Kitchen & Bar display and the Order Queue's
 * "Active Queue" toggle — turning either off turns both off. When off,
 * every payment method must settle straight to DELIVERED, including
 * PAY_LATER: with no queue left to hold a tab in, it can't stay on PENDING
 * (see GET /pos/orders and the SSE stream, which report an empty active
 * feed whenever this is off — a lingering PENDING order would be invisible
 * and unmanageable).
 */
describe("resolveSettledOrderStatus", () => {
  it("goes to CONFIRMED for a cashier-attended payment when the Active Queue is on", () => {
    expect(resolveSettledOrderStatus("CASH", true)).toBe("CONFIRMED");
    expect(resolveSettledOrderStatus("QRIS", true)).toBe("CONFIRMED");
  });

  it("stays PENDING for PAY_LATER when the Active Queue is on", () => {
    expect(resolveSettledOrderStatus("PAY_LATER", true)).toBe("PENDING");
  });

  it("goes straight to DELIVERED for a cashier-attended payment when the Active Queue is off", () => {
    expect(resolveSettledOrderStatus("CASH", false)).toBe("DELIVERED");
  });

  it("also goes straight to DELIVERED for PAY_LATER when the Active Queue is off — never left on PENDING", () => {
    expect(resolveSettledOrderStatus("PAY_LATER", false)).toBe("DELIVERED");
  });
});
