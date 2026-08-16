import { describe, it, expect, vi, beforeEach } from "vitest";
import { MovementType, StockMode } from "@prisma/client";

// var (not const/let) avoids TDZ when vi.mock factory is hoisted above declarations.
var prismaMock: any;
var capturedTx: any;
var balances: Record<string, number>;
var openSales: any[];
var reversingReturns: any[];

/**
 * `product.update` / `material.update` mirror Prisma's atomic
 * `{ decrement }` / `{ increment }`: mutate the balance, return the post-write
 * row. The service copies `balanceAfter` straight out of that return value.
 */
function applyDelta({ where, data }: any) {
  const change = data.currentStock ?? {};
  const delta =
    change.decrement !== undefined ? -Number(change.decrement) : Number(change.increment ?? 0);
  balances[where.id] = (balances[where.id] ?? 0) + delta;
  return { currentStock: balances[where.id] };
}

vi.mock("@/lib/prisma", () => {
  prismaMock = {
    // reversedSaleIds() reads the RETURN rows; the idempotency guard reads the
    // SALE rows minus whatever a RETURN already undid.
    stockMovement: {
      findFirst: vi.fn(async ({ where }: any) => {
        const excluded: string[] = where.NOT?.id?.in ?? [];
        return openSales.find((s) => !excluded.includes(s.id)) ?? null;
      }),
      findMany: vi.fn(async ({ where }: any) => {
        if (where.type === MovementType.RETURN) return reversingReturns;
        return openSales;
      }),
    },
    order: { findUnique: vi.fn() },
    material: { findMany: vi.fn() },
    alert: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
    user: { findUnique: vi.fn().mockResolvedValue({ email: "owner@example.com" }) },
    $transaction: vi.fn(async (fn: any) => {
      capturedTx = {
        product: {
          findMany: vi.fn(async ({ where }: any) =>
            (where.id.in as string[]).map((id) => ({ id, currentStock: balances[id] ?? 0 }))
          ),
          update: vi.fn(async (args: any) => applyDelta(args)),
        },
        material: {
          findMany: vi.fn(async ({ where }: any) => {
            const rows = await prismaMock.material.findMany({ where });
            return rows.filter((m: any) => (where.id.in as string[]).includes(m.id));
          }),
          update: vi.fn(async (args: any) => applyDelta(args)),
        },
        stockMovement: { create: vi.fn() },
        orderItem: { update: vi.fn() },
        order: { update: vi.fn() },
      };
      return fn(capturedTx);
    }),
  };
  return { prisma: prismaMock };
});

vi.mock("@/lib/magicbell/client", () => ({ sendMerchantAlert: vi.fn() }));
// Lazily imported by deductStockForOrder to break an import cycle.
vi.mock("@/lib/services/production-batch.service", () => ({
  productionBatchService: { recordDrawnShortfalls: vi.fn().mockResolvedValue(undefined) },
}));

import { deductStockForOrder } from "../stock-deduction.service";

/**
 * Products as `primaryRecipeInclude` actually returns them: `primaryRecipe` is
 * a single recipe object or null. `isDefault` no longer exists anywhere — the
 * old fixtures invented `recipeProducts: [{ isDefault: true, ... }]`, a shape
 * production never produced.
 */
function seedProduct(product: any, stock: number) {
  balances[product.id] = stock;
  return {
    minStock: 0,
    stockMode: StockMode.BATCH_PRODUCED,
    primaryRecipeId: null,
    primaryRecipe: null,
    currentStock: stock,
    ...product,
  };
}

