import { PLAN_PRICING, type PaidPlan, type PriceCurrency } from "@/lib/constants/plan-pricing";
import type { SourceId } from "../data/sources";

/**
 * The home page margin calculator: what moving part of the delivery-app orders
 * to the restaurant's own ordering link would save, net of payment fees and of
 * the Epidom plan. Runs entirely in the browser and stores nothing.
 *
 *   delivery_revenue = R × d
 *   commission_now   = delivery_revenue × c
 *   moved_revenue    = delivery_revenue × m
 *   moved_orders     = moved_revenue / a
 *   direct_cost      = moved_revenue × fee% + moved_orders × fee_flat
 *   commission_saved = moved_revenue × c − direct_cost
 *   pos_fee_delta    = P − epidom_plan_price
 *   monthly_saving   = commission_saved + pos_fee_delta
 *   margin_points    = monthly_saving / R
 *   new_margin       = n + margin_points
 *
 * Only paid plans are offered: online ordering is a POS feature
 * (FEATURE_MIN_PLAN.onlineOrders), so on Free no order moves off the delivery
 * apps and there is nothing to calculate.
 */

export interface CalculatorInputs {
  /** R: revenue per month, in the currency's major unit. */
  revenue: number;
  /** d: share of revenue from delivery apps, 0..1. */
  deliveryShare: number;
  /** c: the platform's commission, 0..1. */
  commission: number;
  /** m: share of the delivery revenue that could move to direct orders, 0..1. */
  movedShare: number;
  /** a: average order value. */
  averageOrder: number;
  /** P: what the current POS subscription costs per month. */
  currentPosFee: number;
  /** n: current net margin, 0..1. */
  currentMargin: number;
  plan: PaidPlan;
}

export interface CalculatorResult {
  deliveryRevenue: number;
  commissionNow: number;
  movedRevenue: number;
  movedOrders: number;
  directCost: number;
  commissionSaved: number;
  planPrice: number;
  posFeeDelta: number;
  monthlySaving: number;
  yearlySaving: number;
  marginPoints: number;
  newMargin: number;
}

/** What a direct order costs to take online. Shown on the page as an assumption. */
export interface PaymentFee {
  percent: number;
  flat: number;
  source: SourceId;
}

export const PAYMENT_FEE: Record<PriceCurrency, PaymentFee> = {
  EUR: { percent: 0.015, flat: 0.25, source: "S2" },
  USD: { percent: 0.029, flat: 0.3, source: "S7" },
  IDR: { percent: 0.007, flat: 0, source: "S8" },
};

export interface Range {
  default: number;
  min: number;
  max: number;
  step: number;
}

/** Money inputs, in the currency's major unit. Defaults are example figures, not claims. */
export const MONEY_INPUTS: Record<
  PriceCurrency,
  { revenue: Range; averageOrder: Range; currentPosFee: Range }
> = {
  EUR: {
    revenue: { default: 30_000, min: 1_000, max: 500_000, step: 500 },
    averageOrder: { default: 22, min: 5, max: 200, step: 1 },
    currentPosFee: { default: 0, min: 0, max: 500, step: 1 },
  },
  USD: {
    revenue: { default: 30_000, min: 1_000, max: 500_000, step: 500 },
    averageOrder: { default: 22, min: 5, max: 200, step: 1 },
    currentPosFee: { default: 0, min: 0, max: 500, step: 1 },
  },
  IDR: {
    revenue: { default: 100_000_000, min: 5_000_000, max: 5_000_000_000, step: 1_000_000 },
    averageOrder: { default: 50_000, min: 10_000, max: 2_000_000, step: 1_000 },
    currentPosFee: { default: 0, min: 0, max: 5_000_000, step: 10_000 },
  },
};

/** Percentage inputs, in percent (25 means 25 %). */
export const PERCENT_INPUTS = {
  deliveryShare: { default: 25, min: 0, max: 100, step: 1 },
  // 30 %: Uber Eats' default plan before tax (S1).
  commission: { default: 30, min: 0, max: 40, step: 1 },
  movedShare: { default: 20, min: 0, max: 100, step: 1 },
  // 3 %: the average restaurant result (S3).
  currentMargin: { default: 3, min: 0, max: 30, step: 0.5 },
} as const satisfies Record<string, Range>;

export function clamp(value: number, range: Pick<Range, "min" | "max">): number {
  if (!Number.isFinite(value)) return range.min;
  return Math.min(range.max, Math.max(range.min, value));
}

export function defaultInputs(currency: PriceCurrency): CalculatorInputs {
  const money = MONEY_INPUTS[currency];
  return {
    revenue: money.revenue.default,
    deliveryShare: PERCENT_INPUTS.deliveryShare.default / 100,
    commission: PERCENT_INPUTS.commission.default / 100,
    movedShare: PERCENT_INPUTS.movedShare.default / 100,
    averageOrder: money.averageOrder.default,
    currentPosFee: money.currentPosFee.default,
    currentMargin: PERCENT_INPUTS.currentMargin.default / 100,
    plan: "POS",
  };
}

export function computeMargin(input: CalculatorInputs, currency: PriceCurrency): CalculatorResult {
  const fee = PAYMENT_FEE[currency];
  const deliveryRevenue = input.revenue * input.deliveryShare;
  const commissionNow = deliveryRevenue * input.commission;
  const movedRevenue = deliveryRevenue * input.movedShare;
  const movedOrders = input.averageOrder > 0 ? movedRevenue / input.averageOrder : 0;
  const directCost = movedRevenue * fee.percent + movedOrders * fee.flat;
  const commissionSaved = movedRevenue * input.commission - directCost;
  // Monthly list price: the calculator compares month against month.
  const planPrice = PLAN_PRICING[input.plan][currency].monthly;
  const posFeeDelta = input.currentPosFee - planPrice;
  const monthlySaving = commissionSaved + posFeeDelta;
  const marginPoints = input.revenue > 0 ? monthlySaving / input.revenue : 0;
  return {
    deliveryRevenue,
    commissionNow,
    movedRevenue,
    movedOrders,
    directCost,
    commissionSaved,
    planPrice,
    posFeeDelta,
    monthlySaving,
    yearlySaving: monthlySaving * 12,
    marginPoints,
    newMargin: input.currentMargin + marginPoints,
  };
}

/**
 * Analytics bucket for a monthly saving, so the event never carries the exact
 * figure. Thresholds are per currency so the buckets mean roughly the same
 * thing for a French, an American and an Indonesian visitor.
 */
const SAVING_BUCKETS: Record<PriceCurrency, readonly number[]> = {
  EUR: [100, 500, 1_000, 5_000],
  USD: [100, 500, 1_000, 5_000],
  IDR: [1_500_000, 7_500_000, 15_000_000, 75_000_000],
};

export function savingBucket(monthlySaving: number, currency: PriceCurrency): string {
  if (monthlySaving < 0) return "negative";
  const edges = SAVING_BUCKETS[currency];
  let low = 0;
  for (const edge of edges) {
    if (monthlySaving < edge) return `${low}-${edge}`;
    low = edge;
  }
  return `${low}+`;
}
