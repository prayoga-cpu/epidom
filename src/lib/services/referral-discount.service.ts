import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

/**
 * The discount a partner's referral link gives a new customer: a % off their
 * first paid invoice (Partner.customerDiscountPercent, copied onto their
 * SignupAttribution at sign-up, so a later edit doesn't change what the banner
 * promised them). Sales-page sign-ups never get one.
 *
 * Applied as a one-time Stripe coupon:
 * - without a trial, on the Checkout Session (`discounts`): the first invoice
 *   is paid right away;
 * - with the POS trial, after Checkout (handleCheckoutSessionCompleted puts it
 *   on the subscription): the trial's $0 invoice already exists by then, so
 *   the coupon lands on the first paid invoice instead of being used up on it.
 */

/** One coupon per percentage, reused by every referral: "epidom-ref-once-10", "epidom-ref-once-12_5". */
export function referralCouponId(percent: number): string {
  return `epidom-ref-once-${String(Number(percent.toFixed(2))).replace(".", "_")}`;
}

/** The coupon for this percentage, created on first use. */
export async function ensureReferralCoupon(percent: number): Promise<string> {
  const id = referralCouponId(percent);
  try {
    await stripe.coupons.retrieve(id);
    return id;
  } catch (err) {
    if (!(err instanceof Stripe.errors.StripeError) || err.code !== "resource_missing") throw err;
  }
  try {
    await stripe.coupons.create({
      id,
      percent_off: Number(percent.toFixed(2)),
      duration: "once",
      name: `Referral ${percent}% off`,
    });
  } catch (err) {
    // Two checkouts racing to create it: the other one won.
    if (!(err instanceof Stripe.errors.StripeError) || err.code !== "resource_already_exists")
      throw err;
  }
  return id;
}

export interface CheckoutReferralDiscount {
  couponId: string;
  percent: number;
}

/**
 * The referral discount a checkout should carry, or null. Only for an account
 * credited to an active-or-paused partner through a referral link, that has
 * never paid anything nor had a Stripe subscription, and hasn't used it yet.
 */
export async function getCheckoutReferralDiscount(
  userId: string,
  subscription: { stripeSubscriptionId: string | null } | null
): Promise<CheckoutReferralDiscount | null> {
  if (subscription?.stripeSubscriptionId) return null;
  const attribution = await prisma.signupAttribution.findUnique({
    where: { userId },
    select: {
      source: true,
      discountPercent: true,
      discountRedeemedAt: true,
      firstPaidAt: true,
      partner: { select: { status: true } },
    },
  });
  if (
    !attribution ||
    attribution.source !== "REFERRAL_LINK" ||
    !attribution.partner ||
    attribution.partner.status === "ENDED" ||
    attribution.discountRedeemedAt ||
    attribution.firstPaidAt
  ) {
    return null;
  }
  const percent = Number(attribution.discountPercent ?? 0);
  if (!(percent > 0 && percent <= 50)) return null;
  return { couponId: await ensureReferralCoupon(percent), percent };
}
