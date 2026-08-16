import { describe, it, expect, vi, beforeEach } from "vitest";
import { StockMode } from "@prisma/client";

// var (not const/let) avoids TDZ when vi.mock factories are hoisted above declarations.
var prismaMock: any;
var capturedTx: any;
var productionBatchRepoMock: any;
var recipeRepoMock: any;
var productRepoMock: any;
var advanceOrderToReadyMock: any;

vi.mock("@/lib/prisma", () => {
  prismaMock = {
    order: { findUnique: vi.fn() },
    store: { findUnique: vi.fn() },
    product: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    material: { findMany: vi.fn().mockResolvedValue([]) },
    recipeProduct: { findFirst: vi.fn().mockResolvedValue({ id: "rp-1" }) },
    productionBatch: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    alert: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
    user: { findUnique: vi.fn().mockResolvedValue({ email: "owner@example.com" }) },
    $transaction: vi.fn(async (fn: any) => {
      capturedTx = {
        productionBatch: {
          create: vi.fn().mockImplementation(({ data }: any) => ({ id: "batch-1", ...data })),
          update: vi.fn().mockImplementation(({ data }: any) => ({ id: "batch-1", ...data })),
          findMany: vi.fn().mockResolvedValue([]),
        },
        orderItem: {
          updateMany: vi.fn(),
          findMany: vi.fn().mockResolvedValue([]),
          update: vi.fn(),
        },
        order: { update: vi.fn() },
        product: { findUnique: vi.fn(), update: vi.fn() },
        material: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn() },
        stockMovement: { create: vi.fn(), createMany: vi.fn() },
      };
      return fn(capturedTx);
    }),
  };
  return { prisma: prismaMock };
});

vi.mock("../../repositories/production-batch.repository", () => {
  productionBatchRepoMock = {
    belongsToStore: vi.fn().mockResolvedValue(true),
    findById: vi.fn(),
    generateBatchNumber: vi.fn().mockResolvedValue("ORD-000001"),
  };
  return { productionBatchRepository: productionBatchRepoMock };
});

vi.mock("../../repositories/recipe.repository", () => {
  recipeRepoMock = { findById: vi.fn() };
  return { recipeRepository: recipeRepoMock };
});
vi.mock("../../repositories/material.repository", () => ({
  materialRepository: { findById: vi.fn() },
}));
vi.mock("../../repositories/product.repository", () => {
  productRepoMock = { findById: vi.fn() };
  return { productRepository: productRepoMock };
});

vi.mock("../order-status.helpers", () => {
  advanceOrderToReadyMock = vi.fn();
  return { advanceOrderToReadyIfAllItemsReady: advanceOrderToReadyMock };
});

import { productionBatchService } from "../production-batch.service";

/**
 * `shortfallRecipeInclude` selects `primaryRecipe: { id, yieldUnit, storeId }`
 * — a single object or null. There is no `recipeProducts` array and no
 * `isDefault` flag: the old fixtures invented one, and the `where` clause they
 * were pretending to satisfy matched nothing in production.
 */
function makeShortfallProduct(overrides: any = {}) {
  return {
    id: "prod-1",
    currentStock: 2,
    stockMode: StockMode.BATCH_PRODUCED,
    primaryRecipeId: "recipe-1",
    primaryRecipe: { id: "recipe-1", yieldUnit: "piece", storeId: "store-1" },
    ...overrides,
  };
}

