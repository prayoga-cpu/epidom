/**
 * Subscription Service Tests
 *
 * Unit tests for subscription business logic.
 */

import { describe, it, expect, vi, beforeEach, type MockedObject } from "vitest";
import { SubscriptionService } from "../subscription.service";
import { SubscriptionPlan, SubscriptionStatus } from "@prisma/client";
import type { SubscriptionRepository } from "@/lib/repositories/subscription.repository";
import type { UserRepository } from "@/lib/repositories/user.repository";
import type { StoreRepository } from "@/lib/repositories/store.repository";
import type { ProductRepository } from "@/lib/repositories/product.repository";
import type { UserProfileDto } from "@/types/dto";

// Mock Stripe
vi.mock("@/lib/stripe", () => ({
  stripe: {
    customers: {
      create: vi.fn().mockResolvedValue({ id: "cus_123" }),
    },
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({
          id: "cs_123",
          url: "https://checkout.stripe.com/session",
        }),
      },
    },
    billingPortal: {
      sessions: {
        create: vi.fn().mockResolvedValue({
          id: "bps_123",
          url: "https://billing.stripe.com/session",
        }),
      },
    },
    subscriptions: {
      list: vi.fn().mockResolvedValue({ data: [] }),
      update: vi.fn().mockResolvedValue({}),
      cancel: vi.fn().mockResolvedValue({}),
    },
  },
}));

