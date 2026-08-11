/**
 * Subscription Service Tests
 *
 * Unit tests for subscription business logic.
 */

import { describe, it, expect, vi, beforeEach, type MockedObject } from "vitest";
import { SubscriptionService } from "../subscription.service";
import { SubscriptionPlan, SubscriptionStatus } from "@prisma/client";
import { stripe } from "@/lib/stripe";
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
      retrieve: vi.fn(),
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
  plan: SubscriptionPlan.POS,
  status: SubscriptionStatus.ACTIVE,
  currentPeriodStart: new Date(),
  currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  trialEndsAt: null,
  cancelAtPeriodEnd: false,
  customPriceAmount: null,
  customPriceCurrency: null,
  customPriceInterval: null,
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
  defaultLanding: "dashboard",
  rememberLastVisited: true,
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

    it("should enforce POS plan limit (1 store)", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue({
        ...mockSubscription,
        plan: SubscriptionPlan.POS,
      });
      mocks.userRepo.getProfile.mockResolvedValue(mockUserProfile);
      mocks.storeRepo.count.mockResolvedValue(1);

      const result = await service.canCreateStore("user-1");

      expect(result.allowed).toBe(false);
      expect(result.limit).toBe(1);
      expect(result.current).toBe(1);
    });

    it("should allow OPERATIONS plan unlimited stores", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue({
        ...mockSubscription,
        plan: SubscriptionPlan.OPERATIONS,
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

    it("should enforce POS plan limit (500 products)", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue({
        ...mockSubscription,
        plan: SubscriptionPlan.POS,
      });
      mocks.productRepo.count.mockResolvedValue(500);

      const result = await service.canCreateProduct("user-1", "store-1");

      expect(result.allowed).toBe(false);
      expect(result.limit).toBe(500);
    });

    it("should allow under limit", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue({
        ...mockSubscription,
        plan: SubscriptionPlan.POS,
      });
      mocks.productRepo.count.mockResolvedValue(100);

      const result = await service.canCreateProduct("user-1", "store-1");

      expect(result.allowed).toBe(true);
    });
  });

  describe("hasSupplierManagementAccess", () => {
    it("should return false for POS plan", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue({
        ...mockSubscription,
        plan: SubscriptionPlan.POS,
      });

      const result = await service.hasSupplierManagementAccess("user-1");

      expect(result).toBe(false);
    });

    it("should return true for OPERATIONS plan", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue({
        ...mockSubscription,
        plan: SubscriptionPlan.OPERATIONS,
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
    it("should return false for POS plan", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue({
        ...mockSubscription,
        plan: SubscriptionPlan.POS,
      });

      const result = await service.hasAdvancedReportsAccess("user-1");

      expect(result).toBe(false);
    });

    it("should return true for OPERATIONS plan", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue({
        ...mockSubscription,
        plan: SubscriptionPlan.OPERATIONS,
      });

      const result = await service.hasAdvancedReportsAccess("user-1");

      expect(result).toBe(true);
    });
  });

  describe("canDowngradeToPlan", () => {
    it("should return true if store count is under target limit", async () => {
      mocks.userRepo.getProfile.mockResolvedValue(mockUserProfile);
      mocks.storeRepo.count.mockResolvedValue(1);

      const result = await service.canDowngradeToPlan("user-1", SubscriptionPlan.POS);

      expect(result).toBe(true);
    });

    it("should return false if store count exceeds target limit", async () => {
      mocks.userRepo.getProfile.mockResolvedValue(mockUserProfile);
      mocks.storeRepo.count.mockResolvedValue(5);

      const result = await service.canDowngradeToPlan("user-1", SubscriptionPlan.POS);

      expect(result).toBe(false);
    });

    it("should return false if no business found", async () => {
      mocks.userRepo.getProfile.mockResolvedValue({
        ...mockUser,
        business: null,
        subscription: null,
      });

      const result = await service.canDowngradeToPlan("user-1", SubscriptionPlan.POS);

      expect(result).toBe(false);
    });
  });

  describe("cancelSubscription", () => {
    it("should throw error if no subscription found", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue(null);

      await expect(service.cancelSubscription("user-1")).rejects.toThrow(
        "No active subscription found"
      );
    });

    it("should throw error if no stripe subscription id", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue({
        ...mockSubscription,
        stripeSubscriptionId: null,
      });

      await expect(service.cancelSubscription("user-1")).rejects.toThrow(
        "No active subscription found"
      );
    });
  });

  describe("reactivateSubscription", () => {
    it("should throw error if no subscription found", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue(null);

      await expect(service.reactivateSubscription("user-1")).rejects.toThrow(
        "No subscription found"
      );
    });
  });

  describe("createPortalSession", () => {
    it("should throw error if no subscription found", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue(null);

      await expect(
        service.createPortalSession("user-1", "https://example.com/return")
      ).rejects.toThrow("No subscription found");
    });
  });

  describe("setCustomPrice", () => {
    it("stores a reference-only price for an admin-granted account without calling Stripe", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue({
        ...mockSubscription,
        stripeCustomerId: "admin_user-1",
      });
      mocks.subscriptionRepo.update.mockResolvedValue({
        ...mockSubscription,
        stripeCustomerId: "admin_user-1",
        customPriceAmount: 100,
        customPriceCurrency: "EUR",
        customPriceInterval: "MONTHLY",
      } as any);

      await service.setCustomPrice("user-1", {
        amount: 100,
        currency: "EUR",
        interval: "MONTHLY",
      });

      expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
      expect(stripe.subscriptions.update).not.toHaveBeenCalled();
      const [, data] = mocks.subscriptionRepo.update.mock.calls[0];
      expect(String(data.customPriceAmount)).toBe("100");
      expect(data.customPriceCurrency).toBe("EUR");
      expect(data.customPriceInterval).toBe("MONTHLY");
    });

    it("stores a reference-only price for a free-tier account without calling Stripe", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue({
        ...mockSubscription,
        stripeCustomerId: "free_user-1",
      });
      mocks.subscriptionRepo.update.mockResolvedValue(mockSubscription);

      await service.setCustomPrice("user-1", {
        amount: 50,
        currency: "USD",
        interval: "YEARLY",
      });

      expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
      expect(stripe.subscriptions.update).not.toHaveBeenCalled();
    });

    it("applies a live Stripe price override for a real Stripe-billed account", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue(mockSubscription);
      mocks.subscriptionRepo.update.mockResolvedValue(mockSubscription);
      (stripe.subscriptions.retrieve as any).mockResolvedValue({
        items: {
          data: [{ id: "si_123", price: { product: "prod_123" } }],
        },
      });

      await service.setCustomPrice("user-1", {
        amount: 75,
        currency: "EUR",
        interval: "MONTHLY",
      });

      expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith("sub_stripe_123");
      expect(stripe.subscriptions.update).toHaveBeenCalledWith(
        "sub_stripe_123",
        expect.objectContaining({
          items: [
            expect.objectContaining({
              id: "si_123",
              price_data: expect.objectContaining({
                currency: "eur",
                unit_amount: 7500,
                recurring: { interval: "month" },
                product: "prod_123",
              }),
            }),
          ],
          proration_behavior: "none",
        })
      );
    });

    it("throws a 422 AppError when the account has no active Stripe subscription", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue({
        ...mockSubscription,
        stripeSubscriptionId: null,
      });

      await expect(
        service.setCustomPrice("user-1", { amount: 10, currency: "EUR", interval: "MONTHLY" })
      ).rejects.toThrow(
        "This account has no active Stripe subscription to apply a live price override to."
      );
      expect(stripe.subscriptions.update).not.toHaveBeenCalled();
    });
  });

  describe("clearCustomPrice", () => {
    it("nulls the custom price fields for an admin-granted account without calling Stripe", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue({
        ...mockSubscription,
        stripeCustomerId: "admin_user-1",
        customPriceAmount: 100,
      } as any);
      mocks.subscriptionRepo.update.mockResolvedValue(mockSubscription);

      await service.clearCustomPrice("user-1");

      expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
      expect(mocks.subscriptionRepo.update).toHaveBeenCalledWith("user-1", {
        customPriceAmount: null,
        customPriceCurrency: null,
        customPriceInterval: null,
      });
    });

    it("restores the catalog price for a real Stripe-billed account on a paid plan", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue({
        ...mockSubscription,
        plan: SubscriptionPlan.POS,
        customPriceAmount: 75,
      } as any);
      mocks.subscriptionRepo.update.mockResolvedValue(mockSubscription);
      (stripe.subscriptions.retrieve as any).mockResolvedValue({
        items: { data: [{ id: "si_123", price: { product: "prod_123" } }] },
      });

      await service.clearCustomPrice("user-1");

      expect(stripe.subscriptions.update).toHaveBeenCalledWith(
        "sub_stripe_123",
        expect.objectContaining({ items: [{ id: "si_123", price: expect.any(String) }] })
      );
    });
  });
});
