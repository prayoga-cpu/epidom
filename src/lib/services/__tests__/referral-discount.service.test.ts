import { describe, it, expect, vi, beforeEach } from "vitest";
import Stripe from "stripe";
import { Prisma } from "@prisma/client";

var mockStripe: any;
vi.mock("@/lib/stripe", () => {
  mockStripe = { coupons: { retrieve: vi.fn(), create: vi.fn() } };
  return { stripe: mockStripe };
});
var mockPrisma: any;
vi.mock("@/lib/prisma", () => {
  mockPrisma = { signupAttribution: { findUnique: vi.fn() } };
  return { prisma: mockPrisma };
});

import {
  ensureReferralCoupon,
  getCheckoutReferralDiscount,
  referralCouponId,
} from "../referral-discount.service";

const stripeError = (code: string) =>
  Stripe.errors.StripeError.generate({
    type: "invalid_request_error",
    code,
    message: code,
  } as never);

describe("referral coupons", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("one id per percentage", () => {
    expect(referralCouponId(10)).toBe("epidom-ref-once-10");
    expect(referralCouponId(12.5)).toBe("epidom-ref-once-12_5");
  });

  it("reuses the coupon, or creates a one-time one", async () => {
    mockStripe.coupons.retrieve.mockResolvedValueOnce({ id: "epidom-ref-once-10" });
    expect(await ensureReferralCoupon(10)).toBe("epidom-ref-once-10");
    expect(mockStripe.coupons.create).not.toHaveBeenCalled();

    mockStripe.coupons.retrieve.mockRejectedValueOnce(stripeError("resource_missing"));
    mockStripe.coupons.create.mockResolvedValueOnce({});
    await ensureReferralCoupon(10);
    expect(mockStripe.coupons.create).toHaveBeenCalledWith(
      expect.objectContaining({ id: "epidom-ref-once-10", percent_off: 10, duration: "once" })
    );
  });

  it("another checkout creating it at the same moment is fine", async () => {
    mockStripe.coupons.retrieve.mockRejectedValueOnce(stripeError("resource_missing"));
    mockStripe.coupons.create.mockRejectedValueOnce(stripeError("resource_already_exists"));
    expect(await ensureReferralCoupon(10)).toBe("epidom-ref-once-10");
  });
});

describe("getCheckoutReferralDiscount", () => {
  const attribution = (over: Record<string, unknown> = {}) => ({
    source: "REFERRAL_LINK",
    discountPercent: new Prisma.Decimal(10),
    discountRedeemedAt: null,
    firstPaidAt: null,
    partner: { status: "ACTIVE" },
    ...over,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockStripe.coupons.retrieve.mockResolvedValue({ id: "epidom-ref-once-10" });
  });

  it("gives a referral-link customer's first checkout the discount", async () => {
    mockPrisma.signupAttribution.findUnique.mockResolvedValue(attribution());
    expect(await getCheckoutReferralDiscount("u1", null)).toEqual({
      couponId: "epidom-ref-once-10",
      percent: 10,
    });
  });

  it.each([
    ["a sales-page sign-up", { source: "SALES_PAGE" }],
    ["no partner", { partner: null }],
    ["an ended partner", { partner: { status: "ENDED" } }],
    ["already used", { discountRedeemedAt: new Date() }],
    ["already paid once", { firstPaidAt: new Date() }],
    ["no discount", { discountPercent: null }],
    ["over the 50% cap", { discountPercent: new Prisma.Decimal(80) }],
  ])("none for %s", async (_label, over) => {
    mockPrisma.signupAttribution.findUnique.mockResolvedValue(attribution(over));
    expect(await getCheckoutReferralDiscount("u1", null)).toBeNull();
  });

  it("none for an account that already had a Stripe subscription", async () => {
    mockPrisma.signupAttribution.findUnique.mockResolvedValue(attribution());
    expect(await getCheckoutReferralDiscount("u1", { stripeSubscriptionId: "sub_old" })).toBeNull();
    expect(mockPrisma.signupAttribution.findUnique).not.toHaveBeenCalled();
  });
});
