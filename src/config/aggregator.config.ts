import type { AggregatorPlatform, OrderSource, PaymentMarket } from "@prisma/client";

/**
 * Platform commission rates (percentage of order total).
 * These are hardcoded estimates; update as official rates change.
 */
export const AGGREGATOR_COMMISSION: Record<AggregatorPlatform, number> = {
  GOFOOD: 0.2,
  GRABFOOD: 0.2,
  SHOPEEFOOD: 0.2,
  TOKOPEDIA: 0.15,
};

/** Display label for each platform */
export const AGGREGATOR_LABELS: Record<AggregatorPlatform, string> = {
  GOFOOD: "GoFood",
  GRABFOOD: "GrabFood",
  SHOPEEFOOD: "ShopeeFood",
  TOKOPEDIA: "Tokopedia",
};

/** Map AggregatorPlatform → OrderSource */
export const PLATFORM_TO_SOURCE: Record<AggregatorPlatform, OrderSource> = {
  GOFOOD: "GOFOOD",
  GRABFOOD: "GRABFOOD",
  SHOPEEFOOD: "SHOPEEFOOD",
  TOKOPEDIA: "TOKOPEDIA",
};

/**
 * Every OrderSource that is an online delivery platform: the aggregators the
 * email import knows, plus the ones that only arrive by the cashier keying the
 * platform's order in at the till (the "Others" order type).
 */
export const ONLINE_PLATFORM_SOURCES = [
  "GOFOOD",
  "GRABFOOD",
  "SHOPEEFOOD",
  "TOKOPEDIA",
  "UBER_EATS",
  "DELIVEROO",
  "JUST_EAT",
  "DOORDASH",
  "GRUBHUB",
  "OTHER_ONLINE",
] as const satisfies readonly OrderSource[];

export type OnlinePlatformSource = (typeof ONLINE_PLATFORM_SOURCES)[number];

/** OrderSources that are aggregator channels */
export const AGGREGATOR_SOURCES: OrderSource[] = [...ONLINE_PLATFORM_SOURCES];

export function isOnlinePlatformSource(
  source: string | null | undefined
): source is OnlinePlatformSource {
  return (ONLINE_PLATFORM_SOURCES as readonly string[]).includes(source ?? "");
}

/**
 * Brand names, not translated. OTHER_ONLINE is a generic word, so screens show
 * their own translation for it (`pos.onlinePlatform.other`); this English one is
 * for server-built labels such as the finance channel report.
 */
export const ONLINE_PLATFORM_LABELS: Record<OnlinePlatformSource, string> = {
  ...AGGREGATOR_LABELS,
  UBER_EATS: "Uber Eats",
  DELIVEROO: "Deliveroo",
  JUST_EAT: "Just Eat",
  DOORDASH: "DoorDash",
  GRUBHUB: "Grubhub",
  OTHER_ONLINE: "Other platform",
};

/**
 * Commission the platform keeps, as a fraction of the order total. Estimates of
 * each platform's usual headline rate, like AGGREGATOR_COMMISSION: the real
 * rate depends on the merchant's contract. OTHER_ONLINE is unknown, so 0.
 */
export const ONLINE_PLATFORM_COMMISSION: Record<OnlinePlatformSource, number> = {
  ...AGGREGATOR_COMMISSION,
  UBER_EATS: 0.3,
  DELIVEROO: 0.3,
  JUST_EAT: 0.14,
  DOORDASH: 0.25,
  GRUBHUB: 0.2,
  OTHER_ONLINE: 0,
};

/**
 * The platforms a cashier can pick under "Others" at the till. Tokopedia is an
 * aggregator the email import knows, not a food-delivery app, so it is left out.
 */
export const POS_ONLINE_PLATFORMS = [
  "GOFOOD",
  "GRABFOOD",
  "SHOPEEFOOD",
  "UBER_EATS",
  "DELIVEROO",
  "JUST_EAT",
  "DOORDASH",
  "GRUBHUB",
  "OTHER_ONLINE",
] as const satisfies readonly OnlinePlatformSource[];

export type PosOnlinePlatform = (typeof POS_ONLINE_PLATFORMS)[number];

/**
 * Which platforms the till's "Others" menu offers, by the store's market (Fees &
 * Taxes → Market, the same setting that picks the payment methods). "Other
 * platform" closes every list. The server accepts any POS_ONLINE_PLATFORMS value
 * whatever the market, so an order queued offline before a market change still
 * syncs.
 */
export const ONLINE_PLATFORMS_BY_MARKET: Record<PaymentMarket, PosOnlinePlatform[]> = {
  INDONESIA: ["GOFOOD", "GRABFOOD", "SHOPEEFOOD", "OTHER_ONLINE"],
  FRANCE: ["UBER_EATS", "DELIVEROO", "JUST_EAT", "OTHER_ONLINE"],
  INTERNATIONAL: ["UBER_EATS", "DOORDASH", "GRUBHUB", "OTHER_ONLINE"],
};

/** Commission rate for a given OrderSource (0 for non-aggregator channels) */
export function commissionRate(source: OrderSource): number {
  return isOnlinePlatformSource(source) ? ONLINE_PLATFORM_COMMISSION[source] : 0;
}
