import { describe, it, expect, vi, beforeEach } from "vitest";
import { SubscriptionPlan, SubscriptionStatus } from "@prisma/client";

vi.mock("@/lib/api-handler", () => ({
  withApiHandler:
    (handler: (req: Request, ctx: Record<string, unknown>) => Promise<Response>) =>
    (req: Request) =>
      handler(req, { userId: "user-1" }),
}));
vi.mock("@/lib/repositories", () => ({
  subscriptionRepository: { findByUserId: vi.fn(), update: vi.fn() },
}));
vi.mock("@/lib/stripe", () => ({
  stripe: { subscriptions: { list: vi.fn(), cancel: vi.fn() } },
}));
vi.mock("@/config/stripe.config", () => ({
  STRIPE_CONFIG: {
    PRICE_IDS: {
      POS: { MONTHLY: "price_pos_m", YEARLY: "price_pos_y" },
      OPERATIONS: { MONTHLY: "price_ops_m", YEARLY: "price_ops_y" },
    },
  },
}));

import { POST } from "../route";
import { subscriptionRepository } from "@/lib/repositories";
import { stripe } from "@/lib/stripe";

const period = { current_period_start: 1790000000, current_period_end: 1792592000 };
const stripeSub = (fields: Record<string, unknown>) => ({
  id: "sub_1",
  created: 1790000000,
  cancel_at_period_end: false,
  cancel_at: null,
  metadata: {},
  items: { data: [{ price: { id: "price_pos_m" }, ...period }] },
  ...fields,
});
const sync = () =>
  POST(new Request("http://localhost/api/subscriptions/sync", { method: "POST" }), {} as any);

describe("POST /api/subscriptions/sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (subscriptionRepository.findByUserId as any).mockResolvedValue({
      userId: "user-1",
      stripeCustomerId: "cus_1",
      plan: SubscriptionPlan.OPERATIONS,
      status: SubscriptionStatus.ACTIVE,
      customPricePendingAt: null,
    });
  });

  it("takes the plan from the price being paid, not from checkout-time metadata", async () => {
    // Bought Operations, then switched to POS in the Customer Portal.
    (stripe.subscriptions.list as any).mockResolvedValue({
      data: [stripeSub({ status: "active", metadata: { userId: "user-1", plan: "OPERATIONS" } })],
    });

    await sync();

    expect(subscriptionRepository.update).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ plan: SubscriptionPlan.POS, status: SubscriptionStatus.ACTIVE })
    );
  });

  it("keeps a trialing subscription active instead of writing it off as canceled", async () => {
    (stripe.subscriptions.list as any).mockResolvedValue({
      data: [
        stripeSub({
          status: "trialing",
          items: { data: [{ price: { id: "price_ops_y" }, ...period }] },
        }),
      ],
    });

    await sync();

    expect(stripe.subscriptions.list).toHaveBeenCalledWith(
      expect.objectContaining({ status: "all" })
    );
    expect(subscriptionRepository.update).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        plan: SubscriptionPlan.OPERATIONS,
        status: SubscriptionStatus.ACTIVE,
      })
    );
  });

  it("marks a past-due subscription PAST_DUE", async () => {
    (stripe.subscriptions.list as any).mockResolvedValue({
      data: [stripeSub({ status: "past_due" })],
    });

    await sync();

    expect(subscriptionRepository.update).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ status: SubscriptionStatus.PAST_DUE })
    );
  });

  it("keeps the row's plan for a price outside the catalog (admin custom price)", async () => {
    (stripe.subscriptions.list as any).mockResolvedValue({
      data: [
        stripeSub({
          status: "active",
          items: { data: [{ price: { id: "price_custom" }, ...period }] },
        }),
      ],
    });

    await sync();

    expect(subscriptionRepository.update).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ plan: SubscriptionPlan.OPERATIONS, stripePriceId: "price_custom" })
    );
  });

  it("marks the row canceled only when no subscription is live", async () => {
    (stripe.subscriptions.list as any).mockResolvedValue({
      data: [
        stripeSub({ status: "canceled" }),
        stripeSub({ id: "sub_2", status: "incomplete_expired" }),
      ],
    });

    await sync();

    expect(subscriptionRepository.update).toHaveBeenCalledWith("user-1", {
      status: SubscriptionStatus.CANCELED,
    });
  });

  it("refuses an admin-granted account without calling Stripe", async () => {
    (subscriptionRepository.findByUserId as any).mockResolvedValue({
      userId: "user-1",
      stripeCustomerId: "admin_user-1",
      plan: SubscriptionPlan.ENTERPRISE,
      status: SubscriptionStatus.ACTIVE,
      customPricePendingAt: null,
    });

    const res = await sync();

    expect(res.status).toBe(409);
    expect(stripe.subscriptions.list).not.toHaveBeenCalled();
    expect(subscriptionRepository.update).not.toHaveBeenCalled();
  });
});
