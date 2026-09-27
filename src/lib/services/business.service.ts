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
import {
  BusinessNotFoundError,
  StoreNotFoundError,
  SubscriptionInactiveError,
  ConflictError,
  ForbiddenError,
} from "@/lib/errors";
import { resolveMarketDefaults } from "@/lib/onboarding/markets";
import {
  StoreLimitReachedError,
  resolveStoreCountryCode,
  resolveStoreCountryColumn,
  resolveFinanceProvisioning,
  provisionStoreInTransaction,
  ensureDraftStorefront,
} from "./store-provisioning";

/** Optional Store columns the Edit store form can empty (sent as "", stored as null). */
const CLEARABLE_STORE_FIELDS = new Set(["address", "city", "country", "phone", "email", "image"]);

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
    /**
     * Type assertion needed because upsert method accepts union type but repository expects specific type
     * Actual type: CreateBusinessInput | UpdateBusinessInput
     * TODO: Create proper type guard or overload repository method
     */
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
   * Locks the business row (SELECT ... FOR UPDATE) before the store-limit and
   * name checks, so concurrent creates for one business run one after the
   * other: they cannot create more stores than the plan allows, or two
   * stores with the same name.
   *
   * IMPORTANT: This method performs the store limit check within the transaction,
   * after taking that lock, to prevent race conditions where multiple requests
   * check the limit simultaneously and both pass validation before either
   * creates a store.
   *
   * Every new store is provisioned (see store-provisioning.ts): an OWNER
   * staff row and its finance settings inside the transaction, a draft
   * storefront right after commit (best-effort).
   */
  async createStore(
    businessId: string,
    userId: string,
    input: CreateStoreInput
  ): Promise<StoreDto> {
    const { countryCode: sentCountryCode, financeSource, ...details } = input;
    // A caller that sends only the free-text country still gets that
    // country's finance settings and its English name in Store.country.
    const countryCode = resolveStoreCountryCode({
      countryCode: sentCountryCode,
      country: details.country,
    });

    // Use transaction to ensure atomicity and prevent race condition
    // (ReadCommitted + the business row lock taken in step 2)
    const created = await prisma.$transaction(
      async (tx) => {
        // 1. Verify business exists and belongs to user
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

        // 2. Lock the business row until commit. A concurrent create for this
        // business waits here; once it gets the lock, its count and name checks
        // below (each statement takes a fresh ReadCommitted snapshot) see the
        // store this transaction committed. Onboarding locks the same row first
        // too (its business upsert), so the two paths can't deadlock.
        await tx.$queryRaw`SELECT id FROM businesses WHERE id = ${businessId} FOR UPDATE`;

        // 3. Check subscription and store limit WITHIN transaction, under the lock
        const subscription = await tx.subscription.findUnique({
          where: { userId },
        });

        if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE) {
          throw new Error("No active subscription found. Please subscribe to create stores.");
        }

        // Count current stores WITHIN transaction (accurate: the business row is locked)
        const currentStoreCount = await tx.store.count({
          where: {
            businessId,
          },
        });

        // Check if user can create more stores
        const limit = getStoreLimit(subscription.plan);
        const allowed = canCreateStore(subscription.plan, currentStoreCount);

        if (!allowed) {
          throw new StoreLimitReachedError(currentStoreCount, limit);
        }

        // 4. Check if store name already exists for this business (within transaction, under the lock)
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

        // 5. Decide its finance settings (checks a copy source belongs to this business)
        const finance = await resolveFinanceProvisioning(tx, {
          businessId,
          input: { countryCode, financeSource },
        });

        // 6. Create store (within transaction). Empty optional fields are stored as null.
        const store = await tx.store.create({
          data: {
            businessId,
            name: details.name,
            address: details.address || undefined,
            city: details.city || undefined,
            country: resolveStoreCountryColumn({ countryCode, country: details.country }),
            phone: details.phone || undefined,
            email: details.email || undefined,
            image: details.image || undefined,
            ...(finance.kind === "sync" && { syncFinanceWithBusiness: true }),
          },
        });

        // 7. OWNER staff row + finance-settings row (within transaction)
        await provisionStoreInTransaction(tx, { storeId: store.id, userId, finance });

        return store as unknown as StoreDto;
      },
      {
        // Use ReadCommitted isolation level (safer than SERIALIZABLE)
        // SERIALIZABLE can cause deadlocks in production environments
        // ReadCommitted plus the business row lock (step 2) is sufficient for preventing race conditions
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 5000, // Maximum time to wait for transaction to start (5s)
        timeout: 10000, // Maximum time for transaction to complete (10s)
      }
    );

    // 8. Draft storefront, after commit. Never fails store creation.
    await ensureDraftStorefront(created.id);

    return created;
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

    // PATCH /api/stores/[id] parses with createStoreSchema.partial(), which
    // also admits the create-only countryCode / financeSource. Neither is a
    // Store column (Prisma would reject the update): countryCode picks the
    // stored country name, financeSource is ignored (finance settings are
    // edited in Fees & Taxes).
    const {
      countryCode,
      financeSource: _financeSource,
      ...columns
    } = input as UpdateStoreInput &
      Partial<Pick<CreateStoreInput, "countryCode" | "financeSource">>;
    if (countryCode) {
      columns.country = resolveStoreCountryColumn({ countryCode, country: columns.country });
    }
    input = columns;

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

    // Sanitize input: an emptied optional field ("" from the Edit store form)
    // clears its column; fields that weren't sent are left as they are. The
    // name can't be emptied (the schema requires it), so "" there is dropped.
    const sanitizedInput = Object.fromEntries(
      Object.entries(input)
        .filter(([key, value]) => value !== undefined && (value !== "" || CLEARABLE_STORE_FIELDS.has(key)))
        .map(([key, value]) => [key, value === "" ? null : value])
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
      } catch (error) {
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
      activeStores: stores.length,
    };
  }

  // ============================================
  // NEW SIMPLIFIED METHODS (for cleaner API routes)
  // ============================================

  /**
   * Create a store for user, auto-creating business if needed.
   *
   * This is the PREFERRED method for creating stores as it:
   * 1. Auto-creates business if missing (better UX)
   * 2. Checks store limits internally
   * 3. Throws typed errors for proper HTTP response mapping
   *
   * @throws BusinessNotFoundError - if business lookup fails after creation
   * @throws StoreLimitExceededError - if store limit is reached
   * @throws SubscriptionInactiveError - if no active subscription
   * @throws ConflictError - if store name already exists
   */
  async createStoreForUser(userId: string, input: CreateStoreInput): Promise<StoreDto> {
    // 1. Get or create business
    let business = await this.businessRepo.findByUserId(userId);

    if (!business) {
      // The store's country, when given (as a code or a recognizable name),
      // is the best guess for the business's clock and language too (both
      // editable later in Profile).
      const storeCountryCode = resolveStoreCountryCode(input);
      const defaults = storeCountryCode
        ? resolveMarketDefaults({ countryCode: storeCountryCode })
        : null;
      business = await this.businessRepo.create({
        userId,
        name: "My Business",
        timezone: defaults?.timezone ?? "UTC",
        locale: defaults?.locale ?? "en",
        ...(defaults?.countryName ? { country: defaults.countryName } : {}),
      });
    }

    // 2. Check subscription and store limit. A fast path only: createStore
    // re-checks both under the business row lock, and that check decides.
    const subscription = await subscriptionRepository.findByUserId(userId);

    if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE) {
      throw new SubscriptionInactiveError();
    }

    const currentStoreCount = await this.storeRepo.count({ businessId: business.id });
    const limit = getStoreLimit(subscription.plan);
    const allowed = canCreateStore(subscription.plan, currentStoreCount);

    if (!allowed) {
      // A StoreLimitExceededError whose message names the Operations plan.
      throw new StoreLimitReachedError(currentStoreCount, limit);
    }

    // 3. Delegate to existing createStore method (handles transaction + name check + provisioning)
    return this.createStore(business.id, userId, input);
  }

  /**
   * Update store for user (handles business lookup internally)
   *
   * @throws BusinessNotFoundError - if user has no business
   * @throws StoreNotFoundError - if store doesn't exist
   * @throws ForbiddenError - if store doesn't belong to user
   */
  async updateStoreForUser(
    storeId: string,
    userId: string,
    input: UpdateStoreInput
  ): Promise<StoreDto> {
    const business = await this.businessRepo.findByUserId(userId);

    if (!business) {
      throw new BusinessNotFoundError();
    }

    return this.updateStore(storeId, business.id, userId, input);
  }

  /**
   * Delete store for user (handles business lookup internally)
   *
   * @throws BusinessNotFoundError - if user has no business
   * @throws StoreNotFoundError - if store doesn't exist
   * @throws ForbiddenError - if store doesn't belong to user
   */
  async deleteStoreForUser(storeId: string, userId: string): Promise<void> {
    const business = await this.businessRepo.findByUserId(userId);

    if (!business) {
      throw new BusinessNotFoundError();
    }

    return this.deleteStore(storeId, business.id, userId);
  }

  /**
   * Get store by ID for user (handles ownership verification)
   *
   * @throws StoreNotFoundError - if store doesn't exist
   * @throws ForbiddenError - if store doesn't belong to user
   */
  async getStoreByIdForUser(storeId: string, userId: string): Promise<StoreDto> {
    const store = await this.storeRepo.findById(storeId);

    if (!store) {
      throw new StoreNotFoundError(storeId);
    }

    // Verify ownership through business
    const business = await this.businessRepo.findByUserId(userId);
    if (!business || store.businessId !== business.id) {
      throw new ForbiddenError("You do not have access to this store");
    }

    return store as unknown as StoreDto;
  }
}

// Export singleton instance
export const businessService = new BusinessService();
