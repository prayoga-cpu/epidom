import type { AggregatorPlatform, OrderSource } from "@prisma/client";

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

/** OrderSources that are aggregator channels */
export const AGGREGATOR_SOURCES: OrderSource[] = ["GOFOOD", "GRABFOOD", "SHOPEEFOOD", "TOKOPEDIA"];

/** Commission rate for a given OrderSource (0 for non-aggregator channels) */
export function commissionRate(source: OrderSource): number {
  const platform = (Object.entries(PLATFORM_TO_SOURCE) as [AggregatorPlatform, OrderSource][]).find(
    ([, s]) => s === source
  )?.[0];
  return platform ? AGGREGATOR_COMMISSION[platform] : 0;
}
