import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

const h = vi.hoisted(() => ({
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  create: vi.fn(),
  resolve: vi.fn(),
  banner: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    signupAttribution: {
      findUnique: h.findUnique,
      updateMany: h.updateMany,
      create: h.create,
    },
  },
}));
vi.mock("@/lib/services/partner.service", () => ({
  resolveSignupPartner: h.resolve,
  getReferralBanner: h.banner,
}));

import {
  applyReferralCode,
  getCreditedReferral,
  previewReferralCode,
} from "../referral-code.service";

const USER = { id: "u1", email: "a@b.fr" };
const credit = {
  partnerId: "p1",
  commissionRate: new Prisma.Decimal(30),
  commissionMonths: 3,
  discountPercent: new Prisma.Decimal(10),
  selfReferralFlag: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  h.updateMany.mockResolvedValue({ count: 1 });
});

describe("previewReferralCode", () => {
  it("normalizes the code and returns the partner's offer", async () => {
    h.banner.mockResolvedValue({ displayName: "Bob", discountPercent: 10 });
    expect(await previewReferralCode(" bob10 ")).toEqual({
      code: "BOB10",
      displayName: "Bob",
      discountPercent: 10,
    });
  });
  it("null for a malformed or unknown code", async () => {
    expect(await previewReferralCode("a b")).toBeNull();
    h.banner.mockResolvedValue(null);
    expect(await previewReferralCode("NOPE")).toBeNull();
  });
});

describe("applyReferralCode", () => {
  it("credits an account no partner is credited with, as a typed code", async () => {
    h.findUnique.mockResolvedValue({ partnerId: null });
    h.resolve.mockResolvedValue(credit);
    expect(await applyReferralCode(USER, "bob10")).toBe(true);
    expect(h.resolve).toHaveBeenCalledWith(
      { source: "REFERRAL_LINK", refCode: "BOB10", salesPage: null },
      USER,
      null,
      expect.any(Date)
    );
    expect(h.updateMany).toHaveBeenCalledWith({
      where: { userId: "u1", partnerId: null },
      data: expect.objectContaining({ source: "REFERRAL_CODE", refCode: "BOB10", partnerId: "p1" }),
    });
  });

  it("creates the row when the account has none", async () => {
    h.findUnique.mockResolvedValue(null);
    h.resolve.mockResolvedValue(credit);
    expect(await applyReferralCode(USER, "BOB10")).toBe(true);
    expect(h.create).toHaveBeenCalled();
  });

  it("never replaces a credit that is already locked in", async () => {
    h.findUnique.mockResolvedValue({ partnerId: "p0" });
    expect(await applyReferralCode(USER, "BOB10")).toBe(false);
    expect(h.updateMany).not.toHaveBeenCalled();
  });

  it("false for a self-referral or unknown partner, and never throws", async () => {
    h.findUnique.mockResolvedValue({ partnerId: null });
    h.resolve.mockResolvedValue(null);
    expect(await applyReferralCode(USER, "BOB10")).toBe(false);
    h.resolve.mockRejectedValue(new Error("db"));
    expect(await applyReferralCode(USER, "BOB10")).toBe(false);
  });
});

describe("getCreditedReferral", () => {
  it("returns the partner's offer while it is unused", async () => {
    h.findUnique.mockResolvedValue({
      refCode: "BOB10",
      discountPercent: new Prisma.Decimal(10),
      discountRedeemedAt: null,
      partner: { displayName: "Bob", status: "ACTIVE" },
    });
    expect(await getCreditedReferral("u1")).toEqual({
      code: "BOB10",
      displayName: "Bob",
      discountPercent: 10,
    });
  });
  it("null with no partner, an ended one, or a used discount", async () => {
    h.findUnique.mockResolvedValue({ partner: null });
    expect(await getCreditedReferral("u1")).toBeNull();
    h.findUnique.mockResolvedValue({
      discountPercent: new Prisma.Decimal(10),
      discountRedeemedAt: new Date(),
      partner: { displayName: "Bob", status: "ACTIVE" },
    });
    expect(await getCreditedReferral("u1")).toBeNull();
  });
});
