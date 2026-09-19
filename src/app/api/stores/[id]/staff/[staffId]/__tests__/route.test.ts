import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-handler", () => ({
  withApiHandler:
    (handler: (req: Request, ctx: Record<string, unknown>) => Promise<Response>) =>
    (req: Request, ctx: Record<string, unknown>) =>
      handler(req, ctx),
}));
vi.mock("@/lib/services/email.service", () => ({ sendStaffPinEmail: vi.fn() }));
vi.mock("bcryptjs", () => ({ hash: vi.fn(async () => "hashed"), compare: vi.fn() }));

const staffFindUnique = vi.fn();
const staffFindFirst = vi.fn();
const staffUpdate = vi.fn();
const storeFindUnique = vi.fn();
const inviteDeleteMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    staffMember: {
      findUnique: (...a: unknown[]) => staffFindUnique(...a),
      findFirst: (...a: unknown[]) => staffFindFirst(...a),
      update: (...a: unknown[]) => staffUpdate(...a),
    },
    store: { findUnique: (...a: unknown[]) => storeFindUnique(...a) },
    staffInvite: { deleteMany: (...a: unknown[]) => inviteDeleteMany(...a) },
  },
}));

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
  staffUpdate.mockResolvedValue({ id: "s1" });
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