describe("draftShortfallBatchesForOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function orderWithItem(overrides: Partial<any> = {}) {
    return {
      id: "order-1",
      storeId: "store-1",
      orderNumber: "POS-1",
      items: [
        {
          id: "item-1",
          orderId: "order-1",
          quantity: 5,
          product: makeShortfallProduct(),
          menuItem: null,
          ...overrides,
        },
      ],
    };
  }

  it("drafts an IN_PROGRESS ORDER_SHORTFALL batch sized to the shortfall, linked to the item", async () => {
    prismaMock.order.findUnique.mockResolvedValue(orderWithItem());

    const result = await productionBatchService.draftShortfallBatchesForOrder(
      "order-1",
      "store-1"
    );

    expect(result.batchesCreated).toBe(1);
    const [createCall] = capturedTx.productionBatch.create.mock.calls;
    expect(createCall[0].data.status).toBe("IN_PROGRESS");
    expect(createCall[0].data.triggerType).toBe("ORDER_SHORTFALL");
    expect(createCall[0].data.recipeId).toBe("recipe-1");
    expect(Number(createCall[0].data.plannedQuantity)).toBe(3); // 5 ordered - 2 on hand

    const [linkCall] = capturedTx.orderItem.updateMany.mock.calls;
    expect(linkCall[0].where.id.in).toEqual(["item-1"]);
    expect(linkCall[0].data.productionBatchId).toBe("batch-1");
  });

  it("does not draft a batch when on-hand stock already covers the order", async () => {
    prismaMock.order.findUnique.mockResolvedValue(
      orderWithItem({ quantity: 1, product: makeShortfallProduct({ currentStock: 10 }) })
    );

    const result = await productionBatchService.draftShortfallBatchesForOrder(
      "order-1",
      "store-1"
    );

    expect(result.batchesCreated).toBe(0);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("never drafts a batch for a product with no primary recipe, even at zero stock", async () => {
    prismaMock.order.findUnique.mockResolvedValue(
      orderWithItem({
        quantity: 5,
        product: makeShortfallProduct({
          currentStock: 0,
          primaryRecipeId: null,
          primaryRecipe: null,
        }),
      })
    );

    const result = await productionBatchService.draftShortfallBatchesForOrder(
      "order-1",
      "store-1"
    );

    expect(result.batchesCreated).toBe(0);
  });

  it("never drafts for MADE_TO_ORDER — there is no counted balance to fall below", async () => {
    prismaMock.order.findUnique.mockResolvedValue(
      orderWithItem({
        quantity: 5,
        product: makeShortfallProduct({ currentStock: 0, stockMode: StockMode.MADE_TO_ORDER }),
      })
    );

    const result = await productionBatchService.draftShortfallBatchesForOrder(
      "order-1",
      "store-1"
    );

    expect(result.batchesCreated).toBe(0);
  });

  it("never drafts for UNTRACKED — a phantom batch on every order, forever", async () => {
    prismaMock.order.findUnique.mockResolvedValue(
      orderWithItem({
        quantity: 5,
        product: makeShortfallProduct({ currentStock: 0, stockMode: StockMode.UNTRACKED }),
      })
    );

    const result = await productionBatchService.draftShortfallBatchesForOrder(
      "order-1",
      "store-1"
    );

    expect(result.batchesCreated).toBe(0);
  });

  it("never lets a cross-store primary recipe drive production (the FK is global)", async () => {
    prismaMock.order.findUnique.mockResolvedValue(
      orderWithItem({
        quantity: 5,
        product: makeShortfallProduct({
          primaryRecipe: { id: "recipe-1", yieldUnit: "piece", storeId: "other-store" },
        }),
      })
    );

    const result = await productionBatchService.draftShortfallBatchesForOrder(
      "order-1",
      "store-1"
    );

    expect(result.batchesCreated).toBe(0);
  });

  it("aggregates multiple line items of the same product before computing shortfall", async () => {
    const product = makeShortfallProduct({ currentStock: 3 });
    prismaMock.order.findUnique.mockResolvedValue({
      id: "order-1",
      storeId: "store-1",
      orderNumber: "POS-1",
      items: [
        { id: "item-1", orderId: "order-1", quantity: 2, product, menuItem: null },
        { id: "item-2", orderId: "order-1", quantity: 4, product, menuItem: null },
      ],
    });

    const result = await productionBatchService.draftShortfallBatchesForOrder(
      "order-1",
      "store-1"
    );

    expect(result.batchesCreated).toBe(1);
    const [createCall] = capturedTx.productionBatch.create.mock.calls;
    expect(Number(createCall[0].data.plannedQuantity)).toBe(3); // (2+4) ordered - 3 on hand
    const [linkCall] = capturedTx.orderItem.updateMany.mock.calls;
    expect(linkCall[0].where.id.in.sort()).toEqual(["item-1", "item-2"]);
  });
});

