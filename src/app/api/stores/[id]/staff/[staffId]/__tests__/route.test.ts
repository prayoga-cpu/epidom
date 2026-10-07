import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-handler", () => ({
  withApiHandler:
    (handler: (req: Request, ctx: Record<string, unknown>) => Promise<Response>) =>
    (req: Request, ctx: Record<string, unknown>) =>
      handler(req, ctx),
}));
vi.mock("@/lib/services/email.service", () => ({ sendStaffPinEmail: vi.fn() }));
vi.mock("bcryptjs", () => ({ hash: vi.fn(async () => "hashed"), compare: vi.fn() }));

const ownerGuard = vi.fn();
vi.mock("@/lib/auth/require-owner-only", () => ({
  requireOwnerWithoutStaffPersonaApi: (...a: unknown[]) => ownerGuard(...a),
}));

const staffFindUnique = vi.fn();
const staffFindFirst = vi.fn();
const staffUpdate = vi.fn();
const storeFindUnique = vi.fn();
const inviteDeleteMany = vi.fn();
const allowanceDeleteMany = vi.fn();
const allowanceCreateMany = vi.fn();
vi.mock("@/lib/prisma", () => {
  const staffMember = {
    findUnique: (...a: unknown[]) => staffFindUnique(...a),
    findFirst: (...a: unknown[]) => staffFindFirst(...a),
    update: (...a: unknown[]) => staffUpdate(...a),
  };
  const staffAllowance = {
    deleteMany: (...a: unknown[]) => allowanceDeleteMany(...a),
    createMany: (...a: unknown[]) => allowanceCreateMany(...a),
  };
  return {
    prisma: {
      staffMember,
      staffAllowance,
      store: { findUnique: (...a: unknown[]) => storeFindUnique(...a) },
      staffInvite: { deleteMany: (...a: unknown[]) => inviteDeleteMany(...a) },
      $transaction: (fn: (tx: unknown) => Promise<unknown>) => fn({ staffMember, staffAllowance }),
    },
  };
});

import { PATCH, DELETE } from "../route";

const STORE = "store_abc12345";
const existing = { id: "s1", storeId: STORE, name: "Jane", email: "jane@example.com" };

