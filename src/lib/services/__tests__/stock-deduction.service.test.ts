import { describe, it, expect, vi, beforeEach } from "vitest";

// var (not const/let) avoids TDZ when vi.mock factory is hoisted above declarations.
var prismaMock: any;
var capturedTx: any;

vi.mock("@/lib/prisma", () => {
  prismaMock = {
    stockMovement: { findFirst: vi.fn() },
    order: { findUnique: vi.fn() },
    material: { findMany: vi.fn() },
    alert: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
    $transaction: vi.fn(async (fn: any) => {
      capturedTx = {
        product: { update: vi.fn() },
        material: { update: vi.fn() },
        stockMovement: { create: vi.fn() },
      };
      return fn(capturedTx);
    }),
  };
  return { prisma: prismaMock };
});

import { deductStockForOrder } from "../stock-deduction.service";

describe("deductStockForOrder — option-driven material consumption", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.alert.findFirst.mockResolvedValue(null);
  });

  it("deducts a material referenced only via a selected option's materialId/materialQty, independent of any recipe", async () => {
    prismaMock.stockMovement.findFirst.mockResolvedValue(null); // not already deducted
    prismaMock.order.findUnique.mockResolvedValue({
      id: "order-1",
      orderNumber: "POS-1",
      storeId: "store-1",
      store: { business: { userId: "user-1" } },
      items: [
        {
          id: "item-1",
          quantity: 2,
          product: null,
          menuItem: null,
          selectedOptions: [{ groupName: "Size", optionName: "Large", materialId: "mat-1", materialQty: 5 }],
        },
      ],
    });
    prismaMock.material.findMany.mockResolvedValue([
      {
        id: "mat-1",
        name: "Sugar",
        unit: "g",
        currentStock: 100,
        minStock: 0,
      },
    ]);

    const result = await deductStockForOrder("order-1", "store-1");

    expect(result.deducted).toBe(1);
    // 2 units ordered x 5g/unit = 10g consumed on top of a 100g starting stock.
    expect(capturedTx.material.update).toHaveBeenCalledTimes(1);
    const [updateCall] = capturedTx.material.update.mock.calls;
    expect(updateCall[0].where).toEqual({ id: "mat-1" });
    expect(Number(updateCall[0].data.currentStock)).toBe(90);

    expect(capturedTx.stockMovement.create).toHaveBeenCalledTimes(1);
    const [movementCall] = capturedTx.stockMovement.create.mock.calls;
    expect(movementCall[0].data.materialId).toBe("mat-1");
    expect(Number(movementCall[0].data.quantity)).toBe(-10);
  });

  it("is idempotent — a second call for the same order is a no-op", async () => {
    prismaMock.stockMovement.findFirst.mockResolvedValue({ id: "existing-movement" });

    const result = await deductStockForOrder("order-1", "store-1");

    expect(result).toEqual({ deducted: 0, skipped: 0, alreadyDeducted: true });
    expect(prismaMock.order.findUnique).not.toHaveBeenCalled();
  });
});
