import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-handler", () => ({
  withApiHandler:
    (handler: (req: Request, ctx: Record<string, unknown>) => Promise<Response>) =>
    (req: Request, ctx: Record<string, unknown>) =>
      handler(req, ctx),
}));

const ownerGuard = vi.fn();
vi.mock("@/lib/auth/require-owner-only", () => ({
  requireOwnerWithoutStaffPersonaApi: (...a: unknown[]) => ownerGuard(...a),
}));
const featureGate = vi.fn();
vi.mock("@/lib/auth/require-store-feature", () => ({
  requireStoreFeatureApi: (...a: unknown[]) => featureGate(...a),
}));
const activeStaffSession = vi.fn();
vi.mock("@/lib/staff-session", () => ({
  getActiveStaffSession: () => activeStaffSession(),
}));
const storeViewer = vi.fn();
vi.mock("@/lib/auth/store-viewer", () => ({
  getStoreViewer: (...a: unknown[]) => storeViewer(...a),
}));
vi.mock("@/lib/attendance/fetch-hours-report", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/attendance/fetch-hours-report")>();
  return {
    ...actual,
    getStoreHoursSettings: async () => ({ timeZone: "Asia/Jakarta", standardWorkMinutesPerDay: 480 }),
  };
});
const fetchPayroll = vi.fn();
vi.mock("@/lib/attendance/fetch-payroll", () => ({
  fetchPayroll: (...a: unknown[]) => fetchPayroll(...a),
}));

import { GET as getReport } from "../route";
import { GET as getMine } from "../me/route";

const STORE = "store_abc12345";
const ME = "clstaffme000000000000001";
const OTHER = "clstaffother00000000001";

const call = (handler: typeof getReport, query = "") =>
  handler(new Request(`http://localhost/api/stores/${STORE}/payroll${query}`), { storeId: STORE } as never);

const report = (staff: unknown[] = []) => ({
  fromKey: "2026-10-01",
  toKey: "2026-10-06",
  currency: "IDR",
  standardWorkMinutesPerDay: 480,
  staff,
  total: 0,
});

beforeEach(() => {
  vi.clearAllMocks();
  ownerGuard.mockResolvedValue(null);
  featureGate.mockResolvedValue(null);
  activeStaffSession.mockResolvedValue(null);
  storeViewer.mockResolvedValue({ kind: "owner" });
  fetchPayroll.mockResolvedValue(report());
});

describe("GET /payroll — everyone's salary is the owner's report", () => {
  it("refuses whoever the owner guard refuses, before reading anything", async () => {
    ownerGuard.mockResolvedValue(new Response(null, { status: 403 }));
    const res = await call(getReport);
    expect(res.status).toBe(403);
    expect(fetchPayroll).not.toHaveBeenCalled();
  });

  it("is plan-gated like the Schedule page", async () => {
    featureGate.mockResolvedValue(new Response(null, { status: 403 }));
    expect((await call(getReport)).status).toBe(403);
    expect(featureGate).toHaveBeenCalledWith(STORE, "staffOperations", expect.any(String));
    expect(fetchPayroll).not.toHaveBeenCalled();
  });

  it("prices the requested days, filtered to one staff member when asked", async () => {
    const res = await call(getReport, `?from=2026-09-01&to=2026-09-30&staffId=${OTHER}`);
    expect(res.status).toBe(200);
    expect(fetchPayroll).toHaveBeenCalledWith(
      expect.objectContaining({ storeId: STORE, fromKey: "2026-09-01", toKey: "2026-09-30", staffId: OTHER })
    );
  });

  it("rejects a reversed range and a malformed staff id", async () => {
    expect((await call(getReport, "?from=2026-09-30&to=2026-09-01")).status).toBe(400);
    expect((await call(getReport, "?staffId=not-a-cuid")).status).toBe(400);
    expect(fetchPayroll).not.toHaveBeenCalled();
  });
});

describe("GET /payroll/me — only ever the signed-in person's own pay", () => {
  const persona = (over: Record<string, unknown> = {}) => ({
    storeId: STORE,
    staffMemberId: ME,
    name: "Sam",
    role: "CASHIER",
    allowedPages: ["/pos", "/pos/schedule"],
    ...over,
  });

  it("reads whose pay from the PIN persona and ignores a staffId in the URL", async () => {
    activeStaffSession.mockResolvedValue(persona());
    fetchPayroll.mockResolvedValue(report([{ staffMemberId: ME, total: 1 }]));

    const res = await call(getMine, `?staffId=${OTHER}`);
    expect(res.status).toBe(200);
    expect(fetchPayroll).toHaveBeenCalledWith(expect.objectContaining({ staffId: ME }));
    expect((await res.json()).data.payroll).toEqual({ staffMemberId: ME, total: 1 });
  });

  it("refuses the owner with no persona — there is no wage of theirs here", async () => {
    expect((await call(getMine)).status).toBe(403);
    expect(fetchPayroll).not.toHaveBeenCalled();
  });

  it("refuses the owner's own OWNER persona and a persona of another store", async () => {
    activeStaffSession.mockResolvedValue(persona({ role: "OWNER" }));
    expect((await call(getMine)).status).toBe(403);
    activeStaffSession.mockResolvedValue(persona({ storeId: "store_other999" }));
    expect((await call(getMine)).status).toBe(403);
    expect(fetchPayroll).not.toHaveBeenCalled();
  });

  it("refuses a linked staff account whose PIN persona is someone else", async () => {
    activeStaffSession.mockResolvedValue(persona());
    storeViewer.mockResolvedValue({ kind: "staff", staffMemberId: OTHER });
    expect((await call(getMine)).status).toBe(403);
    expect(fetchPayroll).not.toHaveBeenCalled();
  });

  it("stops at today: a month that hasn't happened yet isn't earned", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-06T05:00:00.000Z")); // 12:00 in Jakarta
    try {
      activeStaffSession.mockResolvedValue(persona());
      await call(getMine, "?from=2026-10-01&to=2026-10-31");
      expect(fetchPayroll).toHaveBeenCalledWith(
        expect.objectContaining({ fromKey: "2026-10-01", toKey: "2026-10-06" })
      );
      expect((await call(getMine, "?from=2026-11-01&to=2026-11-30")).status).toBe(400);
    } finally {
      vi.useRealTimers();
    }
  });
});
