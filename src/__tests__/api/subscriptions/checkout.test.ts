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
vi.mock("@/lib/services", () => {
  mockCreateCheckoutSession = vi.fn();
  mockCreatePortalSession = vi.fn();
  return {
    subscriptionService: {
      createCheckoutSession: mockCreateCheckoutSession,
      createPortalSession: mockCreatePortalSession,
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
  });

  it("passes the currency the page quoted on to Checkout", async () => {
    const res = await POST(makeReq({ plan: "POS", yearly: false, currency: "EUR" }), {} as any);

    expect(res.status).toBe(201);
    expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
      "user-1",
      "POS",
      "https://app.test/checkout/success?plan=POS&trial=true",
      "https://app.test/checkout/failed?reason=canceled&plan=POS&billing=monthly",
      true,
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
      false,
      true,
      undefined
    );
  });

  it("sends both default pages on to `next`, and the cancel page back to the plan", async () => {
    await POST(
      makeReq({ plan: "POS", yearly: true, next: "/store/s1/dashboard?tour=1" }),
      {} as any
    );

    const [, , successUrl, cancelUrl] = mockCreateCheckoutSession.mock.calls[0];
    const next = encodeURIComponent("/store/s1/dashboard?tour=1");
    expect(successUrl).toBe(`https://app.test/checkout/success?plan=POS&trial=true&next=${next}`);
    expect(cancelUrl).toBe(
      `https://app.test/checkout/failed?reason=canceled&plan=POS&billing=yearly&next=${next}`
    );
  });

  it("no trial for an account that had a Stripe subscription before", async () => {
    mockFindByUserId.mockResolvedValue({
      plan: "FREE",
      status: "CANCELED",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_old",
    });
    await POST(makeReq({ plan: "POS" }), {} as any);

    const [, , successUrl, , trial] = mockCreateCheckoutSession.mock.calls[0];
    expect(trial).toBe(false);
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
