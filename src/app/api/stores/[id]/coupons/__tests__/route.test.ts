import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/api-handler", async () => {
  const { handleApiError } = await import("@/lib/utils/api-error-handler");
  return {
    withApiHandler:
      (handler: (req: Request, ctx: Record<string, unknown>) => Promise<Response>) =>
      async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
        const params = await ctx.params;
        try {
          return await handler(req, { params, storeId: params.id, userId: "u1" });
        } catch (error) {
          return handleApiError(error, { endpoint: "test" });
        }
      },
  };
});
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const requireManagerOrOwnerApi = vi.fn();
vi.mock("@/lib/auth/require-manager-or-owner", () => ({
  requireManagerOrOwnerApi: (...a: unknown[]) => requireManagerOrOwnerApi(...a),
}));
const requirePromotionsPlanApi = vi.fn();
vi.mock("@/lib/auth/require-promotions-plan", () => ({
  requirePromotionsPlanApi: (...a: unknown[]) => requirePromotionsPlanApi(...a),
}));

const svc = vi.hoisted(() => ({
  listCoupons: vi.fn(),
  createCoupon: vi.fn(),
  updateCoupon: vi.fn(),
  validateCoupon: vi.fn(),
}));
vi.mock("@/lib/services/promotion.service", () => ({ promotionService: svc }));

import { GET, POST } from "../route";
import { PATCH } from "../[couponId]/route";
import { POST as VALIDATE } from "../validate/route";
import * as couponIdRoute from "../[couponId]/route";
import { FieldConflictError } from "@/lib/errors/field-error";

