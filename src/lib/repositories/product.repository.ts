import { Product, Prisma, Recipe, RecipeProduct } from "@prisma/client";
import { BaseRepository } from "./base.repository";

/**
 * Product Repository
 *
 * Handles all database operations related to products.
 * Follows the repository pattern for clean architecture and separation of concerns.
 */

export type ProductWithRelations = Product & {
  recipeProducts?: Array<RecipeProduct & { recipe: Recipe }>;
};

export interface ProductFilters {
  search?: string;
  category?: string;
  sortBy?:
    | "name"
    | "sku"
    | "currentStock"
    | "costPrice"
    | "sellingPrice"
    | "createdAt"
    | "updatedAt";
  sortOrder?: "asc" | "desc";
  skip?: number;
  take?: number;
}

export class ProductRepository extends BaseRepository {
  /**
   * Find all products for a store with optional filtering
   */
  async findAll(
    storeId: string,
    filters: ProductFilters = {}
  ): Promise<{ products: ProductWithRelations[]; total: number }> {
    const {
      search,
      category,
      sortBy = "createdAt",
      sortOrder = "desc",
      skip = 0,
      take = 50,
    } = filters;

    // Build where clause
    const where: Prisma.ProductWhereInput = {
      storeId,
      isActive: true,
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { sku: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { category: { contains: search, mode: "insensitive" } },
        ],
      }),
      ...(category && { category }),
    };

    // Build orderBy clause
    const orderBy: Prisma.ProductOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    // Fetch products
    const [products, total] = await Promise.all([
      this.db.product.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          recipeProducts: {
            include: {
              recipe: true,
            },
            orderBy: {
              createdAt: "asc", // Order by creation date
            },
          },
        },
      }),
      this.db.product.count({ where }),
    ]);

    return { products, total };
  }

  /**
   * Find product by ID
   */
  async findById(productId: string): Promise<ProductWithRelations | null> {
    return this.db.product.findUnique({
      where: { id: productId },
      include: {
        recipeProducts: {
          include: {
            recipe: true,
          },
          orderBy: {
            createdAt: "asc", // Order by creation date
          },
        },
      },
    });
  }

  /**
   * Find product by SKU and storeId
   */
  async findBySku(storeId: string, sku: string): Promise<ProductWithRelations | null> {
    return this.db.product.findFirst({
      where: {
        storeId,
        sku,
      },
      include: {
        recipeProducts: {
          include: {
            recipe: true,
          },
          orderBy: {
            createdAt: "asc", // Order by creation date
          },
        },
      },
    });
  }

  /**
   * Check if product SKU already exists for a store
   */
  async existsBySku(storeId: string, sku: string, excludeId?: string): Promise<boolean> {
    const product = await this.db.product.findFirst({
      where: {
        storeId,
        sku: {
          equals: sku,
          mode: "insensitive",
        },
        ...(excludeId && { id: { not: excludeId } }),
      },
      select: { id: true },
    });

    return !!product;
  }

  /**
   * Check if product name already exists for a store
   */
  async existsByName(storeId: string, name: string, excludeId?: string): Promise<boolean> {
    const product = await this.db.product.findFirst({
      where: {
        storeId,
        name: {
          equals: name,
          mode: "insensitive",
        },
        ...(excludeId && { NOT: { id: excludeId } }),
      },
      select: { id: true },
    });

    return !!product;
  }

  /**
   * Create new product
   */
  async create(data: Prisma.ProductCreateInput): Promise<ProductWithRelations> {
    return this.db.product.create({
      data,
      include: {
        recipeProducts: {
          include: {
            recipe: true,
          },
        },
      },
    });
  }

  /**
   * Update product
   */
  async update(productId: string, data: Prisma.ProductUpdateInput): Promise<ProductWithRelations> {
    return this.db.product.update({
      where: { id: productId },
      data,
      include: {
        recipeProducts: {
          include: {
            recipe: true,
          },
          orderBy: {
            createdAt: "asc", // Order by creation date
          },
        },
      },
    });
  }

  /**
   * Update product recipes (Many-to-Many relationship)
   */
  async updateRecipes(
    productId: string,
    recipeIds: string[]
  ): Promise<ProductWithRelations> {
    // First, delete all existing recipe-product relationships
    await this.db.recipeProduct.deleteMany({
      where: { productId },
    });

    // Then, create new relationships
    if (recipeIds.length > 0) {
      await this.db.recipeProduct.createMany({
        data: recipeIds.map((recipeId) => ({
          productId,
          recipeId,
          isDefault: false, // No default recipes anymore
        })),
      });
    }

    // Return updated product with recipes
    return this.findById(productId) as Promise<ProductWithRelations>;
  }

  /**
   * Delete product (hard delete)
   * Note: Related records (OrderItem, ProductionBatch, StockMovement) will be cascade deleted
   */
  async delete(productId: string): Promise<void> {
    await this.db.product.delete({
      where: { id: productId },
    });
  }

  /**
   * Bulk delete products (hard delete)
   * Note: Related records will be cascade deleted
   */
  async bulkDelete(productIds: string[]): Promise<{ count: number }> {
    const result = await this.db.product.deleteMany({
      where: { id: { in: productIds } },
    });

    return { count: result.count };
  }

  /**
   * Check if product belongs to a specific store
   */
  async belongsToStore(productId: string, storeId: string): Promise<boolean> {
    const product = await this.db.product.findFirst({
      where: { id: productId, storeId },
      select: { id: true },
    });

    return !!product;
  }

  /**
   * Find products by IDs
   */
  async findByIds(productIds: string[]): Promise<ProductWithRelations[]> {
    return this.db.product.findMany({
      where: { id: { in: productIds } },
    });
  }

  /**
   * Count products
   */
  async count(where?: Prisma.ProductWhereInput): Promise<number> {
    return this.db.product.count({ where });
  }
}

// Export singleton instance
export const productRepository = new ProductRepository();
