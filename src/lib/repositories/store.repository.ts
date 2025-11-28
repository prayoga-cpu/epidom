import { Store, Prisma } from "@prisma/client";
import { BaseRepository } from "./base.repository";
import { StoreDto } from "@/types/dto";

/**
 * Store Repository
 *
 * Handles all database operations related to stores.
 */
export class StoreRepository extends BaseRepository {
  /**
   * Find store by ID
   */
  async findById(storeId: string): Promise<Store | null> {
    return this.db.store.findUnique({
      where: { id: storeId },
    });
  }

  /**
   * Find all stores for a business
   * All delete operations use hard delete (permanently removes records)
   */
  async findByBusinessId(businessId: string): Promise<Store[]> {
    return this.db.store.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Check if store name already exists for a business
   */
  async existsByName(businessId: string, name: string, excludeId?: string): Promise<boolean> {
    const store = await this.db.store.findFirst({
      where: {
        businessId,
        name: {
          equals: name,
          mode: "insensitive", // Case-insensitive comparison
        },
        ...(excludeId && { id: { not: excludeId } }),
      },
    });
    return store !== null;
  }

  /**
   * Create a new store
   */
  async create(data: {
    businessId: string;
    name: string;
    address?: string;
    city?: string;
    country?: string;
    phone?: string;
    email?: string;
    image?: string;
  }): Promise<Store> {
    return this.db.store.create({
      data,
    });
  }

  /**
   * Update store
   */
  async update(
    storeId: string,
    data: Partial<Omit<Store, "id" | "businessId" | "createdAt">>
  ): Promise<Store> {
    return this.db.store.update({
      where: { id: storeId },
      data,
    });
  }

  /**
   * Delete store (hard delete)
   * WARNING: This will permanently delete the store and cascade delete all related data
   */
  async delete(storeId: string): Promise<Store> {
    return this.db.store.delete({
      where: { id: storeId },
    });
  }

  /**
   * Check if store belongs to business
   */
  async belongsToBusiness(storeId: string, businessId: string): Promise<boolean> {
    const store = await this.db.store.findUnique({
      where: { id: storeId },
      select: { businessId: true },
    });
    return store?.businessId === businessId;
  }

  /**
   * Count active stores for a business
   */
  async countActiveStores(businessId: string): Promise<number> {
    return this.db.store.count({
      where: { businessId },
    });
  }

  /**
   * List stores with pagination
   */
  async list(params: {
    skip?: number;
    take?: number;
    where?: Prisma.StoreWhereInput;
    orderBy?: Prisma.StoreOrderByWithRelationInput;
  }): Promise<Store[]> {
    return this.db.store.findMany(params);
  }

  /**
   * Count stores
   */
  async count(where?: Prisma.StoreWhereInput): Promise<number> {
    return this.db.store.count({ where });
  }

  /**
   * Find stores by IDs (batch)
   */
  async findByIds(storeIds: string[]): Promise<Store[]> {
    return this.db.store.findMany({
      where: { id: { in: storeIds } },
    });
  }
}

// Export singleton instance
export const storeRepository = new StoreRepository();
