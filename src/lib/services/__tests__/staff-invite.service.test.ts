import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

const signUpEmail = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: { api: { signUpEmail: (...a: unknown[]) => signUpEmail(...a) } },
}));

const inviteFindUnique = vi.fn();
const userFindFirst = vi.fn();
const storeFindUnique = vi.fn();
const staffFindFirst = vi.fn();
const txInviteUpdateMany = vi.fn();
const txUserUpdate = vi.fn();
const txStaffUpdateMany = vi.fn();
const transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
  fn({
    staffInvite: { updateMany: txInviteUpdateMany },
    user: { update: txUserUpdate },
    staffMember: { updateMany: txStaffUpdateMany },
  })
);
vi.mock("@/lib/prisma", () => ({
  prisma: {
    staffInvite: { findUnique: (...a: unknown[]) => inviteFindUnique(...a) },
    user: { findFirst: (...a: unknown[]) => userFindFirst(...a) },
    store: { findUnique: (...a: unknown[]) => storeFindUnique(...a) },
    staffMember: { findFirst: (...a: unknown[]) => staffFindFirst(...a) },
    $transaction: (...a: unknown[]) => transaction(...(a as [never])),
  },
}));

import { Prisma } from "@prisma/client";
import {
  lookupStaffInvite,
  claimStaffInviteWithNewAccount,
  claimStaffInviteWithSession,
} from "../staff-invite.service";

const FUTURE = new Date(Date.now() + 60_000);
const PAST = new Date(Date.now() - 60_000);

function invite(overrides: Record<string, unknown> = {}, member: Record<string, unknown> = {}) {
  return {
    id: "inv_1",
    storeId: "store_1",
    email: "jane.doe@example.com",
    expiresAt: FUTURE,
    consumedAt: null,
    staffMember: {
      id: "staff_1",
      name: "Jane",
      email: "jane.doe@example.com",
      role: "CASHIER",
      isActive: true,
      userId: null,
      ...member,
    },
    store: { id: "store_1", name: "Test Store" },
    ...overrides,
  };
}

const session = (o: Record<string, unknown> = {}) => ({
  id: "user_jane",
  email: "jane.doe@example.com",
  emailVerified: true,
  ...o,
});

beforeEach(() => {
  vi.clearAllMocks();
  txInviteUpdateMany.mockResolvedValue({ count: 1 });
  txStaffUpdateMany.mockResolvedValue({ count: 1 });
  txUserUpdate.mockResolvedValue({});
  userFindFirst.mockResolvedValue(null);
  storeFindUnique.mockResolvedValue({ business: { userId: "owner_user" } });
  staffFindFirst.mockResolvedValue(null);
});

describe("lookupStaffInvite", () => {
  it("valid: shows the store and a MASKED email, and whether an account already exists", async () => {
    inviteFindUnique.mockResolvedValue(invite());
    userFindFirst.mockResolvedValue({ id: "u" });

    const r = await lookupStaffInvite("tok");

    expect(r).toEqual({
      state: "valid",
      staffName: "Jane",
      storeName: "Test Store",
      maskedEmail: "j***@example.com",
      hasExistingAccount: true,
    });
    expect(JSON.stringify(r)).not.toContain("jane.doe@example.com");
  });

  it.each([
    ["unknown token", null, "not_found"],
    ["expired", invite({ expiresAt: PAST }), "expired"],
    ["already used", invite({ consumedAt: new Date() }), "consumed"],
    ["staffer already linked", invite({}, { userId: "someone" }), "consumed"],
    ["staffer deactivated since", invite({}, { isActive: false }), "unavailable"],
    ["staff row is now the owner row", invite({}, { role: "OWNER" }), "unavailable"],
    ["owner edited the email after sending", invite({}, { email: "other@example.com" }), "unavailable"],
    ["staff email cleared", invite({}, { email: null }), "unavailable"],
  ])("%s", async (_name, row, state) => {
    inviteFindUnique.mockResolvedValue(row);
    expect(await lookupStaffInvite("tok")).toEqual({ state });
  });
});

