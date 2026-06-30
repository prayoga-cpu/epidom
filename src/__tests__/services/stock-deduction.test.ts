import { describe, it, expect, vi, beforeEach } from "vitest";
import { MovementType, AlertType } from "@prisma/client";

// ── Prisma mock ───────────────────────────────────────────────────────────────
// var (not const/let) avoids TDZ when vi.mock factory is hoisted above declarations.

var txMock: any;
var prismaMock: any;

vi.mock("@/lib/prisma", () => {
  txMock = {
    product: { update: vi.fn().mockResolvedValue({}) },
    material: { update: vi.fn().mockResolvedValue({}) },
    stockMovement: { create: vi.fn().mockResolvedValue({}) },
  };
  prismaMock = {
    order: { findUnique: vi.fn() },
    stockMovement: { findFirst: vi.fn() },
    alert: { findFirst: vi.fn(), create: vi.fn() },
    $transaction: vi.fn((fn: any, _opts?: any) => fn(txMock)),
  };
  return { prisma: prismaMock };
});
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
          name: "Baguette",
          unit: "piece",
          currentStock: 10,
          minStock: 0,
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
    prismaMock.stockMovement.findFirst.mockResolvedValue(null);
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

  it("is idempotent — no-op when a SALE movement already exists for the order", async () => {
    prismaMock.stockMovement.findFirst.mockResolvedValue({ id: "existing-movement" });
    const result = await deductStockForOrder("order-1", "store-1");
    expect(result).toEqual({ deducted: 0, skipped: 0, alreadyDeducted: true });
    expect(prismaMock.order.findUnique).not.toHaveBeenCalled();
    expect(txMock.product.update).not.toHaveBeenCalled();
    expect(txMock.material.update).not.toHaveBeenCalled();
  });

  it("deducts both product stock and recipe material stock", async () => {
    prismaMock.order.findUnique.mockResolvedValue(makeOrder());
    const result = await deductStockForOrder("order-1", "store-1");
    // 1 product + 1 material
    expect(result.deducted).toBe(2);
    // product: 10 - 2 = 8
    expect(txMock.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "prod-1" },
        data: { currentStock: 8 },
      })
    );
    // material: 500 - (100 * 2/1) = 300
    expect(txMock.material.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "mat-1" },
        data: { currentStock: 300 },
      })
    );
  });

  it("aggregates duplicate line items of the same product into one deduction (no oversell)", async () => {
    const order = makeOrder();
    const baseProduct = order.items[0].product;
    // Same product on two separate lines (e.g. different modifier combos)
    order.items = [
      { id: "item-1", quantity: 2, product: baseProduct, menuItem: null },
      { id: "item-2", quantity: 3, product: baseProduct, menuItem: null },
    ];
    prismaMock.order.findUnique.mockResolvedValue(order);
    const result = await deductStockForOrder("order-1", "store-1");
    // one aggregated product + one aggregated material (not 2 + 2)
    expect(result.deducted).toBe(2);
    expect(txMock.product.update).toHaveBeenCalledTimes(1);
    // product: 10 - (2 + 3) = 5  (NOT 7 from last-write-wins)
    expect(txMock.product.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "prod-1" }, data: { currentStock: 5 } })
    );
    expect(txMock.material.update).toHaveBeenCalledTimes(1);
    // material: 500 - (100*2 + 100*3) = 0
    expect(txMock.material.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "mat-1" }, data: { currentStock: 0 } })
    );
  });

  it("creates a product SALE movement with negative ordered quantity", async () => {
    prismaMock.order.findUnique.mockResolvedValue(makeOrder());
    await deductStockForOrder("order-1", "store-1");
    expect(txMock.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          productId: "prod-1",
          type: MovementType.SALE,
          quantity: -2,
        }),
      })
    );
  });

  it("creates a material SALE movement with negative scaled quantity", async () => {
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

  it("deducts product stock even when the product has no recipe (finished good)", async () => {
    const order = makeOrder();
    order.items[0].product.recipeProducts = [];
    prismaMock.order.findUnique.mockResolvedValue(order);
    const result = await deductStockForOrder("order-1", "store-1");
    // product only, no ingredients
    expect(result.deducted).toBe(1);
    expect(result.skipped).toBe(0);
    expect(txMock.product.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "prod-1" }, data: { currentStock: 8 } })
    );
    expect(txMock.material.update).not.toHaveBeenCalled();
  });

  it("deducts product stock but skips ingredients when yieldQuantity is 0", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const order = makeOrder();
    order.items[0].product.recipeProducts[0].recipe.yieldQuantity = 0;
    prismaMock.order.findUnique.mockResolvedValue(order);
    const result = await deductStockForOrder("order-1", "store-1");
    expect(result.deducted).toBe(1); // product only
    expect(txMock.product.update).toHaveBeenCalled();
    expect(txMock.material.update).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("yieldQuantity=0"));
    warnSpy.mockRestore();
  });

  it("creates CRITICAL_STOCK alert when material falls below minStock", async () => {
    const order = makeOrder();
    // currentStock=100, deduct=200 → newStock=0, minStock=50 → critical (0 <= 12.5)
    order.items[0].product.recipeProducts[0].recipe.ingredients[0].material.currentStock = 100;
    prismaMock.order.findUnique.mockResolvedValue(order);
    await deductStockForOrder("order-1", "store-1");
    expect(prismaMock.alert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: AlertType.CRITICAL_STOCK,
          entityType: "material",
          entityId: "mat-1",
        }),
      })
    );
  });

  it("creates a LOW_STOCK alert for the product when it drops below minStock", async () => {
    const order = makeOrder();
    order.items[0].product.minStock = 20; // 10 - 2 = 8, below 20 but above 25% (5) → low
    prismaMock.order.findUnique.mockResolvedValue(order);
    await deductStockForOrder("order-1", "store-1");
    expect(prismaMock.alert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: AlertType.LOW_STOCK,
          entityType: "product",
          entityId: "prod-1",
        }),
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
    prismaMock.order.findUnique.mockResolvedValue(makeOrder()); // material 300 > 50, product minStock 0
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
    expect(result.deducted).toBe(2);
  });
});
