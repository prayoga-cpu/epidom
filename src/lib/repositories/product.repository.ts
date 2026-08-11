import {
  Product,
  Prisma,
  Recipe,
  RecipeProduct,
  ProductOptionGroup,
  ProductOption,
  Department,
  ProductLine,
} from "@prisma/client";
import { BaseRepository } from "./base.repository";
import type { ProductOptionGroupInput } from "@/lib/validation/inventory.schemas";

/**
 * Product Repository
 *
 * Handles all database operations related to products.
 * Follows the repository pattern for clean architecture and separation of concerns.
 */

export type ProductWithRelations = Product & {
  recipeProducts?: Array<RecipeProduct & { recipe: Recipe }>;
  optionGroups?: Array<ProductOptionGroup & { options: ProductOption[] }>;
};

const optionGroupsInclude = {
  optionGroups: {
    include: { options: { orderBy: { displayOrder: "asc" as const } } },
    orderBy: { displayOrder: "asc" as const },
  },
};

export interface ProductFilters {
  search?: string;
  category?: string;
  department?: Department;
  productLine?: ProductLine;
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
      department,
      productLine,
      sortBy = "createdAt",
      sortOrder = "desc",
      skip = 0,
      take = 50,
    } = filters;

    // Build where clause
    const where: Prisma.ProductWhereInput = {
      storeId,

      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { sku: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { category: { contains: search, mode: "insensitive" } },
        ],
      }),
      ...(category && { category }),
      ...(department && { department }),
      ...(productLine && { productLine }),
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
          ...optionGroupsInclude,
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
        ...optionGroupsInclude,
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
        ...optionGroupsInclude,
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
        ...optionGroupsInclude,
      },
    });
  }

  /**
   * Update product recipes (Many-to-Many relationship)
   */
  async updateRecipes(productId: string, recipeIds: string[]): Promise<ProductWithRelations> {
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
   * Replace a product's option groups (and their options) wholesale.
   * Same delete-all-then-recreate approach as updateRecipes — option groups
   * have no independent identity worth preserving across an edit, and this
   * keeps display order and option membership trivially correct.
   */
  async updateOptionGroups(
    productId: string,
    groups: ProductOptionGroupInput[]
  ): Promise<ProductWithRelations> {
    // Deleting the group cascades to its options (onDelete: Cascade).
    await this.db.productOptionGroup.deleteMany({
      where: { productId },
    });

    for (const [groupIndex, group] of groups.entries()) {
      await this.db.productOptionGroup.create({
        data: {
          productId,
          name: group.name,
          isRequired: group.isRequired,
          maxSelections: group.maxSelections,
          displayOrder: groupIndex,
          options: {
            create: group.options.map((option, optionIndex) => ({
              name: option.name,
              priceAdjustment: option.priceAdjustment,
              materialId: option.materialId,
              materialQty: option.materialQty,
              displayOrder: optionIndex,
            })),
          },
        },
      });
    }

    return this.findById(productId) as Promise<ProductWithRelations>;
  }

  /**
   * Delete product (hard delete)
   * Note: Related records (OrderItem, ProductionBatch, StockMovement) will be cascade deleted
   */
  async delete(productId: string): Promise<Product> {
    return this.db.product.delete({
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
   * Clear a category from all products in a store that use it
   * (sets category to null, removing it from the derived category list)
   */
  async clearCategory(storeId: string, category: string): Promise<{ count: number }> {
    const result = await this.db.product.updateMany({
      where: { storeId, category },
      data: { category: null },
    });

    return { count: result.count };
  }

  /**
   * Hard delete every product in a store that has a given category
   */
  async deleteByCategory(storeId: string, category: string): Promise<{ count: number }> {
    const result = await this.db.product.deleteMany({
      where: { storeId, category },
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
