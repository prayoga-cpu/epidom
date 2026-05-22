import { Business, Prisma } from "@prisma/client";
import { BaseRepository } from "./base.repository";
import { BusinessDto, BusinessWithStoresDto } from "@/types/dto";

/**
 * Business Repository
 *
 * Handles all database operations related to businesses.
 */
export class BusinessRepository extends BaseRepository {
  /**
   * Find business by ID
   */
  async findById(businessId: string): Promise<Business | null> {
    return this.db.business.findUnique({
      where: { id: businessId },
    });
  }

  /**
   * Find business by user ID
   */
  async findByUserId(userId: string): Promise<Business | null> {
    return this.db.business.findUnique({
      where: { userId },
    });
  }

  /**
   * Get business with stores
   */
  async getWithStores(businessId: string): Promise<BusinessWithStoresDto | null> {
    return this.db.business.findUnique({
      where: { id: businessId },
      include: {
        stores: {
          orderBy: { createdAt: "desc" },
        },
      },
    }) as unknown as BusinessWithStoresDto | null;
  }

  /**
   * Create a new business
   */
  async create(data: {
    userId: string;
    name: string;
    address?: string;
    city?: string;
    country?: string;
    phone?: string;
    email?: string;
    website?: string;
    logo?: string;
    currency?: string;
    timezone?: string;
    locale?: string;
  }): Promise<Business> {
    return this.db.business.create({
      data,
    });
  }

  /**
   * Update business
   */
  async update(
    businessId: string,
    data: Partial<Omit<Business, "id" | "userId" | "createdAt">>
  ): Promise<Business> {
    return this.db.business.update({
      where: { id: businessId },
      data,
    });
  }

  /**
   * Upsert business (create if doesn't exist, update if exists)
   */
  async upsert(
    userId: string,
    data: Prisma.BusinessCreateWithoutUserInput | Prisma.BusinessUpdateWithoutUserInput
  ): Promise<Business> {
    // If it's an update payload missing name, and the business doesn't exist,
    // Prisma will throw a constraint error, which is expected behavior for a missing required field.
    return this.db.business.upsert({
      where: { userId },
      create: {
        userId,
        ...(data as any),
      },
      update: data as any,
    });
  }

  /**
   * Delete business (cascade deletes stores)
   */
  async delete(businessId: string): Promise<Business> {
    return this.db.business.delete({
      where: { id: businessId },
    });
  }

  /**
   * Check if user has a business
   */
  async userHasBusiness(userId: string): Promise<boolean> {
    const count = await this.db.business.count({
      where: { userId },
    });
    return count > 0;
  }

  /**
   * Count stores for a business
   */
  async countStores(businessId: string): Promise<number> {
    return this.db.store.count({
      where: { businessId },
    });
  }

  /**
   * List businesses with pagination (for admin)
   */
  async list(params: {
    skip?: number;
    take?: number;
    where?: Prisma.BusinessWhereInput;
    orderBy?: Prisma.BusinessOrderByWithRelationInput;
  }): Promise<Business[]> {
    return this.db.business.findMany(params);
  }

  /**
   * Count businesses
   */
  async count(where?: Prisma.BusinessWhereInput): Promise<number> {
    return this.db.business.count({ where });
  }
}

// Export singleton instance
export const businessRepository = new BusinessRepository();
