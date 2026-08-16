import { describe, it, expect, vi, beforeEach } from "vitest";
import { WasteReason } from "@prisma/client";

/**
 * Ticket #01 regression suite.
 *
 * A recipe run deducted FARINE T55 correctly in the DB, but /management and
 * /data kept showing the old number for ~30s: production-batch.service and
 * waste.service wrote stock without ever publishing a Pusher event, so the
 * listener in use-materials.ts never fired and the UI waited for the safety-net
 * poll. These tests pin the push down at the real boundary — the Pusher server
 * client — rather than at the helper, so a future refactor that drops the call
 * is caught even if the helper itself still exists.
 */

// var (not const/let) avoids TDZ when vi.mock factories are hoisted above declarations.
var pusherTriggerMock: any;
var prismaMock: any;
var capturedTx: any;
var triggerCallsAtCommit: number;
var productionBatchRepoMock: any;
var recipeRepoMock: any;
var materialRepoMock: any;
var productRepoMock: any;

vi.mock("@/lib/realtime/pusher-server", () => {
  pusherTriggerMock = vi.fn().mockResolvedValue(undefined);
  return {
    isRealtimeConfigured: () => true,
    getPusherServer: () => ({ trigger: pusherTriggerMock }),
  };
});

vi.mock("@/lib/magicbell/client", () => ({ sendMerchantAlert: vi.fn() }));

function makeTx() {
  return {
    productionBatch: {
      create: vi.fn().mockImplementation(({ data }: any) => ({ id: "batch-1", ...data })),
      update: vi.fn().mockImplementation(({ data }: any) => ({ id: "batch-1", ...data })),
      // settleDrawnShortfall reads/writes the ORDER_SHORTFALL debt ledger from
      // inside startProduction's transaction. Empty = nothing owed, so these
      // runs draw their full material requirement.
      findMany: vi.fn().mockResolvedValue([]),
    },
    material: {
      findMany: vi.fn().mockResolvedValue([{ id: "mat-1", name: "FARINE T55", currentStock: 20 }]),
      update: vi.fn(),
    },
    product: {
      findUnique: vi.fn().mockResolvedValue({ id: "prod-1", currentStock: 4 }),
      update: vi.fn(),
    },
    stockMovement: {
      create: vi.fn().mockResolvedValue({ id: "movement-1" }),
      createMany: vi.fn(),
    },
    orderItem: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn(), updateMany: vi.fn() },
    wasteEntry: {
      create: vi.fn().mockImplementation(({ data }: any) => ({ id: "waste-1", ...data })),
      update: vi.fn().mockImplementation(({ data }: any) => ({ id: "waste-1", ...data })),
      delete: vi.fn(),
    },
  };
}

vi.mock("@/lib/prisma", () => {
  prismaMock = {
    recipeProduct: { findFirst: vi.fn().mockResolvedValue({ id: "rp-1" }) },
    // getOutstandingDrawnShortfall runs BEFORE startProduction's transaction,
    // so it reads the outer client, not the tx one.
    productionBatch: { findMany: vi.fn().mockResolvedValue([]) },
    wasteEntry: { findFirst: vi.fn() },
    store: { findUnique: vi.fn() },
    material: { findMany: vi.fn() },
    product: { findMany: vi.fn() },
    alert: { findFirst: vi.fn(), create: vi.fn() },
    user: { findUnique: vi.fn() },
    $transaction: vi.fn(async (fn: any) => {
      capturedTx = makeTx();
      const result = await fn(capturedTx);
      // Snapshot taken at the moment the transaction callback finishes, i.e.
      // the last instant before commit — anything published by then was
      // published from INSIDE the transaction.
      triggerCallsAtCommit = pusherTriggerMock.mock.calls.length;
      return result;
    }),
  };
  return { prisma: prismaMock };
});

vi.mock("@/lib/repositories/production-batch.repository", () => {
  productionBatchRepoMock = {
    belongsToStore: vi.fn().mockResolvedValue(true),
    findById: vi.fn(),
    generateBatchNumber: vi.fn().mockResolvedValue("BATCH-000001"),
  };
  return { productionBatchRepository: productionBatchRepoMock };
});

