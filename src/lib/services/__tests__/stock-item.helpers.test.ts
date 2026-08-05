import { describe, it, expect, vi, beforeEach } from "vitest";

var materialRepoMock: any;
var productRepoMock: any;

vi.mock("@/lib/repositories/material.repository", () => {
  materialRepoMock = { findById: vi.fn(), belongsToStore: vi.fn() };
  return { materialRepository: materialRepoMock };
});

vi.mock("@/lib/repositories/product.repository", () => {
  productRepoMock = { findById: vi.fn(), belongsToStore: vi.fn() };
  return { productRepository: productRepoMock };
});

import { resolveStockItem, applyStockDelta } from "../stock-item.helpers";

describe("resolveStockItem", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resolves a material, normalizing unitCost to a plain number", async () => {
    materialRepoMock.findById.mockResolvedValue({
      id: "mat-1",
      unit: "g",
      currentStock: { toString: () => "500" } as any,
      unitCost: { toString: () => "0.002" } as any,
    });
    materialRepoMock.belongsToStore.mockResolvedValue(true);

    const item = await resolveStockItem("store-1", { materialId: "mat-1" });

    expect(item.kind).toBe("material");
    expect(item.unit).toBe("g");
    expect(item.currentStock).toBe(500);
    expect(item.unitCost).toBeCloseTo(0.002, 6);
  });

  it("resolves a product, reading cost from costPrice (not unitCost)", async () => {
    productRepoMock.findById.mockResolvedValue({
      id: "prod-1",
      unit: "piece",
      currentStock: 20,
      costPrice: 3.5,
    });
    productRepoMock.belongsToStore.mockResolvedValue(true);

    const item = await resolveStockItem("store-1", { productId: "prod-1" });

    expect(item.kind).toBe("product");
    expect(item.currentStock).toBe(20);
    expect(item.unitCost).toBe(3.5);
  });

  it("throws when neither materialId nor productId is given", async () => {
    await expect(resolveStockItem("store-1", {})).rejects.toThrow(/materialId or productId/i);
  });

  it("throws when the material doesn't belong to the store", async () => {
    materialRepoMock.findById.mockResolvedValue({ id: "mat-1", unit: "g", currentStock: 1, unitCost: 1 });
    materialRepoMock.belongsToStore.mockResolvedValue(false);

    await expect(resolveStockItem("store-1", { materialId: "mat-1" })).rejects.toThrow(
      /does not belong/i
    );
  });

  it("throws when the product is not found", async () => {
    productRepoMock.findById.mockResolvedValue(null);

    await expect(resolveStockItem("store-1", { productId: "missing" })).rejects.toThrow(
      /product not found/i
    );
  });
});

describe("applyStockDelta", () => {
  it("updates material.currentStock for a material item", async () => {
    const tx = { material: { update: vi.fn() }, product: { update: vi.fn() } };
    await applyStockDelta(tx as any, { kind: "material", id: "mat-1", unit: "g", currentStock: 0, unitCost: 0 }, 42);

    expect(tx.material.update).toHaveBeenCalledWith({
      where: { id: "mat-1" },
      data: { currentStock: expect.anything() },
    });
    expect(tx.product.update).not.toHaveBeenCalled();
  });

  it("updates product.currentStock for a product item", async () => {
    const tx = { material: { update: vi.fn() }, product: { update: vi.fn() } };
    await applyStockDelta(
      tx as any,
      { kind: "product", id: "prod-1", unit: "piece", currentStock: 0, unitCost: 0 },
      7
    );

    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: "prod-1" },
      data: { currentStock: expect.anything() },
    });
    expect(tx.material.update).not.toHaveBeenCalled();
  });
});