describe("recordDrawnShortfalls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.store.findUnique.mockResolvedValue({ productionEnabled: true });
    prismaMock.productionBatch.findFirst.mockResolvedValue(null);
    prismaMock.product.findFirst.mockResolvedValue({ unit: "piece", primaryRecipeId: "recipe-1" });
  });

  it("creates an ORDER_SHORTFALL batch stamped materialsDrawnAt — the marker settlement keys off", async () => {
    await productionBatchService.recordDrawnShortfalls("order-1", "store-1", [
      { productId: "prod-1", quantity: 3 },
    ]);

    const [createCall] = prismaMock.productionBatch.create.mock.calls;
    expect(createCall[0].data.triggerType).toBe("ORDER_SHORTFALL");
    expect(createCall[0].data.status).toBe("IN_PROGRESS");
    expect(Number(createCall[0].data.plannedQuantity)).toBe(3);
    expect(createCall[0].data.recipeId).toBe("recipe-1");
    expect(createCall[0].data.materialsDrawnAt).toBeInstanceOf(Date);
  });

  it("marks the batch already drafted at CONFIRMED rather than creating a second one", async () => {
    // One physical bake must never be recorded twice.
    prismaMock.productionBatch.findFirst.mockResolvedValue({
      id: "batch-existing",
      materialsDrawnAt: null,
    });

    await productionBatchService.recordDrawnShortfalls("order-1", "store-1", [
      { productId: "prod-1", quantity: 3 },
    ]);

    expect(prismaMock.productionBatch.create).not.toHaveBeenCalled();
    expect(prismaMock.productionBatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "batch-existing" },
        data: { materialsDrawnAt: expect.any(Date) },
      })
    );
  });

  it("leaves an already-stamped batch alone (re-delivery must not re-stamp)", async () => {
    prismaMock.productionBatch.findFirst.mockResolvedValue({
      id: "batch-existing",
      materialsDrawnAt: new Date("2026-08-13T09:00:00Z"),
    });

    await productionBatchService.recordDrawnShortfalls("order-1", "store-1", [
      { productId: "prod-1", quantity: 3 },
    ]);

    expect(prismaMock.productionBatch.update).not.toHaveBeenCalled();
    expect(prismaMock.productionBatch.create).not.toHaveBeenCalled();
  });

  it("accrues nothing for a store with Production switched off", async () => {
    prismaMock.store.findUnique.mockResolvedValue({ productionEnabled: false });

    await productionBatchService.recordDrawnShortfalls("order-1", "store-1", [
      { productId: "prod-1", quantity: 3 },
    ]);

    expect(prismaMock.productionBatch.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.productionBatch.create).not.toHaveBeenCalled();
  });
});

