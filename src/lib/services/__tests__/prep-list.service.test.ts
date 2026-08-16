import { describe, it, expect, vi, beforeEach } from "vitest";
import { StockMode } from "@prisma/client";

// var (not const/let) avoids TDZ when vi.mock factories are hoisted above declarations.
var prismaMock: any;
var capturedTx: any;

/**
 * Mirrors Prisma's atomic `{ increment }` / `{ decrement }` against an in-memory
 * balance and returns the POST-write row, because the service copies
 * `balanceAfter` straight out of that return value. A plain
 * `mockResolvedValue({})` would let every ledger assertion pass against
 * `undefined`.
 */
function makeBalanceStore(initial: Record<string, number>) {
  const balances = { ...initial };
  return {
    balances,
    update: vi.fn().mockImplementation(({ where, data }: any) => {
      const current = balances[where.id] ?? 0;
      const next =
        data.currentStock?.increment !== undefined
          ? current + Number(data.currentStock.increment)
          : data.currentStock?.decrement !== undefined
            ? current - Number(data.currentStock.decrement)
            : Number(data.currentStock);
      balances[where.id] = next;
      return { currentStock: next };
    }),
  };
}

vi.mock("@/lib/prisma", () => {
  prismaMock = {
    product: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    productionBatch: { findMany: vi.fn().mockResolvedValue([]) },
    store: { findUnique: vi.fn().mockResolvedValue({ productionEnabled: true }) },
    $transaction: vi.fn(async (fn: any) => fn(capturedTx)),
  };
  return { prisma: prismaMock };
});

vi.mock("../../repositories/production-batch.repository", () => ({
  productionBatchRepository: {
    generateBatchNumber: vi.fn().mockResolvedValue("QUICK-000001"),
    belongsToStore: vi.fn().mockResolvedValue(true),
    findById: vi.fn(),
  },
}));
vi.mock("../../repositories/recipe.repository", () => ({ recipeRepository: { findById: vi.fn() } }));
vi.mock("../../repositories/material.repository", () => ({
  materialRepository: { findById: vi.fn() },
}));
vi.mock("../../repositories/product.repository", () => ({
  productRepository: { findById: vi.fn() },
}));
vi.mock("../order-status.helpers", () => ({ advanceOrderToReadyIfAllItemsReady: vi.fn() }));
vi.mock("../../realtime/publish", () => ({
  publishStockChanged: vi.fn(),
  publishStoreEvent: vi.fn(),
}));
vi.mock("../stock-alerts.helpers", () => ({
  fireLowStockAlertsForEntities: vi.fn(),
  fireLowStockAlert: vi.fn(),
}));

import { productionBatchService } from "../production-batch.service";

/** One croissant needs 100 g of flour; the recipe yields 1. */
function croissantRecipe() {
  return {
    id: "recipe-1",
    storeId: "store-1",
    yieldQuantity: 1,
    yieldUnit: "piece",
    ingredients: [
      {
        materialId: "mat-flour",
        quantity: 100,
        unit: "g",
        material: { id: "mat-flour", name: "Flour", unit: "g" },
      },
    ],
  };
}

function quickLogProduct(overrides: any = {}) {
  return {
    id: "prod-1",
    name: "Croissant",
    unit: "piece",
    stockMode: StockMode.BATCH_PRODUCED,
    primaryRecipeId: "recipe-1",
    primaryRecipe: croissantRecipe(),
    ...overrides,
  };
}

describe("quickLogProduction", () => {
  let productStore: ReturnType<typeof makeBalanceStore>;
  let materialStore: ReturnType<typeof makeBalanceStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    productStore = makeBalanceStore({ "prod-1": 0 });
    materialStore = makeBalanceStore({ "mat-flour": 5000 });
    capturedTx = {
      productionBatch: {
        create: vi.fn().mockImplementation(({ data }: any) => ({ id: "batch-1", ...data })),
        update: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
      product: { update: productStore.update },
      material: { update: materialStore.update },
      stockMovement: { create: vi.fn() },
    };
    prismaMock.product.findFirst.mockResolvedValue(quickLogProduct());
  });

  it("draws materials and credits finished goods when there is no debt", async () => {
    await productionBatchService.quickLogProduction({
      storeId: "store-1",
      productId: "prod-1",
      quantity: 10,
    });

    // 10 croissants × 100 g = 1000 g out of 5000.
    expect(materialStore.balances["mat-flour"]).toBe(4000);
    // All 10 land on the shelf.
    expect(productStore.balances["prod-1"]).toBe(10);
  });

  it("nets against drawn-shortfall debt on BOTH sides", async () => {
    // 3 croissants were sold before they were made: their flour already left at
    // the till, and they go straight to those customers rather than the shelf.
    capturedTx.productionBatch.findMany.mockResolvedValue([
      { id: "sf-1", plannedQuantity: 3, settledQuantity: 0 },
    ]);

    await productionBatchService.quickLogProduction({
      storeId: "store-1",
      productId: "prod-1",
      quantity: 10,
    });

    // Only 7 × 100 g leaves — not 1000 g. This is the double-draw the whole
    // settlement mechanism exists to prevent.
    expect(materialStore.balances["mat-flour"]).toBe(4300);
    // And only 7 are physically on the shelf, not 10.
    expect(productStore.balances["prod-1"]).toBe(7);
    // The debt is consumed so a second run cannot net against it again.
    expect(capturedTx.productionBatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sf-1" },
        data: { settledQuantity: { increment: 3 } },
      })
    );
  });

  it("moves no stock at all when the whole run was already sold", async () => {
    capturedTx.productionBatch.findMany.mockResolvedValue([
      { id: "sf-1", plannedQuantity: 10, settledQuantity: 0 },
    ]);

    await productionBatchService.quickLogProduction({
      storeId: "store-1",
      productId: "prod-1",
      quantity: 10,
    });

    expect(materialStore.balances["mat-flour"]).toBe(5000);
    expect(productStore.balances["prod-1"]).toBe(0);
  });

  it("refuses a product that is not counted on a shelf", async () => {
    prismaMock.product.findFirst.mockResolvedValue(
      quickLogProduct({ stockMode: StockMode.MADE_TO_ORDER })
    );
    await expect(
      productionBatchService.quickLogProduction({
        storeId: "store-1",
        productId: "prod-1",
        quantity: 5,
      })
    ).rejects.toThrow(/count on a shelf/i);
  });

  it("refuses a product with no primary recipe", async () => {
    prismaMock.product.findFirst.mockResolvedValue(
      quickLogProduct({ primaryRecipe: null, primaryRecipeId: null })
    );
    await expect(
      productionBatchService.quickLogProduction({
        storeId: "store-1",
        productId: "prod-1",
        quantity: 5,
      })
    ).rejects.toThrow(/no primary recipe/i);
  });

  it("refuses a cross-store primary recipe", async () => {
    prismaMock.product.findFirst.mockResolvedValue(
      quickLogProduct({ primaryRecipe: { ...croissantRecipe(), storeId: "other-store" } })
    );
    await expect(
      productionBatchService.quickLogProduction({
        storeId: "store-1",
        productId: "prod-1",
        quantity: 5,
      })
    ).rejects.toThrow(/no primary recipe/i);
  });
});

