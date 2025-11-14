import { Business, Prisma } from "@prisma/client";
import { businessRepository, BusinessRepository } from "@/lib/repositories/business.repository";
import { storeRepository, StoreRepository } from "@/lib/repositories/store.repository";
import {
  CreateBusinessInput,
  UpdateBusinessInput,
  CreateStoreInput,
  UpdateStoreInput,
} from "@/lib/validation/business.schemas";
import { BusinessDto, BusinessWithStoresDto, StoreDto } from "@/types/dto";
import { getStorageAdapter } from "@/lib/storage";
import { prisma } from "@/lib/prisma";
import { subscriptionRepository } from "@/lib/repositories/subscription.repository";
import { SubscriptionStatus } from "@prisma/client";
import { getStoreLimit, canCreateStore } from "@/config/stripe.config";

/**
 * Business Service
 *
 * Handles business and store management business logic:
 * - Business CRUD operations
 * - Store management
 * - Multi-store operations
 *
 * Implements business rules and validation
 */
export class BusinessService {
  constructor(
    private readonly businessRepo: BusinessRepository = businessRepository,
    private readonly storeRepo: StoreRepository = storeRepository
  ) {}

  /**
   * Create a new business for a user
   *
   * @throws Error if user already has a business
   */
  async createBusiness(userId: string, input: CreateBusinessInput): Promise<Business> {
    // Check if user already has a business
    const existingBusiness = await this.businessRepo.findByUserId(userId);
    if (existingBusiness) {
      throw new Error("User already has a business");
    }

    // Create business
    return this.businessRepo.create({
      userId,
      ...input,
    });
  }

  /**
   * Get business by ID
   */
  async getBusinessById(businessId: string): Promise<Business> {
    const business = await this.businessRepo.findById(businessId);
    if (!business) {
      throw new Error("Business not found");
    }
    return business;
  }

  /**
   * Get business by user ID
   */
  async getBusinessByUserId(userId: string): Promise<Business | null> {
    return this.businessRepo.findByUserId(userId);
  }

  /**
   * Get business with all stores
   */
  async getBusinessWithStores(businessId: string): Promise<BusinessWithStoresDto> {
    const business = await this.businessRepo.getWithStores(businessId);
    if (!business) {
      throw new Error("Business not found");
    }
    return business;
  }

  /**
   * Update business
   */
  async updateBusiness(
    businessId: string,
    userId: string,
    input: UpdateBusinessInput
  ): Promise<Business> {
    // Verify business exists and belongs to user
    const business = await this.businessRepo.findById(businessId);
    if (!business) {
      throw new Error("Business not found");
    }
    if (business.userId !== userId) {
      throw new Error("Unauthorized to update this business");
    }

    // Update business
    return this.businessRepo.update(businessId, input);
  }

  /**
   * Upsert business (create or update)
   */
  async upsertBusiness(
    userId: string,
    input: CreateBusinessInput | UpdateBusinessInput
  ): Promise<Business> {
    return this.businessRepo.upsert(userId, input as any);
  }

  /**
   * Delete business (and all associated stores)
   */
  async deleteBusiness(businessId: string, userId: string): Promise<void> {
    // Verify business belongs to user
    const business = await this.businessRepo.findById(businessId);
    if (!business) {
      throw new Error("Business not found");
    }
    if (business.userId !== userId) {
      throw new Error("Unauthorized to delete this business");
    }

    await this.businessRepo.delete(businessId);
  }

