import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma, PaymentMarket } from "@prisma/client";
import { ApiErrorCode } from "@/types/api/responses";
import { DEFAULT_ENABLED_PAYMENT_METHODS } from "@/config/payment-fees.config";

const h = vi.hoisted(() => {
  const tx = {
    store: { findUnique: vi.fn(), update: vi.fn() },
    verification: { deleteMany: vi.fn() },
    business: { findUnique: vi.fn(), create: vi.fn() },
    businessFinanceSettings: { findUnique: vi.fn() },
    storeFinanceSettings: { upsert: vi.fn() },
    staffMember: { updateMany: vi.fn(), create: vi.fn() },
    staffSession: { deleteMany: vi.fn() },
    user: { update: vi.fn() },
  };
  const prisma = {
    verification: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    store: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    subscription: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  };
  return { tx, prisma, activateFree: vi.fn(), sendEmail: vi.fn() };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));
vi.mock("../subscription.service", () => ({
  subscriptionService: { activateFree: h.activateFree },
}));
vi.mock("../email.service", () => ({ sendStoreOwnershipTransferEmail: h.sendEmail }));

import {
  acceptStoreTransfer,
  cancelPendingTransfer,
  getPendingTransfer,
  lookupStoreTransfer,
  startStoreTransfer,
} from "../store-transfer.service";

const TOKEN = "a".repeat(64);
const STORE_ID = "store_1";
const DAY = 24 * 60 * 60 * 1000;

function inviteRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "ver_1",
    identifier: `store-transfer:${TOKEN}`,
    value: JSON.stringify({
      storeId: STORE_ID,
      toEmail: "new@owner.com",
      fromUserId: "old_user",
      storeName: "Kopi Kita",
    }),
    expiresAt: new Date(Date.now() + DAY),
    ...overrides,
  };
}

function storeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: STORE_ID,
    name: "Kopi Kita",
    businessId: "biz_old",
    syncFinanceWithBusiness: false,
    business: { id: "biz_old", userId: "old_user", timezone: "Asia/Makassar", locale: "id" },
    ...overrides,
  };
}

const recipient = {
  id: "new_user",
  email: "new@owner.com",
  name: "Nia",
  emailVerified: true,
};

async function rejection(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (e) {
    return e as { statusCode?: number; code?: string; message: string };
  }
  throw new Error("expected the promise to reject");
}

beforeEach(() => {
  vi.clearAllMocks();
  h.prisma.$transaction.mockImplementation(async (cb: (t: typeof h.tx) => unknown) => cb(h.tx));
  h.prisma.verification.deleteMany.mockResolvedValue({ count: 0 });
  h.prisma.verification.create.mockResolvedValue({});
  h.prisma.verification.findMany.mockResolvedValue([]);
  h.prisma.subscription.findUnique.mockResolvedValue({ id: "sub_1" });
  h.sendEmail.mockResolvedValue({ success: true });
  h.activateFree.mockResolvedValue(undefined);
  // Happy-path defaults for the transaction; individual tests override.
  h.tx.store.findUnique.mockResolvedValue(storeRow());
  h.tx.verification.deleteMany.mockResolvedValue({ count: 1 });
  h.tx.business.findUnique.mockResolvedValue({ id: "biz_new" });
  h.tx.business.create.mockResolvedValue({ id: "biz_created" });
  h.tx.businessFinanceSettings.findUnique.mockResolvedValue(null);
  h.tx.staffMember.updateMany.mockResolvedValue({ count: 1 });
});

