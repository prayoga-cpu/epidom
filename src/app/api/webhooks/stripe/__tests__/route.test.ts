import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";
import { stripe } from "@/lib/stripe";
import { subscriptionRepository } from "@/lib/repositories";
import { subscriptionService } from "@/lib/services";
import { SubscriptionPlan, SubscriptionStatus } from "@prisma/client";
import { NextRequest } from "next/server";

// Mock dependencies
vi.mock("@/lib/stripe", () => ({
  stripe: {
    webhooks: {
      constructEvent: vi.fn(),
    },
    subscriptions: {
      retrieve: vi.fn(),
      cancel: vi.fn(),
    },
  },
}));

vi.mock("@/lib/repositories", () => ({
  subscriptionRepository: {
    findByUserId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findByStripeSubscriptionId: vi.fn(),
    updateByStripeSubscriptionId: vi.fn(),
  },
}));

vi.mock("@/lib/services", () => ({
  subscriptionService: {
    invalidateUserCache: vi.fn(),
  },
}));

// Mock headers
vi.mock("next/headers", () => ({
  headers: () => ({
    get: (key: string) => {
      if (key === "stripe-signature") return "mock-signature";
      return null;
    },
  }),
}));

describe("Stripe Webhook Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createRequest = (body: any) => {
    return new NextRequest("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      body: JSON.stringify(body),
    });
  };

  describe("checkout.session.completed", () => {
    it("should assign POS plan for setup mode with new_year_2025 promotion", async () => {
      // Arrange
      const mockEvent = {
        type: "checkout.session.completed",
        data: {
          object: {
            mode: "setup",
            customer: "cus_123",
            metadata: {
              userId: "user-123",
              promotion: "new_year_2025",
            },
          },
        },
      };

      (stripe.webhooks.constructEvent as any).mockReturnValue(mockEvent);
      (subscriptionRepository.findByUserId as any).mockResolvedValue(null);

      // Act
      const req = createRequest(mockEvent);
      const res = await POST(req);

      // Assert
      expect(res.status).toBe(200);

      // Verify repository call
      expect(subscriptionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-123",
          plan: SubscriptionPlan.POS, // CRITICAL CHECK
          status: SubscriptionStatus.ACTIVE,
          stripeCustomerId: "cus_123",
        })
      );

      // Verify expiration date is set (end of 2026, matching PROMO_END_DATE)
      const createCall = (subscriptionRepository.create as any).mock.calls[0][0];
      const endDate = new Date(createCall.currentPeriodEnd);
      expect(endDate.getUTCFullYear()).toBe(2026);
      expect(endDate.getUTCMonth()).toBe(11); // December (0-indexed)
      expect(endDate.getUTCDate()).toBe(31);
    });

    it("should assign OPERATIONS plan for regular subscription checkout", async () => {
      // Arrange
      const mockEvent = {
        type: "checkout.session.completed",
        data: {
          object: {
            mode: "subscription",
            subscription: "sub_123",
            customer: "cus_123",
            metadata: {
              userId: "user-123",
              plan: "OPERATIONS",
            },
          },
        },
      };

      const mockStripeSub = {
        id: "sub_123",
        status: "active",
        current_period_start: 1700000000,
        current_period_end: 1702678400,
        items: {
          data: [{ price: { id: "price_123" } }],
        },
      };

      (stripe.webhooks.constructEvent as any).mockReturnValue(mockEvent);
      (stripe.subscriptions.retrieve as any).mockResolvedValue(mockStripeSub);
      (subscriptionRepository.findByUserId as any).mockResolvedValue(null);

      // Act
      const req = createRequest(mockEvent);
      await POST(req);

      // Assert
      expect(subscriptionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-123",
          plan: SubscriptionPlan.OPERATIONS,
          stripeSubscriptionId: "sub_123",
        })
      );
    });
  });

  describe("customer.subscription.deleted", () => {
    it("clears any admin custom-price override alongside the status update", async () => {
      const mockEvent = {
        type: "customer.subscription.deleted",
        data: {
          object: { id: "sub_123" },
        },
      };

      (stripe.webhooks.constructEvent as any).mockReturnValue(mockEvent);
      (subscriptionRepository.findByStripeSubscriptionId as any).mockResolvedValue({
        userId: "user-123",
        customPricePendingAt: null,
      });

      const req = createRequest(mockEvent);
      await POST(req);

      expect(subscriptionRepository.updateByStripeSubscriptionId).toHaveBeenCalledWith(
        "sub_123",
        expect.objectContaining({
          status: SubscriptionStatus.CANCELED,
          cancelAtPeriodEnd: true,
          customPriceAmount: null,
          customPriceCurrency: null,
          customPriceInterval: null,
        })
      );
    });

    it("keeps a pending custom-price quote — this cancellation is what created it", async () => {
      const mockEvent = {
        type: "customer.subscription.deleted",
        data: { object: { id: "sub_123" } },
      };

      (stripe.webhooks.constructEvent as any).mockReturnValue(mockEvent);
      (subscriptionRepository.findByStripeSubscriptionId as any).mockResolvedValue({
        userId: "user-123",
        customPricePendingAt: new Date(),
      });

      await POST(createRequest(mockEvent));

      const [, data] = (subscriptionRepository.updateByStripeSubscriptionId as any).mock.calls[0];
      expect(data.status).toBe(SubscriptionStatus.CANCELED);
      expect(data).not.toHaveProperty("customPriceAmount");
      expect(data).not.toHaveProperty("customPricePlan");
    });
  });

  describe("custom-price offers", () => {
    it("lifts the suspension when the custom-price checkout completes", async () => {
      const mockEvent = {
        type: "checkout.session.completed",
        data: {
          object: {
            mode: "subscription",
            subscription: "sub_new",
            customer: "cus_123",
            metadata: { userId: "user-123", plan: "ENTERPRISE", customPrice: "true" },
          },
        },
      };

      (stripe.webhooks.constructEvent as any).mockReturnValue(mockEvent);
      (stripe.subscriptions.retrieve as any).mockResolvedValue({
        id: "sub_new",
        status: "active",
        current_period_start: 1700000000,
        current_period_end: 1702678400,
        items: { data: [{ price: { id: "price_custom" } }] },
      });
      (subscriptionRepository.findByUserId as any).mockResolvedValue({
        userId: "user-123",
        stripeSubscriptionId: null,
        customPricePendingAt: new Date(),
      });

      await POST(createRequest(mockEvent));

      expect(subscriptionRepository.update).toHaveBeenCalledWith(
        "user-123",
        expect.objectContaining({
          plan: SubscriptionPlan.ENTERPRISE,
          status: SubscriptionStatus.ACTIVE,
          stripeSubscriptionId: "sub_new",
          customPricePendingAt: null,
          customPricePrevStatus: null,
        })
      );
    });

    it("does not reactivate a suspended account from an unrelated subscription update", async () => {
      const mockEvent = {
        type: "customer.subscription.updated",
        data: {
          object: {
            id: "sub_old",
            status: "active",
            current_period_start: 1700000000,
            current_period_end: 1702678400,
            items: { data: [{ price: { id: "price_123" } }] },
            metadata: { userId: "user-123", plan: "OPERATIONS" },
          },
        },
      };

      (stripe.webhooks.constructEvent as any).mockReturnValue(mockEvent);
      (subscriptionRepository.findByStripeSubscriptionId as any).mockResolvedValue({
        userId: "user-123",
        customPricePendingAt: new Date(),
      });

      await POST(createRequest(mockEvent));

      const [, data] = (subscriptionRepository.updateByStripeSubscriptionId as any).mock.calls[0];
      expect(data).not.toHaveProperty("status");
      expect(data).not.toHaveProperty("plan");
    });

    it("does not reactivate a suspended account from a paid invoice", async () => {
      const mockEvent = {
        type: "invoice.payment_succeeded",
        data: { object: { id: "in_1", subscription: "sub_old" } },
      };

      (stripe.webhooks.constructEvent as any).mockReturnValue(mockEvent);
      (subscriptionRepository.findByStripeSubscriptionId as any).mockResolvedValue({
        userId: "user-123",
        status: SubscriptionStatus.INCOMPLETE,
        customPricePendingAt: new Date(),
      });

      await POST(createRequest(mockEvent));

      expect(subscriptionRepository.updateByStripeSubscriptionId).not.toHaveBeenCalled();
    });
  });
});