vi.mock("@/lib/repositories/recipe.repository", () => {
  recipeRepoMock = { findById: vi.fn() };
  return { recipeRepository: recipeRepoMock };
});

vi.mock("@/lib/repositories/material.repository", () => {
  materialRepoMock = { findById: vi.fn(), belongsToStore: vi.fn() };
  return { materialRepository: materialRepoMock };
});

vi.mock("@/lib/repositories/product.repository", () => {
  productRepoMock = { findById: vi.fn(), belongsToStore: vi.fn() };
  return { productRepository: productRepoMock };
});

vi.mock("@/lib/services/order-status.helpers", () => ({
  advanceOrderToReadyIfAllItemsReady: vi.fn(),
}));

import { publishStockChanged } from "@/lib/realtime/publish";
import { productionBatchService } from "@/lib/services/production-batch.service";
import { wasteService } from "@/lib/services/waste.service";

const CHANNEL = "private-store-store-1";

/** Entity ids the store channel was told to refetch, by event name. */
function publishedEntityIds(event: string): string[] {
  return pusherTriggerMock.mock.calls
    .filter((call: any[]) => call[1] === event)
    .map((call: any[]) => call[2].entityId);
}

// A 10-piece batch of a recipe yielding 10 pieces = multiplier 1, consuming
// 500 g of a material stocked in kg → 20 kg - 0.5 kg = 19.5 kg.
function makeRecipe() {
  return {
    id: "recipe-1",
    storeId: "store-1",
    name: "Pâte à baguette",
    yieldQuantity: 10,
    yieldUnit: "piece",
    ingredients: [
      {
        materialId: "mat-1",
        quantity: 500,
        unit: "g",
        material: { id: "mat-1", name: "FARINE T55", currentStock: 20, unit: "kg" },
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  triggerCallsAtCommit = -1;
  prismaMock.store.findUnique.mockResolvedValue({ business: { userId: "user-1" } });
  prismaMock.material.findMany.mockResolvedValue([]);
  prismaMock.product.findMany.mockResolvedValue([]);
  prismaMock.alert.findFirst.mockResolvedValue(null);
  prismaMock.alert.create.mockResolvedValue({});
  prismaMock.user.findUnique.mockResolvedValue({ email: "owner@example.com" });
  prismaMock.recipeProduct.findFirst.mockResolvedValue({ id: "rp-1" });
  prismaMock.productionBatch.findMany.mockResolvedValue([]);
});

describe("publishStockChanged", () => {
  it("fans out one stock.changed per entity, with the payload the stock listeners expect", () => {
    publishStockChanged("store-1", { materialIds: ["mat-1"], productIds: ["prod-1"] });

    expect(pusherTriggerMock).toHaveBeenCalledTimes(2);
    expect(pusherTriggerMock).toHaveBeenCalledWith(CHANNEL, "stock.changed", {
      action: "updated",
      entityId: "mat-1",
    });
    expect(pusherTriggerMock).toHaveBeenCalledWith(CHANNEL, "stock.changed", {
      action: "updated",
      entityId: "prod-1",
    });
  });

  it("pushes an entity once even if it shows up twice", () => {
    publishStockChanged("store-1", { materialIds: ["mat-1", "mat-1", "mat-2"] });
    expect(publishedEntityIds("stock.changed")).toEqual(["mat-1", "mat-2"]);
  });

  it("no-ops when nothing moved", () => {
    publishStockChanged("store-1", {});
    expect(pusherTriggerMock).not.toHaveBeenCalled();
  });
});

describe("productionBatchService.startProduction", () => {
  beforeEach(() => {
    recipeRepoMock.findById.mockResolvedValue(makeRecipe());
    productRepoMock.findById.mockResolvedValue({ id: "prod-1", storeId: "store-1" });
  });

  const input = {
    storeId: "store-1",
    productId: "prod-1",
    recipeId: "recipe-1",
    plannedQuantity: 10,
    scheduledDate: new Date("2026-08-11T08:00:00Z"),
  };

  it("publishes stock.changed for every material the batch consumed", async () => {
    await productionBatchService.startProduction(input);

    expect(capturedTx.material.update).toHaveBeenCalledWith({
      where: { id: "mat-1" },
      data: { currentStock: 19.5 },
    });
    expect(publishedEntityIds("stock.changed")).toEqual(["mat-1"]);
  });

  it("publishes only after the transaction commits, never from inside it", async () => {
    await productionBatchService.startProduction(input);
    expect(triggerCallsAtCommit).toBe(0);
    expect(pusherTriggerMock).toHaveBeenCalled();
  });

  it("publishes nothing when the transaction rolls back", async () => {
    prismaMock.$transaction.mockRejectedValueOnce(new Error("serialization failure"));
    await expect(productionBatchService.startProduction(input)).rejects.toThrow();
    expect(pusherTriggerMock).not.toHaveBeenCalled();
  });

  it("raises the same low-stock alert a sale would when the run empties a material", async () => {
    prismaMock.material.findMany.mockResolvedValue([
      { id: "mat-1", name: "FARINE T55", currentStock: 19.5, minStock: 100, unit: "kg" },
    ]);

    await productionBatchService.startProduction(input);

    expect(prismaMock.alert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "CRITICAL_STOCK",
          entityType: "material",
          entityId: "mat-1",
        }),
      })
    );
  });

  it("does not let an alerting failure fail a committed batch", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    prismaMock.store.findUnique.mockRejectedValue(new Error("db down"));

    await expect(productionBatchService.startProduction(input)).resolves.toBeDefined();
    expect(publishedEntityIds("stock.changed")).toEqual(["mat-1"]);

    errorSpy.mockRestore();
  });
});