const STORE = "store_abc12345";
const ctx = (extra: Record<string, string> = {}) => ({
  params: Promise.resolve({ id: STORE, ...extra }),
});
const req = (method: string, body?: unknown, path = "") =>
  new Request(`http://localhost/api/stores/${STORE}/coupons${path}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const locked = () =>
  NextResponse.json(
    {
      success: false,
      error: {
        code: "SUBSCRIPTION_FEATURE_LOCKED",
        message: "Coupons requires the Operations plan.",
      },
    },
    { status: 403 }
  );

beforeEach(() => {
  vi.clearAllMocks();
  requireManagerOrOwnerApi.mockResolvedValue(null);
  requirePromotionsPlanApi.mockResolvedValue(null);
});

describe("POST /coupons/validate", () => {
  it("answers HTTP 200 for a rejected coupon — valid:false with the reason, never an error status", async () => {
    svc.validateCoupon.mockResolvedValue({ valid: false, reason: "EXPIRED" });

    const res = await VALIDATE(req("POST", { code: "old", itemsTotal: 30 }, "/validate"), ctx());

    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ valid: false, reason: "EXPIRED" });
    // The code is uppercased before it reaches the service (codes are stored that way).
    expect(svc.validateCoupon).toHaveBeenCalledWith(STORE, { code: "OLD", itemsTotal: 30 });
  });

  it("answers 200 valid:false NOT_FOUND for a mistyped code that could never be created", async () => {
    svc.validateCoupon.mockResolvedValue({ valid: false, reason: "NOT_FOUND" });
    const res = await VALIDATE(
      req("POST", { code: "@@ nope !!", itemsTotal: 5 }, "/validate"),
      ctx()
    );
    expect(res.status).toBe(200);
  });

  it("returns the server-priced discount for a valid coupon", async () => {
    svc.validateCoupon.mockResolvedValue({
      valid: true,
      coupon: {
        id: "k1",
        code: "SAVE10",
        name: null,
        type: "PERCENT",
        value: 10,
        minSubtotal: null,
      },
      discountAmount: 3,
    });
    const res = await VALIDATE(req("POST", { code: "SAVE10", itemsTotal: 30 }, "/validate"), ctx());
    expect((await res.json()).data.discountAmount).toBe(3);
  });

  it("is gated to OPERATIONS server-side (403, service never called)", async () => {
    requirePromotionsPlanApi.mockResolvedValue(locked());

    const res = await VALIDATE(req("POST", { code: "SAVE10", itemsTotal: 30 }, "/validate"), ctx());

    expect(res.status).toBe(403);
    expect(requirePromotionsPlanApi).toHaveBeenCalledWith(STORE, expect.any(String));
    expect(svc.validateCoupon).not.toHaveBeenCalled();
  });

  it("is cashier-tier: no manager check", async () => {
    svc.validateCoupon.mockResolvedValue({ valid: false, reason: "NOT_FOUND" });
    await VALIDATE(req("POST", { code: "X1", itemsTotal: 1 }, "/validate"), ctx());
    expect(requireManagerOrOwnerApi).not.toHaveBeenCalled();
  });

  it("only a malformed body is an error status (400)", async () => {
    const res = await VALIDATE(req("POST", { itemsTotal: 5 }, "/validate"), ctx());
    expect(res.status).toBe(400);
  });
});

describe("GET /coupons", () => {
  it("lists for a store on the plan, and is 403 below it", async () => {
    svc.listCoupons.mockResolvedValue([{ id: "k1" }]);
    const ok = await GET(req("GET"), ctx());
    expect(ok.status).toBe(200);
    expect(svc.listCoupons).toHaveBeenCalledWith(STORE);

    requirePromotionsPlanApi.mockResolvedValue(locked());
    svc.listCoupons.mockClear();
    const no = await GET(req("GET"), ctx());
    expect(no.status).toBe(403);
    expect(svc.listCoupons).not.toHaveBeenCalled();
  });
});

describe("POST /coupons", () => {
  it("creates (201) with the code uppercased", async () => {
    svc.createCoupon.mockResolvedValue({ id: "k1", code: "SAVE10" });

    const res = await POST(req("POST", { code: "save10", type: "PERCENT", value: 10 }), ctx());

    expect(res.status).toBe(201);
    expect(svc.createCoupon).toHaveBeenCalledWith(
      STORE,
      expect.objectContaining({ code: "SAVE10", type: "PERCENT", value: 10 })
    );
  });

  it("a duplicate code is a 409 on the code field", async () => {
    svc.createCoupon.mockRejectedValue(
      new FieldConflictError("code", "A coupon with this code already exists")
    );
    const res = await POST(req("POST", { code: "SAVE10", type: "PERCENT", value: 10 }), ctx());
    expect(res.status).toBe(409);
    expect((await res.json()).error.details).toEqual([
      { field: "code", message: "A coupon with this code already exists" },
    ]);
  });

  it("needs a manager/owner, then the plan — a cashier persona never gets as far as parsing", async () => {
    requireManagerOrOwnerApi.mockResolvedValue(
      NextResponse.json({ success: false }, { status: 403 })
    );
    const res = await POST(req("POST", { code: "SAVE10", type: "PERCENT", value: 10 }), ctx());
    expect(res.status).toBe(403);
    expect(svc.createCoupon).not.toHaveBeenCalled();
    expect(requirePromotionsPlanApi).not.toHaveBeenCalled();
  });

  it("rejects a percent over 100 (400 on the value field)", async () => {
    const res = await POST(req("POST", { code: "SAVE10", type: "PERCENT", value: 150 }), ctx());
    expect(res.status).toBe(400);
    expect((await res.json()).error.details[0].field).toBe("value");
  });
});

describe("PATCH /coupons/[couponId]", () => {
  it("deactivates via isActive:false", async () => {
    svc.updateCoupon.mockResolvedValue({ id: "k1", isActive: false });
    const res = await PATCH(req("PATCH", { isActive: false }, "/k1"), ctx({ couponId: "k1" }));
    expect(res.status).toBe(200);
    expect(svc.updateCoupon).toHaveBeenCalledWith(STORE, "k1", { isActive: false });
  });

  it("refuses a body that carries `code` — it is immutable", async () => {
    const res = await PATCH(
      req("PATCH", { code: "NEW", isActive: true }, "/k1"),
      ctx({ couponId: "k1" })
    );
    expect(res.status).toBe(400);
    expect(svc.updateCoupon).not.toHaveBeenCalled();
  });

  it("there is deliberately no DELETE handler (orders keep an audit FK to the coupon)", () => {
    expect((couponIdRoute as Record<string, unknown>).DELETE).toBeUndefined();
  });
});