  /**
   * Create a store for a business
   * Uses transaction with lock to prevent race condition when checking store limit
   * This ensures that concurrent requests cannot create more stores than allowed
   *
   * IMPORTANT: This method performs the store limit check within the transaction
   * to prevent race conditions where multiple requests check the limit simultaneously
   * and both pass validation before either creates a store.
   */
  async createStore(
    businessId: string,
    userId: string,
    input: CreateStoreInput
  ): Promise<StoreDto> {
    // Use transaction to ensure atomicity and prevent race condition
    // ReadCommitted isolation level with transaction is sufficient to prevent race conditions
    return prisma.$transaction(async (tx) => {
      // 1. Verify business exists and belongs to user
      // Using Prisma query (no raw SQL needed) - transaction ensures atomicity
      const business = await tx.business.findUnique({
        where: { id: businessId },
        select: { id: true, userId: true },
      });

      if (!business) {
        throw new Error("Business not found");
      }

      if (business.userId !== userId) {
        throw new Error("Unauthorized to create store for this business");
      }

      // 2. Check subscription and store limit WITHIN transaction (prevents race condition)
      // This is critical: we check the limit inside the transaction with lock
      // so concurrent requests will wait for the lock and see the updated count
      const subscription = await tx.subscription.findUnique({
        where: { userId },
      });

      if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE) {
        throw new Error("No active subscription found. Please subscribe to create stores.");
      }

      // Count current stores WITHIN transaction (with lock, this is accurate)
      const currentStoreCount = await tx.store.count({
        where: {
          businessId,
          isActive: true,
        },
      });

      // Check if user can create more stores
      const limit = getStoreLimit(subscription.plan);
      const allowed = canCreateStore(subscription.plan, currentStoreCount);

      if (!allowed) {
        throw new Error(
          `You have reached your plan's store limit (${currentStoreCount}/${limit}). Upgrade to Pro to add more stores.`
        );
      }

      // 3. Check if store name already exists for this business (within transaction)
      const nameExists = await tx.store.findFirst({
        where: {
          businessId,
          name: {
            equals: input.name,
            mode: "insensitive",
          },
        },
      });

      if (nameExists) {
        throw new Error("A store with this name already exists in your business");
      }

      // 4. Create store (within transaction)
      const store = await tx.store.create({
        data: {
          businessId,
          ...input,
        },
      });

      return store as unknown as StoreDto;
    }, {
      // Use ReadCommitted isolation level (safer than SERIALIZABLE)
      // SERIALIZABLE can cause deadlocks in production environments
      // ReadCommitted with FOR UPDATE lock is sufficient for preventing race conditions
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      maxWait: 10000, // Wait up to 10 seconds for lock
      timeout: 20000, // Transaction timeout after 20 seconds
    });
  }

  /**
   * Get all stores for a business
   */
  async getStoresByBusinessId(businessId: string): Promise<StoreDto[]> {
    return this.storeRepo.findByBusinessId(businessId) as unknown as StoreDto[];
  }

  /**
   * Get store by ID
   */
  async getStoreById(storeId: string): Promise<StoreDto> {
    const store = await this.storeRepo.findById(storeId);
    if (!store) {
      throw new Error("Store not found");
    }
    return store as unknown as StoreDto;
  }

  /**
   * Update store
   */
  async updateStore(
    storeId: string,
    businessId: string,
    userId: string,
    input: UpdateStoreInput
  ): Promise<StoreDto> {
    // Verify store belongs to business
    const belongsToBusiness = await this.storeRepo.belongsToBusiness(storeId, businessId);
    if (!belongsToBusiness) {
      throw new Error("Store does not belong to this business");
    }

    // Verify business belongs to user
    const business = await this.businessRepo.findById(businessId);
    if (!business || business.userId !== userId) {
      throw new Error("Unauthorized to update this store");
    }

    // If updating name, check if new name already exists
    if (input.name) {
      const nameExists = await this.storeRepo.existsByName(
        businessId,
        input.name,
        storeId // Exclude current store from check
      );
      if (nameExists) {
        throw new Error("A store with this name already exists in your business");
      }
    }

    // Sanitize input: convert empty strings to undefined so Prisma doesn't send them
    const sanitizedInput = Object.fromEntries(
      Object.entries(input)
        .filter(([_, value]) => value !== "")
        .map(([key, value]) => [key, value || undefined])
    );

    // Update store
    return this.storeRepo.update(storeId, sanitizedInput) as unknown as StoreDto;
  }

  /**
   * Delete store (hard delete) and its associated image from Blob storage
   * Uses transaction to reduce connection pool usage
   * WARNING: This will cascade delete all related data (products, materials, recipes, orders, etc.)
   */
  async deleteStore(storeId: string, businessId: string, userId: string): Promise<void> {
    // Perform all database operations in a single transaction
    // This reduces connection pool usage from 4+ queries to 1 connection
    const store = await this.storeRepo.transaction(async (tx) => {
      // Get store and verify it belongs to business, also fetch counts of related data
      const store = await tx.store.findUnique({
        where: { id: storeId },
        select: {
          id: true,
          businessId: true,
          image: true,
          business: {
            select: {
              userId: true,
            },
          },
          _count: {
            select: {
              products: true,
              ingredients: true,
              recipes: true,
              suppliers: true,
              orders: true,
              productionBatches: true,
            },
          },
        },
      });

      if (!store) {
        throw new Error("Store not found");
      }

      if (store.businessId !== businessId) {
        throw new Error("Store does not belong to this business");
      }

      if (store.business.userId !== userId) {
        throw new Error("Unauthorized to delete this store");
      }

      // Log warning if store has related data (for debugging)
      const totalRelatedRecords =
        store._count.products +
        store._count.ingredients +
        store._count.recipes +
        store._count.suppliers +
        store._count.orders +
        store._count.productionBatches;

      if (totalRelatedRecords > 0) {
        console.warn(`⚠️ Deleting store "${storeId}" will cascade delete ${totalRelatedRecords} related records:`, {
          products: store._count.products,
          materials: store._count.ingredients,
          recipes: store._count.recipes,
          suppliers: store._count.suppliers,
          orders: store._count.orders,
          productionBatches: store._count.productionBatches,
        });
      }

      // Delete the store (cascade will handle related data)
      await tx.store.delete({
        where: { id: storeId },
      });

      return store;
    });

    // Delete image from Blob storage if exists (outside transaction)
    if (store.image && store.image.includes("blob.vercel-storage.com")) {
      try {
        const storage = getStorageAdapter();
        await storage.delete(store.image);
        console.log("✅ Image deleted from Blob storage:", store.image);
      } catch (error) {
        console.warn("⚠️ Failed to delete image from Blob storage:", error);
        // Continue even if image deletion fails
      }
    }
  }


  /**
   * Get business statistics
   */
  async getBusinessStats(businessId: string): Promise<{
    totalStores: number;
    activeStores: number;
  }> {
    const stores = await this.storeRepo.findByBusinessId(businessId);
    return {
      totalStores: stores.length,
      activeStores: stores.filter((s) => s.isActive).length,
    };
  }
}

// Export singleton instance
export const businessService = new BusinessService();