describe("productionBatchService.completeProduction", () => {
  it("publishes stock.changed AND product.changed for the finished good", async () => {
    productionBatchRepoMock.findById.mockResolvedValue({
      id: "batch-1",
      batchNumber: "BATCH-000001",
      productId: "prod-1",
      status: "IN_PROGRESS",
      triggerType: "MANUAL",
      unit: "piece",
    });

    await productionBatchService.completeProduction("batch-1", "store-1", 10);

    expect(publishedEntityIds("stock.changed")).toEqual(["prod-1"]);
    expect(publishedEntityIds("product.changed")).toEqual(["prod-1"]);
    expect(triggerCallsAtCommit).toBe(0);
  });

  it("publishes no stock event for an ORDER_SHORTFALL batch — it never moved stock", async () => {
    productionBatchRepoMock.findById.mockResolvedValue({
      id: "batch-1",
      batchNumber: "ORD-000001",
      productId: "prod-1",
      status: "IN_PROGRESS",
      triggerType: "ORDER_SHORTFALL",
      unit: "piece",
    });

    await productionBatchService.completeProduction("batch-1", "store-1", 3);

    expect(pusherTriggerMock).not.toHaveBeenCalled();
  });
});

describe("productionBatchService.cancelProduction", () => {
  it("publishes stock.changed for every material credited back", async () => {
    productionBatchRepoMock.findById.mockResolvedValue({
      id: "batch-1",
      batchNumber: "BATCH-000001",
      status: "IN_PROGRESS",
      triggerType: "MANUAL",
      plannedQuantity: 10,
      recipe: makeRecipe(),
    });

    await productionBatchService.cancelProduction("batch-1", "store-1", true);

    expect(capturedTx.material.update).toHaveBeenCalledWith({
      where: { id: "mat-1" },
      data: { currentStock: 20.5 },
    });
    expect(publishedEntityIds("stock.changed")).toEqual(["mat-1"]);
    expect(triggerCallsAtCommit).toBe(0);
  });

  it("publishes nothing when the caller declined to restore materials", async () => {
    productionBatchRepoMock.findById.mockResolvedValue({
      id: "batch-1",
      batchNumber: "BATCH-000001",
      status: "IN_PROGRESS",
      triggerType: "MANUAL",
      plannedQuantity: 10,
      recipe: makeRecipe(),
    });

    await productionBatchService.cancelProduction("batch-1", "store-1", false);

    expect(pusherTriggerMock).not.toHaveBeenCalled();
  });
});