describe("deductStockForOrder — option-driven material consumption", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    balances = {};
    openSales = [];
    reversingReturns = [];
    prismaMock.alert.findFirst.mockResolvedValue(null);
    prismaMock.user.findUnique.mockResolvedValue({ email: "owner@example.com" });
  });

  it("deducts a material referenced only via a selected option's materialId/materialQty, independent of any recipe", async () => {
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
          selectedOptions: [
            { groupName: "Size", optionName: "Large", materialId: "mat-1", materialQty: 5 },
          ],
        },
      ],
    });
    balances["mat-1"] = 100;
    prismaMock.material.findMany.mockResolvedValue([
      { id: "mat-1", name: "Sugar", unit: "g", currentStock: 100, minStock: 0, unitCost: 2 },
    ]);

    const result = await deductStockForOrder("order-1", "store-1");

    expect(result.deducted).toBe(1);
    // 2 units ordered x 5g/unit = 10g consumed on top of a 100g starting stock.
    expect(capturedTx.material.update).toHaveBeenCalledTimes(1);
    const [updateCall] = capturedTx.material.update.mock.calls;
    expect(updateCall[0].where).toEqual({ id: "mat-1" });
    expect(Number(updateCall[0].data.currentStock.decrement)).toBe(10);
    expect(balances["mat-1"]).toBe(90);

    expect(capturedTx.stockMovement.create).toHaveBeenCalledTimes(1);
    const [movementCall] = capturedTx.stockMovement.create.mock.calls;
    expect(movementCall[0].data.materialId).toBe("mat-1");
    expect(Number(movementCall[0].data.quantity)).toBe(-10);
  });

  it("freezes the modifier cost on the line separately from the product cost", async () => {
    // optionCostSnapshot is a second column on purpose: modifier materials are
    // the only material SALE rows most stores write, so folding them into
    // unitCostSnapshot (or dropping them) deletes them from the P&L.
    prismaMock.order.findUnique.mockResolvedValue({
      id: "order-1",
      orderNumber: "POS-1",
      storeId: "store-1",
      store: { business: { userId: "user-1" } },
      items: [
        {
          id: "item-1",
          quantity: 2,
          status: "SERVED",
          product: seedProduct({ id: "prod-1", name: "Latte", unit: "cup", costPrice: 8 }, 10),
          menuItem: null,
          selectedOptions: [{ materialId: "mat-1", materialQty: 5 }],
        },
      ],
    });
    balances["mat-1"] = 100;
    prismaMock.material.findMany.mockResolvedValue([
      { id: "mat-1", name: "Sugar", unit: "g", currentStock: 100, minStock: 0, unitCost: 2 },
    ]);

    await deductStockForOrder("order-1", "store-1");

    const [snapshotCall] = capturedTx.orderItem.update.mock.calls;
    expect(snapshotCall[0].where).toEqual({ id: "item-1" });
    expect(Number(snapshotCall[0].data.unitCostSnapshot)).toBe(8);
    // 5 g/unit x unitCost 2 = 10 per unit, stored per-unit like unitCostSnapshot.
    expect(Number(snapshotCall[0].data.optionCostSnapshot)).toBe(10);
  });

  it("drops an option material that no longer exists rather than decrementing a missing row", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    prismaMock.order.findUnique.mockResolvedValue({
      id: "order-1",
      orderNumber: "POS-1",
      storeId: "store-1",
      store: { business: { userId: "user-1" } },
      items: [
        {
          id: "item-1",
          quantity: 1,
          product: seedProduct({ id: "prod-1", name: "Latte", unit: "cup", costPrice: 8 }, 10),
          menuItem: null,
          selectedOptions: [{ materialId: "mat-deleted", materialQty: 5 }],
        },
      ],
    });
    prismaMock.material.findMany.mockResolvedValue([]);

    const result = await deductStockForOrder("order-1", "store-1");

    expect(capturedTx.material.update).not.toHaveBeenCalled();
    // The product line still deducts normally.
    expect(result.deducted).toBe(1);
    expect(balances["prod-1"]).toBe(9);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("not found"));
    warnSpy.mockRestore();
  });

  it("skips a CANCELLED order item's stock deduction even though the order was delivered", async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      id: "order-2",
      orderNumber: "POS-2",
      storeId: "store-1",
      store: { business: { userId: "user-1" } },
      items: [
        {
          id: "item-active",
          quantity: 2,
          status: "PENDING",
          product: seedProduct(
            { id: "prod-active", name: "Widget", unit: "pcs", costPrice: 15 },
            50
          ),
          menuItem: null,
          selectedOptions: null,
        },
        {
          id: "item-cancelled",
          quantity: 3,
          status: "CANCELLED",
          product: seedProduct({ id: "prod-cancelled", name: "Gadget", unit: "pcs", costPrice: 9 }, 20),
          menuItem: null,
          selectedOptions: null,
        },
      ],
    });

    const result = await deductStockForOrder("order-2", "store-1");

    expect(result.deducted).toBe(1);
    expect(capturedTx.product.update).toHaveBeenCalledTimes(1);
    const [updateCall] = capturedTx.product.update.mock.calls;
    expect(updateCall[0].where).toEqual({ id: "prod-active" });
    expect(Number(updateCall[0].data.currentStock.decrement)).toBe(2);
    expect(balances["prod-active"]).toBe(48);
    expect(balances["prod-cancelled"]).toBe(20);

    expect(capturedTx.stockMovement.create).toHaveBeenCalledTimes(1);
    const [movementCall] = capturedTx.stockMovement.create.mock.calls;
    expect(movementCall[0].data.productId).toBe("prod-active");

    // Frozen per-line COGS snapshot: only the active (non-cancelled) item
    // gets a snapshot, taken from its product's costPrice.
    expect(capturedTx.orderItem.update).toHaveBeenCalledTimes(1);
    const [snapshotCall] = capturedTx.orderItem.update.mock.calls;
    expect(snapshotCall[0].where).toEqual({ id: "item-active" });
    expect(Number(snapshotCall[0].data.unitCostSnapshot)).toBe(15);
  });

  it("skips stock/recipe deduction for an UNTRACKED service but still records its cost snapshot", async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      id: "order-3",
      orderNumber: "POS-3",
      storeId: "store-1",
      store: { business: { userId: "user-1" } },
      items: [
        {
          id: "item-custom",
          quantity: 1,
          status: "SERVED",
          product: seedProduct(
            {
              id: "prod-custom",
              name: "Men's Haircut",
              unit: "piece",
              costPrice: 20,
              productLine: "CUSTOM",
              // The gate is stockMode, not productLine — a service has no
              // inventory to deduct. See Product.stockMode.
              stockMode: StockMode.UNTRACKED,
            },
            0
          ),
          menuItem: null,
          selectedOptions: null,
        },
      ],
    });

    const result = await deductStockForOrder("order-3", "store-1");

    // Not counted as deducted (nothing was actually decremented) or skipped
    // (that means "unresolvable product," a data problem — this exclusion is
    // intentional and expected).
    expect(result.deducted).toBe(0);
    expect(result.skipped).toBe(0);
    expect(capturedTx.product.update).not.toHaveBeenCalled();
    expect(capturedTx.material.update).not.toHaveBeenCalled();
    expect(capturedTx.stockMovement.create).not.toHaveBeenCalled();

    // Cost snapshot is still recorded so Finance margin reporting works for
    // custom items too.
    expect(capturedTx.orderItem.update).toHaveBeenCalledTimes(1);
    const [snapshotCall] = capturedTx.orderItem.update.mock.calls;
    expect(snapshotCall[0].where).toEqual({ id: "item-custom" });
    expect(Number(snapshotCall[0].data.unitCostSnapshot)).toBe(20);
  });

  it("still deducts stock for a CUSTOM-productLine item that is counted (merchandise, not a service)", async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      id: "order-4",
      orderNumber: "POS-4",
      storeId: "store-1",
      store: { business: { userId: "user-1" } },
      items: [
        {
          id: "item-merch",
          quantity: 2,
          status: "SERVED",
          product: seedProduct(
            {
              id: "prod-merch",
              name: "Branded Shampoo",
              unit: "piece",
              costPrice: 5,
              productLine: "CUSTOM",
              stockMode: StockMode.BATCH_PRODUCED,
            },
            10
          ),
          menuItem: null,
          selectedOptions: null,
        },
      ],
    });

    const result = await deductStockForOrder("order-4", "store-1");

    // productLine is irrelevant here — a counted good in the custom product
    // line deducts exactly like any other BATCH_PRODUCED product.
    expect(result.deducted).toBe(1);
    expect(capturedTx.product.update).toHaveBeenCalledTimes(1);
    const [updateCall] = capturedTx.product.update.mock.calls;
    expect(updateCall[0].where).toEqual({ id: "prod-merch" });
    expect(Number(updateCall[0].data.currentStock.decrement)).toBe(2);
    expect(balances["prod-merch"]).toBe(8);
  });

  it("is idempotent — a second call is a no-op while an unreversed SALE exists", async () => {
    openSales = [{ id: "existing-movement" }];

    const result = await deductStockForOrder("order-1", "store-1");

    expect(result).toEqual({ deducted: 0, skipped: 0, alreadyDeducted: true });
    expect(prismaMock.order.findUnique).not.toHaveBeenCalled();
  });

  it("deducts again after a reversal — the guard is scoped to the DELIVER cycle, not the order", async () => {
    openSales = [{ id: "sale-1" }];
    reversingReturns = [{ reversesMovementId: "sale-1" }];
    prismaMock.order.findUnique.mockResolvedValue({
      id: "order-5",
      orderNumber: "POS-5",
      storeId: "store-1",
      store: { business: { userId: "user-1" } },
      items: [
        {
          id: "item-1",
          quantity: 1,
          status: "SERVED",
          product: seedProduct({ id: "prod-1", name: "Widget", unit: "pcs", costPrice: 3 }, 5),
          menuItem: null,
          selectedOptions: null,
        },
      ],
    });

    const result = await deductStockForOrder("order-5", "store-1");

    expect(result.alreadyDeducted).toBeUndefined();
    expect(result.deducted).toBe(1);
    expect(balances["prod-1"]).toBe(4);
  });
});
