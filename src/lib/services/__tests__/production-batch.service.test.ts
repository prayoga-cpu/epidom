import { describe, it, expect, vi, beforeEach, type MockedObject } from "vitest";
import { ProductionBatchService } from "../production-batch.service";
import type { ProductionBatchRepository } from "@/lib/repositories/production-batch.repository";
import type { RecipeRepository } from "@/lib/repositories/recipe.repository";
import type { MaterialRepository } from "@/lib/repositories/material.repository";
import type { ProductRepository } from "@/lib/repositories/product.repository";
import { Prisma } from "@prisma/client";

const mockBatch = {
  id: "batch-1",
  batchNumber: "PB-2026-05-22-1",
  recipeId: "recipe-1",
  storeId: "store-1",
  plannedQuantity: new Prisma.Decimal(10),
  actualQuantity: new Prisma.Decimal(10),
  status: "PLANNED",
  startDate: new Date(),
  completionDate: null,
  totalCost: new Prisma.Decimal(100),
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const createMockBatchRepo = (): MockedObject<ProductionBatchRepository> =>
  ({
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    updateStatus: vi.fn(),
  }) as unknown as MockedObject<ProductionBatchRepository>;

const createMockRecipeRepo = (): MockedObject<RecipeRepository> =>
  ({
    findById: vi.fn(),
  }) as unknown as MockedObject<RecipeRepository>;

const createMockMaterialRepo = (): MockedObject<MaterialRepository> =>
  ({
    findById: vi.fn(),
  }) as unknown as MockedObject<MaterialRepository>;

const createMockProductRepo = (): MockedObject<ProductRepository> =>
  ({
    findById: vi.fn(),
  }) as unknown as MockedObject<ProductRepository>;

describe("ProductionBatchService", () => {
  let service: ProductionBatchService;
  let mockBatchRepo: ReturnType<typeof createMockBatchRepo>;
  let mockRecipeRepo: ReturnType<typeof createMockRecipeRepo>;
  let mockMaterialRepo: ReturnType<typeof createMockMaterialRepo>;
  let mockProductRepo: ReturnType<typeof createMockProductRepo>;

  beforeEach(() => {
    mockBatchRepo = createMockBatchRepo();
    mockRecipeRepo = createMockRecipeRepo();
    mockMaterialRepo = createMockMaterialRepo();
    mockProductRepo = createMockProductRepo();

    service = new ProductionBatchService(
      mockBatchRepo as unknown as ProductionBatchRepository,
      mockRecipeRepo as unknown as RecipeRepository,
      mockMaterialRepo as unknown as MaterialRepository,
      mockProductRepo as unknown as ProductRepository
    );
  });

  describe("getProductionBatches", () => {
    it("should return batches from repository", async () => {
      mockBatchRepo.findAll.mockResolvedValue({ batches: [mockBatch as any], total: 1 });

      const result = await service.getProductionBatches("store-1", {});

      expect(mockBatchRepo.findAll).toHaveBeenCalledWith("store-1", {});
      expect(result.batches).toHaveLength(1);
    });
  });

  describe("getProductionBatchById", () => {
    it("should return batch from repository", async () => {
      mockBatchRepo.findById.mockResolvedValue(mockBatch as any);

      const result = await service.getProductionBatchById("batch-1");

      expect(mockBatchRepo.findById).toHaveBeenCalledWith("batch-1");
      expect(result).toEqual(mockBatch);
    });
  });

  describe("checkMaterialAvailability", () => {
    it("should throw error if recipe not found", async () => {
      mockRecipeRepo.findById.mockResolvedValue(null);

      await expect(service.checkMaterialAvailability("recipe-1", 10)).rejects.toThrow(
        "Recipe not found"
      );
    });
  });
});