describe("claimStaffInviteWithNewAccount", () => {
  it("creates the account for the INVITED email, then verifies + links + spends the invite together", async () => {
    inviteFindUnique.mockResolvedValue(invite());
    signUpEmail.mockResolvedValue({ user: { id: "user_new" } });

    const r = await claimStaffInviteWithNewAccount({ token: "tok", password: "hunter2hunter2" });

    expect(r).toMatchObject({ ok: true, userId: "user_new", email: "jane.doe@example.com", storeId: "store_1" });
    expect(signUpEmail.mock.calls[0][0].body).toMatchObject({
      email: "jane.doe@example.com",
      password: "hunter2hunter2",
      name: "Jane",
    });
    expect(txInviteUpdateMany).toHaveBeenCalledWith({
      where: { id: "inv_1", consumedAt: null },
      data: { consumedAt: expect.any(Date) },
    });
    expect(txUserUpdate).toHaveBeenCalledWith({
      where: { id: "user_new" },
      data: { emailVerified: true, hasOnboarded: true },
    });
    expect(txStaffUpdateMany).toHaveBeenCalledWith({
      where: { id: "staff_1", userId: null },
      data: { userId: "user_new", userLinkedAt: expect.any(Date) },
    });
  });

  it("uses a chosen display name over the staff row's", async () => {
    inviteFindUnique.mockResolvedValue(invite());
    signUpEmail.mockResolvedValue({ user: { id: "user_new" } });
    await claimStaffInviteWithNewAccount({ token: "tok", password: "hunter2hunter2", name: "  Jane D. " });
    expect(signUpEmail.mock.calls[0][0].body.name).toBe("Jane D.");
  });

  it("refuses when an account for this email appeared since the page loaded — never creates a duplicate", async () => {
    inviteFindUnique.mockResolvedValue(invite());
    userFindFirst.mockResolvedValue({ id: "existing" });

    const r = await claimStaffInviteWithNewAccount({ token: "tok", password: "hunter2hunter2" });

    expect(r).toEqual({ ok: false, reason: "account_exists", maskedEmail: "j***@example.com" });
    expect(signUpEmail).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it("reports account_exists when it loses a sign-up race", async () => {
    inviteFindUnique.mockResolvedValue(invite());
    userFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "raced" });
    signUpEmail.mockRejectedValue(new Error("User already exists"));

    const r = await claimStaffInviteWithNewAccount({ token: "tok", password: "hunter2hunter2" });

    expect(r).toMatchObject({ ok: false, reason: "account_exists" });
  });

  it("rethrows a sign-up failure that ISN'T a duplicate (don't mask real errors)", async () => {
    inviteFindUnique.mockResolvedValue(invite());
    signUpEmail.mockRejectedValue(new Error("db down"));
    await expect(
      claimStaffInviteWithNewAccount({ token: "tok", password: "hunter2hunter2" })
    ).rejects.toThrow("db down");
  });

  it("reports consumed when the invite is spent by a concurrent claim (count !== 1)", async () => {
    inviteFindUnique.mockResolvedValue(invite());
    signUpEmail.mockResolvedValue({ user: { id: "user_new" } });
    txInviteUpdateMany.mockResolvedValue({ count: 0 });

    const r = await claimStaffInviteWithNewAccount({ token: "tok", password: "hunter2hunter2" });

    expect(r).toEqual({ ok: false, reason: "consumed" });
    expect(txStaffUpdateMany).not.toHaveBeenCalled();
  });

  it("won't claim an expired / edited-email invite at all", async () => {
    inviteFindUnique.mockResolvedValue(invite({ expiresAt: PAST }));
    expect(await claimStaffInviteWithNewAccount({ token: "t", password: "hunter2hunter2" })).toEqual({
      ok: false,
      reason: "expired",
    });
    inviteFindUnique.mockResolvedValue(invite({}, { email: "changed@example.com" }));
    expect(await claimStaffInviteWithNewAccount({ token: "t", password: "hunter2hunter2" })).toEqual({
      ok: false,
      reason: "unavailable",
    });
    expect(signUpEmail).not.toHaveBeenCalled();
  });
});

