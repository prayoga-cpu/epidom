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
    clearCategory: vi.fn(),
    deleteByCategory: vi.fn(),
    belongsToStore: vi.fn(),
    existsBySku: vi.fn(),
    existsByBarcode: vi.fn(),
    existsByName: vi.fn(),
  },
}));

vi.mock("@/lib/utils/csv-export", () => ({
  arrayToCSV: vi.fn().mockReturnValue("SKU,Name\nPROD-001,Test Product"),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    menuItem: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    // Stock changes write a movement (the Stock page's Log).
    stockMovement: {
      create: vi.fn().mockResolvedValue({}),
    },
    // getOwnerCurrencyAndRate() (via storefrontService.convertBaseCurrencyToOwner,
    // called from updateProduct's menu-price sync) looks this up — a
    // not-found store defaults to IDR/rate 1, a currency-neutral default for
    // every test here except where a currency conversion is explicitly
    // exercised.
    store: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}));

// Import after mocking
import { ProductService } from "../product.service";
import { productRepository } from "@/lib/repositories/product.repository";
import { prisma } from "@/lib/prisma";

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
} as any;

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

    it("should sync name/price to any linked storefront MenuItem", async () => {
      mockedProductRepo.findById.mockResolvedValue(mockProduct);
      mockedProductRepo.existsByName.mockResolvedValue(false);
      const updated = {
        ...mockProduct,
        name: "Updated Product",
        sellingPrice: new Prisma.Decimal(30),
      };
      mockedProductRepo.update.mockResolvedValue(updated);

      await service.updateProduct("prod-1", "store-1", {
        name: "Updated Product",
        sellingPrice: 30,
      });

      // price comes back as a converted plain number (+ its currency), not
      // the raw Decimal — see storefrontService.convertBaseCurrencyToOwner.
      expect(prisma.menuItem.updateMany).toHaveBeenCalledWith({
        where: { productId: "prod-1" },
        data: { name: "Updated Product", price: 30, currency: "IDR" },
      });
    });

    it("should not touch MenuItem sync when name/price are unchanged", async () => {
      mockedProductRepo.findById.mockResolvedValue(mockProduct);
      mockedProductRepo.update.mockResolvedValue({
        ...mockProduct,
        currentStock: new Prisma.Decimal(5),
      });

      await service.updateProduct("prod-1", "store-1", { currentStock: 5 });

      expect(prisma.menuItem.updateMany).not.toHaveBeenCalled();
    });

    it("should sync department to any linked storefront MenuItem", async () => {
      mockedProductRepo.findById.mockResolvedValue(mockProduct);
      const updated = { ...mockProduct, department: "KITCHEN" };
      mockedProductRepo.update.mockResolvedValue(updated);

      await service.updateProduct("prod-1", "store-1", { department: "KITCHEN" as any });

      expect(prisma.menuItem.updateMany).toHaveBeenCalledWith({
        where: { productId: "prod-1" },
        data: { department: "KITCHEN" },
      });
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
      mockedProductRepo.delete.mockResolvedValue(mockProduct);

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

      expect(result.count).toBe(2);
    });
  });

  describe("deleteCategory", () => {
    it("should clear the category from every product that uses it (default mode)", async () => {
      mockedProductRepo.clearCategory.mockResolvedValue({ count: 4 });

      const result = await service.deleteCategory("store-1", "Cakes");

      expect(mockedProductRepo.clearCategory).toHaveBeenCalledWith("store-1", "Cakes");
      expect(mockedProductRepo.deleteByCategory).not.toHaveBeenCalled();
      expect(result).toEqual({ count: 4 });
    });

    it('should hard-delete every product in the category in "delete" mode', async () => {
      mockedProductRepo.deleteByCategory.mockResolvedValue({ count: 4 });

      const result = await service.deleteCategory("store-1", "Cakes", "delete");

      expect(mockedProductRepo.deleteByCategory).toHaveBeenCalledWith("store-1", "Cakes");
      expect(mockedProductRepo.clearCategory).not.toHaveBeenCalled();
      expect(result).toEqual({ count: 4 });
    });

    it("should throw error if category is empty", async () => {
      await expect(service.deleteCategory("store-1", "")).rejects.toThrow("Category is required");
      await expect(service.deleteCategory("store-1", "   ")).rejects.toThrow(
        "Category is required"
      );
      expect(mockedProductRepo.clearCategory).not.toHaveBeenCalled();
      expect(mockedProductRepo.deleteByCategory).not.toHaveBeenCalled();
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

describe("ProductService — barcode (optional, unique per store)", () => {
  let service: ProductService;

  const newProduct = {
    storeId: "store-1",
    sku: "NEW-SKU",
    name: "New Product",
    costPrice: 10,
    sellingPrice: 25,
  };

  // What Prisma throws when the (storeId, barcode) unique index is violated.
  const p2002 = (target: string[]) =>
    new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "test",
      meta: { target },
    });

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProductService();
    mockedProductRepo.existsBySku.mockResolvedValue(false);
    mockedProductRepo.existsByName.mockResolvedValue(false);
    mockedProductRepo.existsByBarcode.mockResolvedValue(false);
  });

  describe("createProduct", () => {
    it("rejects a barcode another product already uses — a 409 pinned to the barcode field", async () => {
      mockedProductRepo.existsByBarcode.mockResolvedValue(true);

      const err = await service.createProduct({ ...newProduct, barcode: "8991234567890" }).then(
        () => null,
        (e) => e
      );

      expect(err).toMatchObject({
        statusCode: 409,
        code: "CONFLICT",
        details: [{ field: "barcode", message: expect.stringContaining("8991234567890") }],
      });
      expect(mockedProductRepo.existsByBarcode).toHaveBeenCalledWith("store-1", "8991234567890");
      expect(mockedProductRepo.create).not.toHaveBeenCalled();
    });

    it("saves the barcode when it is free", async () => {
      mockedProductRepo.create.mockResolvedValue(mockProduct);

      await service.createProduct({ ...newProduct, barcode: "8991234567890" });

      expect(mockedProductRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ barcode: "8991234567890" })
      );
    });

    it("skips the uniqueness check entirely when there is no barcode (many products may have none)", async () => {
      mockedProductRepo.create.mockResolvedValue(mockProduct);

      await service.createProduct({ ...newProduct });
      await service.createProduct({ ...newProduct, barcode: null });
      await service.createProduct({ ...newProduct, barcode: "" });

      expect(mockedProductRepo.existsByBarcode).not.toHaveBeenCalled();
      for (const [data] of mockedProductRepo.create.mock.calls) {
        expect(data).not.toHaveProperty("barcode");
      }
    });

    it("maps a lost race (P2002 on the barcode index) to the same 409", async () => {
      mockedProductRepo.create.mockRejectedValue(p2002(["storeId", "barcode"]));

      await expect(service.createProduct({ ...newProduct, barcode: "123" })).rejects.toMatchObject({
        statusCode: 409,
        details: [{ field: "barcode" }],
      });
    });

    it("does not disguise a P2002 on some other column as a barcode clash", async () => {
      const other = p2002(["storeId", "sku"]);
      mockedProductRepo.create.mockRejectedValue(other);

      await expect(service.createProduct({ ...newProduct, barcode: "123" })).rejects.toBe(other);
    });
  });

  describe("updateProduct", () => {
    const current = { ...mockProduct, barcode: "111" };

    it("checks a CHANGED barcode against every OTHER product (excluding itself)", async () => {
      mockedProductRepo.findById.mockResolvedValue(current);
      mockedProductRepo.update.mockResolvedValue({ ...current, barcode: "222" });

      await service.updateProduct("prod-1", "store-1", { barcode: "222" });

      expect(mockedProductRepo.existsByBarcode).toHaveBeenCalledWith("store-1", "222", "prod-1");
      expect(mockedProductRepo.update).toHaveBeenCalledWith(
        "prod-1",
        expect.objectContaining({ barcode: "222" })
      );
    });

    it("rejects a changed barcode that another product holds", async () => {
      mockedProductRepo.findById.mockResolvedValue(current);
      mockedProductRepo.existsByBarcode.mockResolvedValue(true);

      await expect(
        service.updateProduct("prod-1", "store-1", { barcode: "222" })
      ).rejects.toMatchObject({ statusCode: 409, details: [{ field: "barcode" }] });
      expect(mockedProductRepo.update).not.toHaveBeenCalled();
    });

    it("does not re-check (or flag itself for) a barcode that did not change", async () => {
      mockedProductRepo.findById.mockResolvedValue(current);
      mockedProductRepo.update.mockResolvedValue(current);

      await service.updateProduct("prod-1", "store-1", { barcode: "111", name: mockProduct.name });

      expect(mockedProductRepo.existsByBarcode).not.toHaveBeenCalled();
    });

    it("null CLEARS the barcode (written as null, no uniqueness check)", async () => {
      mockedProductRepo.findById.mockResolvedValue(current);
      mockedProductRepo.update.mockResolvedValue({ ...current, barcode: null });

      await service.updateProduct("prod-1", "store-1", { barcode: null });

      expect(mockedProductRepo.existsByBarcode).not.toHaveBeenCalled();
      expect(mockedProductRepo.update).toHaveBeenCalledWith(
        "prod-1",
        expect.objectContaining({ barcode: null })
      );
    });

    it("undefined leaves the stored barcode untouched (the key is not sent at all)", async () => {
      mockedProductRepo.findById.mockResolvedValue(current);
      mockedProductRepo.update.mockResolvedValue(current);

      await service.updateProduct("prod-1", "store-1", { description: "x" });

      const [, data] = mockedProductRepo.update.mock.calls[0];
      expect(data).not.toHaveProperty("barcode");
    });

    it("maps a lost race on update to the barcode 409 too", async () => {
      mockedProductRepo.findById.mockResolvedValue(current);
      mockedProductRepo.update.mockRejectedValue(p2002(["storeId", "barcode"]));

      await expect(
        service.updateProduct("prod-1", "store-1", { barcode: "222" })
      ).rejects.toMatchObject({ statusCode: 409, details: [{ field: "barcode" }] });
    });
  });

  describe("exportProducts", () => {
    it("carries a Barcode column right after SKU", async () => {
      const { arrayToCSV } = await import("@/lib/utils/csv-export");
      mockedProductRepo.findAll.mockResolvedValue({
        products: [{ ...mockProduct, barcode: "8991234567890" }],
        total: 1,
      });

      await service.exportProducts("store-1", {});

      const [rows, headers, columns] = vi.mocked(arrayToCSV).mock.calls.at(-1)!;
      expect(headers.slice(0, 3)).toEqual(["SKU", "Barcode", "Name"]);
      expect(columns[1](rows[0])).toBe("8991234567890");
      expect(columns[1]({ ...mockProduct, barcode: null })).toBe("");
    });
  });
});