describe("drawn-shortfall settlement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getOutstandingDrawnShortfall sums planned − settled and floors each batch at 0", async () => {
    prismaMock.productionBatch.findMany.mockResolvedValue([
      { plannedQuantity: 3, settledQuantity: 0 },
      { plannedQuantity: 5, settledQuantity: 2 },
      { plannedQuantity: 4, settledQuantity: 9 }, // over-settled, must not go negative
    ]);

    await expect(productionBatchService.getOutstandingDrawnShortfall("prod-1")).resolves.toBe(6);
  });

  it("settleDrawnShortfall consumes outstanding debt oldest batch first", async () => {
    const tx: any = {
      productionBatch: {
        findMany: vi.fn().mockResolvedValue([
          { id: "batch-old", plannedQuantity: 3, settledQuantity: 0 },
          { id: "batch-new", plannedQuantity: 5, settledQuantity: 2 },
        ]),
        update: vi.fn(),
      },
    };

    const settled = await productionBatchService.settleDrawnShortfall(tx, "prod-1", 5);

    expect(settled).toBe(5);
    expect(tx.productionBatch.update).toHaveBeenNthCalledWith(1, {
      where: { id: "batch-old" },
      data: { settledQuantity: { increment: 3 } },
    });
    expect(tx.productionBatch.update).toHaveBeenNthCalledWith(2, {
      where: { id: "batch-new" },
      data: { settledQuantity: { increment: 2 } },
    });
  });

  it("settleDrawnShortfall absorbs only what debt exists and skips fully-settled batches", async () => {
    const tx: any = {
      productionBatch: {
        findMany: vi.fn().mockResolvedValue([
          { id: "batch-done", plannedQuantity: 4, settledQuantity: 4 },
          { id: "batch-open", plannedQuantity: 2, settledQuantity: 0 },
        ]),
        update: vi.fn(),
      },
    };

    const settled = await productionBatchService.settleDrawnShortfall(tx, "prod-1", 10);

    expect(settled).toBe(2);
    expect(tx.productionBatch.update).toHaveBeenCalledTimes(1);
    expect(tx.productionBatch.update).toHaveBeenCalledWith({
      where: { id: "batch-open" },
      data: { settledQuantity: { increment: 2 } },
    });
  });

  it("settleDrawnShortfall is a no-op for a non-positive quantity", async () => {
    const tx: any = { productionBatch: { findMany: vi.fn(), update: vi.fn() } };
    await expect(productionBatchService.settleDrawnShortfall(tx, "prod-1", 0)).resolves.toBe(0);
    expect(tx.productionBatch.findMany).not.toHaveBeenCalled();
  });

  it("startProduction nets the run against the debt so the same flour is never drawn twice", async () => {
    // 3 of these 10 were already sold ahead of being prepped, and the SALE
    // took their ingredients out then. Only the remaining 7 may draw material.
    prismaMock.productionBatch.findMany.mockResolvedValue([
      { plannedQuantity: 3, settledQuantity: 0 },
    ]);
    recipeRepoMock.findById.mockResolvedValue({
      id: "recipe-1",
      storeId: "store-1",
      name: "Pâte à baguette",
      yieldQuantity: 1,
      yieldUnit: "piece",
      ingredients: [
        {
          materialId: "mat-1",
          quantity: 100,
          unit: "g",
          material: { id: "mat-1", name: "Flour", currentStock: 5000, unit: "g" },
        },
      ],
    });
    productRepoMock.findById.mockResolvedValue({ id: "prod-1", storeId: "store-1" });
    prismaMock.material.findMany.mockResolvedValue([
      { id: "mat-1", name: "Flour", currentStock: 5000, unit: "g", minStock: 0 },
    ]);
    prismaMock.$transaction.mockImplementationOnce(async (fn: any) => {
      capturedTx = {
        productionBatch: {
          create: vi.fn().mockImplementation(({ data }: any) => ({ id: "batch-1", ...data })),
          update: vi.fn(),
          findMany: vi
            .fn()
            .mockResolvedValue([{ id: "batch-debt", plannedQuantity: 3, settledQuantity: 0 }]),
        },
        material: {
          findMany: vi.fn().mockResolvedValue([{ id: "mat-1", currentStock: 5000, name: "Flour" }]),
          update: vi.fn(),
        },
        stockMovement: { createMany: vi.fn() },
      };
      return fn(capturedTx);
    });

    await productionBatchService.startProduction({
      storeId: "store-1",
      productId: "prod-1",
      recipeId: "recipe-1",
      plannedQuantity: 10,
      scheduledDate: new Date("2026-08-14T08:00:00Z"),
    });

    // 7 units x 100 g, NOT 10 x 100 g.
    expect(capturedTx.material.update).toHaveBeenCalledWith({
      where: { id: "mat-1" },
      data: { currentStock: 4300 },
    });
    // The debt is consumed inside the same transaction as the deduction.
    expect(capturedTx.productionBatch.update).toHaveBeenCalledWith({
      where: { id: "batch-debt" },
      data: { settledQuantity: { increment: 3 } },
    });
    // The batch still records the full 10 that were physically produced.
    const [createCall] = capturedTx.productionBatch.create.mock.calls;
    expect(Number(createCall[0].data.plannedQuantity)).toBe(10);
  });

  it("startProduction draws the full quantity when no debt is outstanding", async () => {
    prismaMock.productionBatch.findMany.mockResolvedValue([]);
    recipeRepoMock.findById.mockResolvedValue({
      id: "recipe-1",
      storeId: "store-1",
      name: "Pâte à baguette",
      yieldQuantity: 1,
      yieldUnit: "piece",
      ingredients: [
        {
          materialId: "mat-1",
          quantity: 100,
          unit: "g",
          material: { id: "mat-1", name: "Flour", currentStock: 5000, unit: "g" },
        },
      ],
    });
    productRepoMock.findById.mockResolvedValue({ id: "prod-1", storeId: "store-1" });
    prismaMock.$transaction.mockImplementationOnce(async (fn: any) => {
      capturedTx = {
        productionBatch: {
          create: vi.fn().mockImplementation(({ data }: any) => ({ id: "batch-1", ...data })),
          update: vi.fn(),
          findMany: vi.fn().mockResolvedValue([]),
        },
        material: {
          findMany: vi.fn().mockResolvedValue([{ id: "mat-1", currentStock: 5000, name: "Flour" }]),
          update: vi.fn(),
        },
        stockMovement: { createMany: vi.fn() },
      };
      return fn(capturedTx);
    });

    await productionBatchService.startProduction({
      storeId: "store-1",
      productId: "prod-1",
      recipeId: "recipe-1",
      plannedQuantity: 10,
      scheduledDate: new Date("2026-08-14T08:00:00Z"),
    });

    expect(capturedTx.material.update).toHaveBeenCalledWith({
      where: { id: "mat-1" },
      data: { currentStock: 4000 },
    });
    expect(capturedTx.productionBatch.update).not.toHaveBeenCalled();
  });
});

