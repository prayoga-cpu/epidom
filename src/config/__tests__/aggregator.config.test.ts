import { describe, it, expect } from "vitest";
import {
  commissionRate,
  AGGREGATOR_COMMISSION,
  PLATFORM_TO_SOURCE,
  AGGREGATOR_SOURCES,
  ONLINE_PLATFORMS_BY_MARKET,
  ONLINE_PLATFORM_LABELS,
  ONLINE_PLATFORM_SOURCES,
  POS_ONLINE_PLATFORMS,
  isOnlinePlatformSource,
} from "../aggregator.config";
import type { OrderSource } from "@prisma/client";

describe("commissionRate", () => {
  it.each([
    ["GOFOOD", 0.2],
    ["GRABFOOD", 0.2],
    ["SHOPEEFOOD", 0.2],
    ["TOKOPEDIA", 0.15],
  ] as [OrderSource, number][])("returns %s → %d for aggregator sources", (source, expected) => {
    expect(commissionRate(source)).toBe(expected);
  });

  it.each(["MANUAL", "STOREFRONT", "POS"] as OrderSource[])(
    "returns 0 for non-aggregator source %s",
    (source) => {
      expect(commissionRate(source)).toBe(0);
    }
  );

  it("PLATFORM_TO_SOURCE maps every platform to a valid OrderSource", () => {
    for (const [platform, source] of Object.entries(PLATFORM_TO_SOURCE)) {
      expect(AGGREGATOR_SOURCES).toContain(source);
      expect(AGGREGATOR_COMMISSION).toHaveProperty(platform);
    }
  });

  it("commissionRate output matches AGGREGATOR_COMMISSION for each source", () => {
    for (const [platform, source] of Object.entries(PLATFORM_TO_SOURCE)) {
      const rate = commissionRate(source as OrderSource);
      expect(rate).toBe(AGGREGATOR_COMMISSION[platform as keyof typeof AGGREGATOR_COMMISSION]);
    }
  });
});

describe('online platforms keyed in at the till ("Others")', () => {
  it("offers each market its own platforms, and Other platform last", () => {
    expect(ONLINE_PLATFORMS_BY_MARKET.INDONESIA).toEqual([
      "GOFOOD",
      "GRABFOOD",
      "SHOPEEFOOD",
      "OTHER_ONLINE",
    ]);
    expect(ONLINE_PLATFORMS_BY_MARKET.FRANCE).toEqual([
      "UBER_EATS",
      "DELIVEROO",
      "JUST_EAT",
      "OTHER_ONLINE",
    ]);
    expect(ONLINE_PLATFORMS_BY_MARKET.INTERNATIONAL).toEqual([
      "UBER_EATS",
      "DOORDASH",
      "GRUBHUB",
      "OTHER_ONLINE",
    ]);
  });

  it("every market's platform is one the server accepts, with a label", () => {
    for (const platforms of Object.values(ONLINE_PLATFORMS_BY_MARKET)) {
      for (const platform of platforms) {
        expect(POS_ONLINE_PLATFORMS).toContain(platform);
        expect(ONLINE_PLATFORM_LABELS[platform]).toBeTruthy();
      }
    }
  });

  it("keeps the email-import aggregators, so their reports don't move", () => {
    for (const source of Object.values(PLATFORM_TO_SOURCE)) {
      expect(ONLINE_PLATFORM_SOURCES).toContain(source);
    }
  });

  it("charges the new platforms' estimated commission, and nothing for an unnamed one", () => {
    expect(commissionRate("UBER_EATS")).toBe(0.3);
    expect(commissionRate("DOORDASH")).toBe(0.25);
    expect(commissionRate("OTHER_ONLINE")).toBe(0);
  });

  it("tells a delivery platform from a till or storefront sale", () => {
    expect(isOnlinePlatformSource("GRABFOOD")).toBe(true);
    expect(isOnlinePlatformSource("DELIVEROO")).toBe(true);
    expect(isOnlinePlatformSource("POS")).toBe(false);
    expect(isOnlinePlatformSource("STOREFRONT")).toBe(false);
    expect(isOnlinePlatformSource(null)).toBe(false);
  });
});
