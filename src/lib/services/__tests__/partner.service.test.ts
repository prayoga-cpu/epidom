import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

var mockPrisma: any;
vi.mock("@/lib/prisma", () => {
  mockPrisma = {
    partner: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      updateMany: vi.fn(),
    },
    user: { findUnique: vi.fn() },
    verification: { create: vi.fn(), deleteMany: vi.fn(), findFirst: vi.fn() },
    partnerViewer: { upsert: vi.fn(), deleteMany: vi.fn() },
    partnerSalesPage: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      upsert: vi.fn(),
    },
    session: { findFirst: vi.fn() },
    partnerCommission: { findMany: vi.fn() },
    signupAttribution: { findMany: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
  };
  return { prisma: mockPrisma };
});
vi.mock("@/lib/services/partner-commission.service", () => ({
  backfillCustomerCommissions: vi.fn().mockResolvedValue(0),
}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));
const sendPartnerInviteEmail = vi.fn();
const sendPartnerAccessEmail = vi.fn();
vi.mock("@/lib/services/email.service", () => ({
  sendPartnerInviteEmail: (...a: unknown[]) => sendPartnerInviteEmail(...a),
  sendPartnerAccessEmail: (...a: unknown[]) => sendPartnerAccessEmail(...a),
}));

import {
  acceptPartnerInvite,
  addPartnerViewer,
  createPartner,
  getReferralBanner,
  lookupPartnerInvite,
  normalizeEmail,
  recordPayout,
  resolveSignupPartner,
  setPartnerSalesPages,
  totalsByCurrency,
  updatePartner,
} from "../partner.service";

const D = (v: string | number) => new Prisma.Decimal(v);
const NOW = new Date("2026-11-30T00:00:00Z");

describe("normalizeEmail", () => {
  it("treats Gmail dots, +tags and googlemail as the same mailbox", () => {
    expect(normalizeEmail("Bob.Martin+promo@GoogleMail.com")).toBe("bobmartin@gmail.com");
    expect(normalizeEmail("b.o.b@gmail.com")).toBe("bob@gmail.com");
    expect(normalizeEmail("bob.martin+x@example.fr")).toBe("bob.martin@example.fr");
  });
});

describe("totalsByCurrency", () => {
  it("splits on hold / ready / paid per currency, never adding currencies, ignoring voids", () => {
    const rows = [
      {
        currency: "eur",
        amount: D("4.19"),
        status: "PENDING",
        payableAt: new Date("2026-11-19T00:00:00Z"),
      },
      {
        currency: "eur",
        amount: D("-1.00"),
        status: "PENDING",
        payableAt: new Date("2026-11-19T00:00:00Z"),
      },
      {
        currency: "eur",
        amount: D("4.19"),
        status: "PENDING",
        payableAt: new Date("2026-12-19T00:00:00Z"),
      },
      {
        currency: "eur",
        amount: D("4.19"),
        status: "PAID",
        payableAt: new Date("2026-10-19T00:00:00Z"),
      },
      {
        currency: "eur",
        amount: D("9.99"),
        status: "VOID",
        payableAt: new Date("2026-10-19T00:00:00Z"),
      },
      {
        currency: "idr",
        amount: D("68700.00"),
        status: "PENDING",
        payableAt: new Date("2026-11-01T00:00:00Z"),
      },
    ];
    expect(totalsByCurrency(rows, NOW)).toEqual([
      { currency: "eur", onHold: "4.19", ready: "3.19", paid: "4.19" },
      { currency: "idr", onHold: "0.00", ready: "68700.00", paid: "0.00" },
    ]);
  });
});

