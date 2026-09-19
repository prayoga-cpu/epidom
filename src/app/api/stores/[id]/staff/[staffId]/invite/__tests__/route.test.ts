import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/api-handler", () => ({
  withApiHandler:
    (handler: (req: Request, ctx: Record<string, unknown>) => Promise<Response>) =>
    (req: Request, ctx: Record<string, unknown>) =>
      handler(req, ctx),
}));

const requireOwnerOnlyApi = vi.fn();
vi.mock("@/lib/auth/require-owner-only", () => ({
  requireOwnerOnlyApi: (...a: unknown[]) => requireOwnerOnlyApi(...a),
}));

const sendStaffAccountInviteEmail = vi.fn();
vi.mock("@/lib/services/email.service", () => ({
  sendStaffAccountInviteEmail: (...a: unknown[]) => sendStaffAccountInviteEmail(...a),
}));

const staffFindUnique = vi.fn();
const storeFindUnique = vi.fn();
const inviteDelete = vi.fn();
const txDeleteMany = vi.fn();
const txCreate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    staffMember: { findUnique: (...a: unknown[]) => staffFindUnique(...a) },
    store: { findUnique: (...a: unknown[]) => storeFindUnique(...a) },
    staffInvite: { delete: (...a: unknown[]) => inviteDelete(...a) },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ staffInvite: { deleteMany: txDeleteMany, create: txCreate } }),
  },
}));

import { POST } from "../route";

const STORE = "store_abc12345";
const staff = (over: Record<string, unknown> = {}) => ({
  id: "staff_1",
  storeId: STORE,
  name: "Jane",
  email: "jane.doe@example.com",
  role: "CASHIER",
  isActive: true,
  userId: null,
  ...over,
});

const call = () =>
  POST(new Request("http://localhost/x", { method: "POST" }), {
    storeId: STORE,
    userId: "owner_user",
    params: { staffId: "staff_1" },
  } as never);

beforeEach(() => {
  vi.clearAllMocks();
  requireOwnerOnlyApi.mockResolvedValue(null);
  staffFindUnique.mockResolvedValue(staff());
  storeFindUnique.mockResolvedValue({ name: "Kopi Kita" });
  txCreate.mockResolvedValue({ id: "inv_1" });
  sendStaffAccountInviteEmail.mockResolvedValue({ success: true });
  inviteDelete.mockResolvedValue({});
});

describe("POST /api/stores/[id]/staff/[staffId]/invite", () => {
  it("refuses anyone who isn't the owner, before touching the database or sending mail", async () => {
    requireOwnerOnlyApi.mockResolvedValue(NextResponse.json({}, { status: 403 }));

    const res = await call();

    expect(res.status).toBe(403);
    expect(staffFindUnique).not.toHaveBeenCalled();
    expect(sendStaffAccountInviteEmail).not.toHaveBeenCalled();
  });

  it("404s for a staff member of a different store (no cross-store invites)", async () => {
    staffFindUnique.mockResolvedValue(staff({ storeId: "store_other999" }));
    expect((await call()).status).toBe(404);
    staffFindUnique.mockResolvedValue(null);
    expect((await call()).status).toBe(404);
    expect(sendStaffAccountInviteEmail).not.toHaveBeenCalled();
  });

  it.each([
    ["the owner row", { role: "OWNER" }, 400],
    ["a deactivated staffer", { isActive: false }, 400],
    ["a staffer with no email", { email: null }, 400],
    ["a staffer who already has an account", { userId: "user_x" }, 409],
  ])("refuses %s", async (_name, over, code) => {
    staffFindUnique.mockResolvedValue(staff(over));

    expect((await call()).status).toBe(code);
    expect(txCreate).not.toHaveBeenCalled();
    expect(sendStaffAccountInviteEmail).not.toHaveBeenCalled();
  });

  it("retires earlier unclaimed links, snapshots the email, and creates ONE 7-day single-use token", async () => {
    const before = Date.now();
    const res = await call();

    expect(res.status).toBe(200);
    expect(txDeleteMany).toHaveBeenCalledWith({
      where: { staffMemberId: "staff_1", consumedAt: null },
    });
    const data = txCreate.mock.calls[0][0].data;
    expect(data).toMatchObject({
      storeId: STORE,
      staffMemberId: "staff_1",
      email: "jane.doe@example.com",
      invitedByUserId: "owner_user",
    });
    expect(data.token).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32 random bytes, base64url
    const ttl = data.expiresAt.getTime() - before;
    expect(ttl).toBeGreaterThan(7 * 24 * 60 * 60 * 1000 - 5_000);
    expect(ttl).toBeLessThan(7 * 24 * 60 * 60 * 1000 + 5_000);
  });

  it("emails a link carrying that exact token in the query string, and never echoes it to the browser", async () => {
    const res = await call();
    const token = txCreate.mock.calls[0][0].data.token;

    const [to, name, storeName, url] = sendStaffAccountInviteEmail.mock.calls[0];
    expect(to).toBe("jane.doe@example.com");
    expect(name).toBe("Jane");
    expect(storeName).toBe("Kopi Kita");
    expect(url).toBe(`http://localhost:3000/staff-invite?token=${token}`);

    const text = await res.text();
    expect(text).not.toContain(token);
    expect(JSON.parse(text).data).toEqual({ sent: true });
  });

  it("if the mail provider rejects it, reports failure and deletes the never-delivered link", async () => {
    sendStaffAccountInviteEmail.mockResolvedValue({ success: false });

    const res = await call();

    expect(res.status).toBe(502);
    expect(inviteDelete).toHaveBeenCalledWith({ where: { id: "inv_1" } });
  });
});