describe("wasteService", () => {
  const material = {
    id: "mat-1",
    storeId: "store-1",
    name: "FARINE T55",
    unit: "kg",
    currentStock: 20,
    unitCost: 1.2,
  };

  beforeEach(() => {
    materialRepoMock.findById.mockResolvedValue(material);
    materialRepoMock.belongsToStore.mockResolvedValue(true);
  });

  it("recordWaste publishes stock.changed for the wasted material, after commit", async () => {
    await wasteService.recordWaste({
      storeId: "store-1",
      materialId: "mat-1",
      quantity: 2,
      reason: WasteReason.EXPIRED,
    });

    expect(publishedEntityIds("stock.changed")).toEqual(["mat-1"]);
    expect(triggerCallsAtCommit).toBe(0);
  });

  it("recordWaste runs the same low-stock check a sale does", async () => {
    prismaMock.material.findMany.mockResolvedValue([
      { id: "mat-1", name: "FARINE T55", currentStock: 18, minStock: 100, unit: "kg" },
    ]);

    await wasteService.recordWaste({
      storeId: "store-1",
      materialId: "mat-1",
      quantity: 2,
      reason: WasteReason.SPOILED,
    });

    expect(prismaMock.alert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ entityId: "mat-1", entityType: "material" }),
      })
    );
  });

  it("recordWaste publishes nothing when the transaction rolls back", async () => {
    prismaMock.$transaction.mockRejectedValueOnce(new Error("serialization failure"));

    await expect(
      wasteService.recordWaste({
        storeId: "store-1",
        materialId: "mat-1",
        quantity: 2,
        reason: WasteReason.EXPIRED,
      })
    ).rejects.toThrow();

    expect(pusherTriggerMock).not.toHaveBeenCalled();
  });

  const existingEntry = {
    id: "waste-1",
    storeId: "store-1",
    materialId: "mat-1",
    productId: null,
    quantity: 2,
    unit: "kg",
    reason: WasteReason.EXPIRED,
    customReason: null,
    unitCostSnapshot: 1.2,
    totalValue: 2.4,
  };

  it("updateWasteEntry publishes when the correction moves stock", async () => {
    prismaMock.wasteEntry.findFirst.mockResolvedValue(existingEntry);

    await wasteService.updateWasteEntry("store-1", "waste-1", { quantity: 5 });

    expect(publishedEntityIds("stock.changed")).toEqual(["mat-1"]);
  });

  it("updateWasteEntry publishes nothing for a metadata-only correction", async () => {
    prismaMock.wasteEntry.findFirst.mockResolvedValue(existingEntry);

    await wasteService.updateWasteEntry("store-1", "waste-1", { notes: "Confirmed by manager" });

    expect(pusherTriggerMock).not.toHaveBeenCalled();
  });

  it("updateWasteEntry skips the low-stock check when the correction gives stock back", async () => {
    prismaMock.wasteEntry.findFirst.mockResolvedValue(existingEntry);
    prismaMock.material.findMany.mockResolvedValue([
      { id: "mat-1", name: "FARINE T55", currentStock: 21, minStock: 100, unit: "kg" },
    ]);

    await wasteService.updateWasteEntry("store-1", "waste-1", { quantity: 1 });

    expect(publishedEntityIds("stock.changed")).toEqual(["mat-1"]);
    expect(prismaMock.alert.create).not.toHaveBeenCalled();
  });

  it("deleteWasteEntry publishes stock.changed for the restored material", async () => {
    prismaMock.wasteEntry.findFirst.mockResolvedValue(existingEntry);

    await wasteService.deleteWasteEntry("store-1", "waste-1");

    expect(publishedEntityIds("stock.changed")).toEqual(["mat-1"]);
    expect(triggerCallsAtCommit).toBe(0);
  });
});
