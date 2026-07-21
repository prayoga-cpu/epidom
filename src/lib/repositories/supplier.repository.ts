import { Supplier, Prisma, Material } from "@prisma/client";
import { BaseRepository } from "./base.repository";

/**
 * Supplier Repository
 *
 * Handles all database operations related to suppliers.
 * Follows the repository pattern for clean architecture and separation of concerns.
 */

export type SupplierWithRelations = Supplier & {
  materialSuppliers?: Array<{
    id: string;
    materialId: string;
    supplierId: string;
    price: Prisma.Decimal;
    purchaseQuantity: Prisma.Decimal;
    isPreferred: boolean;
    createdAt: Date;
    updatedAt: Date;
    material: {
      id: string;
      name: string;
      sku: string;
      category: string | null;
      unit: string;
      unitCost: Prisma.Decimal;
      purchaseQuantity: Prisma.Decimal;
      currentStock: Prisma.Decimal;
      minStock: Prisma.Decimal;
      maxStock: Prisma.Decimal;
    };
  }>;
};

export interface SupplierFilters {
  search?: string;
  sortBy?: "name" | "contactPerson" | "email" | "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
  skip?: number;
  take?: number;
}

export class SupplierRepository extends BaseRepository {
  /**
   * Find all suppliers for a store with optional filtering
   */
  async findAll(
    storeId: string,
    filters: SupplierFilters = {}
  ): Promise<{ suppliers: SupplierWithRelations[]; total: number }> {
    const { search, sortBy = "createdAt", sortOrder = "desc", skip = 0, take = 50 } = filters;

    // Build where clause
    const where: Prisma.SupplierWhereInput = {
      storeId,

      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { contactPerson: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
          { city: { contains: search, mode: "insensitive" } },
          { country: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    // Build orderBy clause
    const orderBy: Prisma.SupplierOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    // Fetch suppliers
    const [suppliers, total] = await Promise.all([
      this.db.supplier.findMany({
        where,
        include: {
          materialSuppliers: {
            include: {
              material: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  category: true,
                  unit: true,
                  unitCost: true,
                  purchaseQuantity: true,
                  currentStock: true,
                  minStock: true,
                  maxStock: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy,
        skip,
        take,
      }),
      this.db.supplier.count({ where }),
    ]);

    return { suppliers, total };
  }

  /**
   * Find supplier by ID
   */
  async findById(supplierId: string): Promise<SupplierWithRelations | null> {
    return this.db.supplier.findUnique({
      where: { id: supplierId },
      include: {
        materialSuppliers: {
          include: {
            material: {
              select: {
                id: true,
                name: true,
                sku: true,
                category: true,
                unit: true,
                unitCost: true,
                purchaseQuantity: true,
                currentStock: true,
                minStock: true,
                maxStock: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
  }

  /**
   * Check if supplier name already exists for a store
   */
  async existsByName(storeId: string, name: string, excludeId?: string): Promise<boolean> {
    const supplier = await this.db.supplier.findFirst({
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

    return !!supplier;
  }

  /**
   * Create new supplier
   */
  async create(data: Prisma.SupplierCreateInput): Promise<SupplierWithRelations> {
    return this.db.supplier.create({
      data,
    });
  }

  /**
   * Update supplier
   */
  async update(
    supplierId: string,
    data: Prisma.SupplierUpdateInput
  ): Promise<SupplierWithRelations> {
    return this.db.supplier.update({
      where: { id: supplierId },
      data,
    });
  }

  /**
   * Delete supplier (hard delete)
   * Note: Related records (MaterialSupplier, SupplierOrder) will be cascade deleted
   */
  async delete(supplierId: string): Promise<Supplier> {
    return this.db.supplier.delete({
      where: { id: supplierId },
    });
  }

  /**
   * Bulk delete suppliers (hard delete)
   * Note: Related records will be cascade deleted
   */
  async bulkDelete(supplierIds: string[]): Promise<{ count: number }> {
    const result = await this.db.supplier.deleteMany({
      where: { id: { in: supplierIds } },
    });

    return { count: result.count };
  }

  /**
   * Check if supplier belongs to a specific store
   */
  async belongsToStore(supplierId: string, storeId: string): Promise<boolean> {
    const supplier = await this.db.supplier.findFirst({
      where: { id: supplierId, storeId },
      select: { id: true },
    });

    return !!supplier;
  }

  /**
   * Find suppliers by IDs
   */
  async findByIds(supplierIds: string[]): Promise<SupplierWithRelations[]> {
    return this.db.supplier.findMany({
      where: { id: { in: supplierIds } },
    });
  }
}

// Export singleton instance
export const supplierRepository = new SupplierRepository();
