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

  it("rejects a request with a bad signature as 400, not 500", async () => {
    (stripe.webhooks.constructEvent as any).mockImplementationOnce(() => {
      throw new Error("No signatures found matching the expected signature for payload.");
    });

    const res = await POST(createRequest({ type: "customer.subscription.deleted" }));

    expect(res.status).toBe(400);
    expect(subscriptionRepository.findByStripeSubscriptionId).not.toHaveBeenCalled();
  });

  describe("checkout.session.completed", () => {
    // The retired "new_year_2025" promo: POST /api/subscriptions/setup let any
    // signed-in user validate a card in a setup-mode Checkout, and this webhook
    // then granted POS ACTIVE with no charge. Both are gone. A session like the
    // ones it created (Stripe can still deliver or retry one) must be
    // acknowledged and change nothing.
    it.each([
      ["a user with no subscription row", null],
      [
        "a user on the free plan",
        { userId: "user-123", plan: SubscriptionPlan.FREE, status: SubscriptionStatus.ACTIVE },
      ],
      [
        "a user whose subscription lapsed",
        { userId: "user-123", plan: SubscriptionPlan.POS, status: SubscriptionStatus.CANCELED },
      ],
    ])(
      "grants nothing for a legacy new_year_2025 setup-mode session (%s)",
      async (_who, existingRow) => {
        const mockEvent = {
          type: "checkout.session.completed",
          data: {
            object: {
              mode: "setup",
              customer: "cus_123",
              // Setup-mode sessions never carry a subscription.
              subscription: null,
              setup_intent: "seti_123",
              // Exactly what the deleted route put on the session.
              metadata: { userId: "user-123", promotion: "new_year_2025", plan: "POS" },
            },
          },
        };

        (stripe.webhooks.constructEvent as any).mockReturnValue(mockEvent);
        (subscriptionRepository.findByUserId as any).mockResolvedValue(existingRow);

        const res = await POST(createRequest(mockEvent));

        // Acknowledged, so Stripe stops retrying ...
        expect(res.status).toBe(200);
        // ... and nothing was granted, whatever the user had before.
        expect(subscriptionRepository.create).not.toHaveBeenCalled();
        expect(subscriptionRepository.update).not.toHaveBeenCalled();
        expect(subscriptionRepository.updateByStripeSubscriptionId).not.toHaveBeenCalled();
        expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
        expect(stripe.subscriptions.cancel).not.toHaveBeenCalled();
        expect(subscriptionService.invalidateUserCache).not.toHaveBeenCalled();
      }
    );

    it("grants nothing for a setup-mode session without a plan either", async () => {
      const mockEvent = {
        type: "checkout.session.completed",
        data: {
          object: {
            mode: "setup",
            customer: "cus_123",
            subscription: null,
            metadata: { userId: "user-123", promotion: "new_year_2025" },
          },
        },
      };

      (stripe.webhooks.constructEvent as any).mockReturnValue(mockEvent);

      const res = await POST(createRequest(mockEvent));

      expect(res.status).toBe(200);
      expect(subscriptionRepository.create).not.toHaveBeenCalled();
      expect(subscriptionRepository.update).not.toHaveBeenCalled();
      expect(subscriptionService.invalidateUserCache).not.toHaveBeenCalled();
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

  // Since API 2025-03-31.basil (and in clover/dahlia) the billing period lives on
  // the subscription items and an invoice points at its subscription through
  // `parent.subscription_details`. These are the shapes Stripe actually sends.
  describe("current API shape (basil and later)", () => {
    const itemPeriod = { current_period_start: 1790000000, current_period_end: 1792592000 };

    it("activates the plan on checkout when the period is only on the subscription item", async () => {
      const mockEvent = {
        type: "checkout.session.completed",
        data: {
          object: {
            mode: "subscription",
            subscription: "sub_new",
            customer: "cus_123",
            metadata: { userId: "user-123", plan: "POS" },
          },
        },
      };

      (stripe.webhooks.constructEvent as any).mockReturnValue(mockEvent);
      (stripe.subscriptions.retrieve as any).mockResolvedValue({
        id: "sub_new",
        status: "trialing",
        cancel_at_period_end: false,
        cancel_at: null,
        trial_end: 1791209600,
        items: { data: [{ price: { id: "price_pos" }, ...itemPeriod }] },
      });
      (subscriptionRepository.findByUserId as any).mockResolvedValue(null);

      await POST(createRequest(mockEvent));

      expect(subscriptionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-123",
          plan: SubscriptionPlan.POS,
          status: SubscriptionStatus.ACTIVE,
          stripeSubscriptionId: "sub_new",
          stripePriceId: "price_pos",
          currentPeriodStart: new Date(itemPeriod.current_period_start * 1000),
          currentPeriodEnd: new Date(itemPeriod.current_period_end * 1000),
          trialEndsAt: new Date(1791209600 * 1000),
        })
      );
    });

    it("writes Stripe's current status, not the stale snapshot, on customer.subscription.created", async () => {
      const mockEvent = {
        type: "customer.subscription.created",
        data: {
          object: {
            id: "sub_new",
            status: "incomplete",
            items: { data: [{ price: { id: "price_pos" }, ...itemPeriod }] },
            metadata: { userId: "user-123", plan: "POS" },
          },
        },
      };

      (stripe.webhooks.constructEvent as any).mockReturnValue(mockEvent);
      (stripe.subscriptions.retrieve as any).mockResolvedValue({
        id: "sub_new",
        status: "active",
        cancel_at_period_end: false,
        cancel_at: null,
        trial_end: null,
        items: { data: [{ price: { id: "price_pos" }, ...itemPeriod }] },
        metadata: { userId: "user-123", plan: "POS" },
      });
      (subscriptionRepository.findByUserId as any).mockResolvedValue({
        userId: "user-123",
        stripeSubscriptionId: "sub_new",
        status: SubscriptionStatus.ACTIVE,
      });

      await POST(createRequest(mockEvent));

      expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith("sub_new");
      expect(subscriptionRepository.update).toHaveBeenCalledWith(
        "user-123",
        expect.objectContaining({
          status: SubscriptionStatus.ACTIVE,
          plan: SubscriptionPlan.POS,
          stripeSubscriptionId: "sub_new",
          currentPeriodEnd: new Date(itemPeriod.current_period_end * 1000),
        })
      );
    });

    it("records a scheduled cancellation from customer.subscription.updated", async () => {
      const mockEvent = {
        type: "customer.subscription.updated",
        data: {
          object: {
            id: "sub_123",
            status: "active",
            cancel_at_period_end: true,
            cancel_at: null,
            trial_end: null,
            items: { data: [{ price: { id: "price_123" }, ...itemPeriod }] },
            metadata: { userId: "user-123", plan: "OPERATIONS" },
          },
        },
      };

      (stripe.webhooks.constructEvent as any).mockReturnValue(mockEvent);
      (subscriptionRepository.findByStripeSubscriptionId as any).mockResolvedValue({
        userId: "user-123",
        customPricePendingAt: null,
      });

      await POST(createRequest(mockEvent));

      expect(subscriptionRepository.updateByStripeSubscriptionId).toHaveBeenCalledWith(
        "sub_123",
        expect.objectContaining({
          status: SubscriptionStatus.ACTIVE,
          plan: SubscriptionPlan.OPERATIONS,
          cancelAtPeriodEnd: true,
          currentPeriodStart: new Date(itemPeriod.current_period_start * 1000),
          currentPeriodEnd: new Date(itemPeriod.current_period_end * 1000),
        })
      );
    });

    it("marks the subscription past due when an invoice payment fails", async () => {
      const mockEvent = {
        type: "invoice.payment_failed",
        data: {
          object: {
            id: "in_1",
            parent: {
              type: "subscription_details",
              subscription_details: { subscription: "sub_123", metadata: {} },
            },
          },
        },
      };

      (stripe.webhooks.constructEvent as any).mockReturnValue(mockEvent);
      (subscriptionRepository.findByStripeSubscriptionId as any).mockResolvedValue({
        userId: "user-123",
        status: SubscriptionStatus.ACTIVE,
        customPricePendingAt: null,
      });

      await POST(createRequest(mockEvent));

      expect(subscriptionRepository.findByStripeSubscriptionId).toHaveBeenCalledWith("sub_123");
      expect(subscriptionRepository.updateByStripeSubscriptionId).toHaveBeenCalledWith("sub_123", {
        status: SubscriptionStatus.PAST_DUE,
      });
    });

    it("reactivates a past-due subscription when its invoice is paid (expanded parent)", async () => {
      const mockEvent = {
        type: "invoice.payment_succeeded",
        data: {
          object: {
            id: "in_2",
            parent: {
              type: "subscription_details",
              subscription_details: { subscription: { id: "sub_123" }, metadata: {} },
            },
          },
        },
      };

      (stripe.webhooks.constructEvent as any).mockReturnValue(mockEvent);
      (subscriptionRepository.findByStripeSubscriptionId as any).mockResolvedValue({
        userId: "user-123",
        status: SubscriptionStatus.PAST_DUE,
        customPricePendingAt: null,
      });
      (stripe.subscriptions.retrieve as any).mockResolvedValue({ id: "sub_123", status: "active" });

      await POST(createRequest(mockEvent));

      expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith("sub_123");
      expect(subscriptionRepository.updateByStripeSubscriptionId).toHaveBeenCalledWith("sub_123", {
        status: SubscriptionStatus.ACTIVE,
      });
    });

    it("follows Stripe, not the row, when an invoice is paid on a subscription dunning ended", async () => {
      const mockEvent = {
        type: "invoice.payment_succeeded",
        data: {
          object: {
            id: "in_after_dunning",
            parent: { subscription_details: { subscription: "sub_123", metadata: {} } },
          },
        },
      };

      (stripe.webhooks.constructEvent as any).mockReturnValue(mockEvent);
      // payment_failed was processed after deleted, so the row reads PAST_DUE.
      (subscriptionRepository.findByStripeSubscriptionId as any).mockResolvedValue({
        userId: "user-123",
        status: SubscriptionStatus.PAST_DUE,
        customPricePendingAt: null,
      });
      (stripe.subscriptions.retrieve as any).mockResolvedValue({
        id: "sub_123",
        status: "canceled",
      });

      await POST(createRequest(mockEvent));

      expect(subscriptionRepository.updateByStripeSubscriptionId).toHaveBeenCalledWith("sub_123", {
        status: SubscriptionStatus.CANCELED,
      });
    });

    it("leaves a canceled row alone when the last failed payment arrives after the deletion", async () => {
      const mockEvent = {
        type: "invoice.payment_failed",
        data: {
          object: {
            id: "in_last",
            parent: { subscription_details: { subscription: "sub_123", metadata: {} } },
          },
        },
      };

      (stripe.webhooks.constructEvent as any).mockReturnValue(mockEvent);
      (subscriptionRepository.findByStripeSubscriptionId as any).mockResolvedValue({
        userId: "user-123",
        status: SubscriptionStatus.CANCELED,
        customPricePendingAt: null,
      });

      await POST(createRequest(mockEvent));

      expect(subscriptionRepository.updateByStripeSubscriptionId).not.toHaveBeenCalled();
    });

    it("does not reopen a canceled subscription when a late invoice is paid", async () => {
      const mockEvent = {
        type: "invoice.payment_succeeded",
        data: {
          object: {
            id: "in_late",
            parent: { subscription_details: { subscription: "sub_123", metadata: {} } },
          },
        },
      };

      (stripe.webhooks.constructEvent as any).mockReturnValue(mockEvent);
      (subscriptionRepository.findByStripeSubscriptionId as any).mockResolvedValue({
        userId: "user-123",
        status: SubscriptionStatus.CANCELED,
        customPricePendingAt: null,
      });

      await POST(createRequest(mockEvent));

      expect(subscriptionRepository.updateByStripeSubscriptionId).not.toHaveBeenCalled();
    });

    it("cancels a past-due subscription the customer replaced at checkout", async () => {
      const mockEvent = {
        type: "checkout.session.completed",
        data: {
          object: {
            mode: "subscription",
            subscription: "sub_new",
            customer: "cus_123",
            metadata: { userId: "user-123", plan: "POS" },
          },
        },
      };

      (stripe.webhooks.constructEvent as any).mockReturnValue(mockEvent);
      (stripe.subscriptions.retrieve as any).mockImplementation(async (id: string) =>
        id === "sub_old"
          ? { id: "sub_old", status: "past_due", created: 1780000000 }
          : {
              id: "sub_new",
              status: "active",
              created: 1790000000,
              cancel_at_period_end: false,
              cancel_at: null,
              trial_end: null,
              items: { data: [{ price: { id: "price_pos" }, ...itemPeriod }] },
            }
      );
      (subscriptionRepository.findByUserId as any).mockResolvedValue({
        userId: "user-123",
        stripeSubscriptionId: "sub_old",
        status: SubscriptionStatus.PAST_DUE,
      });

      await POST(createRequest(mockEvent));

      expect(stripe.subscriptions.cancel).toHaveBeenCalledWith("sub_old");
      expect(subscriptionRepository.update).toHaveBeenCalledWith(
        "user-123",
        expect.objectContaining({
          stripeSubscriptionId: "sub_new",
          status: SubscriptionStatus.ACTIVE,
        })
      );
    });

    it("ignores a retried checkout for an older subscription the customer already replaced", async () => {
      const mockEvent = {
        type: "checkout.session.completed",
        data: {
          object: {
            mode: "subscription",
            subscription: "sub_old",
            customer: "cus_123",
            metadata: { userId: "user-123", plan: "POS" },
          },
        },
      };

      (stripe.webhooks.constructEvent as any).mockReturnValue(mockEvent);
      (stripe.subscriptions.retrieve as any).mockImplementation(async (id: string) =>
        id === "sub_current"
          ? { id: "sub_current", status: "trialing", created: 1790000000 }
          : {
              id: "sub_old",
              status: "canceled",
              created: 1780000000,
              cancel_at_period_end: false,
              cancel_at: null,
              trial_end: null,
              items: { data: [{ price: { id: "price_pos" }, ...itemPeriod }] },
            }
      );
      (subscriptionRepository.findByUserId as any).mockResolvedValue({
        userId: "user-123",
        stripeSubscriptionId: "sub_current",
        status: SubscriptionStatus.ACTIVE,
      });

      const res = await POST(createRequest(mockEvent));

      expect(res.status).toBe(200);
      expect(stripe.subscriptions.cancel).not.toHaveBeenCalled();
      expect(subscriptionRepository.update).not.toHaveBeenCalled();
    });

    it("ignores a one-off invoice that has no parent subscription", async () => {
      const mockEvent = {
        type: "invoice.payment_failed",
        data: { object: { id: "in_3", parent: null } },
      };

      (stripe.webhooks.constructEvent as any).mockReturnValue(mockEvent);

      await POST(createRequest(mockEvent));

      expect(subscriptionRepository.findByStripeSubscriptionId).not.toHaveBeenCalled();
      expect(subscriptionRepository.updateByStripeSubscriptionId).not.toHaveBeenCalled();
    });
  });
});
