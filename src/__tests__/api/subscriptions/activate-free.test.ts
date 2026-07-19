import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/api-handler", () => ({
  withApiHandler: (fn: Function, _opts: object) => async (req: NextRequest, _ctx?: unknown) =>
    fn(req, { userId: "user-1", storeId: undefined }),
}));

// var avoids TDZ — vi.mock factory is hoisted above const/let declarations.
var mockActivateFree: any;
vi.mock("@/lib/services", () => {
  mockActivateFree = vi.fn().mockResolvedValue(undefined);
  return { subscriptionService: { activateFree: mockActivateFree } };
});

vi.mock("@/types/api", () => ({
  createSuccessResponse: (data: object) => ({ success: true, data }),
}));

import { POST } from "@/app/api/subscriptions/activate-free/route";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(body?: object) {
  return new NextRequest("http://localhost/api/subscriptions/activate-free", {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/subscriptions/activate-free", () => {
  beforeEach(() => {
    mockActivateFree.mockClear();
  });

  it("defaults to FREE when no body", async () => {
    const res = await POST(makeReq(), {} as any);
    expect(res.status).toBe(200);
    expect(mockActivateFree).toHaveBeenCalledWith("user-1", "FREE");
    const body = await res.json();
    expect(body.data.plan).toBe("FREE");
  });

  it("activates FREE plan when requested", async () => {
    await POST(makeReq({ plan: "FREE" }), {} as any);
    expect(mockActivateFree).toHaveBeenCalledWith("user-1", "FREE");
  });

  it("activates POS plan when requested", async () => {
    await POST(makeReq({ plan: "POS" }), {} as any);
    expect(mockActivateFree).toHaveBeenCalledWith("user-1", "POS");
  });

  it("activates ENTERPRISE plan when requested", async () => {
    await POST(makeReq({ plan: "ENTERPRISE" }), {} as any);
    expect(mockActivateFree).toHaveBeenCalledWith("user-1", "ENTERPRISE");
  });

  it("ignores invalid plan value and falls back to FREE", async () => {
    await POST(makeReq({ plan: "INVALID_PLAN" }), {} as any);
    expect(mockActivateFree).toHaveBeenCalledWith("user-1", "FREE");
  });

  it("returns activated: true and the resolved plan", async () => {
    const res = await POST(makeReq({ plan: "POS" }), {} as any);
    const body = await res.json();
    expect(body.data.activated).toBe(true);
    expect(body.data.plan).toBe("POS");
  });
});
