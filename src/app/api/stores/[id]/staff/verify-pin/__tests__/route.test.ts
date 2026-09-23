import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-handler", () => ({
  withApiHandler:
    (handler: (req: Request, ctx: Record<string, unknown>) => Promise<Response>) =>
    async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
      const params = await ctx.params;
      return handler(req, { params, storeId: params.id, userId: "u1" });
    },
}));

const prismaMock = vi.hoisted(() => ({
  staffMember: { findUnique: vi.fn() },
  shift: { findFirst: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const createStaffSession = vi.fn();
vi.mock("@/lib/staff-session", () => ({
  createStaffSession: (...a: unknown[]) => createStaffSession(...a),
}));

import { POST } from "../route";

const STORE = "store_abc12345";
const CASHIER = "clcashier00000000000000001";

const verify = () =>
  POST(
    new Request(`http://localhost/api/stores/${STORE}/staff/verify-pin`, {
      method: "POST",
      body: JSON.stringify({ staffId: CASHIER, pin: "" }),
    }),
    { params: Promise.resolve({ id: STORE }) }
  );

beforeEach(() => {
  vi.clearAllMocks();
  // No PIN set, so the verify step is a no-op and the shift lookup is what's tested.
  prismaMock.staffMember.findUnique.mockResolvedValue({
    id: CASHIER,
    name: "Sam",
    role: "CASHIER",
    pin: null,
    storeId: STORE,
    isActive: true,
    allowedPages: [],
  });
  createStaffSession.mockResolvedValue(undefined);
});

describe("POST /staff/verify-pin — the shift a persona lands in", () => {
  it("hands back the store's open shift even though ANOTHER person opened it", async () => {
    // The owner opened it; the cashier is signing in on the same tablet mid-day.
    prismaMock.shift.findFirst.mockResolvedValue({ id: "clshift000000000000000001" });

    const res = await verify();

    expect(res.status).toBe(200);
    expect((await res.json()).data.shift).toEqual({ id: "clshift000000000000000001" });
  });

  it("looks across the whole store — never narrowed to the person signing in", async () => {
    prismaMock.shift.findFirst.mockResolvedValue(null);

    await verify();

    // `staffMemberId` in this filter is what made a cashier sign in to "no shift"
    // while the owner's was running.
    const query = prismaMock.shift.findFirst.mock.calls[0][0];
    expect(query.where).toEqual({ storeId: STORE, closedAt: null });
    expect(query.orderBy).toEqual({ openedAt: "desc" });
  });

  it("no open shift anywhere in the store: null, as before", async () => {
    prismaMock.shift.findFirst.mockResolvedValue(null);

    const res = await verify();

    expect((await res.json()).data.shift).toBeNull();
  });
});
