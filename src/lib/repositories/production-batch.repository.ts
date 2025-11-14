import { ProductionBatch, Prisma, ProductionStatus } from "@prisma/client";
import { BaseRepository } from "./base.repository";

/**
 * Production Batch Repository
 *
 * Handles all database operations related to production batches.
 * Follows the repository pattern for clean architecture and separation of concerns.
 */

export type ProductionBatchWithRelations = ProductionBatch & {
  product: {
    id: string;
    name: string;
    sku: string;
    unit: string;
  };
  recipe: {
    id: string;
    name: string;
    yieldQuantity: Prisma.Decimal;
    yieldUnit: string;
    ingredients: Array<{
      id: string;
      materialId: string;
      quantity: Prisma.Decimal;
      unit: string;
      material: {
        id: string;
        name: string;
        currentStock: Prisma.Decimal;
        unit: string;
        unitCost: Prisma.Decimal;
      };
    }>;
  } | null;
  stockMovements: Array<{
    id: string;
    type: string;
    quantity: Prisma.Decimal;
    unit: string;
    createdAt: Date;
  }>;
};

export interface ProductionBatchFilters {
  status?: ProductionStatus | ProductionStatus[];
  recipeId?: string;
  productId?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  sortBy?: "batchNumber" | "scheduledDate" | "completedDate" | "status" | "createdAt";
  sortOrder?: "asc" | "desc";
  skip?: number;
  take?: number;
}

