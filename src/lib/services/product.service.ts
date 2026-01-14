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
   * Get product by SKU and storeId
   */
  async getProductBySku(storeId: string, sku: string): Promise<ProductWithRelations | null> {
    return productRepository.findBySku(storeId, sku);
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
    recipeIds?: string[]; // Changed from recipeId to recipeIds (array)
    productionTime?: number;
    shelfLife?: number;
  }): Promise<ProductWithRelations> {
    // Validate SKU uniqueness within store
    const skuExists = await productRepository.existsBySku(data.storeId, data.sku);
    if (skuExists) {
      throw new Error(`Product with SKU "${data.sku}" already exists in this store`);
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

    // Create product first
    const product = await productRepository.create({
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
      productionTime: data.productionTime,
      shelfLife: data.shelfLife,

      store: {
        connect: { id: data.storeId },
      },
    });

    // Then link recipes if provided
    if (data.recipeIds && data.recipeIds.length > 0) {
      await productRepository.updateRecipes(product.id, data.recipeIds);
      // Return updated product with recipes
      return (await productRepository.findById(product.id))!;
    }

    return product;
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
      recipeIds?: string[]; // Changed from recipeId to recipeIds (array)
      productionTime?: number;
      shelfLife?: number;
    }
  ): Promise<ProductWithRelations> {
    // Get current product to check if values are actually changing
    const currentProduct = await productRepository.findById(productId);
    if (!currentProduct) {
      throw new Error("Product not found");
    }

    // Verify product belongs to store
    if (currentProduct.storeId !== storeId) {
      throw new Error("Product does not belong to this store");
    }

    // If SKU is being updated and is different from current SKU, validate uniqueness
    if (data.sku && data.sku !== currentProduct.sku) {
      const skuExists = await productRepository.existsBySku(storeId, data.sku, productId);
      if (skuExists) {
        throw new Error(`Product with SKU "${data.sku}" already exists in this store`);
      }
    }

    // If name is being updated and is different from current name, validate uniqueness within store
    if (data.name && data.name !== currentProduct.name) {
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

    // Update basic product fields
    const updatedProduct = await productRepository.update(productId, {
      ...(data.sku && { sku: data.sku }),
      ...(data.name && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.costPrice !== undefined && { costPrice: data.costPrice }),
      ...(data.sellingPrice !== undefined && { sellingPrice: data.sellingPrice }),
      ...(data.currentStock !== undefined && { currentStock: data.currentStock }),
      ...(data.unit && { unit: data.unit }),
      ...(data.minStock !== undefined && { minStock: data.minStock }),
      ...(data.maxStock !== undefined && { maxStock: data.maxStock }),
      ...(data.productionTime !== undefined && { productionTime: data.productionTime }),
      ...(data.shelfLife !== undefined && { shelfLife: data.shelfLife }),
    });

    // Update recipes if provided
    if (data.recipeIds !== undefined) {
      await productRepository.updateRecipes(productId, data.recipeIds);
      // Return updated product with recipes
      return (await productRepository.findById(productId))!;
    }

    return updatedProduct;
  }

  /**
   * Delete product (hard delete)
   * Note: Related records (OrderItem, ProductionBatch, StockMovement) will be cascade deleted
   */
  async deleteProduct(productId: string, storeId: string): Promise<Product> {
    // Verify product belongs to store
    const belongsToStore = await productRepository.belongsToStore(productId, storeId);
    if (!belongsToStore) {
      throw new Error("Product does not belong to this store");
    }

    return productRepository.delete(productId);
  }

  /**
   * Bulk delete products (hard delete)
   * Note: Related records will be cascade deleted
   */
  async bulkDeleteProducts(
    productIds: string[],
    storeId: string
  ): Promise<{ count: number }> {
    // Verify all products belong to the store
    const products = await productRepository.findByIds(productIds);
    const invalidProducts = products.filter((p) => p.storeId !== storeId);

    if (invalidProducts.length > 0) {
      throw new Error("One or more products do not belong to this store");
    }

    return productRepository.bulkDelete(productIds);
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