describe("startStoreTransfer", () => {
  const fromUser = { id: "old_user", email: "Old@Owner.com", name: "Old Owner" };

  it("refuses to hand a store to the address that already owns it (case/space-insensitive)", async () => {
    const err = await rejection(
      startStoreTransfer({ storeId: STORE_ID, toEmail: "  old@owner.COM ", fromUser })
    );
    expect(err.statusCode).toBe(400);
    expect(h.prisma.verification.create).not.toHaveBeenCalled();
    expect(h.sendEmail).not.toHaveBeenCalled();
  });

  it("404s for a store that doesn't exist", async () => {
    h.prisma.store.findUnique.mockResolvedValue(null);
    const err = await rejection(
      startStoreTransfer({ storeId: STORE_ID, toEmail: "new@owner.com", fromUser })
    );
    expect(err.statusCode).toBe(404);
    expect(h.prisma.verification.create).not.toHaveBeenCalled();
  });

  it("creates a token-keyed, 7-day invite and emails the accept link with that token", async () => {
    h.prisma.store.findUnique.mockResolvedValue({ name: "Kopi Kita" });
    const before = Date.now();

    const result = await startStoreTransfer({
      storeId: STORE_ID,
      toEmail: "New@Owner.com",
      fromUser,
    });

    expect(result).toEqual({ toEmail: "new@owner.com" });
    const created = h.prisma.verification.create.mock.calls[0][0].data;
    const token = created.identifier.replace("store-transfer:", "");
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.parse(created.value)).toEqual({
      storeId: STORE_ID,
      toEmail: "new@owner.com",
      fromUserId: "old_user",
      storeName: "Kopi Kita",
    });
    const ttl = created.expiresAt.getTime() - before;
    expect(ttl).toBeGreaterThan(7 * DAY - 5000);
    expect(ttl).toBeLessThanOrEqual(7 * DAY + 5000);

    expect(h.sendEmail).toHaveBeenCalledTimes(1);
    const [to, storeName, fromName, url] = h.sendEmail.mock.calls[0];
    expect([to, storeName, fromName]).toEqual(["new@owner.com", "Kopi Kita", "Old Owner"]);
    expect(url).toContain(`/transfer-ownership/accept?token=${token}`);
  });

  it("replaces (never stacks on) an invite already pending for the same store", async () => {
    h.prisma.store.findUnique.mockResolvedValue({ name: "Kopi Kita" });
    await startStoreTransfer({ storeId: STORE_ID, toEmail: "new@owner.com", fromUser });

    expect(h.prisma.verification.deleteMany).toHaveBeenCalledWith({
      where: {
        identifier: { startsWith: "store-transfer:" },
        value: { contains: `"storeId":"${STORE_ID}"` },
      },
    });
    // ...and the cleanup happens before the new row is written.
    const deleteOrder = h.prisma.verification.deleteMany.mock.invocationCallOrder[0];
    const createOrder = h.prisma.verification.create.mock.invocationCallOrder[0];
    expect(deleteOrder).toBeLessThan(createOrder);
  });

  it("doesn't leave a dead invite behind when the email can't be sent", async () => {
    h.prisma.store.findUnique.mockResolvedValue({ name: "Kopi Kita" });
    h.sendEmail.mockResolvedValue({ success: false, error: "boom" });

    const err = await rejection(
      startStoreTransfer({ storeId: STORE_ID, toEmail: "new@owner.com", fromUser })
    );

    expect(err.statusCode).toBe(502);
    const created = h.prisma.verification.create.mock.calls[0][0].data;
    expect(h.prisma.verification.deleteMany).toHaveBeenLastCalledWith({
      where: { identifier: created.identifier },
    });
  });
});

describe("getPendingTransfer / cancelPendingTransfer", () => {
  it("reports the live invite for the store", async () => {
    const row = inviteRow();
    h.prisma.verification.findMany.mockResolvedValue([row]);
    expect(await getPendingTransfer(STORE_ID)).toEqual({
      toEmail: "new@owner.com",
      expiresAt: row.expiresAt.toISOString(),
    });
  });

  it("ignores expired, malformed and merely-mentions-the-store rows", async () => {
    h.prisma.verification.findMany.mockResolvedValue([
      inviteRow({ expiresAt: new Date(Date.now() - 1000) }),
      inviteRow({ value: "{not json" }),
      // The substring scan matches this row (storeName contains the id text),
      // but its parsed storeId is a different store.
      inviteRow({
        value: JSON.stringify({
          storeId: "other_store",
          toEmail: "x@y.co",
          fromUserId: "u",
          storeName: `"storeId":"${STORE_ID}"`,
        }),
      }),
    ]);
    expect(await getPendingTransfer(STORE_ID)).toBeNull();
  });

  it("cancel removes every invite row for the store, expired ones included", async () => {
    await cancelPendingTransfer(STORE_ID);
    expect(h.prisma.verification.deleteMany).toHaveBeenCalledWith({
      where: {
        identifier: { startsWith: "store-transfer:" },
        value: { contains: `"storeId":"${STORE_ID}"` },
      },
    });
  });
});