// Mock subscription data
const mockSubscription = {
  id: "sub-1",
  userId: "user-1",
  stripeCustomerId: "cus_123",
  stripeSubscriptionId: "sub_stripe_123",
  stripePriceId: "price_123",
  plan: SubscriptionPlan.STARTER,
  status: SubscriptionStatus.ACTIVE,
  currentPeriodStart: new Date(),
  currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  cancelAtPeriodEnd: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockUser = {
  id: "user-1",
  name: "Test User",
  email: "test@example.com",
  emailVerified: true,
  image: null,
  phone: null,
  locale: "en",
  timezone: "UTC",
  currency: "EUR",
  stripeConnectAccountId: null,
  stripeConnectOnboarded: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockUserProfile = {
  ...mockUser,
  business: {
    id: "biz-1",
    name: "Test Business",
  },
  subscription: mockSubscription,
} as unknown as UserProfileDto;

// Mock repositories
const createMockRepos = () => ({
  subscriptionRepo: {
    findByUserId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    cancelAtPeriodEnd: vi.fn(),
  } as unknown as MockedObject<SubscriptionRepository>,
  userRepo: {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    getProfile: vi.fn(),
  } as unknown as MockedObject<UserRepository>,
  storeRepo: {
    count: vi.fn(),
  } as unknown as MockedObject<StoreRepository>,
  productRepo: {
    count: vi.fn(),
  } as unknown as MockedObject<ProductRepository>,
});

describe("SubscriptionService", () => {
  let service: SubscriptionService;
  let mocks: ReturnType<typeof createMockRepos>;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks = createMockRepos();

    // Set env variable for skip connect
    process.env.SKIP_STRIPE_CONNECT = "true";

    service = new SubscriptionService(
      mocks.subscriptionRepo as unknown as SubscriptionRepository,
      mocks.userRepo as unknown as UserRepository,
      mocks.storeRepo as unknown as StoreRepository,
      mocks.productRepo as unknown as ProductRepository
    );
  });

  describe("canCreateStore", () => {
    it("should return false if no subscription", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue(null);

      const result = await service.canCreateStore("user-1");

      expect(result.allowed).toBe(false);
      expect(result.limit).toBe(0);
    });

    it("should return false if subscription is not active", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue({
        ...mockSubscription,
        status: SubscriptionStatus.CANCELED,
      });

      const result = await service.canCreateStore("user-1");

      expect(result.allowed).toBe(false);
    });

    it("should return false if no business found", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue(mockSubscription);
      mocks.userRepo.getProfile.mockResolvedValue({
        ...mockUser,
        business: null,
        subscription: null,
      });

      const result = await service.canCreateStore("user-1");

      expect(result.allowed).toBe(false);
    });

    it("should enforce STARTER plan limit (1 store)", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue({
        ...mockSubscription,
        plan: SubscriptionPlan.STARTER,
      });
      mocks.userRepo.getProfile.mockResolvedValue(mockUserProfile);
      mocks.storeRepo.count.mockResolvedValue(1);

      const result = await service.canCreateStore("user-1");

      expect(result.allowed).toBe(false);
      expect(result.limit).toBe(1);
      expect(result.current).toBe(1);
    });

    it("should allow PRO plan unlimited stores", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue({
        ...mockSubscription,
        plan: SubscriptionPlan.PRO,
      });
      mocks.userRepo.getProfile.mockResolvedValue(mockUserProfile);
      mocks.storeRepo.count.mockResolvedValue(10);

      const result = await service.canCreateStore("user-1");

      expect(result.allowed).toBe(true);
    });
  });

  describe("canCreateProduct", () => {
    it("should return false if no subscription", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue(null);

      const result = await service.canCreateProduct("user-1", "store-1");

      expect(result.allowed).toBe(false);
    });

    it("should enforce STARTER plan limit (500 products)", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue({
        ...mockSubscription,
        plan: SubscriptionPlan.STARTER,
      });
      mocks.productRepo.count.mockResolvedValue(500);

      const result = await service.canCreateProduct("user-1", "store-1");

      expect(result.allowed).toBe(false);
      expect(result.limit).toBe(500);
    });

    it("should allow under limit", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue({
        ...mockSubscription,
        plan: SubscriptionPlan.STARTER,
      });
      mocks.productRepo.count.mockResolvedValue(100);

      const result = await service.canCreateProduct("user-1", "store-1");

      expect(result.allowed).toBe(true);
    });
  });

  describe("hasSupplierManagementAccess", () => {
    it("should return false for STARTER plan", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue({
        ...mockSubscription,
        plan: SubscriptionPlan.STARTER,
      });

      const result = await service.hasSupplierManagementAccess("user-1");

      expect(result).toBe(false);
    });

    it("should return true for PRO plan", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue({
        ...mockSubscription,
        plan: SubscriptionPlan.PRO,
      });

      const result = await service.hasSupplierManagementAccess("user-1");

      expect(result).toBe(true);
    });

    it("should return false if no subscription", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue(null);

      const result = await service.hasSupplierManagementAccess("user-1");

      expect(result).toBe(false);
    });
  });

  describe("hasAdvancedReportsAccess", () => {
    it("should return false for STARTER plan", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue({
        ...mockSubscription,
        plan: SubscriptionPlan.STARTER,
      });

      const result = await service.hasAdvancedReportsAccess("user-1");

      expect(result).toBe(false);
    });

    it("should return true for PRO plan", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue({
        ...mockSubscription,
        plan: SubscriptionPlan.PRO,
      });

      const result = await service.hasAdvancedReportsAccess("user-1");

      expect(result).toBe(true);
    });
  });

  describe("canDowngradeToPlan", () => {
    it("should return true if store count is under target limit", async () => {
      mocks.userRepo.getProfile.mockResolvedValue(mockUserProfile);
      mocks.storeRepo.count.mockResolvedValue(1);

      const result = await service.canDowngradeToPlan("user-1", SubscriptionPlan.STARTER);

      expect(result).toBe(true);
    });

    it("should return false if store count exceeds target limit", async () => {
      mocks.userRepo.getProfile.mockResolvedValue(mockUserProfile);
      mocks.storeRepo.count.mockResolvedValue(5);

      const result = await service.canDowngradeToPlan("user-1", SubscriptionPlan.STARTER);

      expect(result).toBe(false);
    });

    it("should return false if no business found", async () => {
      mocks.userRepo.getProfile.mockResolvedValue({
        ...mockUser,
        business: null,
        subscription: null,
      });

      const result = await service.canDowngradeToPlan("user-1", SubscriptionPlan.STARTER);

      expect(result).toBe(false);
    });
  });

  describe("cancelSubscription", () => {
    it("should throw error if no subscription found", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue(null);

      await expect(service.cancelSubscription("user-1")).rejects.toThrow(
        "Active Subscription not found"
      );
    });

    it("should throw error if no stripe subscription id", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue({
        ...mockSubscription,
        stripeSubscriptionId: null,
      });

      await expect(service.cancelSubscription("user-1")).rejects.toThrow(
        "Active Subscription not found"
      );
    });
  });

  describe("reactivateSubscription", () => {
    it("should throw error if no subscription found", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue(null);

      await expect(service.reactivateSubscription("user-1")).rejects.toThrow(
        "Subscription not found"
      );
    });
  });

  describe("createPortalSession", () => {
    it("should throw error if no subscription found", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue(null);

      await expect(
        service.createPortalSession("user-1", "https://example.com/return")
      ).rejects.toThrow("Subscription not found");
    });
  });
});
