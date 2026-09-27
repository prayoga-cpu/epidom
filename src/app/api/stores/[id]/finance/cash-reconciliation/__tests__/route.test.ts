import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/api-handler", () => ({
  withApiHandler:
    (handler: (req: Request, ctx: Record<string, unknown>) => Promise<Response>) =>
    async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
      const params = await ctx.params;
      return handler(req, { params, storeId: params.id, userId: "u1" });
    },
}));

const prismaMock = vi.hoisted(() => ({ shift: { findMany: vi.fn() } }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const requireManagerOrOwnerApi = vi.fn();
vi.mock("@/lib/auth/require-manager-or-owner", () => ({
  requireManagerOrOwnerApi: (...a: unknown[]) => requireManagerOrOwnerApi(...a),
}));

const requireFinanceReportAccessApi = vi.fn();
vi.mock("@/lib/auth/require-finance-access", () => ({
  requireFinanceReportAccessApi: (...a: unknown[]) => requireFinanceReportAccessApi(...a),
}));

const getShiftCashOnHand = vi.fn();
vi.mock("@/lib/services/cash-drawer.service", () => ({
  getShiftCashOnHand: (...a: unknown[]) => getShiftCashOnHand(...a),
}));

import { GET } from "../route";

const STORE = "store_abc12345";
const get = (query = "") =>
  GET(new Request(`http://localhost/api/stores/${STORE}/finance/cash-reconciliation${query}`), {
    params: Promise.resolve({ id: STORE }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  requireManagerOrOwnerApi.mockResolvedValue(null);
  requireFinanceReportAccessApi.mockResolvedValue(null);
  prismaMock.shift.findMany.mockResolvedValue([]);
});

// Every shift's expected cash, counted cash and difference is in this response. It is the
// manager's report, and on the owner's shared iPad a cashier persona rides the OWNER's
// session, so store auth alone cannot tell them apart — only this guard can.
describe("GET /finance/cash-reconciliation — who may read it", () => {
  it("a persona that is not a manager or the owner is refused, and no shift is read", async () => {
    requireManagerOrOwnerApi.mockResolvedValue(
      NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 403 })
    );

    const res = await get();

    expect(res.status).toBe(403);
    expect(prismaMock.shift.findMany).not.toHaveBeenCalled();
    expect(getShiftCashOnHand).not.toHaveBeenCalled();
  });

  it("checks the guard for THIS store", async () => {
    await get();
    expect(requireManagerOrOwnerApi).toHaveBeenCalledWith(STORE);
  });

  it("a manager or the owner gets the report, scoped to the store", async () => {
    const res = await get("?from=2026-09-01T00:00:00.000Z&to=2026-09-30T23:59:59.999Z");

    expect(res.status).toBe(200);
    expect(prismaMock.shift.findMany.mock.calls[0][0].where.storeId).toBe(STORE);
    expect((await res.json()).data.shifts).toEqual([]);
  });
});

// Finance and /shifts both read this route; both are Operations pages, and the
// route enforces that itself so it can't be read on a lower plan by calling it.
describe("GET /finance/cash-reconciliation — plan", () => {
  it("a store below the Finance plan is refused, and no shift is read", async () => {
    requireFinanceReportAccessApi.mockResolvedValue(
      NextResponse.json(
        { success: false, error: { code: "SUBSCRIPTION_FEATURE_LOCKED" } },
        { status: 403 }
      )
    );

    const res = await get();

    expect(res.status).toBe(403);
    expect(prismaMock.shift.findMany).not.toHaveBeenCalled();
  });

  it("judges THIS store, and lets a persona in with either the Finance or the Shifts grant", async () => {
    await get();
    expect(requireFinanceReportAccessApi).toHaveBeenCalledWith(STORE, ["/finance", "/shifts"]);
  });
});
