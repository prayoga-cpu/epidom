/**
 * Pure discount / coupon / loyalty-points math. No Prisma import — shared by
 * the POS cart preview and the server routes, so the number the cashier sees
 * is exactly the number that gets persisted (same contract as
 * order-charges.ts).
 *
 * Every amount here is LITERAL in the store's display currency and is never
 * IDR-converted — see pos-order-builder.ts. A FIXED preset of 5000 in an EUR
 * store is 5000 EUR, which is why the Back Office forms show the store's own
 * currency symbol.
 */

export type DiscountRuleType = "PERCENT" | "FIXED";

export interface DiscountRule {
  type: DiscountRuleType;
  /** PERCENT: 0–100. FIXED: a literal amount in the store's currency. */
  value: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * What a preset/coupon takes off `base` (the item total). Clamped to
 * [0, base] so a discount can never push the bill negative, and never
 * NaN/negative from bad input — the same defensive posture as
 * computeOrderCharges's own clamp.
 */
export function computeRuleDiscount(rule: DiscountRule, base: number): number {
  if (!Number.isFinite(base) || base <= 0) return 0;
  const value = Number.isFinite(rule.value) ? Math.max(rule.value, 0) : 0;
  const raw = rule.type === "PERCENT" ? (base * Math.min(value, 100)) / 100 : value;
  return round2(Math.min(raw, base));
}

// ─── Coupons ─────────────────────────────────────────────────────────────────

export type CouponRejection = "INACTIVE" | "NOT_STARTED" | "EXPIRED" | "USED_UP" | "BELOW_MINIMUM";

export interface CouponRules {
  isActive: boolean;
  validFrom: Date | null;
  validUntil: Date | null;
  maxUses: number | null;
  usedCount: number;
  /** Literal amount in the store's currency, compared against the item total. */
  minSubtotal: number | null;
}

/**
 * Why a coupon can't be used right now, or null when it can. This is the
 * advisory check (the cart preview and the /coupons/validate route); the
 * order transaction re-enforces `usedCount < maxUses` atomically with a
 * conditional update, since two tills can race for the last use.
 */
export function checkCouponEligibility(
  coupon: CouponRules,
  itemsTotal: number,
  now: Date = new Date()
): CouponRejection | null {
  if (!coupon.isActive) return "INACTIVE";
  if (coupon.validFrom && now < coupon.validFrom) return "NOT_STARTED";
  if (coupon.validUntil && now > coupon.validUntil) return "EXPIRED";
  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) return "USED_UP";
  if (coupon.minSubtotal != null && itemsTotal < coupon.minSubtotal) return "BELOW_MINIMUM";
  return null;
}

// ─── Loyalty points ──────────────────────────────────────────────────────────

export interface LoyaltyRules {
  enabled: boolean;
  /** Literal amount in the store's currency that earns ONE point. */
  spendPerPoint: number;
  /** Literal value, in the same currency, of ONE point when redeemed. */
  pointValue: number;
  minRedeemPoints: number;
}

/** Points credited for a paid total. Whole points only, rounded down. */
export function pointsEarnedFor(
  paidTotal: number,
  rules: Pick<LoyaltyRules, "enabled" | "spendPerPoint">
): number {
  if (!rules.enabled || !(rules.spendPerPoint > 0)) return 0;
  if (!Number.isFinite(paidTotal) || paidTotal <= 0) return 0;
  // The epsilon absorbs float error so exactly one point's worth never floors
  // to zero (e.g. 0.3 / 0.1 === 2.9999999999999996).
  return Math.floor(paidTotal / rules.spendPerPoint + 1e-9);
}

/** The currency value of `points` when redeemed. */
export function pointsToValue(points: number, pointValue: number): number {
  if (!(points > 0) || !(pointValue > 0)) return 0;
  return round2(points * pointValue);
}

/**
 * The most points a customer can burn on a bill: bounded by their balance and
 * by what is still payable (a redemption never pays for more than the bill),
 * and zero when that falls under the store's minimum redemption.
 */