describe("resolveSignupPartner", () => {
  const partner = (over: Record<string, unknown> = {}) => ({
    id: "p1",
    userId: "partner_user",
    status: "ACTIVE",
    commissionRate: D(30),
    commissionMonths: 3,
    customerDiscountPercent: D(10),
    user: { email: "bob@gmail.com" },
    ...over,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.session.findFirst.mockResolvedValue(null);
  });

  it("a referral link credits its active partner, with the discount", async () => {
    mockPrisma.partner.findUnique.mockResolvedValue(partner());
    const credit = await resolveSignupPartner(
      { source: "REFERRAL_LINK", refCode: "BOB", salesPage: null },
      { id: "u_new", email: "cafe@example.com" },
      "1.2.3.4",
      NOW
    );
    expect(credit).toMatchObject({ partnerId: "p1", commissionMonths: 3, selfReferralFlag: false });
    expect(Number(credit!.discountPercent)).toBe(10);
    expect(Number(credit!.commissionRate)).toBe(30);
  });

  it("a sales page credits its owner from the credit-from date, with no customer discount", async () => {
    mockPrisma.partnerSalesPage.findUnique.mockResolvedValue({
      creditFrom: new Date("2026-10-20T00:00:00Z"),
      partner: partner({ id: "aaron" }),
    });
    const credit = await resolveSignupPartner(
      { source: "SALES_PAGE", refCode: null, salesPage: "sales-page-2" },
      { id: "u_new", email: "cafe@example.com" },
      null,
      NOW
    );
    expect(credit).toMatchObject({ partnerId: "aaron", discountPercent: null });
  });

  it("nothing before the page's credit-from date, nor for a paused or ended partner", async () => {
    mockPrisma.partnerSalesPage.findUnique.mockResolvedValue({
      creditFrom: new Date("2026-12-01T00:00:00Z"),
      partner: partner(),
    });
    expect(
      await resolveSignupPartner(
        { source: "SALES_PAGE", refCode: null, salesPage: "sales-page-2" },
        { id: "u", email: "x@y.com" },
        null,
        NOW
      )
    ).toBeNull();
    mockPrisma.partner.findUnique.mockResolvedValue(partner({ status: "PAUSED" }));
    expect(
      await resolveSignupPartner(
        { source: "REFERRAL_LINK", refCode: "BOB", salesPage: null },
        { id: "u", email: "x@y.com" },
        null,
        NOW
      )
    ).toBeNull();
  });

  it("refuses the partner's own mailbox, and flags a sign-up from the partner's IP", async () => {
    mockPrisma.partner.findUnique.mockResolvedValue(partner());
    expect(
      await resolveSignupPartner(
        { source: "REFERRAL_LINK", refCode: "BOB", salesPage: null },
        { id: "u2", email: "b.o.b+2@gmail.com" },
        null,
        NOW
      )
    ).toBeNull();

    mockPrisma.session.findFirst.mockResolvedValue({ id: "s1" });
    const flagged = await resolveSignupPartner(
      { source: "REFERRAL_LINK", refCode: "BOB", salesPage: null },
      { id: "u3", email: "someone@else.com" },
      "9.9.9.9",
      NOW
    );
    expect(flagged?.selfReferralFlag).toBe(true);
    expect(mockPrisma.session.findFirst).toHaveBeenCalledWith({
      where: { userId: "partner_user", ipAddress: "9.9.9.9" },
      select: { id: true },
    });
  });

  it("no source, no partner", async () => {
    expect(
      await resolveSignupPartner(
        { source: null, refCode: null, salesPage: null },
        { id: "u", email: "a@b.c" },
        null
      )
    ).toBeNull();
  });
});

describe("guards on partner changes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("nobody changes their own deal", async () => {
    mockPrisma.partner.findUnique.mockResolvedValue({ id: "p1", userId: "me" });
    await expect(updatePartner("p1", { commissionRate: 90 }, "me")).rejects.toThrow(
      /own partner deal/
    );
  });

  it("a sales page has one owner", async () => {
    mockPrisma.partner.findUnique.mockResolvedValue({ id: "p1", userId: "aaron" });
    mockPrisma.partnerSalesPage.findMany.mockResolvedValue([
      { page: "sales-page-2", partner: { displayName: "Bob" } },
    ]);
    await expect(
      setPartnerSalesPages("p1", { pages: [{ page: "sales-page-2", creditFrom: NOW }] }, "admin")
    ).rejects.toThrow(/sales-page-2 already belongs to Bob/);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("a payout needs something ready to pay in that currency", async () => {
    mockPrisma.partner.findUnique.mockResolvedValue({ userId: "aaron" });
    mockPrisma.partnerCommission.findMany.mockResolvedValue([]);
    await expect(recordPayout("p1", { currency: "eur", paidAt: NOW }, "admin")).rejects.toThrow(
      /Nothing is ready to pay in EUR/
    );
  });

  it("a payout's amount is the server's sum of ready rows", async () => {
    mockPrisma.partner.findUnique.mockResolvedValue({ userId: "aaron" });
    mockPrisma.partnerCommission.findMany.mockResolvedValue([
      { id: "c1", amount: D("4.19") },
      { id: "c2", amount: D("4.19") },
      { id: "c3", amount: D("-1.00") },
    ]);
    const tx = {
      partnerPayout: {
        create: vi.fn().mockResolvedValue({ id: "po_1", amount: D("7.38"), currency: "eur" }),
      },
      partnerCommission: { updateMany: vi.fn().mockResolvedValue({ count: 3 }) },
    };
    mockPrisma.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));

    await recordPayout("p1", { currency: "eur", reference: "VIR-1", paidAt: NOW }, "admin");

    expect(tx.partnerPayout.create.mock.calls[0][0].data).toMatchObject({
      currency: "eur",
      amount: "7.38",
      reference: "VIR-1",
    });
    expect(tx.partnerCommission.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["c1", "c2", "c3"] }, status: "PENDING" },
      data: { status: "PAID", payoutId: "po_1" },
    });
  });
});

