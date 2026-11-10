import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  retrieveSession: vi.fn(),
  retrieveSubscription: vi.fn(),
  findByUserId: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
  invalidate: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    checkout: { sessions: { retrieve: h.retrieveSession } },
    subscriptions: { retrieve: h.retrieveSubscription, cancel: vi.fn() },
  },
}));
vi.mock("@/lib/repositories", () => ({
  subscriptionRepository: {
    findByUserId: h.findByUserId,
    update: h.update,
    create: h.create,
    findByStripeSubscriptionId: vi.fn(),
    updateByStripeSubscriptionId: vi.fn(),
  },
}));
vi.mock("@/lib/services", () => ({ subscriptionService: { invalidateUserCache: h.invalidate } }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/services/email.service", () => ({ sendTrialEndingEmail: vi.fn() }));

import { syncCheckoutSession } from "../stripe-subscription-sync.service";

const paidSession = (over: Record<string, unknown> = {}) => ({
  id: "cs_test_1",
  status: "complete",
  payment_status: "paid",
  customer: "cus_1",
  subscription: "sub_1",
  metadata: { userId: "u1", plan: "OPERATIONS" },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.retrieveSession.mockResolvedValue(paidSession());
  h.retrieveSubscription.mockResolvedValue({
    id: "sub_1",
    status: "active",
    created: 1790000000,
    items: {
      data: [
        {
          price: { id: "price_ops" },
          current_period_start: 1790000000,
          current_period_end: 1792592000,
        },
      ],
    },
    trial_end: null,
  });
  h.findByUserId.mockResolvedValue(null);
});

describe("syncCheckoutSession", () => {
  it("records the owner's paid Checkout as an active plan, as the webhook would", async () => {
    expect(await syncCheckoutSession("u1", "cs_test_1")).toBe(true);
    expect(h.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        stripeCustomerId: "cus_1",
        stripeSubscriptionId: "sub_1",
        plan: "OPERATIONS",
        status: "ACTIVE",
      })
    );
    expect(h.invalidate).toHaveBeenCalledWith("u1");
  });

  it("updates the stored row when the account already has one (the Free plan)", async () => {
    h.findByUserId.mockResolvedValue({ userId: "u1", stripeSubscriptionId: null });
    await syncCheckoutSession("u1", "cs_test_1");
    expect(h.update).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({
        plan: "OPERATIONS",
        status: "ACTIVE",
        stripeSubscriptionId: "sub_1",
      })
    );
    expect(h.create).not.toHaveBeenCalled();
  });

  it("refuses another account's session, an unpaid one, and a non-Checkout id", async () => {
    h.retrieveSession.mockResolvedValueOnce(
      paidSession({ metadata: { userId: "someone-else", plan: "POS" } })
    );
    expect(await syncCheckoutSession("u1", "cs_test_1")).toBe(false);
    h.retrieveSession.mockResolvedValueOnce(
      paidSession({ status: "open", payment_status: "unpaid" })
    );
    expect(await syncCheckoutSession("u1", "cs_test_1")).toBe(false);
    expect(await syncCheckoutSession("u1", "sub_trial_1")).toBe(false);
    expect(h.create).not.toHaveBeenCalled();
    expect(h.update).not.toHaveBeenCalled();
  });
});