describe("claimStaffInviteWithSession — the anti-takeover rule", () => {
  it("REFUSES an authenticated user whose email is not the invited one, and writes NOTHING", async () => {
    inviteFindUnique.mockResolvedValue(invite());

    const r = await claimStaffInviteWithSession({
      token: "tok",
      user: session({ id: "user_attacker", email: "attacker@evil.com" }),
    });

    expect(r).toEqual({ ok: false, reason: "email_mismatch", maskedEmail: "j***@example.com" });
    expect(transaction).not.toHaveBeenCalled();
    expect(txStaffUpdateMany).not.toHaveBeenCalled();
    expect(txInviteUpdateMany).not.toHaveBeenCalled();
  });

  it("matches the email case-insensitively", async () => {
    inviteFindUnique.mockResolvedValue(invite());
    const r = await claimStaffInviteWithSession({
      token: "tok",
      user: session({ email: "Jane.Doe@Example.COM" }),
    });
    expect(r).toMatchObject({ ok: true, userId: "user_jane" });
  });

  it("links the caller's own account, spending the invite atomically, without touching verification flags", async () => {
    inviteFindUnique.mockResolvedValue(invite());

    await claimStaffInviteWithSession({ token: "tok", user: session() });

    expect(txInviteUpdateMany).toHaveBeenCalledWith({
      where: { id: "inv_1", consumedAt: null },
      data: { consumedAt: expect.any(Date) },
    });
    expect(txStaffUpdateMany).toHaveBeenCalledWith({
      where: { id: "staff_1", userId: null },
      data: { userId: "user_jane", userLinkedAt: expect.any(Date) },
    });
    expect(txUserUpdate).not.toHaveBeenCalled(); // an existing account keeps its own state
  });

  it("refuses a session whose email isn't verified", async () => {
    inviteFindUnique.mockResolvedValue(invite());
    const r = await claimStaffInviteWithSession({ token: "tok", user: session({ emailVerified: false }) });
    expect(r).toEqual({ ok: false, reason: "email_unverified" });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("refuses to link the store's OWNER as staff at their own store", async () => {
    inviteFindUnique.mockResolvedValue(invite());
    storeFindUnique.mockResolvedValue({ business: { userId: "user_jane" } });
    const r = await claimStaffInviteWithSession({ token: "tok", user: session() });
    expect(r).toEqual({ ok: false, reason: "own_store" });
  });

  it("refuses an account already linked as staff elsewhere, with a clear message before the DB constraint", async () => {
    inviteFindUnique.mockResolvedValue(invite());
    staffFindFirst.mockResolvedValue({ id: "other_staff" });
    const r = await claimStaffInviteWithSession({ token: "tok", user: session() });
    expect(r).toEqual({ ok: false, reason: "linked_elsewhere" });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("maps the @unique(userId) violation from a race to linked_elsewhere", async () => {
    inviteFindUnique.mockResolvedValue(invite());
    txStaffUpdateMany.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "x" })
    );
    const r = await claimStaffInviteWithSession({ token: "tok", user: session() });
    expect(r).toEqual({ ok: false, reason: "linked_elsewhere" });
  });

  it("reports consumed when the staff row got linked concurrently (count !== 1)", async () => {
    inviteFindUnique.mockResolvedValue(invite());
    txStaffUpdateMany.mockResolvedValue({ count: 0 });
    const r = await claimStaffInviteWithSession({ token: "tok", user: session() });
    expect(r).toEqual({ ok: false, reason: "consumed" });
  });
});
