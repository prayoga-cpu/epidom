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

      // Verify expiration date is set (end of 2025)
      const createCall = (subscriptionRepository.create as any).mock.calls[0][0];
      const endDate = new Date(createCall.currentPeriodEnd);
      expect(endDate.getUTCFullYear()).toBe(2025);
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
});