describe("lookupStoreTransfer (public, read-only)", () => {
  beforeEach(() => {
    h.prisma.verification.findFirst.mockResolvedValue(inviteRow());
    h.prisma.store.findUnique.mockResolvedValue({
      name: "Kopi Kita",
      business: { userId: "old_user", timezone: "Asia/Makassar" },
    });
    h.prisma.user.findUnique.mockResolvedValue({ name: "Old Owner" });
  });

  it("returns what the accept page needs — and never the sender's user id", async () => {
    const result = await lookupStoreTransfer(TOKEN);
    expect(result).toMatchObject({
      storeName: "Kopi Kita",
      toEmail: "new@owner.com",
      fromName: "Old Owner",
      storeTimezone: "Asia/Makassar",
    });
    expect(JSON.stringify(result)).not.toContain("old_user");
    expect(h.prisma.verification.findFirst).toHaveBeenCalledWith({
      where: { identifier: `store-transfer:${TOKEN}` },
    });
  });

  it("404s an unknown token", async () => {
    h.prisma.verification.findFirst.mockResolvedValue(null);
    const err = await rejection(lookupStoreTransfer(TOKEN));
    expect(err.statusCode).toBe(404);
  });

  it("404s a row whose value isn't a valid invite", async () => {
    h.prisma.verification.findFirst.mockResolvedValue(inviteRow({ value: "garbage" }));
    const err = await rejection(lookupStoreTransfer(TOKEN));
    expect(err.statusCode).toBe(404);
  });

  it("410s an expired token and purges the row", async () => {
    h.prisma.verification.findFirst.mockResolvedValue(
      inviteRow({ expiresAt: new Date(Date.now() - 1000) })
    );
    const err = await rejection(lookupStoreTransfer(TOKEN));
    expect(err.statusCode).toBe(410);
    expect(err.code).toBe(ApiErrorCode.TOKEN_EXPIRED);
    expect(h.prisma.verification.deleteMany).toHaveBeenCalledWith({ where: { id: "ver_1" } });
  });

  it("answers exactly like a dead link when the sender no longer owns the store", async () => {
    h.prisma.store.findUnique.mockResolvedValue({
      name: "Kopi Kita",
      business: { userId: "someone_else", timezone: "Asia/Makassar" },
    });
    const err = await rejection(lookupStoreTransfer(TOKEN));
    expect(err.statusCode).toBe(404);
  });

  it("404s when the store was deleted", async () => {
    h.prisma.store.findUnique.mockResolvedValue(null);
    const err = await rejection(lookupStoreTransfer(TOKEN));
    expect(err.statusCode).toBe(404);
  });
});