describe("getPrepList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.productionBatch.findMany.mockResolvedValue([]);
  });

  it("suggests the gap to par level", async () => {
    prismaMock.product.findMany.mockResolvedValue([
      {
        id: "prod-1",
        name: "Croissant",
        department: "KITCHEN",
        unit: "piece",
        currentStock: 4,
        minStock: 20,
        primaryRecipe: { id: "recipe-1", name: "Croissant dough", storeId: "store-1" },
      },
    ]);

    const rows = await productionBatchService.getPrepList("store-1");
    expect(rows).toHaveLength(1);
    expect(rows[0].suggested).toBe(16);
  });

  it("nets the suggestion against outstanding drawn-shortfall debt", async () => {
    prismaMock.product.findMany.mockResolvedValue([
      {
        id: "prod-1",
        name: "Croissant",
        department: "KITCHEN",
        unit: "piece",
        currentStock: 4,
        minStock: 20,
        primaryRecipe: { id: "recipe-1", name: "Croissant dough", storeId: "store-1" },
      },
    ]);
    // 6 already sold-and-drawn: they are not stock the kitchen must rebuild.
    prismaMock.productionBatch.findMany.mockResolvedValue([
      { plannedQuantity: 6, settledQuantity: 0 },
    ]);

    const rows = await productionBatchService.getPrepList("store-1");
    expect(rows[0].suggested).toBe(10);
    expect(rows[0].outstandingShortfall).toBe(6);
  });

  it("omits a cross-store primary recipe", async () => {
    prismaMock.product.findMany.mockResolvedValue([
      {
        id: "prod-1",
        name: "Croissant",
        department: "KITCHEN",
        unit: "piece",
        currentStock: 0,
        minStock: 20,
        primaryRecipe: { id: "recipe-1", name: "Croissant dough", storeId: "other-store" },
      },
    ]);
    await expect(productionBatchService.getPrepList("store-1")).resolves.toEqual([]);
  });
});

describe("applyStockCount", () => {
  let productStore: ReturnType<typeof makeBalanceStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    productStore = makeBalanceStore({ "prod-1": 40 });
    capturedTx = {
      product: { update: productStore.update },
      stockMovement: { create: vi.fn() },
    };
    prismaMock.product.findMany.mockResolvedValue([
      { id: "prod-1", name: "Croissant", unit: "piece", currentStock: 40 },
    ]);
  });

  it("writes a negative ADJUSTMENT for shrinkage", async () => {
    // 40 on the books, 25 actually on the shelf — 15 binned and never costed
    // until this runs.
    const result = await productionBatchService.applyStockCount("store-1", [
      { productId: "prod-1", countedQuantity: 25 },
    ]);

    expect(result).toEqual({ adjusted: 1, skipped: 0 });
    expect(productStore.balances["prod-1"]).toBe(25);
    expect(capturedTx.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ quantity: -15, reason: "STOCK_COUNT", balanceAfter: 25 }),
      })
    );
  });

  it("accepts a count of zero", async () => {
    const result = await productionBatchService.applyStockCount("store-1", [
      { productId: "prod-1", countedQuantity: 0 },
    ]);
    expect(result.adjusted).toBe(1);
    expect(productStore.balances["prod-1"]).toBe(0);
  });

  it("skips a count that already matches, rather than writing a no-op row", async () => {
    const result = await productionBatchService.applyStockCount("store-1", [
      { productId: "prod-1", countedQuantity: 40 },
    ]);
    expect(result).toEqual({ adjusted: 0, skipped: 1 });
    expect(capturedTx.stockMovement.create).not.toHaveBeenCalled();
  });

  it("skips a product that is not in this store", async () => {
    prismaMock.product.findMany.mockResolvedValue([]);
    const result = await productionBatchService.applyStockCount("store-1", [
      { productId: "prod-1", countedQuantity: 5 },
    ]);
    expect(result).toEqual({ adjusted: 0, skipped: 1 });
    expect(productStore.update).not.toHaveBeenCalled();
  });
});