describe("getReferralBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows an active partner's name and discount, nothing for others or bad codes", async () => {
    mockPrisma.partner.findUnique.mockResolvedValue({
      displayName: "Bob",
      customerDiscountPercent: D(10),
      status: "ACTIVE",
    });
    expect(await getReferralBanner("bob")).toEqual({ displayName: "Bob", discountPercent: 10 });
    expect(mockPrisma.partner.findUnique.mock.calls[0][0].where).toEqual({ referralCode: "BOB" });

    mockPrisma.partner.findUnique.mockResolvedValue({
      displayName: "Bob",
      customerDiscountPercent: D(10),
      status: "ENDED",
    });
    expect(await getReferralBanner("BOB")).toBeNull();
    expect(await getReferralBanner("<x>")).toBeNull();
  });
});

describe("partner page viewers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adds an existing account as a read-only viewer, once", async () => {
    mockPrisma.partner.findUnique.mockResolvedValue({ userId: "aaron_user" });
    mockPrisma.user.findUnique.mockResolvedValue({ id: "evan_user" });
    await addPartnerViewer("aaron", " ECAO.inquiries@gmail.com ", "admin");
    expect(mockPrisma.user.findUnique.mock.calls[0][0].where).toEqual({
      email: "ecao.inquiries@gmail.com",
    });
    expect(mockPrisma.partnerViewer.upsert).toHaveBeenCalledWith({
      where: { partnerId_userId: { partnerId: "aaron", userId: "evan_user" } },
      create: { partnerId: "aaron", userId: "evan_user", createdById: "admin" },
      update: {},
    });
  });

  it("refuses an unknown email and the partner's own account", async () => {
    mockPrisma.partner.findUnique.mockResolvedValue({ userId: "aaron_user" });
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(addPartnerViewer("aaron", "nobody@x.com", "admin")).rejects.toThrow(
      /sign up first/
    );
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "aaron_user" });
    await expect(addPartnerViewer("aaron", "aaron@x.com", "admin")).rejects.toThrow(/own account/);
    expect(mockPrisma.partnerViewer.upsert).not.toHaveBeenCalled();
  });
});