describe("ProductService — stock changes go on the Log", () => {
  let service: ProductService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProductService();
    mockedProductRepo.existsBySku.mockResolvedValue(false);
    mockedProductRepo.existsByName.mockResolvedValue(false);
  });

  const newProduct = { storeId: "store-1", sku: "NEW", name: "New", costPrice: 1, sellingPrice: 2 };

  it("logs a new product's opening stock", async () => {
    mockedProductRepo.create.mockResolvedValue({ ...mockProduct, id: "prod-new", unit: "pcs" });

    await service.createProduct({ ...newProduct, currentStock: 12 });

    expect(prisma.stockMovement.create).toHaveBeenCalledWith({
      data: {
        productId: "prod-new",
        type: "ADJUSTMENT",
        quantity: 12,
        unit: "pcs",
        balanceAfter: 12,
        notes: "Initial stock",
      },
    });
  });

  it("logs nothing for a product created without stock", async () => {
    mockedProductRepo.create.mockResolvedValue(mockProduct);

    await service.createProduct(newProduct);

    expect(prisma.stockMovement.create).not.toHaveBeenCalled();
  });

  it("logs an edit that changes the stock, signed", async () => {
    mockedProductRepo.findById.mockResolvedValue(mockProduct); // 50 in stock
    mockedProductRepo.update.mockResolvedValue({
      ...mockProduct,
      currentStock: new Prisma.Decimal(45),
    });

    await service.updateProduct("prod-1", "store-1", { currentStock: 45 });

    expect(prisma.stockMovement.create).toHaveBeenCalledWith({
      data: {
        productId: "prod-1",
        type: "ADJUSTMENT",
        quantity: -5,
        unit: "piece",
        balanceAfter: 45,
        notes: "Stock decrease - Manual adjustment",
      },
    });
  });

  it("logs nothing when an edit resends the same stock or leaves it out", async () => {
    mockedProductRepo.findById.mockResolvedValue(mockProduct);
    mockedProductRepo.update.mockResolvedValue(mockProduct);

    await service.updateProduct("prod-1", "store-1", { currentStock: 50 });
    await service.updateProduct("prod-1", "store-1", { name: "Renamed" });

    expect(prisma.stockMovement.create).not.toHaveBeenCalled();
  });
});
