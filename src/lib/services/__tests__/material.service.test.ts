/**
 * Material Service Tests
 *
 * Unit tests for material (ingredient) business logic.
 */

import { describe, it, expect, vi, beforeEach, type MockedObject } from "vitest";
import { MaterialService } from "../material.service";
import type {
  MaterialRepository,
  MaterialWithSuppliers,
} from "@/lib/repositories/material.repository";
import { MovementType, Prisma } from "@prisma/client";

// Mock material data
const mockMaterial: MaterialWithSuppliers = {
  id: "mat-1",
  sku: "SKU-001",
  name: "Test Material",
  description: "Test description",
  category: "Test Category",
  unit: "kg",
  unitCost: new Prisma.Decimal(10.0),
  purchaseQuantity: new Prisma.Decimal(1),
  currentStock: new Prisma.Decimal(100),
  minStock: new Prisma.Decimal(10),
  maxStock: new Prisma.Decimal(200),
  storeId: "store-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  materialSuppliers: [],
};

// Mock repository
const createMockRepository = (): MockedObject<MaterialRepository> =>
  ({
    findAll: vi.fn(),
    findById: vi.fn(),
    findBySku: vi.fn(),
    findByIds: vi.fn(),
    findLowStock: vi.fn(),
    existsBySku: vi.fn(),
    belongsToStore: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    addSupplier: vi.fn(),
    removeSupplier: vi.fn(),
    updateSupplier: vi.fn(),
  }) as unknown as MockedObject<MaterialRepository>;

describe("MaterialService", () => {
  let service: MaterialService;
  let mockRepo: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    mockRepo = createMockRepository();
    service = new MaterialService(mockRepo as unknown as MaterialRepository);
  });

  describe("getMaterials", () => {
    it("should return materials with total count", async () => {
      const mockResult = {
        materials: [mockMaterial],
        total: 1,
      };
      mockRepo.findAll.mockResolvedValue(mockResult);

      const result = await service.getMaterials("store-1", {});

      expect(mockRepo.findAll).toHaveBeenCalledWith("store-1", {});
      expect(result.materials).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it("should pass filters to repository", async () => {
      const filters = {
        search: "test",
        category: "Category A",
        sortBy: "name" as const,
        sortOrder: "asc" as const,
      };
      mockRepo.findAll.mockResolvedValue({ materials: [], total: 0 });

      await service.getMaterials("store-1", filters);

      expect(mockRepo.findAll).toHaveBeenCalledWith("store-1", filters);
    });
  });

  describe("getMaterialById", () => {
    it("should return material when found", async () => {
      mockRepo.findById.mockResolvedValue(mockMaterial);

      const result = await service.getMaterialById("mat-1");

      expect(result).toEqual(mockMaterial);
    });

    it("should throw error when material not found", async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(service.getMaterialById("non-existent")).rejects.toThrow("Material not found");
    });
  });

  describe("createMaterial - validation", () => {
    it("should throw error if SKU already exists", async () => {
      mockRepo.existsBySku.mockResolvedValue(true);

      const input = {
        storeId: "store-1",
        sku: "EXISTING-SKU",
        name: "New Material",
        unit: "kg",
        unitCost: 10,
      };

      await expect(service.createMaterial(input)).rejects.toThrow(
        "A material with this SKU already exists"
      );
    });

    it("should throw error if multiple preferred suppliers", async () => {
      mockRepo.existsBySku.mockResolvedValue(false);

      const input = {
        storeId: "store-1",
        sku: "NEW-SKU",
        name: "New Material",
        unit: "kg",
        unitCost: 10,
        suppliers: [
          { supplierId: "sup-1", price: 10, isPreferred: true },
          { supplierId: "sup-2", price: 12, isPreferred: true },
        ],
      };

      await expect(service.createMaterial(input)).rejects.toThrow(
        "Only one supplier can be marked as preferred"
      );
    });
  });

  describe("updateMaterial - validation", () => {
    it("should throw error if material not found", async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(
        service.updateMaterial("non-existent", "store-1", { name: "Updated" })
      ).rejects.toThrow("Material not found");
    });

    it("should throw error if material does not belong to store", async () => {
      mockRepo.findById.mockResolvedValue(mockMaterial);
      mockRepo.belongsToStore.mockResolvedValue(false);

      await expect(
        service.updateMaterial("mat-1", "other-store", { name: "Updated" })
      ).rejects.toThrow("Material does not belong to this store");
    });

    it("should throw error if new SKU already exists", async () => {
      mockRepo.findById.mockResolvedValue(mockMaterial);
      mockRepo.belongsToStore.mockResolvedValue(true);
      mockRepo.existsBySku.mockResolvedValue(true);

      await expect(
        service.updateMaterial("mat-1", "store-1", { sku: "EXISTING-SKU" })
      ).rejects.toThrow("A material with this SKU already exists");
    });
  });

  describe("deleteMaterial - validation", () => {
    it("should throw error if material does not belong to store", async () => {
      mockRepo.belongsToStore.mockResolvedValue(false);

      await expect(service.deleteMaterial("mat-1", "other-store")).rejects.toThrow(
        "Material does not belong to this store"
      );
    });
  });

  describe("bulkDeleteMaterials", () => {
    it("should throw error if any material does not belong to store", async () => {
      const materials = [
        { ...mockMaterial, id: "mat-1", storeId: "store-1" },
        { ...mockMaterial, id: "mat-2", storeId: "other-store" },
      ];
      mockRepo.findByIds.mockResolvedValue(materials as MaterialWithSuppliers[]);

      await expect(service.bulkDeleteMaterials(["mat-1", "mat-2"], "store-1")).rejects.toThrow(
        "Some materials do not belong to this store"
      );
    });
  });

  describe("addSupplier - validation", () => {
    it("should throw error if material does not belong to store", async () => {
      mockRepo.belongsToStore.mockResolvedValue(false);

      await expect(service.addSupplier("mat-1", "other-store", "sup-1", 10)).rejects.toThrow(
        "Material does not belong to this store"
      );
    });
  });

  describe("exportMaterialsToCSV", () => {
    it("should generate valid CSV with headers", async () => {
      mockRepo.findAll.mockResolvedValue({
        materials: [mockMaterial],
        total: 1,
      });

      const csv = await service.exportMaterialsToCSV("store-1");

      expect(csv).toContain("SKU,Name,Category,Unit");
      expect(csv).toContain("SKU-001,Test Material");
    });

    it("should escape quotes and commas in CSV", async () => {
      const materialWithComma = {
        ...mockMaterial,
        name: 'Material, with "quotes"',
      };
      mockRepo.findAll.mockResolvedValue({
        materials: [materialWithComma as MaterialWithSuppliers],
        total: 1,
      });

      const csv = await service.exportMaterialsToCSV("store-1");

      // Should be properly escaped
      expect(csv).toContain('"Material, with ""quotes"""');
    });
  });
});