describe("making someone a partner: picked user, or invitation", () => {
  const deal = {
    displayName: "Bob",
    referralCode: "BOB",
    referralLanding: "REGISTER" as const,
    commissionRate: 30,
    commissionMonths: 3,
    customerDiscountPercent: 10,
    notes: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.partner.findUnique.mockResolvedValue(null); // code free
    mockPrisma.partner.findFirst.mockResolvedValue(null);
    mockPrisma.partner.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: "p_new", ...data, commissionRate: D(data.commissionRate), customerDiscountPercent: D(data.customerDiscountPercent) })
    );
    mockPrisma.signupAttribution.findMany.mockResolvedValue([]);
    mockPrisma.verification.create.mockResolvedValue({});
    mockPrisma.verification.deleteMany.mockResolvedValue({ count: 0 });
    sendPartnerInviteEmail.mockResolvedValue({ success: true });
    sendPartnerAccessEmail.mockResolvedValue({ success: true });
  });

  it("a user picked from the list is linked at once and told by email", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: "u_bob", email: "bob@x.com", partner: null });
    const res = await createPartner({ ...deal, userId: "u_bob" }, "admin");
    expect(res).toEqual({ partner: { id: "p_new" }, invited: false });
    expect(mockPrisma.partner.create.mock.calls[0][0].data).toMatchObject({ userId: "u_bob", inviteEmail: null });
    expect(sendPartnerAccessEmail).toHaveBeenCalledWith(
      "bob@x.com",
      "Bob",
      expect.stringContaining("30% of what each customer you bring pays during their first 3 months"),
      expect.stringContaining("/admin/my-referrals")
    );
    expect(mockPrisma.verification.create).not.toHaveBeenCalled();
  });

  it("an email with no account gets a partner waiting for them and an invitation", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const res = await createPartner({ ...deal, inviteEmail: "New.Bob@X.com" }, "admin");
    expect(res.invited).toBe(true);
    expect(mockPrisma.partner.create.mock.calls[0][0].data).toMatchObject({
      userId: null,
      inviteEmail: "new.bob@x.com",
    });
    const row = mockPrisma.verification.create.mock.calls[0][0].data;
    expect(row.identifier).toMatch(/^partner-invite:[a-f0-9]{64}$/);
    expect(JSON.parse(row.value)).toEqual({ partnerId: "p_new", email: "new.bob@x.com" });
    expect(sendPartnerInviteEmail.mock.calls[0][3]).toMatch(/\/partner-invite\?token=[a-f0-9]{64}$/);
  });

  it("an invited email that already has an account is linked instead", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: "u_bob", email: "bob@x.com", partner: null });
    const res = await createPartner({ ...deal, inviteEmail: "bob@x.com" }, "admin");
    expect(res.invited).toBe(false);
    expect(sendPartnerInviteEmail).not.toHaveBeenCalled();
  });

  it("when the invitation can't be sent, no partner is left behind", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    sendPartnerInviteEmail.mockResolvedValue({ success: false, error: "resend down" });
    await expect(createPartner({ ...deal, inviteEmail: "new@x.com" }, "admin")).rejects.toThrow(
      /couldn't send the invitation/
    );
    expect(mockPrisma.partner.delete).toHaveBeenCalledWith({ where: { id: "p_new" } });
  });

  it("refuses a sales page someone else owns before creating anything", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: "u_aaron", email: "a@x.com", partner: null });
    mockPrisma.partnerSalesPage.findUnique.mockResolvedValue({ partner: { displayName: "Bob" } });
    await expect(
      createPartner(
        { ...deal, referralCode: null, userId: "u_aaron", salesPage: { page: "sales-page-2", creditFrom: NOW } },
        "admin"
      )
    ).rejects.toThrow(/sales-page-2 already belongs to Bob/);
    expect(mockPrisma.partner.create).not.toHaveBeenCalled();
  });
});

describe("accepting a partner invitation", () => {
  const TOKEN = "a".repeat(64);
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.verification.findFirst.mockResolvedValue({
      id: "v1",
      value: JSON.stringify({ partnerId: "p_new", email: "new@x.com" }),
      expiresAt: new Date(Date.now() + 86400000),
    });
    mockPrisma.partner.findUnique.mockImplementation(({ where }: any) =>
      Promise.resolve(
        where.id
          ? { id: "p_new", userId: null, displayName: "Bob", commissionRate: D(30), commissionMonths: 3, referralCode: "BOB", customerDiscountPercent: D(10), salesPages: [] }
          : null
      )
    );
    const tx = {
      verification: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      partner: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    mockPrisma.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));
  });

  it("shows the deal to whoever holds the link", async () => {
    expect(await lookupPartnerInvite(TOKEN)).toMatchObject({
      displayName: "Bob",
      email: "new@x.com",
      commissionRate: 30,
      hasReferralLink: true,
    });
  });

  it("links the partner to the invited, verified address only", async () => {
    await expect(
      acceptPartnerInvite(TOKEN, { id: "u1", email: "other@x.com", emailVerified: true })
    ).rejects.toThrow(/This invitation is for new@x.com/);
    await expect(
      acceptPartnerInvite(TOKEN, { id: "u1", email: "NEW@x.com", emailVerified: false })
    ).rejects.toThrow(/Verify your email/);
    expect(
      await acceptPartnerInvite(TOKEN, { id: "u1", email: "NEW@x.com", emailVerified: true })
    ).toEqual({ partnerId: "p_new" });
  });

  it("an expired invitation is refused (and removed)", async () => {
    mockPrisma.verification.findFirst.mockResolvedValue({
      id: "v1",
      value: JSON.stringify({ partnerId: "p_new", email: "new@x.com" }),
      expiresAt: new Date(Date.now() - 1000),
    });
    await expect(lookupPartnerInvite(TOKEN)).rejects.toThrow(/expired/);
    expect(mockPrisma.verification.deleteMany).toHaveBeenCalledWith({ where: { id: "v1" } });
  });
});
