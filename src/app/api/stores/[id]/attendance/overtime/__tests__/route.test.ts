import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveDayOvertime } from "@/lib/attendance/overtime-approval";
import type { HoursReportRow } from "@/lib/attendance/hours-report";

vi.mock("@/lib/api-handler", () => ({
  withApiHandler:
    (handler: (req: Request, ctx: Record<string, unknown>) => Promise<Response>) =>
    (req: Request, ctx: Record<string, unknown>) =>
      handler(req, ctx),
}));

const guard = vi.fn();
const decider = vi.fn();
vi.mock("@/lib/attendance/overtime-decider", () => ({
  guardOvertimeDecisionApi: (...a: unknown[]) => guard(...a),
  resolveOvertimeDecider: (...a: unknown[]) => decider(...a),
}));

const settings = vi.hoisted(() => ({
  timeZone: "Asia/Jakarta",
  standardWorkMinutesPerDay: 480,
  overtimeRequiresApproval: true,
}));
const fetchHoursReport = vi.fn();
vi.mock("@/lib/attendance/fetch-hours-report", () => ({
  getStoreHoursSettings: async () => settings,
  fetchHoursReport: (...a: unknown[]) => fetchHoursReport(...a),
}));

const prismaMock = vi.hoisted(() => ({
  staffMember: { findMany: vi.fn() },
  overtimeApproval: { upsert: vi.fn(), deleteMany: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { POST, DELETE } from "../route";

const STORE = "store_abc12345";
const ANA = "clstaffana0000000000001";
const BUDI = "clstaffbudi000000000001";
const MANAGER = "clstaffmgr0000000000001";
const OWNER_ROW = "clstaffowner00000000001";

function row(
  staffMemberId: string,
  date: string,
  over: Partial<HoursReportRow> = {}
): HoursReportRow {
  const overtimeMinutes = over.overtimeMinutes ?? 90;
  return {
    staffMemberId,
    date,
    status: "worked",
    pairs: [],
    workedMinutes: 480 + overtimeMinutes,
    expectedMinutes: 480,
    expectedSource: "standard",
    expectedWindows: [],
    differenceMinutes: overtimeMinutes,
    regularMinutes: 480,
    overtimeMinutes,
    overtime: resolveDayOvertime(overtimeMinutes, undefined, true),
    openClockIn: null,
    present: true,
    hasLongPair: false,
    ...over,
  };
}

const post = (body: unknown) =>
  POST(
    new Request(`http://localhost/api/stores/${STORE}/attendance/overtime`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
    { storeId: STORE } as never
  );
const del = (query: string) =>
  DELETE(
    new Request(`http://localhost/api/stores/${STORE}/attendance/overtime?${query}`, {
      method: "DELETE",
    }),
    {
      storeId: STORE,
    } as never
  );

beforeEach(() => {
  vi.clearAllMocks();
  settings.overtimeRequiresApproval = true;
  guard.mockResolvedValue(null);
  decider.mockResolvedValue({ userId: "u-owner", staffMemberId: null, name: "Owner" });
  prismaMock.staffMember.findMany.mockResolvedValue([
    { id: ANA, role: "CASHIER" },
    { id: BUDI, role: "KITCHEN" },
    { id: MANAGER, role: "MANAGER" },
    { id: OWNER_ROW, role: "OWNER" },
  ]);
  fetchHoursReport.mockResolvedValue({
    rows: [
      row(ANA, "2026-10-01"),
      row(BUDI, "2026-10-01", { overtimeMinutes: 30 }),
      row(MANAGER, "2026-10-01"),
      row(OWNER_ROW, "2026-10-01"),
      // Still on the clock: the overtime isn't final.
      row(ANA, "2026-10-02", { status: "onClock" }),
      // No overtime at all.
      row(BUDI, "2026-10-02", { overtimeMinutes: 0 }),
    ],
    missingClockOuts: [],
  });
  prismaMock.overtimeApproval.upsert.mockImplementation((args) => args);
  prismaMock.$transaction.mockImplementation(async (ops: unknown[]) => ops);
  prismaMock.overtimeApproval.deleteMany.mockResolvedValue({ count: 1 });
});

describe("POST /attendance/overtime", () => {
  it("refuses whoever the guard refuses, before reading anything", async () => {
    guard.mockResolvedValue(new Response(null, { status: 403 }));
    const res = await post({
      decision: "APPROVED",
      days: [{ staffMemberId: ANA, date: "2026-10-01" }],
    });
    expect(res.status).toBe(403);
    expect(fetchHoursReport).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("does nothing while the store's overtime approval is off", async () => {
    settings.overtimeRequiresApproval = false;
    const res = await post({
      decision: "APPROVED",
      days: [{ staffMemberId: ANA, date: "2026-10-01" }],
    });
    expect(res.status).toBe(409);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("records the day's overtime as the server computes it, with who decided", async () => {
    const res = await post({
      decision: "APPROVED",
      days: [{ staffMemberId: ANA, date: "2026-10-01" }],
    });
    const { data } = await res.json();

    expect(res.status).toBe(200);
    expect(data).toMatchObject({ decided: 1, minutes: 90, skipped: [] });
    const upsert = prismaMock.overtimeApproval.upsert.mock.calls[0][0];
    expect(upsert.where.staffMemberId_date).toEqual({
      staffMemberId: ANA,
      date: new Date("2026-10-01T00:00:00Z"),
    });
    expect(upsert.create).toMatchObject({
      storeId: STORE,
      staffMemberId: ANA,
      decision: "APPROVED",
      minutes: 90,
      approvedMinutes: 90,
      decidedByUserId: "u-owner",
      decidedByStaffMemberId: null,
      decidedByName: "Owner",
    });
    expect(upsert.update).toMatchObject({ decision: "APPROVED", minutes: 90, approvedMinutes: 90 });
  });

  const decidedRow = (minutes: number, approvedMinutes: number) =>
    row(ANA, "2026-10-01", {
      overtime: resolveDayOvertime(
        90,
        {
          staffMemberId: ANA,
          date: "2026-10-01",
          decision: approvedMinutes > 0 ? "APPROVED" : "REJECTED",
          minutes,
          approvedMinutes,
          decidedAt: "2026-10-02T01:00:00.000Z",
          decidedByName: "Owner",
        },
        true
      ),
    });

  it("rejecting minutes a corrected clock-out added keeps the ones approved before", async () => {
    // Approved at 60 minutes; the day now has 90.
    fetchHoursReport.mockResolvedValue({ rows: [decidedRow(60, 60)], missingClockOuts: [] });
    const res = await post({
      decision: "REJECTED",
      days: [{ staffMemberId: ANA, date: "2026-10-01" }],
    });
    const { data } = await res.json();

    expect(data).toMatchObject({ decided: 1, minutes: 30 });
    expect(prismaMock.overtimeApproval.upsert.mock.calls[0][0].update).toMatchObject({
      decision: "REJECTED",
      minutes: 90,
      approvedMinutes: 60,
    });
  });

  it("won't re-decide a day with nothing waiting — undo it first", async () => {
    fetchHoursReport.mockResolvedValue({ rows: [decidedRow(90, 90)], missingClockOuts: [] });
    const res = await post({
      decision: "REJECTED",
      days: [{ staffMemberId: ANA, date: "2026-10-01" }],
    });
    expect(res.status).toBe(409);
    expect((await res.json()).error.details).toEqual({ reason: "alreadyDecided" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("won't let a manager approve their own overtime", async () => {
    decider.mockResolvedValue({ userId: "u-owner", staffMemberId: MANAGER, name: "Maya" });
    const res = await post({
      decision: "APPROVED",
      days: [{ staffMemberId: MANAGER, date: "2026-10-01" }],
    });
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.error.details).toEqual({ reason: "self" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("won't decide a day that is still on the clock", async () => {
    const res = await post({
      decision: "APPROVED",
      days: [{ staffMemberId: ANA, date: "2026-10-02" }],
    });
    expect(res.status).toBe(409);
    expect((await res.json()).error.details).toEqual({ reason: "notDecidable" });
  });

  it("decides what it can in a batch and lists the rest", async () => {
    decider.mockResolvedValue({ userId: "u-owner", staffMemberId: MANAGER, name: "Maya" });
    const res = await post({
      decision: "REJECTED",
      days: [
        { staffMemberId: ANA, date: "2026-10-01" },
        { staffMemberId: BUDI, date: "2026-10-01" },
        { staffMemberId: MANAGER, date: "2026-10-01" },
        { staffMemberId: OWNER_ROW, date: "2026-10-01" },
        { staffMemberId: ANA, date: "2026-10-02" },
        { staffMemberId: BUDI, date: "2026-10-02" },
        // Sent twice: decided once.
        { staffMemberId: ANA, date: "2026-10-01" },
      ],
    });
    const { data } = await res.json();

    expect(data.decided).toBe(2);
    expect(data.minutes).toBe(120);
    expect(data.skipped).toEqual([
      { staffMemberId: MANAGER, date: "2026-10-01", reason: "self" },
      { staffMemberId: OWNER_ROW, date: "2026-10-01", reason: "owner" },
      { staffMemberId: ANA, date: "2026-10-02", reason: "notDecidable" },
      { staffMemberId: BUDI, date: "2026-10-02", reason: "notDecidable" },
    ]);
    expect(prismaMock.overtimeApproval.upsert).toHaveBeenCalledTimes(2);
  });

  it("only reads this store's staff", async () => {
    await post({ decision: "APPROVED", days: [{ staffMemberId: ANA, date: "2026-10-01" }] });
    expect(prismaMock.staffMember.findMany.mock.calls[0][0].where).toEqual({
      storeId: STORE,
      id: { in: [ANA] },
    });
    expect(fetchHoursReport).toHaveBeenCalledWith(
      expect.objectContaining({
        storeId: STORE,
        fromKey: "2026-10-01",
        toKey: "2026-10-01",
        staffId: ANA,
      })
    );
  });

  it("rejects a malformed date", async () => {
    const res = await post({ decision: "APPROVED", days: [{ staffMemberId: ANA, date: "1 Oct" }] });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /attendance/overtime", () => {
  it("puts the day back to waiting", async () => {
    const res = await del(`staffMemberId=${ANA}&date=2026-10-01`);
    expect(res.status).toBe(200);
    expect(prismaMock.overtimeApproval.deleteMany).toHaveBeenCalledWith({
      where: { storeId: STORE, staffMemberId: ANA, date: new Date("2026-10-01T00:00:00Z") },
    });
  });

  it("won't let a manager undo a decision on their own overtime", async () => {
    decider.mockResolvedValue({ userId: "u-owner", staffMemberId: MANAGER, name: "Maya" });
    const res = await del(`staffMemberId=${MANAGER}&date=2026-10-01`);
    expect(res.status).toBe(403);
    expect(prismaMock.overtimeApproval.deleteMany).not.toHaveBeenCalled();
  });

  it("says so when there was no decision", async () => {
    prismaMock.overtimeApproval.deleteMany.mockResolvedValue({ count: 0 });
    expect((await del(`staffMemberId=${ANA}&date=2026-10-01`)).status).toBe(404);
  });
});
