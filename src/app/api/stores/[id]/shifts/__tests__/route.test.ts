import { describe, it, expect, vi, beforeEach } from "vitest";

// Pass-through withApiHandler: auth and rate limiting are not what is under test,
// the shift rules are.
vi.mock("@/lib/api-handler", () => ({
  withApiHandler:
    (handler: (req: Request, ctx: Record<string, unknown>) => Promise<Response>) =>
    async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
      const params = await ctx.params;
      return handler(req, { params, storeId: params.id, userId: "u1" });
    },
}));

const prismaMock = vi.hoisted(() => ({
  shift: { findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  staffMember: { findUnique: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const isStaffAuthenticated = vi.fn();
vi.mock("@/lib/attendance/verify-staff-auth", () => ({
  isStaffAuthenticated: (...a: unknown[]) => isStaffAuthenticated(...a),
}));

import { GET, POST } from "../route";

const STORE = "store_abc12345";
const OWNER_ROW = "clowner0000000000000000001";
const CASHIER = "clcashier00000000000000001";

const ctx = () => ({ params: Promise.resolve({ id: STORE }) });
const url = (query = "") => `http://localhost/api/stores/${STORE}/shifts${query}`;
const open = (staffId: string, openingCash = 100_000) =>
  POST(
    new Request(url(), {
      method: "POST",
      body: JSON.stringify({ staffId, pin: "", openingCash }),
    }),
    ctx()
  );

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.shift.findMany.mockResolvedValue([]);
  prismaMock.shift.count.mockResolvedValue(0);
  prismaMock.shift.findFirst.mockResolvedValue(null);
  prismaMock.shift.create.mockResolvedValue({ id: "clshift000000000000000001" });
  prismaMock.staffMember.findUnique.mockResolvedValue({
    id: CASHIER,
    storeId: STORE,
    isActive: true,
    pin: null,
  });
  isStaffAuthenticated.mockResolvedValue(true);
});

describe("GET /shifts — status filter", () => {
  const whereOf = () => prismaMock.shift.findMany.mock.calls[0][0].where;

  it("status=open asks the database for open rows, so a newer closed shift can't hide it", async () => {
    await GET(new Request(url("?status=open&take=1")), ctx());
    expect(whereOf()).toEqual({ storeId: STORE, closedAt: null });
    expect(prismaMock.shift.findMany.mock.calls[0][0].take).toBe(1);
  });

  it("status=closed is the history", async () => {
    await GET(new Request(url("?status=closed")), ctx());
    expect(whereOf()).toEqual({ storeId: STORE, closedAt: { not: null } });
  });

  it("no status returns both, still scoped to the store", async () => {
    await GET(new Request(url()), ctx());
    expect(whereOf()).toEqual({ storeId: STORE });
  });

  it("staffId still narrows, and combines with status", async () => {
    await GET(new Request(url(`?status=closed&staffId=${CASHIER}`)), ctx());
    expect(whereOf()).toEqual({
      storeId: STORE,
      staffMemberId: CASHIER,
      closedAt: { not: null },
    });
  });

  // Silently ignoring a mistyped status (status=OPEN) returned open AND closed rows, so the
  // "open shift" read (take=1) could hand back a closed shift as if it were the live one.
  it("an unknown status is a 400, not silently ignored", async () => {
    const res = await GET(new Request(url("?status=OPEN")), ctx());
    expect(res.status).toBe(400);
    expect(prismaMock.shift.findMany).not.toHaveBeenCalled();
  });
});

describe("GET /shifts — paging", () => {
  const takeOf = () => prismaMock.shift.findMany.mock.calls[0][0].take;

  it("defaults to 20 rows from the start", async () => {
    await GET(new Request(url()), ctx());
    expect(takeOf()).toBe(20);
    expect(prismaMock.shift.findMany.mock.calls[0][0].skip).toBe(0);
  });

  it("clamps an over-large take to 100 instead of refusing — 'Show more' keeps widening it", async () => {
    const res = await GET(new Request(url("?status=closed&take=110")), ctx());
    expect(res.status).toBe(200);
    expect(takeOf()).toBe(100);
  });

  // take=abc reached Prisma as NaN, threw a validation error and the route 500'd.
  it.each(["abc", "0", "-5", "1.5"])(
    "take=%s is a 400 and never reaches the database",
    async (bad) => {
      const res = await GET(new Request(url(`?take=${bad}`)), ctx());
      expect(res.status).toBe(400);
      expect(prismaMock.shift.findMany).not.toHaveBeenCalled();
    }
  );

  it("a negative skip is a 400", async () => {
    const res = await GET(new Request(url("?skip=-1")), ctx());
    expect(res.status).toBe(400);
  });

  it("an empty staffId is the same as none", async () => {
    await GET(new Request(url("?staffId=")), ctx());
    expect(prismaMock.shift.findMany.mock.calls[0][0].where).toEqual({ storeId: STORE });
  });
});

describe("POST /shifts — one open shift per STORE", () => {
  it("refuses when ANOTHER staff member already has the till open", async () => {
    // The owner opened it earlier; a cashier now tries to open a second one.
    prismaMock.shift.findFirst.mockResolvedValue({ id: "clshift000000000000000009" });

    const res = await open(CASHIER);

    expect(res.status).toBe(409);
    expect((await res.json()).error.message).toMatch(/store already has an open shift/i);
    expect(prismaMock.shift.create).not.toHaveBeenCalled();
  });

  it("looks for an open shift across the whole store — never narrowed to the opener", async () => {
    await open(CASHIER);
    // The regression this guards: `staffMemberId: staffId` in this filter is what
    // let two people run two tills at once and hid one from the other.
    expect(prismaMock.shift.findFirst).toHaveBeenCalledWith({
      where: { storeId: STORE, closedAt: null },
    });
  });

  it("opens the shift when the store has none, attributed to whoever opened it", async () => {
    const res = await open(OWNER_ROW, 250_000);

    expect(res.status).toBe(201);
    const { data } = prismaMock.shift.create.mock.calls[0][0];
    expect(data.storeId).toBe(STORE);
    expect(data.staffMemberId).toBe(OWNER_ROW);
  });

  it("still refuses a staff member from another store, before it looks at shifts", async () => {
    prismaMock.staffMember.findUnique.mockResolvedValue({
      id: CASHIER,
      storeId: "some_other_store",
      isActive: true,
      pin: null,
    });

    const res = await open(CASHIER);

    expect(res.status).toBe(404);
    expect(prismaMock.shift.findFirst).not.toHaveBeenCalled();
  });
});
