import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/owner/summary — Finance's "All outlets" scope.
 *
 * Drives the real route. (This file used to re-implement the roll-up locally
 * and assert against that copy, so it stayed green while the route's own
 * arithmetic drifted from the single-outlet Finance report.) The per-outlet
 * figures come from computeStoreFinanceSummary — tested on its own in
 * src/lib/finance/__tests__/store-summary.test.ts — so here it is mocked and
 * the route is held to: who may read it, which plan, and how rows roll up.
 */

vi.mock("@/lib/api-handler", async () => {
  const { handleApiError } = await import("@/lib/utils/api-error-handler");
  return {
    withApiHandler:
      (handler: (req: Request, ctx: Record<string, unknown>) => Promise<Response>) =>
      async (req: Request) => {
        try {
          return await handler(req, { userId: "owner-1" });
        } catch (error) {
          return handleApiError(error, { endpoint: "test" });
        }
      },
  };
});

const prismaMock = vi.hoisted(() => ({
  business: { findUnique: vi.fn() },
  subscription: { findUnique: vi.fn() },
  order: { count: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const getActiveStaffSession = vi.fn();
vi.mock("@/lib/staff-session", () => ({
  getActiveStaffSession: (...a: unknown[]) => getActiveStaffSession(...a),
}));

const computeStoreFinanceSummary = vi.fn();
vi.mock("@/lib/finance/store-summary", () => ({
  computeStoreFinanceSummary: (...a: unknown[]) => computeStoreFinanceSummary(...a),
}));

import { GET } from "../summary/route";

const get = (query = "?from=2026-09-01T00:00:00Z&to=2026-09-30T23:59:59Z") =>
  (GET as unknown as (req: Request) => Promise<Response>)(
    new Request(`http://localhost/api/owner/summary${query}`)
  );

/** A computeStoreFinanceSummary result with the money fields that matter here. */
function outletSummary(
  currency: string,
  f: { revenue: number; cogs: number; wasteLoss: number; netProfit: number; orderCount: number }
) {
  const grossProfit = f.revenue - f.cogs;
  return {
    currency,
    revenue: f.revenue,
    cogs: f.cogs,
    grossProfit,
    grossMarginPct: f.revenue > 0 ? Math.round((grossProfit / f.revenue) * 10000) / 100 : 0,
    wasteLoss: f.wasteLoss,
    netProfit: f.netProfit,
    orderCount: f.orderCount,
  };
}

const STORES = [
  { id: "store-small", name: "Small", image: null },
  { id: "store-big", name: "Big", image: null },
];

beforeEach(() => {
  vi.clearAllMocks();
  getActiveStaffSession.mockResolvedValue(null);
  prismaMock.subscription.findUnique.mockResolvedValue({ plan: "OPERATIONS", status: "ACTIVE" });
  prismaMock.business.findUnique.mockResolvedValue({ name: "Biz", stores: STORES });
  prismaMock.order.count.mockResolvedValue(0);
  computeStoreFinanceSummary.mockImplementation(async (storeId: string) =>
    storeId === "store-big"
      ? outletSummary("EUR", {
          revenue: 1000,
          cogs: 400,
          wasteLoss: 50,
          netProfit: 420,
          orderCount: 40,
        })
      : outletSummary("EUR", {
          revenue: 200,
          cogs: 50,
          wasteLoss: 10,
          netProfit: 110,
          orderCount: 8,
        })
  );
});

describe("GET /api/owner/summary — who may read it", () => {
  it("refuses a non-owner PIN persona before reading any business data", async () => {
    getActiveStaffSession.mockResolvedValue({ storeId: "store-big", role: "MANAGER" });

    const res = await get();

    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("FORBIDDEN");
    expect(computeStoreFinanceSummary).not.toHaveBeenCalled();
  });

  it("lets the OWNER persona through", async () => {
    getActiveStaffSession.mockResolvedValue({ storeId: "store-big", role: "OWNER" });
    expect((await get()).status).toBe(200);
  });

  it("answers 404 when the caller has no business of their own", async () => {
    prismaMock.business.findUnique.mockResolvedValue(null);
    expect((await get()).status).toBe(404);
  });

  it("rejects an unparseable date range with 400", async () => {
    expect((await get("?from=not-a-date")).status).toBe(400);
  });
});

describe("GET /api/owner/summary — plan", () => {
  it("is locked below Operations, naming the plan that unlocks it", async () => {
    prismaMock.subscription.findUnique.mockResolvedValue({ plan: "POS", status: "ACTIVE" });

    const res = await get();

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("SUBSCRIPTION_FEATURE_LOCKED");
    expect(body.error.details).toEqual({
      feature: "finance",
      requiredPlan: "OPERATIONS",
      upgradeRequired: true,
    });
  });

  it("treats a subscription that isn't ACTIVE as Free", async () => {
    prismaMock.subscription.findUnique.mockResolvedValue({
      plan: "ENTERPRISE",
      status: "PAST_DUE",
    });
    expect((await get()).status).toBe(403);
  });

  it("opens on Operations and on Enterprise", async () => {
    expect((await get()).status).toBe(200);
    prismaMock.subscription.findUnique.mockResolvedValue({ plan: "ENTERPRISE", status: "ACTIVE" });
    expect((await get()).status).toBe(200);
  });
});

describe("GET /api/owner/summary — roll-up", () => {
  it("builds every row from the same per-store summary as that outlet's own Finance page", async () => {
    await get();

    expect(computeStoreFinanceSummary).toHaveBeenCalledTimes(2);
    for (const store of STORES) {
      // No filters: the roll-up is the unfiltered report for the window.
      expect(computeStoreFinanceSummary).toHaveBeenCalledWith(store.id, {
        from: new Date("2026-09-01T00:00:00Z"),
        to: new Date("2026-09-30T23:59:59Z"),
      });
    }
  });

  it("passes each outlet's net profit through untouched (refunds, tax and fees already out)", async () => {
    const body = (await (await get()).json()).data;
    const big = body.stores.find((s: { storeId: string }) => s.storeId === "store-big");
    expect(big.netProfit).toBe(420);
    expect(big.currency).toBe("EUR");
  });

  it("sorts outlets by revenue and adds up totals when they share a currency", async () => {
    prismaMock.order.count.mockImplementation(async ({ where }: { where: { storeId: string } }) =>
      where.storeId === "store-big" ? 3 : 1
    );

    const body = (await (await get()).json()).data;

    expect(body.stores.map((s: { storeId: string }) => s.storeId)).toEqual([
      "store-big",
      "store-small",
    ]);
    expect(body.mixedCurrencies).toBe(false);
    expect(body.currency).toBe("EUR");
    expect(body.totals).toEqual({
      revenue: 1200,
      cogs: 450,
      grossProfit: 750,
      grossMarginPct: 62.5,
      wasteLoss: 60,
      netProfit: 530,
    });
    expect(body.totalOrders).toBe(48);
    expect(body.totalPending).toBe(4);
    expect(body.storeCount).toBe(2);
  });

  it("never adds money across currencies — totals are null, counts still add up", async () => {
    computeStoreFinanceSummary.mockImplementation(async (storeId: string) =>
      storeId === "store-big"
        ? outletSummary("EUR", {
            revenue: 1000,
            cogs: 400,
            wasteLoss: 0,
            netProfit: 600,
            orderCount: 40,
          })
        : outletSummary("IDR", {
            revenue: 2_000_000,
            cogs: 500_000,
            wasteLoss: 0,
            netProfit: 1_500_000,
            orderCount: 8,
          })
    );

    const body = (await (await get()).json()).data;

    expect(body.mixedCurrencies).toBe(true);
    expect(body.currency).toBeNull();
    expect(body.currencies.sort()).toEqual(["EUR", "IDR"]);
    expect(body.totals).toBeNull();
    expect(body.totalOrders).toBe(48);
    // Grouped by currency, not ranked by the raw number: Rp 2,000,000 does
    // not outrank €1,000.
    expect(body.stores.map((s: { currency: string }) => s.currency)).toEqual(["EUR", "IDR"]);
  });

  it("counts orders awaiting payment regardless of the date range", async () => {
    await get();
    const where = prismaMock.order.count.mock.calls[0][0].where;
    expect(where.paymentStatus).toBe("PENDING");
    expect(where.orderDate).toBeUndefined();
  });
});
