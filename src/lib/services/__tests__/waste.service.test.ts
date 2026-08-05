import { describe, it, expect, vi, beforeEach } from "vitest";
import { WasteReason } from "@prisma/client";

// var (not const/let) avoids TDZ when vi.mock factories are hoisted above declarations.
var prismaMock: any;
var capturedTx: any;
var materialRepoMock: any;
var productRepoMock: any;

vi.mock("@/lib/prisma", () => {
  prismaMock = {
    wasteEntry: {
      findFirst: vi.fn(),
      aggregate: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(async (fn: any) => {
      capturedTx = {
        material: { update: vi.fn() },
        product: { update: vi.fn() },
        stockMovement: { create: vi.fn().mockResolvedValue({ id: "movement-1" }) },
        wasteEntry: {
          create: vi.fn().mockImplementation(({ data }: any) => ({ id: "waste-1", ...data })),
          update: vi.fn().mockImplementation(({ data }: any) => ({ id: "waste-1", ...data })),
          delete: vi.fn(),
        },
      };
      return fn(capturedTx);
    }),
  };
  return { prisma: prismaMock };
});

vi.mock("@/lib/repositories/material.repository", () => {
  materialRepoMock = { findById: vi.fn(), belongsToStore: vi.fn() };
  return { materialRepository: materialRepoMock };
});

vi.mock("@/lib/repositories/product.repository", () => {
  productRepoMock = { findById: vi.fn(), belongsToStore: vi.fn() };
  return { productRepository: productRepoMock };
});

import { wasteService } from "../waste.service";

const material = {
  id: "mat-1",
  storeId: "store-1",
  name: "Flour",
  unit: "g",
  currentStock: 1000,
  unitCost: 0.01,
};

const product = {
  id: "prod-1",
  storeId: "store-1",
  name: "Cookie",
  unit: "piece",
  currentStock: 50,
  costPrice: 2.5,
};

describe("wasteService.recordWaste", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    materialRepoMock.findById.mockResolvedValue(material);
    materialRepoMock.belongsToStore.mockResolvedValue(true);
    productRepoMock.findById.mockResolvedValue(product);
    productRepoMock.belongsToStore.mockResolvedValue(true);
  });

  it("records waste for a material — deducts stock and writes a WASTE movement", async () => {
    const result = await wasteService.recordWaste({
      storeId: "store-1",
      materialId: "mat-1",
      quantity: 200,
      reason: WasteReason.EXPIRED,
    });

    expect(capturedTx.material.update).toHaveBeenCalledWith({
      where: { id: "mat-1" },
      data: { currentStock: expect.anything() },
    });
    const [movementCall] = capturedTx.stockMovement.create.mock.calls;
    expect(movementCall[0].data.type).toBe("WASTE");
    expect(Number(movementCall[0].data.quantity)).toBe(-200);
    expect(movementCall[0].data.materialId).toBe("mat-1");

    const [entryCall] = capturedTx.wasteEntry.create.mock.calls;
    expect(Number(entryCall[0].data.totalValue)).toBeCloseTo(2, 5); // 200 * 0.01
    expect(result.wasteEntry).toBeDefined();
  });

  it("records waste for a product (proves the product-stock gap is fixed)", async () => {
    const result = await wasteService.recordWaste({
      storeId: "store-1",
      productId: "prod-1",
      quantity: 3,
      reason: WasteReason.DAMAGED,
    });

    expect(capturedTx.product.update).toHaveBeenCalledWith({
      where: { id: "prod-1" },
      data: { currentStock: expect.anything() },
    });
    const [movementCall] = capturedTx.stockMovement.create.mock.calls;
    expect(movementCall[0].data.productId).toBe("prod-1");
    const [entryCall] = capturedTx.wasteEntry.create.mock.calls;
    expect(Number(entryCall[0].data.totalValue)).toBeCloseTo(7.5, 5); // 3 * 2.5
    expect(result.wasteEntry).toBeDefined();
  });

  it("rejects a quantity that would drive stock negative", async () => {
    await expect(
      wasteService.recordWaste({
        storeId: "store-1",
        materialId: "mat-1",
        quantity: 5000,
        reason: WasteReason.SPOILED,
      })
    ).rejects.toThrow(/negative/i);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects reason=OTHER without a customReason", async () => {
    await expect(
      wasteService.recordWaste({
        storeId: "store-1",
        materialId: "mat-1",
        quantity: 10,
        reason: WasteReason.OTHER,
      })
    ).rejects.toThrow(/custom reason/i);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

describe("wasteService.updateWasteEntry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    materialRepoMock.findById.mockResolvedValue(material);
    materialRepoMock.belongsToStore.mockResolvedValue(true);
  });

  const existingEntry = {
    id: "waste-1",
    storeId: "store-1",
    materialId: "mat-1",
    productId: null,
    quantity: 200,
    unit: "g",
    reason: WasteReason.EXPIRED,
    customReason: null,
    unitCostSnapshot: 0.01,
    totalValue: 2,
  };

  it("appends a compensating movement when quantity decreases (stock given back)", async () => {
    prismaMock.wasteEntry.findFirst.mockResolvedValue(existingEntry);

    const result = await wasteService.updateWasteEntry("store-1", "waste-1", { quantity: 50 });

    expect(capturedTx.stockMovement.create).toHaveBeenCalledTimes(1);
    const [movementCall] = capturedTx.stockMovement.create.mock.calls;
    expect(movementCall[0].data.type).toBe("ADJUSTMENT");
    // oldQty(200) - newQty(50) = +150 given back to stock.
    expect(Number(movementCall[0].data.quantity)).toBe(150);
    expect(result.movement).not.toBeNull();

    const [updateCall] = capturedTx.wasteEntry.update.mock.calls;
    expect(Number(updateCall[0].data.quantity)).toBe(50);
    expect(Number(updateCall[0].data.totalValue)).toBeCloseTo(0.5, 5); // 50 * 0.01
  });

  it("appends a compensating movement when quantity increases (more stock consumed)", async () => {
    prismaMock.wasteEntry.findFirst.mockResolvedValue(existingEntry);

    await wasteService.updateWasteEntry("store-1", "waste-1", { quantity: 300 });

    const [movementCall] = capturedTx.stockMovement.create.mock.calls;
    // oldQty(200) - newQty(300) = -100 additionally consumed.
    expect(Number(movementCall[0].data.quantity)).toBe(-100);
  });

  it("creates zero movements for a metadata-only correction (reason/notes, same quantity)", async () => {
    prismaMock.wasteEntry.findFirst.mockResolvedValue(existingEntry);

    const result = await wasteService.updateWasteEntry("store-1", "waste-1", {
      notes: "Confirmed by manager",
    });

    expect(capturedTx.stockMovement.create).not.toHaveBeenCalled();
    expect(result.movement).toBeNull();
  });

  it("rejects a correction that would drive current stock negative", async () => {
    materialRepoMock.findById.mockResolvedValue({ ...material, currentStock: 10 });
    prismaMock.wasteEntry.findFirst.mockResolvedValue(existingEntry);

    // Increasing quantity from 200 to 2000 needs 1800 more than the 10 units on hand.
    await expect(
      wasteService.updateWasteEntry("store-1", "waste-1", { quantity: 2000 })
    ).rejects.toThrow(/negative/i);
  });

  it("throws when the waste entry doesn't exist for this store", async () => {
    prismaMock.wasteEntry.findFirst.mockResolvedValue(null);

    await expect(
      wasteService.updateWasteEntry("store-1", "missing", { notes: "x" })
    ).rejects.toThrow(/not found/i);
  });
});

describe("wasteService.deleteWasteEntry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    materialRepoMock.findById.mockResolvedValue(material);
    materialRepoMock.belongsToStore.mockResolvedValue(true);
  });

  it("restores the wasted quantity to current stock and removes the entry", async () => {
    prismaMock.wasteEntry.findFirst.mockResolvedValue({
      id: "waste-1",
      storeId: "store-1",
      materialId: "mat-1",
      productId: null,
      quantity: 200,
    });

    const result = await wasteService.deleteWasteEntry("store-1", "waste-1");

    const [movementCall] = capturedTx.stockMovement.create.mock.calls;
    expect(movementCall[0].data.type).toBe("ADJUSTMENT");
    expect(Number(movementCall[0].data.quantity)).toBe(200);
    expect(capturedTx.wasteEntry.delete).toHaveBeenCalledWith({ where: { id: "waste-1" } });
    expect(result).toEqual({ success: true });
  });
});
