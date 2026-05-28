import { describe, it, expect, vi, beforeEach } from "vitest";
import { MovementType, AlertType, AlertSeverity } from "@prisma/client";

// ── Prisma mock ───────────────────────────────────────────────────────────────

const txMock = {
  material: { update: vi.fn().mockResolvedValue({}) },
  stockMovement: { create: vi.fn().mockResolvedValue({}) },
};

const prismaMock = {
  order: { findUnique: vi.fn() },
  alert: { findFirst: vi.fn(), create: vi.fn() },
  $transaction: vi.fn((fn: any, _opts?: any) => fn(txMock)),
};

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/utils/types.server", () => ({
  toDecimal: (n: number) => n,
}));

import { deductStockForOrder } from "@/lib/services/stock-deduction.service";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeOrder(overrides: any = {}) {
  return {
    id: "order-1",
    orderNumber: "ORD-001",
    storeId: "store-1",
    store: { business: { userId: "user-1" } },
    items: [
      {
        id: "item-1",
        quantity: 2,
        product: {
          id: "prod-1",
          recipeProducts: [
            {
              isDefault: true,
              recipe: {
                id: "recipe-1",
                yieldQuantity: 1,
                ingredients: [
                  {
                    materialId: "mat-1",
                    quantity: 100,
                    unit: "g",
                    material: {
                      id: "mat-1",
                      name: "Flour",
                      unit: "g",
                      currentStock: 500,
                      minStock: 50,
                    },
                  },
                ],
              },
            },
          ],
        },
        menuItem: null,
      },
    ],
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("deductStockForOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.alert.findFirst.mockResolvedValue(null);
    prismaMock.alert.create.mockResolvedValue({});
  });

  it("returns 0/0 when order not found", async () => {
    prismaMock.order.findUnique.mockResolvedValue(null);
    const result = await deductStockForOrder("order-1", "store-1");
    expect(result).toEqual({ deducted: 0, skipped: 0 });
  });

  it("returns 0/0 when storeId mismatch", async () => {
    prismaMock.order.findUnique.mockResolvedValue(makeOrder({ storeId: "other-store" }));
    const result = await deductStockForOrder("order-1", "store-1");
    expect(result).toEqual({ deducted: 0, skipped: 0 });
  });

  it("deducts correct quantity from material (qty=2, yield=1, ingredient=100g → 200g)", async () => {
    prismaMock.order.findUnique.mockResolvedValue(makeOrder());
    const result = await deductStockForOrder("order-1", "store-1");
    expect(result.deducted).toBe(1);
    expect(txMock.material.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "mat-1" },
        data: { currentStock: 300 }, // 500 - (100 * 2/1)
      })
    );
  });

  it("creates StockMovement with negative quantity", async () => {
    prismaMock.order.findUnique.mockResolvedValue(makeOrder());
    await deductStockForOrder("order-1", "store-1");
    expect(txMock.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          materialId: "mat-1",
          type: MovementType.SALE,
          quantity: -200,
        }),
      })
    );
  });

  it("wraps all deductions in one $transaction call", async () => {
    prismaMock.order.findUnique.mockResolvedValue(makeOrder());
    await deductStockForOrder("order-1", "store-1");
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it("uses Serializable isolation level", async () => {
    prismaMock.order.findUnique.mockResolvedValue(makeOrder());
    await deductStockForOrder("order-1", "store-1");
    expect(prismaMock.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: "Serializable" }
    );
  });

  it("skips item with no product and logs warning", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    prismaMock.order.findUnique.mockResolvedValue(
      makeOrder({ items: [{ id: "item-1", quantity: 1, product: null, menuItem: null }] })
    );
    const result = await deductStockForOrder("order-1", "store-1");
    expect(result.skipped).toBe(1);
    expect(result.deducted).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("no product found"));
    warnSpy.mockRestore();
  });

  it("skips item with no recipe and logs warning", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const order = makeOrder();
    order.items[0].product.recipeProducts = [];
    prismaMock.order.findUnique.mockResolvedValue(order);
    const result = await deductStockForOrder("order-1", "store-1");
    expect(result.skipped).toBe(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("no default recipe"));
    warnSpy.mockRestore();
  });

  it("skips when yieldQuantity is 0 and logs warning", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const order = makeOrder();
    order.items[0].product.recipeProducts[0].recipe.yieldQuantity = 0;
    prismaMock.order.findUnique.mockResolvedValue(order);
    const result = await deductStockForOrder("order-1", "store-1");
    expect(result.skipped).toBe(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("yieldQuantity=0"));
    warnSpy.mockRestore();
  });

  it("creates LOW_STOCK alert when stock falls below minStock", async () => {
    const order = makeOrder();
    // currentStock=100, deduct=200 → newStock=0, minStock=50 → alert
    order.items[0].product.recipeProducts[0].recipe.ingredients[0].material.currentStock = 100;
    prismaMock.order.findUnique.mockResolvedValue(order);
    await deductStockForOrder("order-1", "store-1");
    expect(prismaMock.alert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: AlertType.CRITICAL_STOCK }),
      })
    );
  });

  it("does NOT create duplicate alert when unread alert already exists", async () => {
    prismaMock.alert.findFirst.mockResolvedValue({ id: "existing-alert" });
    const order = makeOrder();
    order.items[0].product.recipeProducts[0].recipe.ingredients[0].material.currentStock = 10;
    prismaMock.order.findUnique.mockResolvedValue(order);
    await deductStockForOrder("order-1", "store-1");
    expect(prismaMock.alert.create).not.toHaveBeenCalled();
  });

  it("does not create alert when stock stays above minStock", async () => {
    prismaMock.order.findUnique.mockResolvedValue(makeOrder()); // currentStock=500, deduct=200 → 300 > minStock=50
    await deductStockForOrder("order-1", "store-1");
    expect(prismaMock.alert.create).not.toHaveBeenCalled();
  });

  it("resolves menuItem product when direct product is null", async () => {
    const order = makeOrder();
    const prod = order.items[0].product;
    order.items[0].product = null;
    order.items[0].menuItem = { product: prod };
    prismaMock.order.findUnique.mockResolvedValue(order);
    const result = await deductStockForOrder("order-1", "store-1");
    expect(result.deducted).toBe(1);
  });
});
