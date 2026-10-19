import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

var mockPrisma: any;
vi.mock("@/lib/prisma", () => {
  mockPrisma = {
    partner: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
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

import {
  addPartnerViewer,
  getReferralBanner,
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
