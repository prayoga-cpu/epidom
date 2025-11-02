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
   * Since we're using hard delete, we don't need to filter by isActive
   * (kept isActive field in schema for future soft delete implementation)
   */
  async findByBusinessId(businessId: string): Promise<Store[]> {
    return this.db.store.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Check if store name already exists for a business
   * Using hard delete, so we don't filter by isActive
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
   * Soft delete store (set isActive to false)
   */
  async softDelete(storeId: string): Promise<Store> {
    return this.db.store.update({
      where: { id: storeId },
      data: { isActive: false },
    });
  }

  /**
   * Hard delete store
   */
  async delete(storeId: string): Promise<Store> {
    return this.db.store.delete({
      where: { id: storeId },
    });
  }

  /**
   * Activate store
   */
  async activate(storeId: string): Promise<Store> {
    return this.db.store.update({
      where: { id: storeId },
      data: { isActive: true },
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
      where: { businessId, isActive: true },
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
