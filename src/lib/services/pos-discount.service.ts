import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { planHasFeature, type PlanTier } from "@/lib/plans/entitlements";
import {
  buildDiscountReason,
  checkCouponEligibility,
  checkRedeem,
  composeOrderDiscount,
  computeRuleDiscount,
  type CouponRejection,
  type RedeemRejection,
} from "@/lib/finance/discounts";
import { getLoyaltyRules } from "./loyalty.service";
import { OrderBuildError } from "./pos-order-builder";

/**
 * Server-side pricing of an order's discount.
 *
 * The rule this file exists to enforce: for a PRESET, a COUPON or a POINTS
 * redemption the server derives the amount itself (from the store's own rows)
 * and rebuilds `discountReason` itself. A client-sent `discountAmount` is only
 * ever honored as the existing MANUAL discount, and only when no preset/coupon
 * was sent — otherwise a tampered or stale cart could write its own price.
 *
 * All money here is LITERAL in the store's display currency, never
 * IDR-converted (see src/lib/finance/discounts.ts).
 */

type DiscountDb = Prisma.TransactionClient | typeof prisma;

/** The store's plan is below OPERATIONS — callers map this to a 403. */
export class PromotionsPlanError extends Error {
  constructor(
    message = "Discount presets, coupons and loyalty points require the Operations plan."
  ) {
    super(message);
  }
}

export interface ResolveOrderDiscountArgs {
  storeId: string;
  /** Sum of the repriced order lines, before service charge/tax. */
  itemsTotal: number;
  /** Client-sent manual discount. Honored only when no preset/coupon is sent. */
  discountAmount?: number;
  discountReason?: string;
  presetId?: string;
  couponCode?: string;
  redeemPoints?: number;
  customerId?: string;
  /**
   * Offline replay (the request carried a clientRequestId): the customer has
   * ALREADY been charged the discounted price on a disconnected till, and the
   * queue deletes an entry after 5 failed replays. Nothing in here may throw
   * in that mode — it degrades to the flat amount the customer got, skips the
   * redemption bookkeeping, and records a warning instead.
   */
  tolerant: boolean;
  tx?: Prisma.TransactionClient;
}

export interface ResolvedOrderDiscount {
  /** What goes into Order.discountAmount (primary + points value). */
  discountAmount: number;
  /** Server-built ("Preset: X + Points: 50"), or the cashier's manual reason. */
  discountReason?: string;
  /** Set only when the coupon is to be consumed inside the order transaction. */
  couponId: string | null;
  /** Read alongside the coupon so the usedCount bump can be conditional. */
  couponMaxUses: number | null;
  /** Points that will really be burned (0 when nothing is to be redeemed). */
  pointsRedeemed: number;
  /** Non-fatal degradations, appended to Order.notes by the caller. */
  warnings: string[];
}

const COUPON_REJECTION_MESSAGES: Record<CouponRejection, string> = {
  INACTIVE: "This coupon is no longer active",
  NOT_STARTED: "This coupon is not valid yet",
  EXPIRED: "This coupon has expired",
  USED_UP: "This coupon has already been fully used",
  BELOW_MINIMUM: "The bill is below this coupon's minimum",
};

const REDEEM_REJECTION_MESSAGES: Record<RedeemRejection, string> = {
  DISABLED: "Loyalty points are not enabled for this store",
  BELOW_MINIMUM: "Below the store's minimum redemption",
  EXCEEDS_BALANCE: "The customer does not have that many points",
  EXCEEDS_PAYABLE: "That many points is more than the bill",
};

/**
 * Whether this STORE's plan covers presets/coupons/points. The plan always
 * belongs to the store owner (a linked staff account has no subscription of
 * its own — same rule as requirePlan), so it is resolved store → business →
 * user → subscription here rather than from the caller's session. Exported
 * because every OPERATIONS-gated promotion route needs the same check and
 * `operationsGuard` only takes a userId + returns a NextResponse.
 */
export async function storeHasPromotionsPlan(
  storeId: string,
  tx?: Prisma.TransactionClient
): Promise<boolean> {
  const db: DiscountDb = tx ?? prisma;
  const store = await db.store.findUnique({
    where: { id: storeId },
    select: {
      business: {
        select: { user: { select: { subscription: { select: { plan: true, status: true } } } } },
      },
    },
  });
  const subscription = store?.business?.user?.subscription;
  const plan: PlanTier =
    subscription && subscription.status === "ACTIVE" ? subscription.plan : "FREE";
  return planHasFeature(plan, "loyaltyAndPromotions");
}

