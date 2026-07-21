import { Material, Prisma } from "@prisma/client";
import { BaseRepository } from "./base.repository";

/**
 * Material (Ingredient) Repository
 *
 * Handles all database operations related to materials/ingredients.
 * Follows the repository pattern for clean architecture and separation of concerns.
 */

export type MaterialWithSuppliers = Material & {
  materialSuppliers: Array<{
    id: string;
    materialId: string;
    supplierId: string;
    price: Prisma.Decimal;
    purchaseQuantity: Prisma.Decimal;
    isPreferred: boolean;
    createdAt: Date;
    updatedAt: Date;
    supplier: {
      id: string;
      name: string;
    };
  }>;
};

export interface MaterialFilters {
  search?: string;
  category?: string;
  supplierId?: string;
  stockStatus?: "in_stock" | "low_stock" | "out_of_stock" | "overstocked";
  sortBy?: "name" | "sku" | "currentStock" | "unitCost" | "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
  skip?: number;
  take?: number;
}

export class MaterialRepository extends BaseRepository {
  /**
   * Find all materials for a store with optional filtering
   */
  async findAll(
    storeId: string,
    filters: MaterialFilters = {}
  ): Promise<{ materials: MaterialWithSuppliers[]; total: number }> {
    const {
      search,
      category,
      supplierId,
      stockStatus,
      sortBy = "createdAt",
      sortOrder = "desc",
      skip = 0,
      take = 50,
    } = filters;

    // Handle stock status filtering using raw query to get matching IDs
    // This is necessary because Prisma doesn't support column comparison (current vs min) in where clause
    let stockStatusIds: string[] | undefined;

    if (stockStatus) {
      let stockQuery = Prisma.sql``;

      switch (stockStatus) {
        case "out_of_stock":
          stockQuery = Prisma.sql`
            SELECT id FROM "ingredients"
            WHERE "storeId" = ${storeId}
            AND "currentStock" <= 0
          `;
          break;
        case "low_stock":
          stockQuery = Prisma.sql`
            SELECT id FROM "ingredients"
            WHERE "storeId" = ${storeId}
            AND "currentStock" > 0
            AND "currentStock" <= "minStock"
          `;
          break;
        case "overstocked":
          stockQuery = Prisma.sql`
            SELECT id FROM "ingredients"
            WHERE "storeId" = ${storeId}
            AND "currentStock" > "maxStock"
          `;
          break;
        case "in_stock":
          stockQuery = Prisma.sql`
            SELECT id FROM "ingredients"
            WHERE "storeId" = ${storeId}
            AND "currentStock" > "minStock"
            AND "currentStock" <= "maxStock"
          `;
          break;
      }

      if (stockQuery.values.length > 0 || stockQuery.text.length > 0) {
        const results = await this.db.$queryRaw<{ id: string }[]>(stockQuery);
        stockStatusIds = results.map((r) => r.id);
      }
    }

    // Build where clause
    const where: Prisma.MaterialWhereInput = {
      storeId,
      ...(stockStatusIds && {
        id: { in: stockStatusIds },
      }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { sku: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      }),
      ...(category && { category }),
      ...(supplierId && {
        materialSuppliers: {
          some: {
            supplierId,
          },
        },
      }),
    };

    // Build orderBy clause
    const orderBy: Prisma.MaterialOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    // Fetch materials with includes
    const [materials, total] = await Promise.all([
      this.db.material.findMany({
        where,
        include: {
          materialSuppliers: {
            include: {
              supplier: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: { isPreferred: "desc" },
          },
        },
        orderBy,
        skip,
        take,
      }),
      this.db.material.count({ where }),
    ]);

    return {
      materials: materials as MaterialWithSuppliers[],
      total,
    };
  }

  /**
   * Find material by SKU and storeId
   */
  async findBySku(storeId: string, sku: string): Promise<MaterialWithSuppliers | null> {
    return this.db.material.findFirst({
      where: {
        storeId,
        sku,
      },
      include: {
        materialSuppliers: {
          include: {
            supplier: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { isPreferred: "desc" },
        },
      },
    });
  }

  /**
   * Find material by ID with suppliers
   */
  async findById(materialId: string): Promise<MaterialWithSuppliers | null> {
    const material = await this.db.material.findUnique({
      where: { id: materialId },
      include: {
        materialSuppliers: {
          include: {
            supplier: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                contactPerson: true,
              },
            },
          },
          orderBy: { isPreferred: "desc" },
        },
      },
    });

    return material as MaterialWithSuppliers | null;
  }

  /**
   * Check if SKU already exists for a store
   * Optimized: Only select id field for faster query
   */
  async existsBySku(storeId: string, sku: string, excludeId?: string): Promise<boolean> {
    const material = await this.db.material.findFirst({
      where: {
        storeId,
        sku: {
          equals: sku,
          mode: "insensitive",
        },
        ...(excludeId && { id: { not: excludeId } }),
      },
      select: {
        id: true, // Only select id for faster query
      },
    });
    return material !== null;
  }

