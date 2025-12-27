/**
 * Product Service Tests
 *
 * Unit tests for product business logic.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

// Mock modules directly with inline mocks
vi.mock("@/lib/repositories/product.repository", () => ({
  productRepository: {
    findAll: vi.fn(),
    findById: vi.fn(),
    findBySku: vi.fn(),
    findByIds: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateRecipes: vi.fn(),
    delete: vi.fn(),
    bulkDelete: vi.fn(),
    belongsToStore: vi.fn(),
    existsBySku: vi.fn(),
    existsByName: vi.fn(),
  },
}));

vi.mock("@/lib/utils/csv-export", () => ({
  arrayToCSV: vi.fn().mockReturnValue("SKU,Name\nPROD-001,Test Product"),
}));

// Import after mocking
import { ProductService } from "../product.service";
import { productRepository } from "@/lib/repositories/product.repository";

// Mock product data
const mockProduct = {
  id: "prod-1",
  storeId: "store-1",
  sku: "PROD-001",
  name: "Chocolate Cake",
  description: "Delicious chocolate cake",
  category: "Cakes",
  costPrice: new Prisma.Decimal(10.0),
  sellingPrice: new Prisma.Decimal(25.0),
  currentStock: new Prisma.Decimal(50),
  unit: "piece",
  minStock: new Prisma.Decimal(10),
  maxStock: new Prisma.Decimal(100),
  productionTime: 60,
  shelfLife: 7,
  createdAt: new Date(),
  updatedAt: new Date(),
  recipes: [],
};

// Get mocked functions
const mockedProductRepo = vi.mocked(productRepository);

describe("ProductService", () => {
  let service: ProductService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProductService();
  });

  describe("getProducts", () => {
    it("should return products with total count", async () => {
      mockedProductRepo.findAll.mockResolvedValue({
        products: [mockProduct],
        total: 1,
      });

      const result = await service.getProducts("store-1", {});

      expect(mockedProductRepo.findAll).toHaveBeenCalledWith("store-1", {});
      expect(result.products).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe("getProductById", () => {
    it("should return product when found", async () => {
      mockedProductRepo.findById.mockResolvedValue(mockProduct);

      const result = await service.getProductById("prod-1");

      expect(result).toEqual(mockProduct);
    });

    it("should return null when not found", async () => {
      mockedProductRepo.findById.mockResolvedValue(null);

      const result = await service.getProductById("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("getProductBySku", () => {
    it("should return product by SKU", async () => {
      mockedProductRepo.findBySku.mockResolvedValue(mockProduct);

      const result = await service.getProductBySku("store-1", "PROD-001");

      expect(mockedProductRepo.findBySku).toHaveBeenCalledWith("store-1", "PROD-001");
      expect(result).toEqual(mockProduct);
    });
  });

  describe("createProduct", () => {
    it("should throw error if SKU already exists", async () => {
      mockedProductRepo.existsBySku.mockResolvedValue(true);

      const input = {
        storeId: "store-1",
        sku: "EXISTING-SKU",
        name: "New Product",
        costPrice: 10,
        sellingPrice: 25,
      };

      await expect(service.createProduct(input)).rejects.toThrow(
        'Product with SKU "EXISTING-SKU" already exists in this store'
      );
    });

    it("should throw error if name already exists", async () => {
      mockedProductRepo.existsBySku.mockResolvedValue(false);
      mockedProductRepo.existsByName.mockResolvedValue(true);

      const input = {
        storeId: "store-1",
        sku: "NEW-SKU",
        name: "Existing Name",
        costPrice: 10,
        sellingPrice: 25,
      };

      await expect(service.createProduct(input)).rejects.toThrow(
        'Product with name "Existing Name" already exists in this store'
      );
    });

    it("should create product when SKU and name are unique", async () => {
      mockedProductRepo.existsBySku.mockResolvedValue(false);
      mockedProductRepo.existsByName.mockResolvedValue(false);
      mockedProductRepo.create.mockResolvedValue(mockProduct);

      const input = {
        storeId: "store-1",
        sku: "NEW-SKU",
        name: "New Product",
        costPrice: 10,
        sellingPrice: 25,
      };

      const result = await service.createProduct(input);

      expect(mockedProductRepo.create).toHaveBeenCalled();
      expect(result).toEqual(mockProduct);
    });
  });

  describe("updateProduct", () => {
    it("should throw error if product not found", async () => {
      mockedProductRepo.findById.mockResolvedValue(null);

      await expect(
        service.updateProduct("non-existent", "store-1", { name: "Updated" })
      ).rejects.toThrow("Product not found");
    });

    it("should throw error if product does not belong to store", async () => {
      mockedProductRepo.findById.mockResolvedValue({ ...mockProduct, storeId: "other-store" });

      await expect(service.updateProduct("prod-1", "store-1", { name: "Updated" })).rejects.toThrow(
        "Product does not belong to this store"
      );
    });

    it("should throw error if new SKU already exists", async () => {
      mockedProductRepo.findById.mockResolvedValue(mockProduct);
      mockedProductRepo.existsBySku.mockResolvedValue(true);

      await expect(
        service.updateProduct("prod-1", "store-1", { sku: "EXISTING-SKU" })
      ).rejects.toThrow('Product with SKU "EXISTING-SKU" already exists in this store');
    });

    it("should update product when valid", async () => {
      mockedProductRepo.findById.mockResolvedValue(mockProduct);
      mockedProductRepo.existsBySku.mockResolvedValue(false);
      mockedProductRepo.existsByName.mockResolvedValue(false);
      mockedProductRepo.update.mockResolvedValue({ ...mockProduct, name: "Updated Product" });

      const result = await service.updateProduct("prod-1", "store-1", { name: "Updated Product" });

      expect(result.name).toBe("Updated Product");
    });
  });

  describe("deleteProduct", () => {
    it("should throw error if product does not belong to store", async () => {
      mockedProductRepo.belongsToStore.mockResolvedValue(false);

      await expect(service.deleteProduct("prod-1", "other-store")).rejects.toThrow(
        "Product does not belong to this store"
      );
    });

    it("should delete product when valid", async () => {
      mockedProductRepo.belongsToStore.mockResolvedValue(true);
      mockedProductRepo.delete.mockResolvedValue(undefined);

      await service.deleteProduct("prod-1", "store-1");

      expect(mockedProductRepo.delete).toHaveBeenCalledWith("prod-1");
    });
  });

  describe("bulkDeleteProducts", () => {
    it("should throw error if any product does not belong to store", async () => {
      mockedProductRepo.findByIds.mockResolvedValue([
        { ...mockProduct, storeId: "store-1" },
        { ...mockProduct, id: "prod-2", storeId: "other-store" },
      ]);

      await expect(service.bulkDeleteProducts(["prod-1", "prod-2"], "store-1")).rejects.toThrow(
        "One or more products do not belong to this store"
      );
    });

    it("should delete all products when valid", async () => {
      mockedProductRepo.findByIds.mockResolvedValue([
        { ...mockProduct, storeId: "store-1" },
        { ...mockProduct, id: "prod-2", storeId: "store-1" },
      ]);
      mockedProductRepo.bulkDelete.mockResolvedValue({ count: 2 });

      const result = await service.bulkDeleteProducts(["prod-1", "prod-2"], "store-1");

      expect(result.deletedCount).toBe(2);
    });
  });

  describe("exportProducts", () => {
    it("should export products to CSV format", async () => {
      mockedProductRepo.findAll.mockResolvedValue({
        products: [mockProduct],
        total: 1,
      });

      const result = await service.exportProducts("store-1", {});

      expect(result).toContain("SKU");
      expect(result).toContain("Name");
    });
  });
});
