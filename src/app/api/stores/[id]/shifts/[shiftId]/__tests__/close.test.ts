import { describe, it, expect, vi, beforeEach } from "vitest";
import type { StoreAccess } from "@/lib/utils/store-verification";
import { resolveStaffRoutePolicy } from "@/lib/auth/staff-principal-policy";

// Pass-through withApiHandler that hands the handler whatever `access` the test
// sets — the rule under test is "who may close", not how auth resolves it.
const auth = vi.hoisted(() => ({ access: { accessType: "owner" } as unknown }));
vi.mock("@/lib/api-handler", () => ({
  withApiHandler:
    (handler: (req: Request, ctx: Record<string, unknown>) => Promise<Response>) =>
    async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
      const params = await ctx.params;
      return handler(req, { params, storeId: params.id, userId: "u1", access: auth.access });
    },
}));

const prismaMock = vi.hoisted(() => ({
  shift: { findUnique: vi.fn(), updateMany: vi.fn() },
  staffMember: { findFirst: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const persona = vi.hoisted(() => ({ current: null as null | Record<string, unknown> }));
vi.mock("@/lib/staff-session", () => ({
  getActiveStaffSession: async () => persona.current,
}));

const ownerOnly = vi.hoisted(() => ({ denied: null as Response | null }));
vi.mock("@/lib/auth/require-owner-only", () => ({
  requireOwnerOnlyApi: async () => ownerOnly.denied,
}));

vi.mock("@/lib/services/cash-drawer.service", () => ({
  getShiftCashOnHand: async () => ({ expectedCash: 150_000, cashDifference: 0 }),
}));

import { PATCH } from "../route";
import { POST as OWNER_CLOSE } from "../close/route";

const STORE = "store_abc12345";
const SHIFT = "clshift000000000000000001";
const CASHIER_A = "clcashierA0000000000000001";
const CASHIER_B = "clcashierB0000000000000001";
const MANAGER = "clmanager00000000000000001";
const OWNER_ROW = "clowner0000000000000000001";

const shiftOpenedBy = (id: string, role: string, name = "Dinda") => ({
  id: SHIFT,
  storeId: STORE,
  staffMemberId: id,
  openedAt: new Date("2026-10-06T01:00:00Z"),
  closedAt: null,
  openingCash: 100_000,
  closingCash: null,
  staffMember: { id, name, role },
});

const ctx = () => ({ params: Promise.resolve({ id: STORE, shiftId: SHIFT }) });
const body = JSON.stringify({ closingCash: 150_000 });
const closeOnPos = () =>
  PATCH(
    new Request(`http://localhost/api/stores/${STORE}/shifts/${SHIFT}`, { method: "PATCH", body }),
    ctx()
  );
const closeFromBackOffice = () =>
  OWNER_CLOSE(
    new Request(`http://localhost/api/stores/${STORE}/shifts/${SHIFT}/close`, {
      method: "POST",
      body,
    }),
    ctx()
  );
const writeOf = () => prismaMock.shift.updateMany.mock.calls[0][0];

beforeEach(() => {
  vi.clearAllMocks();
  auth.access = { accessType: "owner" } satisfies Partial<StoreAccess>;
  persona.current = null;
  ownerOnly.denied = null;
  prismaMock.shift.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.staffMember.findFirst.mockResolvedValue({ id: OWNER_ROW });
});

describe("PATCH /shifts/[shiftId] — only the opener closes it on the POS", () => {
  it("lets the cashier who opened it close it, and records them as the closer", async () => {
    prismaMock.shift.findUnique.mockResolvedValue(shiftOpenedBy(CASHIER_A, "CASHIER"));
    persona.current = { storeId: STORE, staffMemberId: CASHIER_A, role: "CASHIER" };

    const res = await closeOnPos();
    expect(res.status).toBe(200);
    expect(writeOf().where).toEqual({ id: SHIFT, storeId: STORE, closedAt: null });
    expect(writeOf().data).toMatchObject({
      closedByStaffMemberId: CASHIER_A,
      closedFromBackOffice: false,
    });
  });

  it("refuses another cashier, and names who can", async () => {
    prismaMock.shift.findUnique.mockResolvedValue(shiftOpenedBy(CASHIER_A, "CASHIER"));
    persona.current = { storeId: STORE, staffMemberId: CASHIER_B, role: "CASHIER" };

    const res = await closeOnPos();
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.details).toEqual({ reason: "NOT_SHIFT_OPENER", openedBy: "Dinda" });
    expect(prismaMock.shift.updateMany).not.toHaveBeenCalled();
  });

  it("refuses a manager too — the override is the owner's, from the Back Office", async () => {
    prismaMock.shift.findUnique.mockResolvedValue(shiftOpenedBy(CASHIER_A, "CASHIER"));
    persona.current = { storeId: STORE, staffMemberId: MANAGER, role: "MANAGER" };

    expect((await closeOnPos()).status).toBe(403);
    expect(prismaMock.shift.updateMany).not.toHaveBeenCalled();
  });

  it("refuses the owner's own POS persona for a cashier's shift", async () => {
    prismaMock.shift.findUnique.mockResolvedValue(shiftOpenedBy(CASHIER_A, "CASHIER"));

    expect((await closeOnPos()).status).toBe(403);
    expect(prismaMock.shift.updateMany).not.toHaveBeenCalled();
  });

  it("lets the owner close a shift the owner opened", async () => {
    prismaMock.shift.findUnique.mockResolvedValue(shiftOpenedBy(OWNER_ROW, "OWNER", "Owner"));

    expect((await closeOnPos()).status).toBe(200);
    expect(writeOf().data).toMatchObject({ closedByStaffMemberId: OWNER_ROW });
  });

  it("ignores a persona cookie from another store", async () => {
    prismaMock.shift.findUnique.mockResolvedValue(shiftOpenedBy(CASHIER_A, "CASHIER"));
    persona.current = { storeId: "other_store", staffMemberId: CASHIER_A, role: "CASHIER" };

    // Treated as the owner acting as themselves — who didn't open this shift.
    expect((await closeOnPos()).status).toBe(403);
  });

  it("holds a linked staff account to the same rule", async () => {
    prismaMock.shift.findUnique.mockResolvedValue(shiftOpenedBy(CASHIER_A, "CASHIER"));

    auth.access = { accessType: "staff", staffMemberId: CASHIER_B };
    expect((await closeOnPos()).status).toBe(403);

    auth.access = { accessType: "staff", staffMemberId: CASHIER_A };
    expect((await closeOnPos()).status).toBe(200);
  });

  it("answers 409 when another tablet closed it between the read and the write", async () => {
    prismaMock.shift.findUnique.mockResolvedValue(shiftOpenedBy(CASHIER_A, "CASHIER"));
    persona.current = { storeId: STORE, staffMemberId: CASHIER_A, role: "CASHIER" };
    prismaMock.shift.updateMany.mockResolvedValue({ count: 0 });

    expect((await closeOnPos()).status).toBe(409);
  });

  it("still answers 409 for an already-closed shift before judging who is asking", async () => {
    prismaMock.shift.findUnique.mockResolvedValue({
      ...shiftOpenedBy(CASHIER_A, "CASHIER"),
      closedAt: new Date(),
    });
    persona.current = { storeId: STORE, staffMemberId: CASHIER_B, role: "CASHIER" };

    expect((await closeOnPos()).status).toBe(409);
  });
});

describe("POST /shifts/[shiftId]/close — the owner's Back Office override", () => {
  it("closes a shift someone else opened, filed under the owner and flagged as such", async () => {
    prismaMock.shift.findUnique.mockResolvedValue(shiftOpenedBy(CASHIER_A, "CASHIER"));

    const res = await closeFromBackOffice();
    expect(res.status).toBe(200);
    expect(writeOf().where).toEqual({ id: SHIFT, storeId: STORE, closedAt: null });
    expect(writeOf().data).toMatchObject({
      closedByStaffMemberId: OWNER_ROW,
      closedFromBackOffice: true,
    });
  });

  it("refuses anyone the owner-only guard turns away", async () => {
    ownerOnly.denied = new Response(null, { status: 403 });
    prismaMock.shift.findUnique.mockResolvedValue(shiftOpenedBy(CASHIER_A, "CASHIER"));

    expect((await closeFromBackOffice()).status).toBe(403);
    expect(prismaMock.shift.updateMany).not.toHaveBeenCalled();
  });

  it("is not reachable by a linked staff account at all (default-deny)", () => {
    expect(
      resolveStaffRoutePolicy("POST", `/api/stores/${STORE}/shifts/${SHIFT}/close`)
    ).toBeNull();
    // ...while the POS close stays listed for them, gated by the opener rule.
    expect(resolveStaffRoutePolicy("PATCH", `/api/stores/${STORE}/shifts/${SHIFT}`)).not.toBeNull();
  });

  it("answers 404 for a shift in another store", async () => {
    prismaMock.shift.findUnique.mockResolvedValue({
      ...shiftOpenedBy(CASHIER_A, "CASHIER"),
      storeId: "other_store",
    });
    expect((await closeFromBackOffice()).status).toBe(404);
  });
});
