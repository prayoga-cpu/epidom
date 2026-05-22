import { describe, it, expect } from "vitest";
import {
  commissionRate,
  AGGREGATOR_COMMISSION,
  PLATFORM_TO_SOURCE,
  AGGREGATOR_SOURCES,
} from "../aggregator.config";
import type { OrderSource } from "@prisma/client";

describe("commissionRate", () => {
  it.each([
    ["GOFOOD", 0.20],
    ["GRABFOOD", 0.20],
    ["SHOPEEFOOD", 0.20],
    ["TOKOPEDIA", 0.15],
  ] as [OrderSource, number][])(
    "returns %s → %d for aggregator sources",
    (source, expected) => {
      expect(commissionRate(source)).toBe(expected);
    }
  );

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
