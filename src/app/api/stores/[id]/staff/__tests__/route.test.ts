import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-handler", () => ({
  withApiHandler:
    (handler: (req: Request, ctx: Record<string, unknown>) => Promise<Response>) =>
    (req: Request, ctx: Record<string, unknown>) =>
      handler(req, ctx),
}));
vi.mock("@/lib/services/email.service", () => ({ sendStaffPinEmail: vi.fn() }));
vi.mock("bcryptjs", () => ({ hash: vi.fn() }));
// Whether the caller is the owner acting as themselves (no cashier/manager PIN
// persona on top) — decides whether pay is in the roster.
const owner = vi.hoisted(() => ({ acting: true }));
vi.mock("@/lib/auth/require-owner-only", () => ({
  canSeeStaffPay: async () => owner.acting,
  requireOwnerWithoutStaffPersonaApi: async () => null,
}));

const staffFindFirst = vi.fn();
const staffFindMany = vi.fn();
const inviteFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    staffMember: {
      findFirst: (...a: unknown[]) => staffFindFirst(...a),
      findMany: (...a: unknown[]) => staffFindMany(...a),
    },
    staffInvite: { findMany: (...a: unknown[]) => inviteFindMany(...a) },
  },
}));

import { GET } from "../route";

const STORE = "store_abc12345";
const get = (ctx: Record<string, unknown>, query = "") =>
  GET(new Request(`http://localhost/api/stores/${STORE}/staff${query}`), {
    storeId: STORE,
    ...ctx,
  } as never);

const row = (over: Record<string, unknown> = {}) => ({
  id: "s1",
  name: "Jane",
  username: "jane",
  email: "jane@example.com",
  whatsapp: "+33123456789",
  role: "CASHIER",
  customRoleLabel: null,
  allowedPages: ["/pos"],
  isActive: true,
  inviteStatus: "none",
  payType: "HOURLY",
  payRate: "12.5",
  overtimeRate: null,
  allowances: [],
  contractType: "PART_TIME",
  createdAt: new Date(),
  updatedAt: new Date(),
  pin: "$2a$10$hash",
  userId: null,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  owner.acting = true;
  inviteFindMany.mockResolvedValue([]);
});

describe("GET /api/stores/[id]/staff — a linked staff account (the PIN picker's own list)", () => {
  const staffCtx = { access: { accessType: "staff", staffMemberId: "s_me" } };

  it("gets ONLY its own row, with only the fields the picker needs", async () => {
    staffFindFirst.mockResolvedValue({
      id: "s_me",
      name: "Jane",
      role: "CASHIER",
      customRoleLabel: "Barista",
      allowedPages: ["/pos"],
      isActive: true,
      pin: "$2a$10$secrethash",
    });

    const res = await get(staffCtx);
    const text = await res.text();
    const { staff } = JSON.parse(text).data;

    expect(staffFindMany).not.toHaveBeenCalled(); // never the whole roster
    expect(staffFindFirst.mock.calls[0][0].where).toEqual({ id: "s_me", storeId: STORE, isActive: true });
    expect(staff).toEqual([
      {
        id: "s_me",
        name: "Jane",
        role: "CASHIER",
        customRoleLabel: "Barista",
        allowedPages: ["/pos"],
        isActive: true,
        hasPin: true,
      },
    ]);
    expect(text).not.toContain("secrethash"); // the PIN hash never leaves the server
  });

  it("reports hasPin false when no PIN is set", async () => {
    staffFindFirst.mockResolvedValue({
      id: "s_me", name: "Jane", role: "CASHIER", customRoleLabel: null,
      allowedPages: [], isActive: true, pin: null,
    });
    const { staff } = (await (await get(staffCtx)).json()).data;
    expect(staff[0].hasPin).toBe(false);
  });

  it("an empty list when the row was deactivated in the meantime (the picker then has nobody to show)", async () => {
    staffFindFirst.mockResolvedValue(null);
    expect((await (await get(staffCtx)).json()).data.staff).toEqual([]);
  });
});

describe("GET /api/stores/[id]/staff — the owner's roster", () => {
  const ownerCtx = { access: { accessType: "owner" } };

  it("lists everyone, without leaking the PIN hash or the linked account's id", async () => {
    staffFindMany.mockResolvedValue([row({ userId: "user_secret_123" })]);

    // The owner's Staff page asks for the pay setup.
    const res = await get(ownerCtx, "?include=pay");
    const text = await res.text();
    const [s] = JSON.parse(text).data.staff;

    expect(text).not.toContain("$2a$10$hash");
    expect(text).not.toContain("user_secret_123");
    expect(s).not.toHaveProperty("pin");
    expect(s).not.toHaveProperty("userId");
    expect(s).toMatchObject({ hasPin: true, payRate: 12.5, contractType: "PART_TIME", hasLinkedAccount: true });
  });

  it("leaves the pay setup out unless the owner's Staff page asks for it", async () => {
    // The default list feeds the PIN pickers and the device's offline cache.
    staffFindMany.mockResolvedValue([row()]);
    const [s] = (await (await get(ownerCtx)).json()).data.staff;
    expect(s).not.toHaveProperty("payRate");
    expect(s).not.toHaveProperty("allowances");
  });

  it("leaves the pay setup out for a cashier or manager PIN persona, even when asked", async () => {
    // The Staff page and Salary tab are owner-only; the roster still reaches a
    // persona (PIN picker, rosters), but without anyone's pay.
    owner.acting = false;
    staffFindMany.mockResolvedValue([row({ overtimeRate: "20", allowances: [] })]);
    const [s] = (await (await get(ownerCtx, "?include=pay")).json()).data.staff;
    for (const field of ["payRate", "overtimeRate", "allowances", "payType", "contractType"]) {
      expect(s).not.toHaveProperty(field);
    }
    expect(s).toMatchObject({ id: "s1", name: "Jane", role: "CASHIER", hasPin: true });
  });

  it("rejects an unknown include value", async () => {
    const res = await get(ownerCtx, "?include=everything");
    expect(res.status).toBe(400);
  });

  it("an owner request with no access context at all behaves as the owner (unchanged route contract)", async () => {
    staffFindMany.mockResolvedValue([row()]);
    const res = await get({});
    expect(res.status).toBe(200);
    expect(staffFindMany).toHaveBeenCalled();
  });

  it("flags a pending sign-in invite only for someone unlinked with a live, unclaimed link", async () => {
    staffFindMany.mockResolvedValue([
      row({ id: "pending" }),
      row({ id: "linked", userId: "u1" }),
      row({ id: "none" }),
    ]);
    inviteFindMany.mockResolvedValue([{ staffMemberId: "pending" }, { staffMemberId: "linked" }]);

    const { staff } = (await (await get(ownerCtx)).json()).data;
    const byId = Object.fromEntries(staff.map((s: { id: string }) => [s.id, s]));

    expect(byId.pending).toMatchObject({ hasLinkedAccount: false, hasPendingAccountInvite: true });
    // Already linked wins: a leftover invite row must not show a "pending" badge.
    expect(byId.linked).toMatchObject({ hasLinkedAccount: true, hasPendingAccountInvite: false });
    expect(byId.none).toMatchObject({ hasLinkedAccount: false, hasPendingAccountInvite: false });
  });

  it("only counts invites that are unclaimed AND unexpired", async () => {
    staffFindMany.mockResolvedValue([row()]);

    await get(ownerCtx);

    const where = inviteFindMany.mock.calls[0][0].where;
    expect(where.consumedAt).toBeNull();
    expect(where.expiresAt.gt).toBeInstanceOf(Date);
    expect(where.storeId).toBe(STORE);
  });
});
