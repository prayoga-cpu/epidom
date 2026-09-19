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
        notes: undefined,
        selectedOptions: undefined,
        isCustom: false,
        department: null,
        initialStatus: "PENDING",
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

  it("sets initialStatus to SERVED for a CUSTOM-productLine item, PENDING for STANDARD", async () => {
    prismaMock.menuItem.findMany.mockResolvedValue([
      { id: "menu-1", name: "Haircut", price: 50000, product: { productLine: "CUSTOM" } },
      { id: "menu-2", name: "Croissant", price: 15000, product: { productLine: "STANDARD" } },
    ]);

    const { orderItems } = await validateAndBuildOrderItems("store-1", [
      { menuItemId: "menu-1", name: "Haircut", quantity: 1, unitPrice: 1 },
      { menuItemId: "menu-2", name: "Croissant", quantity: 1, unitPrice: 1 },
    ] as any);

    expect(orderItems.find((i) => i.menuItemId === "menu-1")?.initialStatus).toBe("SERVED");
    expect(orderItems.find((i) => i.menuItemId === "menu-2")?.initialStatus).toBe("PENDING");
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
 * Custom Items are the ONE line type whose client-sent name/price the server
 * keeps — there is no menu row to reprice from. The Zod schema is what bounds
 * them; this covers what the builder does with them afterwards.
 */
describe("validateAndBuildOrderItems — Custom Items", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the cashier-typed name and price, with no menuItemId", async () => {
    const { orderItems, subtotal } = await validateAndBuildOrderItems("store-1", [
      { custom: true, name: "Corkage", quantity: 2, unitPrice: 25000, notes: "table 4" },
    ] as any);

    expect(orderItems).toEqual([
      {
        menuItemId: null,
        name: "Corkage",
        quantity: 2,
        unit: "pcs",
        unitPrice: 25000,
        total: 50000,
        notes: "table 4",
        selectedOptions: undefined,
        isCustom: true,
        department: null,
        // No prep area ⇒ nothing would ever move it off PENDING.
        initialStatus: "SERVED",
      },
    ]);
    expect(subtotal).toBe(50000);
  });

  it("never hits the menu for an all-custom cart", async () => {
    await validateAndBuildOrderItems("store-1", [
      { custom: true, name: "Corkage", quantity: 1, unitPrice: 1000 },
    ] as any);
    expect(prismaMock.menuItem.findMany).not.toHaveBeenCalled();
  });

  it("starts PENDING when the cashier chose a prep area", async () => {
    const { orderItems } = await validateAndBuildOrderItems("store-1", [
      { custom: true, name: "Special cocktail", quantity: 1, unitPrice: 90000, department: "BAR" },
    ] as any);

    expect(orderItems[0].department).toBe("BAR");
    expect(orderItems[0].initialStatus).toBe("PENDING");
  });

  it("mixes custom and menu lines, repricing only the menu ones", async () => {
    prismaMock.menuItem.findMany.mockResolvedValue([
      { id: "menu-1", name: "Latte", price: 25000 },
    ]);

    const { orderItems, subtotal } = await validateAndBuildOrderItems("store-1", [
      { menuItemId: "menu-1", name: "Latte", quantity: 1, unitPrice: 1 },
      { custom: true, name: "Tip", quantity: 1, unitPrice: 5000 },
    ] as any);

    // Order is preserved, so the cart line and the receipt line still match up.
    expect(orderItems.map((i) => i.name)).toEqual(["Latte", "Tip"]);
    expect(orderItems[0].unitPrice).toBe(25000);
    expect(orderItems[1].unitPrice).toBe(5000);
    expect(subtotal).toBe(30000);
  });

  it("does not count custom lines when reporting unavailable menu items", async () => {
    prismaMock.menuItem.findMany.mockResolvedValue([]); // the menu line is gone

    await expect(
      validateAndBuildOrderItems("store-1", [
        { menuItemId: "menu-1", name: "Latte", quantity: 1, unitPrice: 1 },
        { custom: true, name: "Tip", quantity: 1, unitPrice: 5000 },
      ] as any)
    ).rejects.toThrow(/Latte/);
  });
});

/**
 * The Active Queue toggle (kitchenDisplayEnabled) is the single shared
 * switch behind both the Kitchen & Bar display and the Order Queue's
 * "Active Queue" toggle — turning either off turns both off. Every payment
 * method resolves the same way regardless of the toggle: production isn't
 * gated on payment clearing, so an unpaid order (PAY_LATER, or an online
 * payment still awaiting confirmation) is tracked via paymentStatus and
 * followed up on with Mark as Paid, not by holding it out of CONFIRMED.
 */
describe("resolveSettledOrderStatus", () => {
  it("goes to CONFIRMED for any payment method when the Active Queue is on", () => {
    expect(resolveSettledOrderStatus("CASH", true)).toBe("CONFIRMED");
    expect(resolveSettledOrderStatus("QRIS", true)).toBe("CONFIRMED");
    expect(resolveSettledOrderStatus("PAY_LATER", true)).toBe("CONFIRMED");
  });

  it("goes straight to DELIVERED for any payment method when the Active Queue is off", () => {
    expect(resolveSettledOrderStatus("CASH", false)).toBe("DELIVERED");
    expect(resolveSettledOrderStatus("PAY_LATER", false)).toBe("DELIVERED");
  });
});