  /**
   * Create a new material
   */
  async create(data: {
    storeId: string;
    sku: string;
    name: string;
    description?: string;
    category?: string;
    unit: string;
    unitCost: number;
    purchaseQuantity?: number;
    currentStock?: number;
    minStock?: number;
    maxStock?: number;
    suppliers?: Array<{
      supplierId: string;
      price: number;
      purchaseQuantity?: number;
      isPreferred?: boolean;
    }>;
  }): Promise<MaterialWithSuppliers> {
    const { suppliers, ...materialData } = data;

    const material = await this.db.material.create({
      data: {
        ...materialData,
        ...(suppliers &&
          suppliers.length > 0 && {
            materialSuppliers: {
              create: suppliers.map((s) => ({
                supplierId: s.supplierId,
                price: s.price,
                purchaseQuantity: s.purchaseQuantity ?? 1,
                isPreferred: s.isPreferred ?? false,
              })),
            },
          }),
      },
      include: {
        materialSuppliers: {
          include: {
            supplier: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return material as MaterialWithSuppliers;
  }

  /**
   * Update material
   */
  async update(
    materialId: string,
    data: Partial<Omit<Material, "id" | "storeId" | "createdAt" | "updatedAt">>
  ): Promise<Material> {
    return this.db.material.update({
      where: { id: materialId },
      data,
    });
  }

  /**
   * Hard delete material
   */
  async delete(materialId: string): Promise<Material> {
    return this.db.material.delete({
      where: { id: materialId },
    });
  }

  /**
   * Bulk hard delete materials
   */
  async bulkDelete(materialIds: string[]): Promise<{ count: number }> {
    const result = await this.db.material.deleteMany({
      where: {
        id: {
          in: materialIds,
        },
      },
    });
    return result;
  }

  /**
   * Add supplier to material
   */
  async addSupplier(
    materialId: string,
    supplierId: string,
    price: number,
    isPreferred: boolean = false
  ): Promise<{
    id: string;
    materialId: string;
    supplierId: string;
    price: Prisma.Decimal;
    isPreferred: boolean;
    createdAt: Date;
    updatedAt: Date;
  }> {
    // If this is marked as preferred, unmark others
    if (isPreferred) {
      await this.db.materialSupplier.updateMany({
        where: { materialId: materialId },
        data: { isPreferred: false },
      });
    }

    return this.db.materialSupplier.create({
      data: {
        materialId: materialId,
        supplierId,
        price,
        isPreferred,
      },
    });
  }

  /**
   * Remove supplier from material
   */
  async removeSupplier(
    materialId: string,
    supplierId: string
  ): Promise<{
    id: string;
    materialId: string;
    supplierId: string;
    price: Prisma.Decimal;
    isPreferred: boolean;
    createdAt: Date;
    updatedAt: Date;
  }> {
    return this.db.materialSupplier.delete({
      where: {
        materialId_supplierId: {
          materialId: materialId,
          supplierId,
        },
      },
    });
  }

  /**
   * Update supplier for material
   */
  async updateSupplier(
    materialId: string,
    supplierId: string,
    data: { price?: number; isPreferred?: boolean }
  ): Promise<{
    id: string;
    materialId: string;
    supplierId: string;
    price: Prisma.Decimal;
    isPreferred: boolean;
    createdAt: Date;
    updatedAt: Date;
  }> {
    // If updating to preferred, unmark others
    if (data.isPreferred) {
      await this.db.materialSupplier.updateMany({
        where: {
          materialId: materialId,
          supplierId: { not: supplierId },
        },
        data: { isPreferred: false },
      });
    }

    return this.db.materialSupplier.update({
      where: {
        materialId_supplierId: {
          materialId: materialId,
          supplierId,
        },
      },
      data,
    });
  }

  /**
   * Get materials with low stock
   * Optimized: Uses raw SQL to filter at database level (currentStock <= minStock)
   * instead of fetching all materials and filtering in memory
   */
  async findLowStock(storeId: string): Promise<MaterialWithSuppliers[]> {
    // Use raw SQL for column comparison - Prisma doesn't support comparing two columns
    const lowStockIds = await this.db.$queryRaw<{ id: string }[]>`
      SELECT id FROM "ingredients"
      WHERE "storeId" = ${storeId}
      AND "currentStock" <= "minStock"
      AND "currentStock" > 0
      ORDER BY "currentStock" ASC
      LIMIT 100
    `;

    // If no low stock items, return early
    if (!lowStockIds.length) {
      return [];
    }

    // Fetch full details only for filtered items
    const materials = await this.db.material.findMany({
      where: {
        id: { in: lowStockIds.map((r) => r.id) },
      },
      include: {
        materialSuppliers: {
          include: {
            supplier: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { isPreferred: "desc" },
        },
      },
    });

    // Sort by stock level (maintain the order from raw query)
    materials.sort((a, b) => Number(a.currentStock) - Number(b.currentStock));

    return materials as MaterialWithSuppliers[];
  }

  /**
   * Count materials by filters
   */
  async count(where?: Prisma.MaterialWhereInput): Promise<number> {
    return this.db.material.count({ where });
  }

  /**
   * Find materials by IDs (batch)
   */
  async findByIds(materialIds: string[]): Promise<Material[]> {
    return this.db.material.findMany({
      where: { id: { in: materialIds } },
    });
  }

  /**
   * Check if material belongs to store
   */
  async belongsToStore(materialId: string, storeId: string): Promise<boolean> {
    const material = await this.db.material.findUnique({
      where: { id: materialId },
      select: { storeId: true },
    });
    return material?.storeId === storeId;
  }
}

// Export singleton instance
export const materialRepository = new MaterialRepository();
