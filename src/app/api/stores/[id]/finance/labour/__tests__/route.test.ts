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

const prismaMock = vi.hoisted(() => ({
  store: { findUnique: vi.fn() },
  staffMember: { findMany: vi.fn() },
  attendanceRecord: { findMany: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const requireManagerOrOwnerApi = vi.fn();
vi.mock("@/lib/auth/require-manager-or-owner", () => ({
  requireManagerOrOwnerApi: (...a: unknown[]) => requireManagerOrOwnerApi(...a),
}));
const requireFinanceReportAccessApi = vi.fn();
vi.mock("@/lib/auth/require-finance-access", () => ({
  requireFinanceReportAccessApi: (...a: unknown[]) => requireFinanceReportAccessApi(...a),
}));

const owner = vi.hoisted(() => ({ acting: true }));
vi.mock("@/lib/auth/require-owner-only", () => ({ canSeeStaffPay: async () => owner.acting }));

import { GET } from "../route";

const STORE = "store_abc12345";
const get = (query: string) =>
  GET(new Request(`http://localhost/api/stores/${STORE}/finance/labour${query}`), {
    params: Promise.resolve({ id: STORE }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  owner.acting = true;
  requireManagerOrOwnerApi.mockResolvedValue(null);
  requireFinanceReportAccessApi.mockResolvedValue(null);
  prismaMock.store.findUnique.mockResolvedValue({
    standardWorkMinutesPerDay: 480,
    business: { timezone: "Asia/Jakarta" },
  });
  prismaMock.staffMember.findMany.mockResolvedValue([
    { id: "m", name: "Salaried", payType: "MONTHLY", payRate: 3100, isActive: true },
  ]);
  prismaMock.attendanceRecord.findMany.mockResolvedValue([]);
});

describe("GET /finance/labour", () => {
  it("prorates a salary over the days asked for, not one more (store east of UTC)", async () => {
    // "Today" in the report: one whole day. Read in Jakarta time, 23:59:59Z
    // is already the next day, which used to cost two days of salary.
    const res = await get("?from=2026-10-06T00:00:00Z&to=2026-10-06T23:59:59Z");
    const { data } = await res.json();

    expect(data.monthFraction).toBeCloseTo(1 / 31, 4);
    expect(data.rows[0]).toMatchObject({ basis: "salary", cost: 100 });
  });

  it("gives a manager the totals but not each person's rate or cost", async () => {
    // Individual pay is the owner's only, as on the Salary tab.
    owner.acting = false;
    const res = await get("?from=2026-10-06T00:00:00Z&to=2026-10-06T23:59:59Z");
    const { data } = await res.json();
    expect(data.payHidden).toBe(true);
    expect(data.rows[0]).toMatchObject({ payRate: null, cost: null });
    expect(data.totals.cost).toBe(100);
  });

  it("is manager/owner only — every pay rate is in the response", async () => {
    requireManagerOrOwnerApi.mockResolvedValue(
      NextResponse.json({ success: false }, { status: 403 })
    );
    const res = await get("?from=2026-10-06T00:00:00Z&to=2026-10-06T23:59:59Z");
    expect(res.status).toBe(403);
    expect(prismaMock.staffMember.findMany).not.toHaveBeenCalled();
  });

  it("leaves the owner's own staff row out", async () => {
    await get("?from=2026-10-06T00:00:00Z&to=2026-10-06T23:59:59Z");
    expect(prismaMock.staffMember.findMany.mock.calls[0][0].where).toEqual({
      storeId: STORE,
      role: { not: "OWNER" },
    });
  });
});
