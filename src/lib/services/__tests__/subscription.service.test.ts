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
      retrieve: vi.fn().mockResolvedValue({ id: "cus_123", deleted: false }),
    },
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({
          id: "cs_123",
          url: "https://checkout.stripe.com/session",
        }),
        list: vi.fn().mockResolvedValue({ data: [] }),
        expire: vi.fn().mockResolvedValue({}),
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
      create: vi.fn(),
    },
  },
}));

// A partner's referral discount (tested on its own); none unless a test asks.
vi.mock("@/lib/services/referral-discount.service", () => ({
  getCheckoutReferralDiscount: vi.fn().mockResolvedValue(null),
}));
import { getCheckoutReferralDiscount } from "@/lib/services/referral-discount.service";

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
  customPricePlan: null,
  customPricePendingAt: null,
  customPricePrevStatus: null,
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

    it("should allow an OPERATIONS plan up to three stores", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue({
        ...mockSubscription,
        plan: SubscriptionPlan.OPERATIONS,
      });
      mocks.userRepo.getProfile.mockResolvedValue(mockUserProfile);
      mocks.storeRepo.count.mockResolvedValue(2);

      const result = await service.canCreateStore("user-1");

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(3);
    });

    // A fourth outlet is an Enterprise conversation, not an Operations one.
    it("should stop an OPERATIONS plan at three stores", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue({
        ...mockSubscription,
        plan: SubscriptionPlan.OPERATIONS,
      });
      mocks.userRepo.getProfile.mockResolvedValue(mockUserProfile);
      mocks.storeRepo.count.mockResolvedValue(3);

      const result = await service.canCreateStore("user-1");

      expect(result.allowed).toBe(false);
      expect(result.limit).toBe(3);
    });

    it("should allow an ENTERPRISE plan unlimited stores", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue({
        ...mockSubscription,
        plan: SubscriptionPlan.ENTERPRISE,
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

    it("clears cancel_at_period_end for a cancellation made in the app", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue(mockSubscription);
      (stripe.subscriptions.retrieve as any).mockResolvedValue({
        cancel_at_period_end: true,
        cancel_at: 1792592000,
      });

      await service.reactivateSubscription("user-1");

      expect(stripe.subscriptions.update).toHaveBeenCalledWith("sub_stripe_123", {
        cancel_at_period_end: false,
      });
      expect(mocks.subscriptionRepo.update).toHaveBeenCalledWith("user-1", {
        cancelAtPeriodEnd: false,
      });
    });

    it("unsets cancel_at for a portal cancellation on a flexible billing-mode subscription", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue(mockSubscription);
      (stripe.subscriptions.retrieve as any).mockResolvedValue({
        cancel_at_period_end: false,
        cancel_at: 1792592000,
      });

      await service.reactivateSubscription("user-1");

      expect(stripe.subscriptions.update).toHaveBeenCalledWith("sub_stripe_123", {
        cancel_at: "",
      });
    });
  });

  describe("createPortalSession", () => {
    it("should throw error if no subscription found", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue(null);

      await expect(
        service.createPortalSession("user-1", "https://example.com/return")
      ).rejects.toThrow("No subscription found");
    });

    it("refuses an admin-granted account, which has no Stripe customer", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue({
        ...mockSubscription,
        stripeCustomerId: "admin_user-1",
      });

      await expect(
        service.createPortalSession("user-1", "https://example.com/return")
      ).rejects.toThrow("Cannot manage billing portal");
      expect(stripe.billingPortal.sessions.create).not.toHaveBeenCalled();
    });

    it("replaces a customer the current Stripe account doesn't know (previous account)", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue({
        ...mockSubscription,
        stripeCustomerId: "cus_old_account",
      });
      mocks.userRepo.findById.mockResolvedValue({
        id: "user-1",
        email: "a@b.co",
        name: "A",
      } as any);
      (stripe.customers.retrieve as any).mockRejectedValueOnce(
        Object.assign(new Error("No such customer: 'cus_old_account'"), {
          code: "resource_missing",
        })
      );
      (stripe.customers.create as any).mockResolvedValueOnce({ id: "cus_new_account" });

      await service.createPortalSession("user-1", "https://example.com/return");

      expect(mocks.subscriptionRepo.update).toHaveBeenCalledWith("user-1", {
        stripeCustomerId: "cus_new_account",
      });
      expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith({
        customer: "cus_new_account",
        return_url: "https://example.com/return",
      });
    });

    it("keeps the stored customer when Stripe fails for another reason", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue({
        ...mockSubscription,
        stripeCustomerId: "cus_live_customer",
      });
      mocks.userRepo.findById.mockResolvedValue({
        id: "user-1",
        email: "a@b.co",
        name: "A",
      } as any);
      (stripe.customers.retrieve as any).mockRejectedValueOnce(
        Object.assign(new Error("An error occurred with our connection to Stripe."), {
          type: "StripeConnectionError",
        })
      );

      await expect(
        service.createPortalSession("user-1", "https://example.com/return")
      ).rejects.toThrow("connection to Stripe");
      expect(stripe.customers.create).not.toHaveBeenCalled();
      expect(mocks.subscriptionRepo.update).not.toHaveBeenCalled();
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
        plan: SubscriptionPlan.OPERATIONS,
      });

      expect(stripe.subscriptions.cancel).not.toHaveBeenCalled();
      expect(stripe.subscriptions.update).not.toHaveBeenCalled();
      const [, data] = mocks.subscriptionRepo.update.mock.calls[0];
      expect(String(data.customPriceAmount)).toBe("100");
      expect(data.customPriceCurrency).toBe("EUR");
      expect(data.customPriceInterval).toBe("MONTHLY");
      expect(data.customPricePlan).toBe(SubscriptionPlan.OPERATIONS);
      // Reference-only: a BETA account keeps its access and its status.
      expect(data.customPricePendingAt).toBeUndefined();
      expect(data.status).toBeUndefined();
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
        plan: SubscriptionPlan.POS,
      });

      expect(stripe.subscriptions.cancel).not.toHaveBeenCalled();
      expect(stripe.subscriptions.update).not.toHaveBeenCalled();
      const [, data] = mocks.subscriptionRepo.update.mock.calls[0];
      expect(data.customPricePendingAt).toBeUndefined();
    });

    it("cancels the running subscription and suspends a real Stripe-billed account", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue(mockSubscription);
      mocks.subscriptionRepo.update.mockResolvedValue(mockSubscription);

      await service.setCustomPrice("user-1", {
        amount: 75,
        currency: "EUR",
        interval: "MONTHLY",
        plan: SubscriptionPlan.ENTERPRISE,
      });

      expect(stripe.subscriptions.cancel).toHaveBeenCalledWith("sub_stripe_123", {
        prorate: false,
      });
      const [, data] = mocks.subscriptionRepo.update.mock.calls[0];
      expect(String(data.customPriceAmount)).toBe("75");
      expect(data.customPricePlan).toBe(SubscriptionPlan.ENTERPRISE);
      expect(data.customPricePendingAt).toBeInstanceOf(Date);
      expect(data.status).toBe(SubscriptionStatus.INCOMPLETE);
      // The status to hand back if the operator withdraws the quote.
      expect(data.customPricePrevStatus).toBe(SubscriptionStatus.ACTIVE);
      // The canceled subscription must not be reused by the next webhook.
      expect(data.stripeSubscriptionId).toBeNull();
    });

    it("keeps the pre-offer status when re-quoting an already pending account", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue({
        ...mockSubscription,
        status: SubscriptionStatus.INCOMPLETE,
        stripeSubscriptionId: null,
        customPricePendingAt: new Date("2026-08-01"),
        customPricePrevStatus: SubscriptionStatus.ACTIVE,
      });
      mocks.subscriptionRepo.update.mockResolvedValue(mockSubscription);

      await service.setCustomPrice("user-1", {
        amount: 60,
        currency: "EUR",
        interval: "MONTHLY",
        plan: SubscriptionPlan.OPERATIONS,
      });

      expect(stripe.subscriptions.cancel).not.toHaveBeenCalled();
      const [, data] = mocks.subscriptionRepo.update.mock.calls[0];
      expect(data.customPricePrevStatus).toBe(SubscriptionStatus.ACTIVE);
    });

    it("still records the offer when the Stripe subscription is already gone", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue(mockSubscription);
      mocks.subscriptionRepo.update.mockResolvedValue(mockSubscription);
      (stripe.subscriptions.cancel as any).mockRejectedValueOnce(new Error("No such subscription"));

      await service.setCustomPrice("user-1", {
        amount: 20,
        currency: "EUR",
        interval: "MONTHLY",
        plan: SubscriptionPlan.POS,
      });

      const [, data] = mocks.subscriptionRepo.update.mock.calls[0];
      expect(data.customPricePendingAt).toBeInstanceOf(Date);
      expect(data.status).toBe(SubscriptionStatus.INCOMPLETE);
    });
  });

  describe("activateFree", () => {
    const upsert = vi.fn();

    beforeEach(() => {
      upsert.mockReset();
      mocks.subscriptionRepo.findByUserId.mockResolvedValue(null);
      // activateFree writes through the repository's client, not a repo method.
      (mocks.subscriptionRepo as any).db = { subscription: { upsert } };
    });

    // The guard test used to pass ENTERPRISE; activateFree now refuses any
    // non-FREE plan before it looks at the account, so it uses the real
    // self-service plan. The ENTERPRISE variant lives under
    // grantPlanWithoutPayment below.
    it("refuses to reactivate an account that owes an admin-quoted price", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue({
        ...mockSubscription,
        status: SubscriptionStatus.INCOMPLETE,
        customPricePendingAt: new Date(),
      });

      await expect(service.activateFree("user-1", SubscriptionPlan.FREE)).rejects.toMatchObject({
        message: expect.stringContaining("A custom price is awaiting payment on this account."),
        statusCode: 409,
      });
      expect(upsert).not.toHaveBeenCalled();
    });

    it("provisions FREE as ACTIVE with the placeholder customer id and a lifetime period", async () => {
      await service.activateFree("user-1", SubscriptionPlan.FREE);

      expect(upsert).toHaveBeenCalledTimes(1);
      expect(upsert).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        update: { plan: SubscriptionPlan.FREE, status: SubscriptionStatus.ACTIVE },
        create: {
          userId: "user-1",
          stripeCustomerId: "free_user-1",
          plan: SubscriptionPlan.FREE,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: expect.any(Date),
          currentPeriodEnd: expect.any(Date),
        },
      });
    });

    it("defaults to FREE when no plan is given", async () => {
      await service.activateFree("user-1");

      expect(upsert.mock.calls[0][0].update.plan).toBe(SubscriptionPlan.FREE);
      expect(upsert.mock.calls[0][0].create.plan).toBe(SubscriptionPlan.FREE);
    });

    it.each([SubscriptionPlan.POS, SubscriptionPlan.OPERATIONS, SubscriptionPlan.ENTERPRISE])(
      "refuses %s and writes nothing",
      async (plan) => {
        await expect(service.activateFree("user-1", plan as never)).rejects.toMatchObject({
          name: "AppError",
          code: "FORBIDDEN",
          statusCode: 403,
          message: "Only the FREE plan can be activated without payment.",
        });

        expect(mocks.subscriptionRepo.findByUserId).not.toHaveBeenCalled();
        expect(upsert).not.toHaveBeenCalled();
      }
    );

    it.each([null, "free", "PRO", ""])("refuses the non-enum value %j", async (plan) => {
      await expect(service.activateFree("user-1", plan as never)).rejects.toMatchObject({
        statusCode: 403,
      });
      expect(upsert).not.toHaveBeenCalled();
    });

    it("has no flag a forwarded request body could use to unlock a paid plan", async () => {
      // A future caller might spread untrusted input into extra arguments;
      // activateFree ignores them and still refuses.
      await expect(
        (service as any).activateFree("user-1", SubscriptionPlan.ENTERPRISE, { privileged: true })
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(upsert).not.toHaveBeenCalled();
    });
  });

  describe("grantPlanWithoutPayment", () => {
    const upsert = vi.fn();

    beforeEach(() => {
      upsert.mockReset();
      mocks.subscriptionRepo.findByUserId.mockResolvedValue(null);
      (mocks.subscriptionRepo as any).db = { subscription: { upsert } };
    });

    it("provisions the requested paid plan as ACTIVE with the same upsert shape as FREE", async () => {
      await service.grantPlanWithoutPayment("user-1", SubscriptionPlan.OPERATIONS);

      expect(upsert).toHaveBeenCalledTimes(1);
      expect(upsert).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        update: { plan: SubscriptionPlan.OPERATIONS, status: SubscriptionStatus.ACTIVE },
        create: {
          userId: "user-1",
          stripeCustomerId: "free_user-1",
          plan: SubscriptionPlan.OPERATIONS,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: expect.any(Date),
          currentPeriodEnd: expect.any(Date),
        },
      });
    });

    it("still refuses an account that owes an admin-quoted price", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue({
        ...mockSubscription,
        status: SubscriptionStatus.INCOMPLETE,
        customPricePendingAt: new Date(),
      });

      await expect(
        service.grantPlanWithoutPayment("user-1", SubscriptionPlan.ENTERPRISE)
      ).rejects.toThrow("A custom price is awaiting payment on this account.");
      expect(upsert).not.toHaveBeenCalled();
    });
  });

  describe("createCheckoutSession", () => {
    it("lets the Stripe Dashboard choose the payment methods, so PayPal can be offered", async () => {
      mocks.userRepo.findById.mockResolvedValue(mockUser as any);
      mocks.subscriptionRepo.findByUserId.mockResolvedValue(mockSubscription);

      await service.createCheckoutSession(
        "user-1",
        "OPERATIONS",
        "https://app.test/checkout/success",
        "https://app.test/checkout/failed?reason=canceled",
        true
      );

      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: "cus_123",
          mode: "subscription",
          line_items: [{ price: expect.any(String), quantity: 1 }],
          metadata: { userId: "user-1", plan: "OPERATIONS" },
        })
      );
      const params = vi.mocked(stripe.checkout.sessions.create).mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(params).not.toHaveProperty("payment_method_types");
    });

    it("a referral-link customer's checkout carries the one-time coupon", async () => {
      mocks.userRepo.findById.mockResolvedValue(mockUser as any);
      mocks.subscriptionRepo.findByUserId.mockResolvedValue(null);
      vi.mocked(getCheckoutReferralDiscount).mockResolvedValueOnce({
        couponId: "epidom-ref-once-10",
        percent: 10,
      });

      await service.createCheckoutSession("user-1", "OPERATIONS", "https://a/s", "https://a/c");

      const params = vi.mocked(stripe.checkout.sessions.create).mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(params.discounts).toEqual([{ coupon: "epidom-ref-once-10" }]);
      expect(params.metadata).toEqual({ userId: "user-1", plan: "OPERATIONS" });
    });

    it("a failed referral lookup never blocks the checkout", async () => {
      mocks.userRepo.findById.mockResolvedValue(mockUser as any);
      mocks.subscriptionRepo.findByUserId.mockResolvedValue(null);
      vi.mocked(getCheckoutReferralDiscount).mockRejectedValueOnce(new Error("Stripe down"));

      await service.createCheckoutSession("user-1", "POS", "https://a/s", "https://a/c");

      const params = vi.mocked(stripe.checkout.sessions.create).mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(params).not.toHaveProperty("discounts");
    });

    it("never adds a trial: the POS trial starts without Checkout", async () => {
      mocks.userRepo.findById.mockResolvedValue(mockUser as any);
      mocks.subscriptionRepo.findByUserId.mockResolvedValue(null);

      await service.createCheckoutSession("user-1", "POS", "https://a/s", "https://a/c");

      const params = vi.mocked(stripe.checkout.sessions.create).mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(params.subscription_data).toEqual({ metadata: { userId: "user-1", plan: "POS" } });
      expect(params).not.toHaveProperty("payment_method_collection");
    });

    it("charges in the currency the page quoted, not the one Stripe guesses from the IP", async () => {
      mocks.userRepo.findById.mockResolvedValue(mockUser as any);
      mocks.subscriptionRepo.findByUserId.mockResolvedValue(mockSubscription);

      await service.createCheckoutSession(
        "user-1",
        "POS",
        "https://a/s",
        "https://a/c",
        false,
        "EUR"
      );

      expect(stripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({ currency: "eur", customer: "cus_123" })
      );
    });

    it("leaves the currency to Stripe when none is given", async () => {
      mocks.userRepo.findById.mockResolvedValue(mockUser as any);
      mocks.subscriptionRepo.findByUserId.mockResolvedValue(mockSubscription);

      await service.createCheckoutSession("user-1", "POS", "https://a/s", "https://a/c");

      const params = vi.mocked(stripe.checkout.sessions.create).mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(params).not.toHaveProperty("currency");
    });

    it("expires the customer's open subscription Checkouts first", async () => {
      mocks.userRepo.findById.mockResolvedValue(mockUser as any);
      mocks.subscriptionRepo.findByUserId.mockResolvedValue(mockSubscription);
      vi.mocked(stripe.checkout.sessions.list).mockResolvedValueOnce({
        data: [
          { id: "cs_old_idr", mode: "subscription" },
          { id: "cs_setup", mode: "setup" },
        ],
      } as any);

      await service.createCheckoutSession(
        "user-1",
        "POS",
        "https://a/s",
        "https://a/c",
        false,
        "EUR"
      );

      expect(stripe.checkout.sessions.list).toHaveBeenCalledWith({
        customer: "cus_123",
        status: "open",
        limit: 100,
      });
      expect(stripe.checkout.sessions.expire).toHaveBeenCalledTimes(1);
      expect(stripe.checkout.sessions.expire).toHaveBeenCalledWith("cs_old_idr");
      expect(vi.mocked(stripe.checkout.sessions.expire).mock.invocationCallOrder[0]).toBeLessThan(
        vi.mocked(stripe.checkout.sessions.create).mock.invocationCallOrder[0]
      );
    });

    it("still opens Checkout when the open sessions can't be listed", async () => {
      mocks.userRepo.findById.mockResolvedValue(mockUser as any);
      mocks.subscriptionRepo.findByUserId.mockResolvedValue(mockSubscription);
      vi.mocked(stripe.checkout.sessions.list).mockRejectedValueOnce(new Error("rate limited"));

      const session = await service.createCheckoutSession(
        "user-1",
        "POS",
        "https://a/s",
        "https://a/c",
        false,
        "EUR"
      );

      expect(session.id).toBe("cs_123");
    });

    it("keeps the customer's existing currency when Stripe won't mix currencies", async () => {
      mocks.userRepo.findById.mockResolvedValue(mockUser as any);
      mocks.subscriptionRepo.findByUserId.mockResolvedValue(mockSubscription);
      vi.mocked(stripe.checkout.sessions.create).mockRejectedValueOnce(
        new Error(
          "You cannot combine currencies on a single customer. This customer has an active subscription with currency idr."
        )
      );

      const session = await service.createCheckoutSession(
        "user-1",
        "POS",
        "https://a/s",
        "https://a/c",
        false,
        "EUR"
      );

      expect(session.id).toBe("cs_123");
      const [first, retry] = vi
        .mocked(stripe.checkout.sessions.create)
        .mock.calls.map((call) => call[0] as Record<string, unknown>);
      expect(first.currency).toBe("eur");
      expect(retry).not.toHaveProperty("currency");
    });

    it("surfaces any other Stripe error", async () => {
      mocks.userRepo.findById.mockResolvedValue(mockUser as any);
      mocks.subscriptionRepo.findByUserId.mockResolvedValue(mockSubscription);
      vi.mocked(stripe.checkout.sessions.create).mockRejectedValueOnce(new Error("No such price"));

      await expect(
        service.createCheckoutSession(
          "user-1",
          "POS",
          "https://a/s",
          "https://a/c",
          false,
          "EUR"
        )
      ).rejects.toThrow("No such price");
      expect(stripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
    });
  });

  describe("startPosTrial", () => {
    const freeRow = {
      ...mockSubscription,
      stripeCustomerId: "free_user-1",
      stripeSubscriptionId: null,
      plan: SubscriptionPlan.FREE,
    };
    const trialing = {
      id: "sub_trial_1",
      status: "trialing",
      trial_end: 1_800_000_000,
      discounts: [],
      items: {
        data: [
          {
            price: { id: "price_pos_m" },
            current_period_start: 1_798_790_400,
            current_period_end: 1_800_000_000,
          },
        ],
      },
    };

    beforeEach(() => {
      mocks.userRepo.findById.mockResolvedValue(mockUser as any);
      vi.mocked(stripe.subscriptions.create).mockResolvedValue(trialing as any);
    });

    it("starts a 14-day trial with no card that Stripe cancels if none is added", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue(freeRow);

      const created = await service.startPosTrial("user-1", false, "EUR");

      expect(created.id).toBe("sub_trial_1");
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
      const [params, options] = vi.mocked(stripe.subscriptions.create).mock.calls[0];
      expect(params).toEqual({
        customer: "cus_123",
        items: [{ price: expect.any(String) }],
        trial_period_days: 14,
        trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
        payment_settings: { save_default_payment_method: "on_subscription" },
        metadata: { userId: "user-1", plan: "POS" },
        currency: "eur",
      });
      expect(params).not.toHaveProperty("default_payment_method");
      // A double click gets the same subscription back.
      expect(options).toEqual({ idempotencyKey: "pos-trial:cus_123:monthly:EUR" });
    });

    it("puts POS on the row at once, ACTIVE until the trial's end", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue(freeRow);

      await service.startPosTrial("user-1", false, "EUR");

      expect(mocks.subscriptionRepo.update).toHaveBeenLastCalledWith("user-1", {
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_trial_1",
        stripePriceId: "price_pos_m",
        plan: SubscriptionPlan.POS,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(1_798_790_400 * 1000),
        currentPeriodEnd: new Date(1_800_000_000 * 1000),
        trialEndsAt: new Date(1_800_000_000 * 1000),
        cancelAtPeriodEnd: false,
      });
    });

    it("creates the row when the account has none yet", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue(null);

      await service.startPosTrial("user-1");

      expect(mocks.subscriptionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          stripeSubscriptionId: "sub_trial_1",
          plan: SubscriptionPlan.POS,
          status: SubscriptionStatus.ACTIVE,
        })
      );
      const params = vi.mocked(stripe.subscriptions.create).mock.calls[0][0] as unknown as Record<
        string,
        unknown
      >;
      expect(params).not.toHaveProperty("currency");
    });

    it("adds a referral coupon after creation, so the $0 trial invoice can't use it up", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue(freeRow);
      vi.mocked(getCheckoutReferralDiscount).mockResolvedValueOnce({
        couponId: "epidom-ref-once-10",
        percent: 10,
      });

      await service.startPosTrial("user-1", false, "EUR");

      const params = vi.mocked(stripe.subscriptions.create).mock.calls[0][0] as unknown as Record<
        string,
        unknown
      >;
      expect(params).not.toHaveProperty("discounts");
      expect(stripe.subscriptions.update).toHaveBeenCalledWith("sub_trial_1", {
        discounts: [{ coupon: "epidom-ref-once-10" }],
      });
    });

    it("keeps the customer's existing currency when Stripe won't mix currencies", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue(freeRow);
      vi.mocked(stripe.subscriptions.create)
        .mockRejectedValueOnce(new Error("You cannot combine currencies on a single customer."))
        .mockResolvedValueOnce(trialing as any);

      await service.startPosTrial("user-1", true, "EUR");

      const [first, retry] = vi.mocked(stripe.subscriptions.create).mock.calls;
      expect((first[0] as unknown as Record<string, unknown>).currency).toBe("eur");
      expect(retry[0]).not.toHaveProperty("currency");
      expect(retry[1]).toEqual({ idempotencyKey: "pos-trial:cus_123:yearly:default" });
    });

    it("refuses an account that owes an admin-quoted price", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue({
        ...freeRow,
        status: SubscriptionStatus.INCOMPLETE,
        customPricePendingAt: new Date(),
      });

      await expect(service.startPosTrial("user-1")).rejects.toThrow(
        "A custom price is awaiting payment on this account."
      );
      expect(stripe.subscriptions.create).not.toHaveBeenCalled();
    });

    it("surfaces any other Stripe error and leaves the row alone", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue(mockSubscription);
      vi.mocked(stripe.subscriptions.create).mockRejectedValueOnce(new Error("No such price"));

      await expect(service.startPosTrial("user-1", false, "EUR")).rejects.toThrow("No such price");
      expect(mocks.subscriptionRepo.create).not.toHaveBeenCalled();
      expect(mocks.subscriptionRepo.update).not.toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({ plan: SubscriptionPlan.POS })
      );
    });
  });

  describe("hasPaymentMethod", () => {
    it("is false without a Stripe subscription", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue({
        ...mockSubscription,
        stripeSubscriptionId: null,
      });
      expect(await service.hasPaymentMethod("user-1")).toBe(false);
      expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
    });

    it("reads the subscription's card, then the customer's default", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue(mockSubscription);
      const customer = (pm: string | null) => ({
        id: "cus_123",
        deleted: undefined,
        invoice_settings: { default_payment_method: pm },
      });
      vi.mocked(stripe.subscriptions.retrieve)
        .mockResolvedValueOnce({
          default_payment_method: "pm_sub",
          customer: customer(null),
        } as any)
        .mockResolvedValueOnce({
          default_payment_method: null,
          customer: customer("pm_cus"),
        } as any)
        .mockResolvedValueOnce({ default_payment_method: null, customer: customer(null) } as any);

      expect(await service.hasPaymentMethod("user-1")).toBe(true);
      expect(await service.hasPaymentMethod("user-1")).toBe(true);
      expect(await service.hasPaymentMethod("user-1")).toBe(false);
      expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith("sub_stripe_123", {
        expand: ["customer"],
      });
    });
  });

  describe("createPaymentMethodSession", () => {
    it("opens the portal straight on adding a payment method", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue(mockSubscription);

      await service.createPaymentMethodSession("user-1", "https://app.test/store/s1/billing");

      expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith({
        customer: "cus_123",
        return_url: "https://app.test/store/s1/billing",
        flow_data: {
          type: "payment_method_update",
          after_completion: {
            type: "redirect",
            redirect: { return_url: "https://app.test/store/s1/billing" },
          },
        },
      });
    });

    it("falls back to the portal home when the shortcut is refused", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue(mockSubscription);
      vi.mocked(stripe.billingPortal.sessions.create).mockRejectedValueOnce(
        new Error("This feature is disabled in your portal configuration")
      );

      const session = await service.createPaymentMethodSession("user-1", "https://app.test/b");

      expect(session.url).toBe("https://billing.stripe.com/session");
      expect(vi.mocked(stripe.billingPortal.sessions.create).mock.calls[1][0]).toEqual({
        customer: "cus_123",
        return_url: "https://app.test/b",
      });
    });

    it("refuses an account with no Stripe customer", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue({
        ...mockSubscription,
        stripeCustomerId: "free_user-1",
      });
      await expect(
        service.createPaymentMethodSession("user-1", "https://app.test/b")
      ).rejects.toThrow("No Stripe billing on this account");
    });
  });

  describe("createCustomPriceCheckoutSession", () => {
    const pendingSubscription = {
      ...mockSubscription,
      stripeSubscriptionId: null,
      status: SubscriptionStatus.INCOMPLETE,
      customPriceAmount: 42.5,
      customPriceCurrency: "EUR",
      customPriceInterval: "MONTHLY",
      customPricePlan: SubscriptionPlan.OPERATIONS,
      customPricePendingAt: new Date(),
      customPricePrevStatus: SubscriptionStatus.ACTIVE,
    } as any;

    it("bills the quoted amount as an ad-hoc price tagged for the webhook", async () => {
      mocks.userRepo.findById.mockResolvedValue(mockUser as any);
      mocks.subscriptionRepo.findByUserId.mockResolvedValue(pendingSubscription);
      (stripe.customers.retrieve as any).mockResolvedValue({ id: "cus_123", deleted: false });

      await service.createCustomPriceCheckoutSession(
        "user-1",
        "https://app.test/billing?success=true",
        "https://app.test/billing?canceled=true"
      );

      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: "cus_123",
          mode: "subscription",
          line_items: [
            expect.objectContaining({
              price_data: expect.objectContaining({
                currency: "eur",
                unit_amount: 4250,
                recurring: { interval: "month" },
              }),
            }),
          ],
          metadata: { userId: "user-1", plan: "OPERATIONS", customPrice: "true" },
          subscription_data: {
            metadata: { userId: "user-1", plan: "OPERATIONS", customPrice: "true" },
          },
        })
      );
      const params = vi.mocked(stripe.checkout.sessions.create).mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(params).not.toHaveProperty("payment_method_types");
      // An open catalog Checkout in another currency would make Stripe refuse this one.
      expect(stripe.checkout.sessions.list).toHaveBeenCalledWith(
        expect.objectContaining({ customer: "cus_123", status: "open" })
      );
    });

    it("rejects when no custom price is awaiting payment", async () => {
      mocks.userRepo.findById.mockResolvedValue(mockUser as any);
      mocks.subscriptionRepo.findByUserId.mockResolvedValue(mockSubscription);

      await expect(
        service.createCustomPriceCheckoutSession("user-1", "https://a/s", "https://a/c")
      ).rejects.toThrow("No custom price is awaiting payment on this account.");
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
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
        customPricePlan: null,
        customPricePendingAt: null,
        customPricePrevStatus: null,
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

    it("withdrawing a pending quote hands back the status the account had before it", async () => {
      mocks.subscriptionRepo.findByUserId.mockResolvedValue({
        ...mockSubscription,
        stripeSubscriptionId: null,
        status: SubscriptionStatus.INCOMPLETE,
        customPriceAmount: 75,
        customPricePlan: SubscriptionPlan.ENTERPRISE,
        customPricePendingAt: new Date(),
        customPricePrevStatus: SubscriptionStatus.ACTIVE,
      } as any);
      mocks.subscriptionRepo.update.mockResolvedValue(mockSubscription);

      await service.clearCustomPrice("user-1");

      expect(mocks.subscriptionRepo.update).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({
          customPriceAmount: null,
          customPricePendingAt: null,
          status: SubscriptionStatus.ACTIVE,
        })
      );
    });
  });
});
