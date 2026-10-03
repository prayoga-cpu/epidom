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
      "https://app.test/checkout/failed?reason=canceled",
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

  it("refuses a currency the catalog Prices have no amount in", async () => {
    const res = await POST(makeReq({ plan: "POS", currency: "GBP" }), {} as any);

    expect(res.status).toBe(400);
    expect(mockCreateCheckoutSession).not.toHaveBeenCalled();
  });
});