describe("acceptStoreTransfer — who may accept", () => {
  beforeEach(() => {
    h.prisma.verification.findFirst.mockResolvedValue(inviteRow());
  });

  it("refuses an unverified email address, before touching anything", async () => {
    const err = await rejection(
      acceptStoreTransfer({ token: TOKEN, recipient: { ...recipient, emailVerified: false } })
    );
    expect(err.statusCode).toBe(403);
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
    expect(h.activateFree).not.toHaveBeenCalled();
  });

  it("refuses a signed-in account whose email isn't the one invited", async () => {
    const err = await rejection(
      acceptStoreTransfer({
        token: TOKEN,
        recipient: { ...recipient, email: "someone.else@owner.com" },
      })
    );
    expect(err.statusCode).toBe(403);
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("matches the invited email case- and whitespace-insensitively", async () => {
    const result = await acceptStoreTransfer({
      token: TOKEN,
      recipient: { ...recipient, email: "  New@Owner.COM " },
    });
    expect(result).toEqual({ storeId: STORE_ID });
  });

  it("refuses the sender accepting their own invite", async () => {
    const err = await rejection(
      acceptStoreTransfer({ token: TOKEN, recipient: { ...recipient, id: "old_user" } })
    );
    expect(err.statusCode).toBe(400);
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects an expired token", async () => {
    h.prisma.verification.findFirst.mockResolvedValue(
      inviteRow({ expiresAt: new Date(Date.now() - 1) })
    );
    const err = await rejection(acceptStoreTransfer({ token: TOKEN, recipient }));
    expect(err.statusCode).toBe(410);
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects an unknown token", async () => {
    h.prisma.verification.findFirst.mockResolvedValue(null);
    const err = await rejection(acceptStoreTransfer({ token: TOKEN, recipient }));
    expect(err.statusCode).toBe(404);
  });
});

describe("acceptStoreTransfer — the transfer itself", () => {
  beforeEach(() => {
    h.prisma.verification.findFirst.mockResolvedValue(inviteRow());
  });

  it("moves the store to the recipient's existing business and returns its id", async () => {
    const result = await acceptStoreTransfer({ token: TOKEN, recipient });

    expect(result).toEqual({ storeId: STORE_ID });
    expect(h.tx.business.create).not.toHaveBeenCalled();
    expect(h.tx.store.update).toHaveBeenCalledWith({
      where: { id: STORE_ID },
      data: { businessId: "biz_new", syncFinanceWithBusiness: false },
    });
  });

  it("consumes the token as a single-use lock BEFORE moving anything", async () => {
    await acceptStoreTransfer({ token: TOKEN, recipient });
    expect(h.tx.verification.deleteMany).toHaveBeenCalledWith({ where: { id: "ver_1" } });
    const consumed = h.tx.verification.deleteMany.mock.invocationCallOrder[0];
    const moved = h.tx.store.update.mock.invocationCallOrder[0];
    expect(consumed).toBeLessThan(moved);
  });

  it("loses cleanly to a concurrent accept that already consumed the token", async () => {
    h.tx.verification.deleteMany.mockResolvedValue({ count: 0 });
    const err = await rejection(acceptStoreTransfer({ token: TOKEN, recipient }));
    expect(err.statusCode).toBe(409);
    expect(h.tx.store.update).not.toHaveBeenCalled();
    expect(h.tx.staffMember.create).not.toHaveBeenCalled();
  });

  it("re-checks INSIDE the transaction that the sender still owns the store", async () => {
    h.tx.store.findUnique.mockResolvedValue(
      storeRow({ business: { id: "biz_x", userId: "someone_else", timezone: "UTC", locale: "en" } })
    );
    const err = await rejection(acceptStoreTransfer({ token: TOKEN, recipient }));
    expect(err.statusCode).toBe(404);
    expect(h.tx.verification.deleteMany).not.toHaveBeenCalled();
    expect(h.tx.store.update).not.toHaveBeenCalled();
  });

  it("404s if the store was deleted after the invite was sent", async () => {
    h.tx.store.findUnique.mockResolvedValue(null);
    const err = await rejection(acceptStoreTransfer({ token: TOKEN, recipient }));
    expect(err.statusCode).toBe(404);
  });

  it("won't 'transfer' a store to the business that already holds it", async () => {
    h.tx.business.findUnique.mockResolvedValue({ id: "biz_old" });
    const err = await rejection(acceptStoreTransfer({ token: TOKEN, recipient }));
    expect(err.statusCode).toBe(400);
    expect(h.tx.store.update).not.toHaveBeenCalled();
  });

  it("gives a brand-new recipient a business that inherits the store's timezone/locale", async () => {
    h.tx.business.findUnique.mockResolvedValue(null);

    await acceptStoreTransfer({ token: TOKEN, recipient });

    expect(h.tx.business.create).toHaveBeenCalledWith({
      data: {
        userId: "new_user",
        name: "Kopi Kita",
        email: "new@owner.com",
        timezone: "Asia/Makassar",
        locale: "id",
      },
    });
    expect(h.tx.store.update).toHaveBeenCalledWith({
      where: { id: STORE_ID },
      data: { businessId: "biz_created", syncFinanceWithBusiness: false },
    });
  });

  it("provisions the FREE subscription only for a recipient who has none", async () => {
    h.prisma.subscription.findUnique.mockResolvedValue(null);
    await acceptStoreTransfer({ token: TOKEN, recipient });
    expect(h.activateFree).toHaveBeenCalledWith("new_user", "FREE");

    vi.clearAllMocks();
    h.prisma.verification.findFirst.mockResolvedValue(inviteRow());
    h.prisma.$transaction.mockImplementation(async (cb: (t: typeof h.tx) => unknown) => cb(h.tx));
    h.prisma.subscription.findUnique.mockResolvedValue({ id: "sub_1" });
    h.tx.store.findUnique.mockResolvedValue(storeRow());
    h.tx.verification.deleteMany.mockResolvedValue({ count: 1 });
    h.tx.business.findUnique.mockResolvedValue({ id: "biz_new" });
    h.tx.businessFinanceSettings.findUnique.mockResolvedValue(null);
    await acceptStoreTransfer({ token: TOKEN, recipient });
    expect(h.activateFree).not.toHaveBeenCalled();
  });

  it("removes the old owner: strips their proxy staff row, ends PIN sessions, seats the new owner", async () => {
    await acceptStoreTransfer({ token: TOKEN, recipient });

    expect(h.tx.staffMember.updateMany).toHaveBeenCalledWith({
      where: { storeId: STORE_ID, role: "OWNER" },
      data: {
        role: "MANAGER",
        isActive: false,
        email: null,
        whatsapp: null,
        username: null,
        pin: null,
        allowedPages: [],
      },
    });
    expect(h.tx.staffSession.deleteMany).toHaveBeenCalledWith({ where: { storeId: STORE_ID } });
    expect(h.tx.staffMember.create).toHaveBeenCalledWith({
      data: {
        storeId: STORE_ID,
        name: "Nia",
        email: "new@owner.com",
        role: "OWNER",
        pin: null,
        isActive: true,
        inviteStatus: "accepted",
      },
    });
    // The old row is scrubbed BEFORE the new OWNER row exists, so there is
    // never a moment with two active owners in the store.
    expect(h.tx.staffMember.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      h.tx.staffMember.create.mock.invocationCallOrder[0]
    );
  });

  it("falls back to 'Owner' for a recipient with no display name", async () => {
    await acceptStoreTransfer({ token: TOKEN, recipient: { ...recipient, name: null } });
    expect(h.tx.staffMember.create.mock.calls[0][0].data.name).toBe("Owner");
  });

  it("marks the recipient onboarded and sweeps any leftover invites for the store", async () => {
    await acceptStoreTransfer({ token: TOKEN, recipient });
    expect(h.tx.user.update).toHaveBeenCalledWith({
      where: { id: "new_user" },
      data: { hasOnboarded: true },
    });
    expect(h.tx.verification.deleteMany).toHaveBeenLastCalledWith({
      where: {
        identifier: { startsWith: "store-transfer:" },
        value: { contains: `"storeId":"${STORE_ID}"` },
      },
    });
  });

  it("maps a unique-constraint failure to a clean 409, not a 500", async () => {
    h.prisma.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "test" })
    );
    const err = await rejection(acceptStoreTransfer({ token: TOKEN, recipient }));
    expect(err.statusCode).toBe(409);
  });

  it("lets any other failure propagate unchanged", async () => {
    const boom = new Error("db down");
    h.prisma.$transaction.mockRejectedValue(boom);
    await expect(acceptStoreTransfer({ token: TOKEN, recipient })).rejects.toBe(boom);
  });
});

