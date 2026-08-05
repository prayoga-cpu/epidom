/**
 * Waste Validation Schemas Tests
 *
 * Tests the materialId/productId "at least one" refine and the
 * reason=OTHER → customReason required refine, on both the create and
 * update schemas.
 */

import { describe, it, expect } from "vitest";
import { recordWasteSchema, updateWasteSchema, wasteListQuerySchema } from "../waste.schemas";

describe("recordWasteSchema", () => {
  const base = { quantity: 5, reason: "EXPIRED" as const, materialId: "c123456789012345678901234" };

  it("accepts a valid material waste entry", () => {
    const result = recordWasteSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it("accepts a valid product waste entry", () => {
    const result = recordWasteSchema.safeParse({
      quantity: 5,
      reason: "DAMAGED",
      productId: "c123456789012345678901234",
    });
    expect(result.success).toBe(true);
  });

  it("rejects when neither materialId nor productId is provided", () => {
    const result = recordWasteSchema.safeParse({ quantity: 5, reason: "EXPIRED" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-positive quantity", () => {
    const result = recordWasteSchema.safeParse({ ...base, quantity: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects reason=OTHER without a customReason", () => {
    const result = recordWasteSchema.safeParse({ ...base, reason: "OTHER" });
    expect(result.success).toBe(false);
  });

  it("rejects reason=OTHER with a blank/whitespace customReason", () => {
    const result = recordWasteSchema.safeParse({ ...base, reason: "OTHER", customReason: "   " });
    expect(result.success).toBe(false);
  });

  it("accepts reason=OTHER with a non-blank customReason", () => {
    const result = recordWasteSchema.safeParse({
      ...base,
      reason: "OTHER",
      customReason: "Power outage spoiled the fridge",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown reason value", () => {
    const result = recordWasteSchema.safeParse({ ...base, reason: "STOLEN" });
    expect(result.success).toBe(false);
  });
});

describe("updateWasteSchema", () => {
  it("accepts a metadata-only correction with no fields required", () => {
    const result = updateWasteSchema.safeParse({ notes: "Confirmed by manager" });
    expect(result.success).toBe(true);
  });

  it("accepts a quantity + unitCostOverride correction", () => {
    const result = updateWasteSchema.safeParse({ quantity: 3, unitCostOverride: 1.5 });
    expect(result.success).toBe(true);
  });

  it("rejects a non-positive unitCostOverride", () => {
    const result = updateWasteSchema.safeParse({ unitCostOverride: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects switching reason to OTHER without a customReason", () => {
    const result = updateWasteSchema.safeParse({ reason: "OTHER" });
    expect(result.success).toBe(false);
  });

  it("accepts switching reason to OTHER with a customReason", () => {
    const result = updateWasteSchema.safeParse({ reason: "OTHER", customReason: "Freezer broke" });
    expect(result.success).toBe(true);
  });
});

describe("wasteListQuerySchema", () => {
  it("accepts an empty query (all filters optional)", () => {
    const result = wasteListQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("coerces take/skip from string query params", () => {
    const result = wasteListQuerySchema.safeParse({ take: "25", skip: "10" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.take).toBe(25);
      expect(result.data.skip).toBe(10);
    }
  });

  it("rejects a take above the max of 200", () => {
    const result = wasteListQuerySchema.safeParse({ take: "500" });
    expect(result.success).toBe(false);
  });
});