export class ProductionBatchRepository extends BaseRepository {
  /**
   * Find all production batches for a store with optional filtering
   */
  async findAll(
    storeId: string,
    filters: ProductionBatchFilters = {}
  ): Promise<{ batches: ProductionBatchWithRelations[]; total: number }> {
    const {
      status,
      recipeId,
      productId,
      startDate,
      endDate,
      search,
      sortBy = "scheduledDate",
      sortOrder = "desc",
      skip = 0,
      take = 50,
    } = filters;

    // Build where clause
    const where: Prisma.ProductionBatchWhereInput = {
      storeId,
      ...(status && {
        status: Array.isArray(status) ? { in: status } : status,
      }),
      ...(recipeId && { recipeId }),
      ...(productId && { productId }),
      ...(startDate && {
        scheduledDate: {
          gte: startDate,
        },
      }),
      ...(endDate && {
        scheduledDate: {
          lte: endDate,
        },
      }),
      ...(search && {
        OR: [
          { batchNumber: { contains: search, mode: "insensitive" } },
          { notes: { contains: search, mode: "insensitive" } },
          { product: { name: { contains: search, mode: "insensitive" } } },
        ],
      }),
    };

    // Build orderBy clause
    const orderBy: Prisma.ProductionBatchOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    // Fetch batches with includes
    const [batches, total] = await Promise.all([
      this.db.productionBatch.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              unit: true,
            },
          },
          recipe: {
            select: {
              id: true,
              name: true,
              yieldQuantity: true,
              yieldUnit: true,
              ingredients: {
                include: {
                  material: {
                    select: {
                      id: true,
                      name: true,
                      currentStock: true,
                      unit: true,
                      unitCost: true,
                    },
                  },
                },
              },
            },
          },
          stockMovements: {
            select: {
              id: true,
              type: true,
              quantity: true,
              unit: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy,
        skip,
        take,
      }),
      this.db.productionBatch.count({ where }),
    ]);

    return {
      batches: batches as ProductionBatchWithRelations[],
      total,
    };
  }

  /**
   * Find production batch by ID with full relations
   */
  async findById(batchId: string): Promise<ProductionBatchWithRelations | null> {
    const batch = await this.db.productionBatch.findUnique({
      where: { id: batchId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            unit: true,
          },
        },
        recipe: {
          select: {
            id: true,
            name: true,
            yieldQuantity: true,
            yieldUnit: true,
            ingredients: {
              include: {
                material: {
                  select: {
                    id: true,
                    name: true,
                    currentStock: true,
                    unit: true,
                  },
                },
              },
            },
          },
        },
        stockMovements: {
          select: {
            id: true,
            type: true,
            quantity: true,
            unit: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return batch as ProductionBatchWithRelations | null;
  }

  /**
   * Check if batch number already exists
   */
  async existsByBatchNumber(batchNumber: string, excludeId?: string): Promise<boolean> {
    const batch = await this.db.productionBatch.findFirst({
      where: {
        batchNumber: {
          equals: batchNumber,
          mode: "insensitive",
        },
        ...(excludeId && { id: { not: excludeId } }),
      },
    });
    return batch !== null;
  }

  /**
   * Create a new production batch
   */
  async create(data: {
    storeId: string;
    batchNumber: string;
    productId: string;
    recipeId?: string;
    plannedQuantity: number;
    unit: string;
    status: ProductionStatus;
    scheduledDate: Date;
    notes?: string;
  }): Promise<ProductionBatchWithRelations> {
    const batch = await this.db.productionBatch.create({
      data: {
        ...data,
        recipeId: data.recipeId || null,
        notes: data.notes || null,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            unit: true,
          },
        },
        recipe: {
          select: {
            id: true,
            name: true,
            yieldQuantity: true,
            yieldUnit: true,
            ingredients: {
              include: {
                material: {
                  select: {
                    id: true,
                    name: true,
                    currentStock: true,
                    unit: true,
                  },
                },
              },
            },
          },
        },
        stockMovements: {
          select: {
            id: true,
            type: true,
            quantity: true,
            unit: true,
            createdAt: true,
          },
        },
      },
    });

    return batch as ProductionBatchWithRelations;
  }

  /**
   * Update production batch
   */
  async update(
    batchId: string,
    data: Partial<
      Omit<ProductionBatch, "id" | "storeId" | "batchNumber" | "createdAt" | "updatedAt">
    >
  ): Promise<ProductionBatch> {
    return this.db.productionBatch.update({
      where: { id: batchId },
      data,
    });
  }

  /**
   * Update batch status
   */
  async updateStatus(
    batchId: string,
    status: ProductionStatus,
    additionalData?: {
      actualQuantity?: number;
      completedDate?: Date;
      notes?: string;
    }
  ): Promise<ProductionBatch> {
    return this.db.productionBatch.update({
      where: { id: batchId },
      data: {
        status,
        ...additionalData,
      },
    });
  }

  /**
   * Delete production batch (hard delete)
   */
  async delete(batchId: string): Promise<ProductionBatch> {
    return this.db.productionBatch.delete({
      where: { id: batchId },
    });
  }

  /**
   * Get active batches (PLANNED, IN_PROGRESS) for a recipe
   */
  async getActiveBatchesByRecipe(
    storeId: string,
    recipeId: string
  ): Promise<ProductionBatchWithRelations[]> {
    const batches = await this.db.productionBatch.findMany({
      where: {
        storeId,
        recipeId,
        status: {
          in: [ProductionStatus.PLANNED, ProductionStatus.IN_PROGRESS],
        },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            unit: true,
          },
        },
        recipe: {
          select: {
            id: true,
            name: true,
            yieldQuantity: true,
            yieldUnit: true,
            ingredients: {
              include: {
                material: {
                  select: {
                    id: true,
                    name: true,
                    currentStock: true,
                    unit: true,
                  },
                },
              },
            },
          },
        },
        stockMovements: {
          select: {
            id: true,
            type: true,
            quantity: true,
            unit: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { scheduledDate: "asc" },
    });

    return batches as ProductionBatchWithRelations[];
  }

  /**
   * Get production batches due within date range
   */
  async getBatchesDueSoon(
    storeId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ProductionBatch[]> {
    return this.db.productionBatch.findMany({
      where: {
        storeId,
        status: {
          in: [ProductionStatus.PLANNED, ProductionStatus.IN_PROGRESS],
        },
        scheduledDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { scheduledDate: "asc" },
    });
  }

  /**
   * Check if batch belongs to store
   */
  async belongsToStore(batchId: string, storeId: string): Promise<boolean> {
    const batch = await this.db.productionBatch.findUnique({
      where: { id: batchId },
      select: { storeId: true },
    });
    return batch?.storeId === storeId;
  }

  /**
   * Count batches by filters
   */
  async count(where?: Prisma.ProductionBatchWhereInput): Promise<number> {
    return this.db.productionBatch.count({ where });
  }

  /**
   * Generate unique batch number with optimized single-query approach
   * Format: {PREFIX}-{YYYYMMDD}-{SEQUENCE}-{RANDOM}
   * Example: BATCH-20250114-0001-432
   */
  async generateBatchNumber(
    storeId: string,
    prefix: string = "BATCH"
  ): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const datePrefix = `${prefix}-${year}${month}${day}`;

    // Get the latest batch number for today using a single query
    // This finds the highest sequence number by filtering batch numbers that match today's date
    const latestBatch = await this.db.productionBatch.findFirst({
      where: {
        storeId,
        batchNumber: {
          startsWith: datePrefix,
        },
      },
      orderBy: {
        batchNumber: "desc",
      },
      select: {
        batchNumber: true,
      },
    });

    // Extract sequence number from latest batch, or start at 0
    let nextSequence = 1;
    if (latestBatch?.batchNumber) {
      // Extract sequence from format: PREFIX-YYYYMMDD-XXXX-XXX
      const parts = latestBatch.batchNumber.split("-");
      if (parts.length >= 3) {
        const currentSequence = parseInt(parts[2], 10);
        if (!isNaN(currentSequence)) {
          nextSequence = currentSequence + 1;
        }
      }
    }

    const sequence = String(nextSequence).padStart(4, "0");

    // Add random suffix to prevent collisions in high-concurrency scenarios
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");

    const batchNumber = `${datePrefix}-${sequence}-${random}`;

    return batchNumber;
  }
}

// Export singleton instance
export const productionBatchRepository = new ProductionBatchRepository();
