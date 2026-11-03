import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ────────────────────────────────────────────────────────────────────

// Auth is stubbed, but errors go through the real handleApiError so the tests
// see the status code and body a client would actually get.
vi.mock("@/lib/api-handler", async () => {
  const { handleApiError } = await import("@/lib/utils/api-error-handler");
  return {
    withApiHandler: (fn: Function, _opts: object) => async (req: NextRequest, _ctx?: unknown) => {
      try {
        return await fn(req, { userId: "user-1", storeId: undefined });
      } catch (error) {
        return handleApiError(error, { endpoint: "/api/subscriptions/checkout" });
      }
    },
  };
});

// var avoids TDZ — vi.mock factory is hoisted above const/let declarations.
var mockCreateCheckoutSession: any;
var mockCreatePortalSession: any;
var mockStartPosTrial: any;
vi.mock("@/lib/services", () => {
  mockCreateCheckoutSession = vi.fn();
  mockCreatePortalSession = vi.fn();
  mockStartPosTrial = vi.fn();
  return {
    subscriptionService: {
      createCheckoutSession: mockCreateCheckoutSession,
      createPortalSession: mockCreatePortalSession,
      startPosTrial: mockStartPosTrial,
    },
  };
});

var mockFindByUserId: any;
vi.mock("@/lib/repositories/subscription.repository", () => {
  mockFindByUserId = vi.fn();
  return { subscriptionRepository: { findByUserId: mockFindByUserId } };
});

import { POST } from "@/app/api/subscriptions/checkout/route";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/subscriptions/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: "https://app.test" },
    body: JSON.stringify(body),
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/subscriptions/checkout", () => {
  beforeEach(() => {
    mockCreateCheckoutSession.mockReset();
    mockCreateCheckoutSession.mockResolvedValue({ id: "cs_1", url: "https://stripe.test/c" });
    mockCreatePortalSession.mockReset();
    mockFindByUserId.mockReset();
    mockFindByUserId.mockResolvedValue(null);
    mockStartPosTrial.mockReset();
    mockStartPosTrial.mockResolvedValue({ id: "sub_trial_1", trial_end: 1_800_000_000 });
  });

  it("starts a first POS subscription as the card-less trial, with no Checkout", async () => {
    const res = await POST(makeReq({ plan: "POS", yearly: false, currency: "EUR" }), {} as any);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(mockStartPosTrial).toHaveBeenCalledWith("user-1", false, "EUR");
    expect(mockCreateCheckoutSession).not.toHaveBeenCalled();
    expect(body.data).toMatchObject({
      trialStarted: true,
      trialEndsAt: new Date(1_800_000_000 * 1000).toISOString(),
      // The success page, with the trial's subscription id where Stripe's
      // session id goes, so a reload doesn't count the trial twice.
      url: "https://app.test/checkout/success?plan=POS&trial=true&billing=monthly&currency=EUR&session_id=sub_trial_1",
    });
  });

  it("sends the trial's success page on to `next`", async () => {
    const res = await POST(
      makeReq({ plan: "POS", yearly: true, next: "/store/s1/dashboard?tour=1" }),
      {} as any
    );

    const next = encodeURIComponent("/store/s1/dashboard?tour=1");
    expect((await res.json()).data.url).toBe(
      `https://app.test/checkout/success?plan=POS&trial=true&billing=yearly&session_id=sub_trial_1&next=${next}`
    );
    expect(mockStartPosTrial).toHaveBeenCalledWith("user-1", true, undefined);
  });

  it("passes the currency the page quoted on to Checkout", async () => {
    const res = await POST(
      makeReq({ plan: "OPERATIONS", yearly: false, currency: "EUR" }),
      {} as any
    );

    expect(res.status).toBe(201);
    expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
      "user-1",
      "OPERATIONS",
      "https://app.test/checkout/success?plan=OPERATIONS&trial=false&billing=monthly&currency=EUR&session_id={CHECKOUT_SESSION_ID}",
      "https://app.test/checkout/failed?reason=canceled&plan=OPERATIONS&billing=monthly",
      false,
      "EUR"
    );
    expect((await res.json()).data.url).toBe("https://stripe.test/c");
  });

  it("leaves the currency to Stripe when the page sends none", async () => {
    await POST(makeReq({ plan: "OPERATIONS", yearly: true }), {} as any);

    expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
      "user-1",
      "OPERATIONS",
      expect.any(String),
      expect.any(String),
      true,
      undefined
    );
  });

  it("sends both default pages on to `next`, and the cancel page back to the plan", async () => {
    await POST(
      makeReq({ plan: "OPERATIONS", yearly: true, next: "/store/s1/dashboard?tour=1" }),
      {} as any
    );

    const [, , successUrl, cancelUrl] = mockCreateCheckoutSession.mock.calls[0];
    const next = encodeURIComponent("/store/s1/dashboard?tour=1");
    expect(successUrl).toBe(
      `https://app.test/checkout/success?plan=OPERATIONS&trial=false&billing=yearly&session_id={CHECKOUT_SESSION_ID}&next=${next}`
    );
    expect(cancelUrl).toBe(
      `https://app.test/checkout/failed?reason=canceled&plan=OPERATIONS&billing=yearly&next=${next}`
    );
  });

  it("tells the caller when it sends a paying account to the billing portal instead", async () => {
    mockFindByUserId.mockResolvedValue({
      plan: "POS",
      status: "ACTIVE",
      stripeCustomerId: "cus_paid",
      stripeSubscriptionId: "sub_1",
    });
    mockCreatePortalSession.mockResolvedValue({ id: "bps_1", url: "https://billing.stripe.test/p" });

    const res = await POST(makeReq({ plan: "OPERATIONS" }), {} as any);

    expect(mockCreateCheckoutSession).not.toHaveBeenCalled();
    expect((await res.json()).data).toMatchObject({ url: "https://billing.stripe.test/p", portal: true });
  });

  it("no trial for an account that had a Stripe subscription before", async () => {
    mockFindByUserId.mockResolvedValue({
      plan: "FREE",
      status: "CANCELED",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_old",
    });
    await POST(makeReq({ plan: "POS" }), {} as any);

    expect(mockStartPosTrial).not.toHaveBeenCalled();
    const [, plan, successUrl] = mockCreateCheckoutSession.mock.calls[0];
    expect(plan).toBe("POS");
    expect(successUrl).toContain("trial=false");
  });

  it.each(["https://evil.test/x", "//evil.test", "store/s1"])(
    "refuses a `next` that isn't an app path (%s)",
    async (next) => {
      const res = await POST(makeReq({ plan: "POS", next }), {} as any);
      expect(res.status).toBe(400);
      expect(mockCreateCheckoutSession).not.toHaveBeenCalled();
    }
  );

  it("refuses a currency the catalog Prices have no amount in", async () => {
    const res = await POST(makeReq({ plan: "POS", currency: "GBP" }), {} as any);

    expect(res.status).toBe(400);
    expect(mockCreateCheckoutSession).not.toHaveBeenCalled();
  });
});
