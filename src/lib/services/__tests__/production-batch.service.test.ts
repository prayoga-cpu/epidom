import { describe, it, expect, vi, beforeEach } from "vitest";

// var (not const/let) avoids TDZ when vi.mock factories are hoisted above declarations.
var prismaMock: any;
var capturedTx: any;
var productionBatchRepoMock: any;
var advanceOrderToReadyMock: any;

vi.mock("@/lib/prisma", () => {
  prismaMock = {
    order: { findUnique: vi.fn() },
    $transaction: vi.fn(async (fn: any) => {
      capturedTx = {
        productionBatch: {
          create: vi.fn().mockImplementation(({ data }: any) => ({ id: "batch-1", ...data })),
          update: vi.fn().mockImplementation(({ data }: any) => ({ id: "batch-1", ...data })),
        },
        orderItem: {
          updateMany: vi.fn(),
          findMany: vi.fn().mockResolvedValue([]),
          update: vi.fn(),
        },
        order: { update: vi.fn() },
        product: { findUnique: vi.fn(), update: vi.fn() },
        stockMovement: { create: vi.fn() },
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

vi.mock("../../repositories/recipe.repository", () => ({
  recipeRepository: { findById: vi.fn() },
}));
vi.mock("../../repositories/material.repository", () => ({
  materialRepository: { findById: vi.fn() },
}));
vi.mock("../../repositories/product.repository", () => ({
  productRepository: { findById: vi.fn() },
}));

vi.mock("../order-status.helpers", () => {
  advanceOrderToReadyMock = vi.fn();
  return { advanceOrderToReadyIfAllItemsReady: advanceOrderToReadyMock };
});

import { productionBatchService } from "../production-batch.service";

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
          product: {
            id: "prod-1",
            currentStock: 2,
            recipeProducts: [{ recipe: { id: "recipe-1", yieldUnit: "piece" } }],
          },
          menuItem: null,
          ...overrides,
        },
      ],
      ...("items" in overrides ? {} : {}),
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
    expect(Number(createCall[0].data.plannedQuantity)).toBe(3); // 5 ordered - 2 on hand

    const [linkCall] = capturedTx.orderItem.updateMany.mock.calls;
    expect(linkCall[0].where.id.in).toEqual(["item-1"]);
    expect(linkCall[0].data.productionBatchId).toBe("batch-1");
  });

  it("does not draft a batch when on-hand stock already covers the order", async () => {
    prismaMock.order.findUnique.mockResolvedValue(
      orderWithItem({
        quantity: 1,
        product: {
          id: "prod-1",
          currentStock: 10,
          recipeProducts: [{ recipe: { id: "recipe-1", yieldUnit: "piece" } }],
        },
      })
    );

    const result = await productionBatchService.draftShortfallBatchesForOrder(
      "order-1",
      "store-1"
    );

    expect(result.batchesCreated).toBe(0);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("never drafts a batch for a product with no recipe, even at zero stock", async () => {
    prismaMock.order.findUnique.mockResolvedValue(
      orderWithItem({
        quantity: 5,
        product: { id: "prod-1", currentStock: 0, recipeProducts: [] },
      })
    );

    const result = await productionBatchService.draftShortfallBatchesForOrder(
      "order-1",
      "store-1"
    );

    expect(result.batchesCreated).toBe(0);
  });

  it("aggregates multiple line items of the same product before computing shortfall", async () => {
    const product = {
      id: "prod-1",
      currentStock: 3,
      recipeProducts: [{ recipe: { id: "recipe-1", yieldUnit: "piece" } }],
    };
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