export function maxRedeemablePoints(args: {
  balance: number;
  /** Item total minus any preset/coupon/manual discount already applied. */
  payable: number;
  rules: LoyaltyRules;
}): number {
  const { balance, payable, rules } = args;
  if (!rules.enabled || !(rules.pointValue > 0)) return 0;
  if (!(balance > 0) || !(payable > 0)) return 0;
  const cap = Math.floor(payable / rules.pointValue + 1e-9);
  const max = Math.min(Math.floor(balance), cap);
  return max >= Math.max(rules.minRedeemPoints, 1) ? max : 0;
}

export type RedeemRejection = "DISABLED" | "BELOW_MINIMUM" | "EXCEEDS_BALANCE" | "EXCEEDS_PAYABLE";

/** Why `points` can't be redeemed, or null when the redemption is valid. */
export function checkRedeem(args: {
  points: number;
  balance: number;
  payable: number;
  rules: LoyaltyRules;
}): RedeemRejection | null {
  const { points, balance, payable, rules } = args;
  if (!rules.enabled || !(rules.pointValue > 0)) return "DISABLED";
  if (points < Math.max(rules.minRedeemPoints, 1)) return "BELOW_MINIMUM";
  if (points > balance) return "EXCEEDS_BALANCE";
  if (pointsToValue(points, rules.pointValue) > payable + 1e-9) return "EXCEEDS_PAYABLE";
  return null;
}

// ─── Composition ─────────────────────────────────────────────────────────────

export interface ComposedDiscount {
  /** Manual / preset / coupon amount actually applied (clamped to the item total). */
  primaryAmount: number;
  /** Points that will really be burned (may be fewer than requested if clamped). */
  pointsRedeemed: number;
  /** Currency value of those points. */
  pointsValue: number;
  /** primaryAmount + pointsValue — what goes into Order.discountAmount. */
  discountAmount: number;
}

/**
 * Combine the cart's single "primary" discount (manual, preset or coupon —
 * mutually exclusive, latest wins) with an optional points redemption into the
 * one `discountAmount` the order stores. Points are applied second and can only
 * cover what the primary discount left payable, so the two together never
 * exceed the item total.
 */
export function composeOrderDiscount(args: {
  itemsTotal: number;
  primaryAmount: number;
  redeemPoints?: number;
  rules?: LoyaltyRules | null;
}): ComposedDiscount {
  const itemsTotal = Number.isFinite(args.itemsTotal) ? Math.max(args.itemsTotal, 0) : 0;
  const primaryAmount = round2(
    Math.min(Math.max(Number.isFinite(args.primaryAmount) ? args.primaryAmount : 0, 0), itemsTotal)
  );
  const rules = args.rules;
  const requested = Math.max(Math.floor(args.redeemPoints ?? 0), 0);

  if (!rules || !rules.enabled || !(rules.pointValue > 0) || requested === 0) {
    return { primaryAmount, pointsRedeemed: 0, pointsValue: 0, discountAmount: primaryAmount };
  }

  const payable = round2(itemsTotal - primaryAmount);
  const affordable = Math.floor(payable / rules.pointValue + 1e-9);
  const pointsRedeemed = Math.min(requested, Math.max(affordable, 0));
  const pointsValue = Math.min(pointsToValue(pointsRedeemed, rules.pointValue), payable);

  return {
    primaryAmount,
    pointsRedeemed,
    pointsValue,
    discountAmount: round2(primaryAmount + pointsValue),
  };
}

/** Order.discountReason is capped at 200 chars by the API schema. */
export const DISCOUNT_REASON_MAX = 200;

/** Join human-readable parts ("Member", "Coupon SAVE10", "50 pts") into one reason string. */
export function buildDiscountReason(parts: Array<string | null | undefined>): string | undefined {
  const joined = parts
    .map((p) => p?.trim())
    .filter((p): p is string => !!p)
    .join(" + ");
  if (!joined) return undefined;
  return joined.length > DISCOUNT_REASON_MAX ? joined.slice(0, DISCOUNT_REASON_MAX) : joined;
}