const patch = (body: unknown) =>
  PATCH(
    new Request("http://localhost/x", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { storeId: STORE, params: { staffId: "s1" } } as never
  );
const del = () =>
  DELETE(new Request("http://localhost/x", { method: "DELETE" }), {
    storeId: STORE,
    params: { staffId: "s1" },
  } as never);

const pendingWhere = { where: { staffMemberId: "s1", consumedAt: null } };

beforeEach(() => {
  vi.clearAllMocks();
  staffFindUnique.mockResolvedValue(existing);
  staffFindFirst.mockResolvedValue(null);
  storeFindUnique.mockResolvedValue({ name: "Kopi Kita" });
  staffUpdate.mockResolvedValue({ id: "s1", payRate: null, overtimeRate: null, allowances: [] });
  ownerGuard.mockResolvedValue(null);
  inviteDeleteMany.mockResolvedValue({ count: 1 });
});

describe("PATCH staff — an outstanding sign-in invite belongs to the address it was sent to", () => {
  it("retires unclaimed invites when the email is changed (usually because it was wrong)", async () => {
    await patch({ email: "right@example.com" });
    expect(inviteDeleteMany).toHaveBeenCalledWith(pendingWhere);
  });

  it("retires them when the email is cleared", async () => {
    await patch({ email: "" });
    expect(inviteDeleteMany).toHaveBeenCalledWith(pendingWhere);
  });

  it("leaves them alone when the 'change' is only casing/whitespace of the same address", async () => {
    await patch({ email: " Jane@Example.com " });
    expect(inviteDeleteMany).not.toHaveBeenCalled();
  });

  it("leaves them alone when the email isn't part of the update at all", async () => {
    await patch({ name: "Jane D." });
    expect(inviteDeleteMany).not.toHaveBeenCalled();
  });

  it("retires them when the staffer is deactivated via PATCH", async () => {
    await patch({ isActive: false });
    expect(inviteDeleteMany).toHaveBeenCalledWith(pendingWhere);
  });

  it("doesn't touch them when reactivating", async () => {
    await patch({ isActive: true });
    expect(inviteDeleteMany).not.toHaveBeenCalled();
  });

  it("only ever deletes UNCLAIMED invites — the record of a claimed one is kept", async () => {
    await patch({ email: "other@example.com" });
    expect(inviteDeleteMany.mock.calls[0][0].where.consumedAt).toBeNull();
  });

  it("does nothing to invites when the update is rejected (wrong store)", async () => {
    staffFindUnique.mockResolvedValue({ ...existing, storeId: "store_other999" });
    const res = await patch({ email: "right@example.com" });
    expect(res.status).toBe(404);
    expect(inviteDeleteMany).not.toHaveBeenCalled();
  });
});

describe("DELETE staff (deactivate)", () => {
  it("deactivates and retires unclaimed invites, so a reactivation later can't revive an old link", async () => {
    const res = await del();

    expect(res.status).toBe(200);
    expect(staffUpdate).toHaveBeenCalledWith({ where: { id: "s1" }, data: { isActive: false } });
    expect(inviteDeleteMany).toHaveBeenCalledWith(pendingWhere);
  });
});

describe("staff writes are the owner's alone", () => {
  const refused = new Response(JSON.stringify({ success: false }), { status: 403 });

  it("refuses an edit from anyone the owner guard turns away — a cashier can't raise their own pay", async () => {
    ownerGuard.mockResolvedValue(refused);
    const res = await patch({ payRate: 99999 });
    expect(res.status).toBe(403);
    expect(staffUpdate).not.toHaveBeenCalled();
  });

  it("refuses a deactivation the same way", async () => {
    ownerGuard.mockResolvedValue(refused);
    const res = await del();
    expect(res.status).toBe(403);
    expect(staffUpdate).not.toHaveBeenCalled();
  });
});

describe("PATCH staff — allowances and overtime rate", () => {
  it("replaces the whole allowance list, scoped to this store and staff member", async () => {
    await patch({
      overtimeRate: 25000,
      allowances: [
        { name: "Meal", amount: 25000, basis: "PER_DAY" },
        { name: "Position", amount: 500000, basis: "PER_MONTH" },
      ],
    });
    expect(allowanceDeleteMany).toHaveBeenCalledWith({ where: { staffMemberId: "s1", storeId: STORE } });
    expect(allowanceCreateMany).toHaveBeenCalledWith({
      data: [
        { storeId: STORE, staffMemberId: "s1", name: "Meal", amount: 25000, basis: "PER_DAY" },
        { storeId: STORE, staffMemberId: "s1", name: "Position", amount: 500000, basis: "PER_MONTH" },
      ],
    });
    expect(staffUpdate.mock.calls[0][0].data).toMatchObject({ overtimeRate: 25000 });
  });

  it("an empty list clears them; leaving the field out keeps them", async () => {
    await patch({ allowances: [] });
    expect(allowanceDeleteMany).toHaveBeenCalledTimes(1);
    expect(allowanceCreateMany).not.toHaveBeenCalled();

    vi.clearAllMocks();
    staffFindUnique.mockResolvedValue(existing);
    staffUpdate.mockResolvedValue({ id: "s1", payRate: null, overtimeRate: null, allowances: [] });
    ownerGuard.mockResolvedValue(null);
    await patch({ name: "Jane D." });
    expect(allowanceDeleteMany).not.toHaveBeenCalled();
  });

  it("rejects a nameless or negative allowance", async () => {
    expect((await patch({ allowances: [{ name: " ", amount: 1, basis: "PER_DAY" }] })).status).toBe(400);
    expect((await patch({ allowances: [{ name: "Meal", amount: -1, basis: "PER_DAY" }] })).status).toBe(400);
    expect(allowanceDeleteMany).not.toHaveBeenCalled();
  });
});