describe("completeProduction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("MANUAL batch: still creates PRODUCTION_IN and increments product stock (regression guard)", async () => {
    productionBatchRepoMock.findById.mockResolvedValue({
      id: "batch-1",
      batchNumber: "BATCH-1",
      productId: "prod-1",
      status: "IN_PROGRESS",
      triggerType: "MANUAL",
      unit: "piece",
    });
    prismaMock.$transaction.mockImplementationOnce(async (fn: any) => {
      capturedTx = {
        productionBatch: {
          update: vi.fn().mockResolvedValue({ id: "batch-1", status: "COMPLETED" }),
        },
        orderItem: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn() },
        product: {
          findUnique: vi.fn().mockResolvedValue({ id: "prod-1", currentStock: 20 }),
          update: vi.fn(),
        },
        stockMovement: { create: vi.fn() },
      };
      return fn(capturedTx);
    });

    await productionBatchService.completeProduction("batch-1", "store-1", 10);

    expect(capturedTx.product.findUnique).toHaveBeenCalled();
    expect(capturedTx.stockMovement.create).toHaveBeenCalledTimes(1);
    const [movementCall] = capturedTx.stockMovement.create.mock.calls;
    expect(movementCall[0].data.type).toBe("PRODUCTION_IN");
    expect(capturedTx.orderItem.findMany).not.toHaveBeenCalled();
  });

  it("ORDER_SHORTFALL batch: skips stock movement, flips linked items to READY", async () => {
    productionBatchRepoMock.findById.mockResolvedValue({
      id: "batch-1",
      batchNumber: "ORD-1",
      productId: "prod-1",
      status: "IN_PROGRESS",
      triggerType: "ORDER_SHORTFALL",
      unit: "piece",
    });

    // Override the default empty findMany from the shared mock setup.
    prismaMock.$transaction.mockImplementationOnce(async (fn: any) => {
      capturedTx = {
        productionBatch: { update: vi.fn().mockResolvedValue({ id: "batch-1", status: "COMPLETED" }) },
        orderItem: {
          findMany: vi.fn().mockResolvedValue([
            { id: "item-1", orderId: "order-1", status: "PREPARING" },
            { id: "item-2", orderId: "order-1", status: "READY" }, // already ready, should be skipped
          ]),
          update: vi.fn(),
        },
        product: { findUnique: vi.fn(), update: vi.fn() },
        stockMovement: { create: vi.fn() },
      };
      return fn(capturedTx);
    });

    await productionBatchService.completeProduction("batch-1", "store-1", 3);

    expect(capturedTx.stockMovement.create).not.toHaveBeenCalled();
    expect(capturedTx.product.update).not.toHaveBeenCalled();
    expect(capturedTx.orderItem.update).toHaveBeenCalledTimes(1); // only item-1, item-2 was already READY
    expect(capturedTx.orderItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "item-1" } })
    );
    expect(advanceOrderToReadyMock).toHaveBeenCalledWith(capturedTx, "order-1");
  });

  it("throws when the batch isn't IN_PROGRESS", async () => {
    productionBatchRepoMock.findById.mockResolvedValue({
      id: "batch-1",
      status: "COMPLETED",
      triggerType: "MANUAL",
    });

    await expect(productionBatchService.completeProduction("batch-1", "store-1", 1)).rejects.toThrow(
      /in progress/i
    );
  });
});

describe("cancelProduction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (fn: any) => {
      capturedTx = {
        productionBatch: { update: vi.fn().mockResolvedValue({ id: "batch-1", status: "CANCELLED" }) },
        material: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn() },
        stockMovement: { createMany: vi.fn() },
      };
      return fn(capturedTx);
    });
  });

  it("forces restoreMaterials to false for an ORDER_SHORTFALL batch regardless of the caller's flag", async () => {
    productionBatchRepoMock.findById.mockResolvedValue({
      id: "batch-1",
      status: "IN_PROGRESS",
      triggerType: "ORDER_SHORTFALL",
      recipe: { yieldQuantity: 1, ingredients: [] },
      plannedQuantity: 5,
    });

    await productionBatchService.cancelProduction("batch-1", "store-1", true);

    // No material lookups should have been attempted since restoreMaterials
    // was forced false before the restoration branch ran.
    expect(capturedTx.material.findMany).not.toHaveBeenCalled();
  });
});
