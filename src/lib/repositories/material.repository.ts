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

    // Build where clause
    const where: Prisma.MaterialWhereInput = {
      storeId,
      isActive: true,
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

    // Optimize pagination based on whether stockStatus filter is used
    // Stock status filtering requires column comparisons (currentStock <= minStock),
    // which Prisma doesn't support well at database level, so we filter in-memory
    if (stockStatus) {
      // If stockStatus filter is used, we need to fetch materials and filter in-memory
      // To optimize, we fetch a reasonable batch size (max 1000) for filtering
      // This prevents fetching all materials from large datasets
      const maxFetchForFiltering = Math.min(take * 10, 1000); // Fetch up to 10 pages or 1000 records

      // Fetch materials with includes (limited batch for filtering)
      let materials = await this.db.material.findMany({
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
        take: maxFetchForFiltering, // Limit fetch size
      });

      // Apply stock status filter in-memory (Prisma doesn't support column comparisons)
      materials = materials.filter((material) => {
        const current = Number(material.currentStock);
        const min = Number(material.minStock) || 0;
        const max = Number(material.maxStock) || Infinity;

        switch (stockStatus) {
          case "out_of_stock":
            return current <= 0;
          case "low_stock":
            return current > 0 && current <= min;
          case "overstocked":
            return current > max;
          case "in_stock":
            return current > min && current <= max;
          default:
            return true;
        }
      });

      // Get total after filtering (limited to fetched batch)
      const total = materials.length;

      // Apply pagination after filtering
      const paginatedMaterials = materials.slice(skip, skip + take);

      return {
        materials: paginatedMaterials as MaterialWithSuppliers[],
        total,
      };
    }

    // If no stockStatus filter, apply pagination at database level (optimal)
    // This is much more efficient for large datasets
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
        take, // Apply pagination at database level
      }),
      this.db.material.count({ where }), // Get total count from database
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
        isActive: true,
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
    currentStock?: number;
    minStock?: number;
    maxStock?: number;
    suppliers?: Array<{
      supplierId: string;
      price: number;
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
  async bulkDelete(materialIds: string[]): Promise<number> {
    const result = await this.db.material.deleteMany({
      where: {
        id: {
          in: materialIds,
        },
      },
    });
    return result.count;
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
   */
  async findLowStock(storeId: string): Promise<MaterialWithSuppliers[]> {
    const materials = await this.db.material.findMany({
      where: {
        storeId,
        isActive: true,
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
      orderBy: { currentStock: "asc" },
    });

    // Filter for low stock (currentStock <= minStock)
    const lowStockMaterials = materials.filter(
      (material) =>
        Number(material.currentStock) <= Number(material.minStock) &&
        Number(material.currentStock) > 0
    );

    return lowStockMaterials as MaterialWithSuppliers[];
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