export async function resolveOrderDiscount(
  args: ResolveOrderDiscountArgs
): Promise<ResolvedOrderDiscount> {
  const db: DiscountDb = args.tx ?? prisma;
  const { tolerant, storeId, itemsTotal } = args;
  const warnings: string[] = [];

  /** The manual fallback: what the customer was actually charged off-line. */
  const manualAmount = Math.max(args.discountAmount ?? 0, 0);
  const manualReason = args.discountReason?.trim() || undefined;

  let primaryAmount = 0;
  let primaryReason: string | undefined;
  let couponId: string | null = null;
  let couponMaxUses: number | null = null;
  let requestedPoints = args.redeemPoints ?? 0;
  let presetId = args.presetId;
  let couponCode = args.couponCode;

  const usesGatedFeature = !!presetId || !!couponCode || requestedPoints > 0;
  if (usesGatedFeature && !(await storeHasPromotionsPlan(storeId, args.tx))) {
    if (!tolerant) throw new PromotionsPlanError();
    // Offline replay on a store that has since downgraded: the sale already
    // happened at the discounted price, so keep the money and drop the
    // mechanics.
    warnings.push("Promotions are not available on this plan");
    presetId = undefined;
    couponCode = undefined;
    requestedPoints = 0;
  }

  // Preset and coupon are mutually exclusive in the cart (latest wins). If a
  // payload somehow carries both, the coupon wins — it is the one with
  // usage bookkeeping attached, so honoring the other would silently discard
  // a redemption the customer believes they used.
  if (presetId && couponCode) {
    warnings.push("Both a preset and a coupon were sent; the coupon was applied");
    presetId = undefined;
  }

  if (presetId) {
    const preset = await db.discountPreset.findFirst({
      where: { id: presetId, storeId },
      select: { id: true, name: true, type: true, value: true, isActive: true },
    });
    if (!preset || !preset.isActive) {
      if (!tolerant) throw new OrderBuildError("Discount preset not found or inactive");
      warnings.push("Discount preset unavailable; kept the amount already applied");
      primaryAmount = manualAmount;
      primaryReason = manualReason;
    } else {
      primaryAmount = computeRuleDiscount(
        { type: preset.type, value: Number(preset.value) },
        itemsTotal
      );
      primaryReason = `Preset: ${preset.name}`;
    }
  } else if (couponCode) {
    const coupon = await db.coupon.findFirst({
      // Codes are stored uppercase; the cashier may type any case.
      where: { storeId, code: couponCode.trim().toUpperCase() },
    });
    const rejection = coupon
      ? checkCouponEligibility(
          {
            isActive: coupon.isActive,
            validFrom: coupon.validFrom,
            validUntil: coupon.validUntil,
            maxUses: coupon.maxUses,
            usedCount: coupon.usedCount,
            minSubtotal: coupon.minSubtotal != null ? Number(coupon.minSubtotal) : null,
          },
          itemsTotal
        )
      : null;

    if (!coupon || rejection) {
      const message = coupon ? COUPON_REJECTION_MESSAGES[rejection!] : "Coupon not found";
      if (!tolerant) throw new OrderBuildError(message);
      warnings.push(`Coupon not applied (${message.toLowerCase()})`);
      primaryAmount = manualAmount;
      primaryReason = manualReason;
    } else {
      primaryAmount = computeRuleDiscount(
        { type: coupon.type, value: Number(coupon.value) },
        itemsTotal
      );
      primaryReason = `Coupon: ${coupon.code}`;
      couponId = coupon.id;
      couponMaxUses = coupon.maxUses;
    }
  } else {
    // Plain staff-applied discount — unchanged behaviour, still clamped by
    // computeOrderCharges downstream.
    primaryAmount = manualAmount;
    primaryReason = manualReason;
  }

  // ── Points ────────────────────────────────────────────────────────────────
  let pointsRedeemed = 0;
  let rules = null as Awaited<ReturnType<typeof getLoyaltyRules>> | null;

  if (requestedPoints > 0 && args.customerId) {
    rules = await getLoyaltyRules(storeId, args.tx);
    const customer = await db.customer.findFirst({
      where: { id: args.customerId, storeId },
      select: { points: true },
    });

    if (!customer) {
      if (!tolerant) throw new OrderBuildError("Customer not found");
      warnings.push("Customer not found; points were not redeemed");
    } else {
      const payable = Math.max(itemsTotal - primaryAmount, 0);
      const rejection = checkRedeem({
        points: requestedPoints,
        balance: customer.points,
        payable,
        rules,
      });
      if (rejection) {
        const message = REDEEM_REJECTION_MESSAGES[rejection];
        if (!tolerant) throw new OrderBuildError(message);
        warnings.push(`Points not redeemed (${message.toLowerCase()})`);
      } else {
        pointsRedeemed = requestedPoints;
      }
    }
  }

  const composed = composeOrderDiscount({
    itemsTotal,
    primaryAmount,
    redeemPoints: pointsRedeemed,
    rules,
  });

  return {
    discountAmount: composed.discountAmount,
    discountReason: buildDiscountReason([
      primaryReason,
      composed.pointsRedeemed > 0 ? `Points: ${composed.pointsRedeemed}` : null,
    ]),
    couponId,
    couponMaxUses,
    // composeOrderDiscount clamps the burn to what the bill can absorb, so the
    // ledger only ever burns points the customer actually got value for.
    pointsRedeemed: composed.pointsRedeemed,
    warnings,
  };
}
