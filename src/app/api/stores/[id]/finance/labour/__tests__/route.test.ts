import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { computeStaffPayroll } from "@/lib/attendance/payroll";
import { resolveDayOvertime } from "@/lib/attendance/overtime-approval";
import type { HoursReportRow } from "@/lib/attendance/hours-report";

vi.mock("@/lib/api-handler", () => ({
  withApiHandler:
    (handler: (req: Request, ctx: Record<string, unknown>) => Promise<Response>) =>
    async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
      const params = await ctx.params;
      return handler(req, { params, storeId: params.id, userId: "u1" });
    },
}));

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

const SETTINGS = {
  timeZone: "Asia/Jakarta",
  standardWorkMinutesPerDay: 480,
  overtimeRequiresApproval: true,
};
vi.mock("@/lib/attendance/fetch-hours-report", () => ({
  getStoreHoursSettings: async () => SETTINGS,
}));
const fetchPayroll = vi.fn();
vi.mock("@/lib/attendance/fetch-payroll", () => ({
  fetchPayroll: (...a: unknown[]) => fetchPayroll(...a),
}));

import { GET } from "../route";

const STORE = "store_abc12345";
const get = (query: string) =>
  GET(new Request(`http://localhost/api/stores/${STORE}/finance/labour${query}`), {
    params: Promise.resolve({ id: STORE }),
  });

/** A worked day of 10h against 8h expected: 2h overtime, approved or not. */
function workedDay(staffMemberId: string, date: string, approved: boolean): HoursReportRow {
  return {
    staffMemberId,
    date,
    status: "worked",
    pairs: [],
    workedMinutes: 600,
    expectedMinutes: 480,
    expectedSource: "standard",
    expectedWindows: [],
    differenceMinutes: 120,
    regularMinutes: 480,
    overtimeMinutes: 120,
    overtime: resolveDayOvertime(
      120,
      approved
        ? {
            staffMemberId,
            date,
            decision: "APPROVED",
            minutes: 120,
            approvedMinutes: 120,
            decidedAt: "",
            decidedByName: "Owner",
          }
        : undefined,
      true
    ),
    openClockIn: null,
    present: true,
    hasLongPair: false,
  };
}

function payrollFor(approved: boolean) {
  const fromKey = "2026-10-06";
  const toKey = "2026-10-06";
  const staff = computeStaffPayroll({
    staff: {
      staffMemberId: "h",
      payType: "HOURLY",
      payRate: 20,
      overtimeRate: 30,
      allowances: [{ id: "a", name: "Meal", amount: 5, basis: "PER_DAY" }],
      attributedSales: null,
    },
    days: [workedDay("h", fromKey, approved)],
    fromKey,
    toKey,
  });
  return {
    fromKey,
    toKey,
    currency: "IDR",
    standardWorkMinutesPerDay: 480,
    overtimeRequiresApproval: true,
    staff: [{ ...staff, name: "Hourly", role: "CASHIER", payRate: 20, overtimeRate: 30 }],
    total: staff.total,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  owner.acting = true;
  requireManagerOrOwnerApi.mockResolvedValue(null);
  requireFinanceReportAccessApi.mockResolvedValue(null);
  fetchPayroll.mockResolvedValue(payrollFor(true));
});

describe("GET /finance/labour", () => {
  it("prices the days asked for, not one more (store east of UTC)", async () => {
    // "Today" in the report: one whole day. Read in Jakarta time, 23:59:59Z
    // is already the next day, which used to cost two days of salary.
    await get("?from=2026-10-06T00:00:00Z&to=2026-10-06T23:59:59Z");
    expect(fetchPayroll).toHaveBeenCalledWith(
      expect.objectContaining({ storeId: STORE, fromKey: "2026-10-06", toKey: "2026-10-06" })
    );
  });

  it("costs what the Salary tab pays: base, allowances and approved overtime", async () => {
    const res = await get("?from=2026-10-06T00:00:00Z&to=2026-10-06T23:59:59Z");
    const { data } = await res.json();

    // 8h × 20 + 5 meal allowance + 2h × 30 approved overtime.
    expect(data.rows[0]).toMatchObject({
      base: 160,
      allowances: 5,
      paidOvertimeMinutes: 120,
      overtimePay: 60,
      pendingOvertimeMinutes: 0,
      cost: 225,
    });
    expect(data.totals.cost).toBe(225);
    expect(data.overtimeRequiresApproval).toBe(true);
  });

  it("leaves overtime that is still waiting for approval out of the cost", async () => {
    fetchPayroll.mockResolvedValue(payrollFor(false));
    const res = await get("?from=2026-10-06T00:00:00Z&to=2026-10-06T23:59:59Z");
    const { data } = await res.json();

    expect(data.rows[0]).toMatchObject({ overtimePay: 0, pendingOvertimeMinutes: 120, cost: 165 });
    expect(data.totals).toMatchObject({ cost: 165, pendingOvertimeMinutes: 120, overtimePay: 0 });
  });

  it("gives a manager the totals but not each person's rate or pay", async () => {
    // Individual pay is the owner's only, as on the Salary tab.
    owner.acting = false;
    const res = await get("?from=2026-10-06T00:00:00Z&to=2026-10-06T23:59:59Z");
    const { data } = await res.json();
    expect(data.payHidden).toBe(true);
    expect(data.rows[0]).toMatchObject({
      payRate: null,
      base: null,
      allowances: null,
      overtimePay: null,
      cost: null,
      // Hours aren't pay: a manager still sees them.
      paidOvertimeMinutes: 120,
    });
    expect(data.totals.cost).toBe(225);
  });

  it("is manager/owner only — every pay rate is in the response", async () => {
    requireManagerOrOwnerApi.mockResolvedValue(
      NextResponse.json({ success: false }, { status: 403 })
    );
    const res = await get("?from=2026-10-06T00:00:00Z&to=2026-10-06T23:59:59Z");
    expect(res.status).toBe(403);
    expect(fetchPayroll).not.toHaveBeenCalled();
  });

  it("refuses a reversed range", async () => {
    const res = await get("?from=2026-10-07T00:00:00Z&to=2026-10-06T23:59:59Z");
    expect(res.status).toBe(400);
    expect(fetchPayroll).not.toHaveBeenCalled();
  });
});