describe("acceptStoreTransfer — finance settings ride with the store", () => {
  beforeEach(() => {
    h.prisma.verification.findFirst.mockResolvedValue(inviteRow());
  });

  it("leaves finance alone for a store that already has its own settings", async () => {
    await acceptStoreTransfer({ token: TOKEN, recipient });
    expect(h.tx.businessFinanceSettings.findUnique).not.toHaveBeenCalled();
    expect(h.tx.storeFinanceSettings.upsert).not.toHaveBeenCalled();
  });

  it("copies the old business's shared settings onto a store that was syncing to them", async () => {
    h.tx.store.findUnique.mockResolvedValue(storeRow({ syncFinanceWithBusiness: true }));
    const overrides = { QRIS: { percent: 0.7, flat: 0 } };
    h.tx.businessFinanceSettings.findUnique.mockResolvedValue({
      currency: "USD",
      market: PaymentMarket.INDONESIA,
      enabledPaymentMethods: ["CASH", "QRIS"],
      taxEnabled: true,
      taxRate: 0.11,
      taxLabel: "PPN",
      taxInclusive: false,
      serviceChargeEnabled: true,
      serviceChargeRate: 0.05,
      processingFeeEnabled: false,
      processingFeeOverrides: overrides,
    });

    await acceptStoreTransfer({ token: TOKEN, recipient });

    expect(h.tx.businessFinanceSettings.findUnique).toHaveBeenCalledWith({
      where: { businessId: "biz_old" },
    });
    const expected = {
      currency: "USD",
      market: PaymentMarket.INDONESIA,
      enabledPaymentMethods: ["CASH", "QRIS"],
      taxEnabled: true,
      taxRate: 0.11,
      taxLabel: "PPN",
      taxInclusive: false,
      serviceChargeEnabled: true,
      serviceChargeRate: 0.05,
      processingFeeEnabled: false,
      processingFeeOverrides: overrides,
    };
    expect(h.tx.storeFinanceSettings.upsert).toHaveBeenCalledWith({
      where: { storeId: STORE_ID },
      create: { storeId: STORE_ID, ...expected },
      update: expected,
    });
    // Copied BEFORE the store stops syncing / changes business.
    expect(h.tx.storeFinanceSettings.upsert.mock.invocationCallOrder[0]).toBeLessThan(
      h.tx.store.update.mock.invocationCallOrder[0]
    );
    expect(h.tx.store.update).toHaveBeenCalledWith({
      where: { id: STORE_ID },
      data: { businessId: "biz_new", syncFinanceWithBusiness: false },
    });
  });

  it("pins the app defaults when the syncing business never configured anything", async () => {
    // Without this, a stale StoreFinanceSettings row from before syncing was
    // switched on would suddenly become the store's real config.
    h.tx.store.findUnique.mockResolvedValue(storeRow({ syncFinanceWithBusiness: true }));
    h.tx.businessFinanceSettings.findUnique.mockResolvedValue(null);

    await acceptStoreTransfer({ token: TOKEN, recipient });

    const { create } = h.tx.storeFinanceSettings.upsert.mock.calls[0][0];
    expect(create).toEqual({
      storeId: STORE_ID,
      currency: "IDR",
      market: PaymentMarket.INDONESIA,
      enabledPaymentMethods: DEFAULT_ENABLED_PAYMENT_METHODS,
      taxEnabled: false,
      taxRate: 0,
      taxLabel: null,
      taxInclusive: true,
      serviceChargeEnabled: false,
      serviceChargeRate: 0,
      processingFeeEnabled: true,
      processingFeeOverrides: Prisma.JsonNull,
    });
  });

  it("stores a null fee-override table as JSON null, not a JS null Prisma would reject", async () => {
    h.tx.store.findUnique.mockResolvedValue(storeRow({ syncFinanceWithBusiness: true }));
    h.tx.businessFinanceSettings.findUnique.mockResolvedValue({
      currency: "IDR",
      market: PaymentMarket.INDONESIA,
      enabledPaymentMethods: ["CASH"],
      taxEnabled: false,
      taxRate: 0,
      taxLabel: null,
      taxInclusive: true,
      serviceChargeEnabled: false,
      serviceChargeRate: 0,
      processingFeeEnabled: true,
      processingFeeOverrides: null,
    });

    await acceptStoreTransfer({ token: TOKEN, recipient });

    expect(h.tx.storeFinanceSettings.upsert.mock.calls[0][0].create.processingFeeOverrides).toBe(
      Prisma.JsonNull
    );
  });
});
