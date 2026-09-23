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
        return handleApiError(error, { endpoint: "/api/subscriptions/activate-free" });
      }
    },
  };
});

// var avoids TDZ — vi.mock factory is hoisted above const/let declarations.
var mockActivateFree: any;
vi.mock("@/lib/services", () => {
  mockActivateFree = vi.fn().mockResolvedValue(undefined);
  return { subscriptionService: { activateFree: mockActivateFree } };
});

import { POST } from "@/app/api/subscriptions/activate-free/route";
import { activateFreeSchema } from "@/lib/validation/activate-free.schemas";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(body?: unknown) {
  return new NextRequest("http://localhost/api/subscriptions/activate-free", {
    method: "POST",
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function makeRawReq(raw: string) {
  return new NextRequest("http://localhost/api/subscriptions/activate-free", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: raw,
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/subscriptions/activate-free", () => {
  beforeEach(() => {
    mockActivateFree.mockClear();
  });

  describe("accepted: only ever provisions FREE", () => {
    it("defaults to FREE when there is no body", async () => {
      const res = await POST(makeReq(), {} as any);
      expect(res.status).toBe(200);
      expect(mockActivateFree).toHaveBeenCalledTimes(1);
      expect(mockActivateFree).toHaveBeenCalledWith("user-1", "FREE");
      const body = await res.json();
      expect(body.data).toEqual({ activated: true, plan: "FREE" });
    });

    it("defaults to FREE for an empty JSON object", async () => {
      const res = await POST(makeReq({}), {} as any);
      expect(res.status).toBe(200);
      expect(mockActivateFree).toHaveBeenCalledWith("user-1", "FREE");
    });

    it("activates FREE when it is named explicitly", async () => {
      const res = await POST(makeReq({ plan: "FREE" }), {} as any);
      expect(res.status).toBe(200);
      expect(mockActivateFree).toHaveBeenCalledWith("user-1", "FREE");
    });

    it("tolerates the extra keys the pricing page sends", async () => {
      const res = await POST(makeReq({ plan: "FREE", trial: undefined, yearly: true }), {} as any);
      expect(res.status).toBe(200);
      expect(mockActivateFree).toHaveBeenCalledWith("user-1", "FREE");
    });

    it("defaults to FREE for malformed JSON", async () => {
      const res = await POST(makeRawReq("{not json"), {} as any);
      expect(res.status).toBe(200);
      expect(mockActivateFree).toHaveBeenCalledWith("user-1", "FREE");
    });

    it("defaults to FREE for an empty body with a JSON content type", async () => {
      const res = await POST(makeRawReq(""), {} as any);
      expect(res.status).toBe(200);
      expect(mockActivateFree).toHaveBeenCalledWith("user-1", "FREE");
    });

    it("defaults to FREE for a JSON null body", async () => {
      const res = await POST(makeRawReq("null"), {} as any);
      expect(res.status).toBe(200);
      expect(mockActivateFree).toHaveBeenCalledWith("user-1", "FREE");
    });
  });

  describe("rejected: any other plan never reaches the service", () => {
    // POS/OPERATIONS/ENTERPRISE are real enum values (the escalation hole);
    // STARTER/PRO are legacy names; the rest is garbage or a wrong type.
    it.each([
      "POS",
      "OPERATIONS",
      "ENTERPRISE",
      "STARTER",
      "PRO",
      "INVALID_PLAN",
      "free",
      "Free",
      " FREE",
      "",
      "__proto__",
    ])("rejects plan %j with 400 and does not call the service", async (plan) => {
      const res = await POST(makeReq({ plan }), {} as any);
      expect(res.status).toBe(400);
      expect(mockActivateFree).not.toHaveBeenCalled();
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toMatch(/only the FREE plan can be activated/i);
      expect(body.error.details).toEqual([
        { field: "plan", message: expect.stringContaining("Paid plans start from checkout") },
      ]);
    });

    it.each([null, 0, 1, true, false, ["FREE"], { plan: "POS" }])(
      "rejects the non-string plan value %j",
      async (plan) => {
        const res = await POST(makeReq({ plan }), {} as any);
        expect(res.status).toBe(400);
        expect(mockActivateFree).not.toHaveBeenCalled();
      }
    );

    it("does not silently coerce a paid plan into FREE", async () => {
      const res = await POST(makeReq({ plan: "ENTERPRISE" }), {} as any);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.data).toBeUndefined();
    });

    it("rejects a paid plan even when FREE-looking keys accompany it", async () => {
      const res = await POST(makeReq({ plan: "OPERATIONS", trial: true, yearly: true }), {} as any);
      expect(res.status).toBe(400);
      expect(mockActivateFree).not.toHaveBeenCalled();
    });

    it("rejects a JSON body that is not an object", async () => {
      for (const raw of ['"ENTERPRISE"', "42", "[]", '["POS"]']) {
        const res = await POST(makeRawReq(raw), {} as any);
        expect(res.status).toBe(400);
      }
      expect(mockActivateFree).not.toHaveBeenCalled();
    });
  });

  it("propagates a service failure (e.g. a pending custom price) as its own error", async () => {
    const { AppError } = await import("@/lib/errors");
    const { ApiErrorCode } = await import("@/types/api/responses");
    mockActivateFree.mockRejectedValueOnce(
      new AppError("custom price pending", ApiErrorCode.CONFLICT, 409)
    );
    const res = await POST(makeReq({ plan: "FREE" }), {} as any);
    expect(res.status).toBe(409);
  });
});

describe("activateFreeSchema", () => {
  it("accepts a missing plan and FREE", () => {
    expect(activateFreeSchema.safeParse({}).success).toBe(true);
    expect(activateFreeSchema.safeParse({ plan: "FREE" }).success).toBe(true);
  });

  it("accepts FREE and rejects every other SubscriptionPlan enum value", async () => {
    const { SubscriptionPlan } = await import("@prisma/client");
    for (const plan of Object.values(SubscriptionPlan)) {
      expect(activateFreeSchema.safeParse({ plan }).success).toBe(plan === "FREE");
    }
  });
});
