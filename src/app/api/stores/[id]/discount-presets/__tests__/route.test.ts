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
  listPresets: vi.fn(),
  createPreset: vi.fn(),
  updatePreset: vi.fn(),
  deletePreset: vi.fn(),
}));
vi.mock("@/lib/services/promotion.service", () => ({ promotionService: svc }));

const loyalty = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/services/loyalty-settings.service", () => ({ loyaltySettingsService: loyalty }));

import { GET, POST } from "../route";
import { PATCH, DELETE } from "../[presetId]/route";
import { GET as GET_LOYALTY, PUT as PUT_LOYALTY } from "../../loyalty-settings/route";
import { FieldError } from "@/lib/errors/field-error";

const STORE = "store_abc12345";
const ctx = (extra: Record<string, string> = {}) => ({
  params: Promise.resolve({ id: STORE, ...extra }),
});
const req = (method: string, body?: unknown, path = "", base = "discount-presets") =>
  new Request(`http://localhost/api/stores/${STORE}/${base}${path}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const locked = () =>
  NextResponse.json(
    { success: false, error: { code: "SUBSCRIPTION_FEATURE_LOCKED" } },
    { status: 403 }
  );

beforeEach(() => {
  vi.clearAllMocks();
  requireManagerOrOwnerApi.mockResolvedValue(null);
  requirePromotionsPlanApi.mockResolvedValue(null);
});

describe("discount presets", () => {
  it("GET lists active presets by default and all of them with includeInactive=1", async () => {
    svc.listPresets.mockResolvedValue([]);
    await GET(req("GET"), ctx());
    expect(svc.listPresets).toHaveBeenLastCalledWith(STORE, false);
    await GET(req("GET", undefined, "?includeInactive=1"), ctx());
    expect(svc.listPresets).toHaveBeenLastCalledWith(STORE, true);
  });

  it("GET is OPERATIONS-gated server-side but open to a cashier (no manager check)", async () => {
    requirePromotionsPlanApi.mockResolvedValue(locked());
    const res = await GET(req("GET"), ctx());
    expect(res.status).toBe(403);
    expect(svc.listPresets).not.toHaveBeenCalled();
    expect(requireManagerOrOwnerApi).not.toHaveBeenCalled();
  });

  it("POST creates (201), literal FIXED value, manager/owner only", async () => {
    svc.createPreset.mockResolvedValue({ id: "p1" });
    const res = await POST(req("POST", { name: "5 off", type: "FIXED", value: 5 }), ctx());
    expect(res.status).toBe(201);
    expect(svc.createPreset).toHaveBeenCalledWith(
      STORE,
      expect.objectContaining({ type: "FIXED", value: 5 })
    );

    requireManagerOrOwnerApi.mockResolvedValue(
      NextResponse.json({ success: false }, { status: 403 })
    );
    svc.createPreset.mockClear();
    expect((await POST(req("POST", { name: "x", type: "FIXED", value: 5 }), ctx())).status).toBe(
      403
    );
    expect(svc.createPreset).not.toHaveBeenCalled();
  });

  it("PATCH surfaces the service's field error (a percent that would exceed 100)", async () => {
    svc.updatePreset.mockRejectedValue(new FieldError("value", "A percentage can't exceed 100"));
    const res = await PATCH(req("PATCH", { type: "PERCENT" }, "/p1"), ctx({ presetId: "p1" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.details).toEqual([
      { field: "value", message: "A percentage can't exceed 100" },
    ]);
  });

  it("DELETE is a hard delete, manager/owner only, gated", async () => {
    const res = await DELETE(req("DELETE", undefined, "/p1"), ctx({ presetId: "p1" }));
    expect(res.status).toBe(200);
    expect(svc.deletePreset).toHaveBeenCalledWith(STORE, "p1");
    expect((await res.json()).data).toEqual({ id: "p1", deleted: true });

    requirePromotionsPlanApi.mockResolvedValue(locked());
    svc.deletePreset.mockClear();
    expect((await DELETE(req("DELETE", undefined, "/p1"), ctx({ presetId: "p1" }))).status).toBe(
      403
    );
    expect(svc.deletePreset).not.toHaveBeenCalled();
  });
});

describe("loyalty settings", () => {
  const settings = { enabled: false, spendPerPoint: 0, pointValue: 0, minRedeemPoints: 0 };
  const call = (method: "GET" | "PUT", body?: unknown) =>
    (method === "GET" ? GET_LOYALTY : PUT_LOYALTY)(
      req(method, body, "", "loyalty-settings"),
      ctx()
    );

  it("GET resolves defaults (never null) for a store that never configured it", async () => {
    loyalty.get.mockResolvedValue(settings);
    const res = await call("GET");
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual(settings);
  });

  it("GET is gated below OPERATIONS", async () => {
    requirePromotionsPlanApi.mockResolvedValue(locked());
    expect((await call("GET")).status).toBe(403);
    expect(loyalty.get).not.toHaveBeenCalled();
  });

  it("PUT saves, and an enable with zero amounts is a 400 on the offending field", async () => {
    loyalty.update.mockResolvedValue({
      ...settings,
      enabled: true,
      spendPerPoint: 1,
      pointValue: 0.05,
    });
    const ok = await call("PUT", { enabled: true, spendPerPoint: 1, pointValue: 0.05 });
    expect(ok.status).toBe(200);
    expect(loyalty.update).toHaveBeenCalledWith(STORE, {
      enabled: true,
      spendPerPoint: 1,
      pointValue: 0.05,
    });

    loyalty.update.mockRejectedValue(
      new FieldError("spendPerPoint", "Set how much a customer spends to earn 1 point")
    );
    const bad = await call("PUT", { enabled: true });
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.details[0].field).toBe("spendPerPoint");
  });

  it("PUT needs a manager/owner", async () => {
    requireManagerOrOwnerApi.mockResolvedValue(
      NextResponse.json({ success: false }, { status: 403 })
    );
    expect((await call("PUT", { enabled: false })).status).toBe(403);
    expect(loyalty.update).not.toHaveBeenCalled();
  });
});
