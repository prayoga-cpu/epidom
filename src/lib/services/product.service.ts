import { Product } from "@prisma/client";
import {
  productRepository,
  ProductWithRelations,
  ProductFilters,
} from "../repositories/product.repository";
import { arrayToCSV } from "../utils/csv-export";

/**
 * Product Service
 *
 * Business logic layer for product operations.
 * Handles validation, authorization, and orchestrates repository calls.
 */
export class ProductService {
  /**
   * Get all products for a store with filtering
   */
  async getProducts(
    storeId: string,
    filters: ProductFilters = {}
  ): Promise<{ products: ProductWithRelations[]; total: number }> {
    return productRepository.findAll(storeId, filters);
  }

  /**
   * Get product by ID
   */
  async getProductById(productId: string): Promise<ProductWithRelations | null> {
    return productRepository.findById(productId);
  }

  /**
   * Get product by SKU
   */
  async getProductBySku(sku: string): Promise<ProductWithRelations | null> {
    return productRepository.findBySku(sku);
  }

  /**
   * Create new product
   */
  async createProduct(data: {
    storeId: string;
    sku: string;
    name: string;
    description?: string;
    category?: string;
    costPrice: number;
    sellingPrice: number;
    currentStock?: number;
    unit?: string;
    minStock?: number;
    maxStock?: number;
    recipeId?: string;
    productionTime?: number;
    shelfLife?: number;
    isActive?: boolean;
  }): Promise<ProductWithRelations> {
    // Validate SKU uniqueness
    const skuExists = await productRepository.existsBySku(data.sku);
    if (skuExists) {
      throw new Error(`Product with SKU "${data.sku}" already exists`);
    }

    // Validate product name uniqueness within store
    const nameExists = await productRepository.existsByName(data.storeId, data.name);
    if (nameExists) {
      throw new Error(`Product with name "${data.name}" already exists in this store`);
    }

    // Validate price logic
    if (data.sellingPrice < data.costPrice) {
      throw new Error("Selling price cannot be less than cost price");
    }

    return productRepository.create({
      sku: data.sku,
      name: data.name,
      description: data.description,
      category: data.category,
      costPrice: data.costPrice,
      sellingPrice: data.sellingPrice,
      currentStock: data.currentStock ?? 0,
      unit: data.unit ?? "piece",
      minStock: data.minStock ?? 0,
      maxStock: data.maxStock ?? 1000,
      recipe: data.recipeId ? { connect: { id: data.recipeId } } : undefined,
      productionTime: data.productionTime,
      shelfLife: data.shelfLife,
      isActive: data.isActive ?? true,
      store: {
        connect: { id: data.storeId },
      },
    });
  }

  /**
   * Update product
   */
  async updateProduct(
    productId: string,
    storeId: string,
    data: {
      sku?: string;
      name?: string;
      description?: string;
      category?: string;
      costPrice?: number;
      sellingPrice?: number;
      currentStock?: number;
      unit?: string;
      minStock?: number;
      maxStock?: number;
      recipeId?: string;
      productionTime?: number;
      shelfLife?: number;
      isActive?: boolean;
    }
  ): Promise<ProductWithRelations> {
    // Verify product belongs to store
    const belongsToStore = await productRepository.belongsToStore(productId, storeId);
    if (!belongsToStore) {
      throw new Error("Product does not belong to this store");
    }

    // If SKU is being updated, validate uniqueness
    if (data.sku) {
      const skuExists = await productRepository.existsBySku(data.sku, productId);
      if (skuExists) {
        throw new Error(`Product with SKU "${data.sku}" already exists`);
      }
    }

    // If name is being updated, validate uniqueness within store
    if (data.name) {
      const nameExists = await productRepository.existsByName(storeId, data.name, productId);
      if (nameExists) {
        throw new Error(`Product with name "${data.name}" already exists in this store`);
      }
    }

    // If both prices provided, validate price logic
    if (data.sellingPrice !== undefined && data.costPrice !== undefined) {
      if (data.sellingPrice < data.costPrice) {
        throw new Error("Selling price cannot be less than cost price");
      }
    }

    return productRepository.update(productId, data);
  }

  /**
   * Delete product (soft delete)
   */
  async deleteProduct(productId: string, storeId: string): Promise<void> {
    // Verify product belongs to store
    const belongsToStore = await productRepository.belongsToStore(productId, storeId);
    if (!belongsToStore) {
      throw new Error("Product does not belong to this store");
    }

    await productRepository.delete(productId);
  }

  /**
   * Bulk delete products (soft delete)
   */
  async bulkDeleteProducts(
    productIds: string[],
    storeId: string
  ): Promise<{ deletedCount: number }> {
    // Verify all products belong to the store
    const products = await productRepository.findByIds(productIds);
    const invalidProducts = products.filter((p) => p.storeId !== storeId);

    if (invalidProducts.length > 0) {
      throw new Error("One or more products do not belong to this store");
    }

    const result = await productRepository.bulkDelete(productIds);
    return { deletedCount: result.count };
  }

  /**
   * Export products to CSV format
   */
  async exportProducts(storeId: string, filters: ProductFilters = {}): Promise<string> {
    const { products } = await productRepository.findAll(storeId, filters);

    // CSV headers
    const headers = [
      "SKU",
      "Name",
      "Category",
      "Description",
      "Unit",
      "Cost Price",
      "Selling Price",
      "Profit Margin %",
      "Current Stock",
      "Min Stock",
      "Max Stock",
      "Production Time (min)",
      "Shelf Life (days)",
      "Created At",
    ];

    // CSV column extractors
    const columns = [
      (product: Product) => product.sku,
      (product: Product) => product.name,
      (product: Product) => product.category || "",
      (product: Product) => product.description || "",
      (product: Product) => product.unit,
      (product: Product) => Number(product.costPrice).toFixed(2),
      (product: Product) => Number(product.sellingPrice).toFixed(2),
      (product: Product) => {
        const costPrice = Number(product.costPrice);
        const sellingPrice = Number(product.sellingPrice);
        if (costPrice === 0) return "0.00";
        const margin = ((sellingPrice - costPrice) / costPrice) * 100;
        return margin.toFixed(2);
      },
      (product: Product) => Number(product.currentStock).toFixed(2),
      (product: Product) => Number(product.minStock).toFixed(2),
      (product: Product) => Number(product.maxStock).toFixed(2),
      (product: Product) => product.productionTime?.toString() || "",
      (product: Product) => product.shelfLife?.toString() || "",
      (product: Product) => new Date(product.createdAt).toISOString(),
    ];

    return arrayToCSV(products, headers, columns);
  }
}

// Export singleton instance
export const productService = new ProductService();
