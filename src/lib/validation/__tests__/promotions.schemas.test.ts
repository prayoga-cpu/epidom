import { describe, it, expect } from "vitest";
import {
  createCouponSchema,
  discountValueError,
  MAX_PROMO_AMOUNT,
  updateCouponSchema,
  updateDiscountPresetSchema,
  upsertDiscountPresetSchema,
  validateCouponSchema,
} from "../promotions.schemas";

describe("discountValueError", () => {
  it("bounds a PERCENT to (0, 100] and a FIXED to a positive literal amount", () => {
    expect(discountValueError("PERCENT", 10)).toBeNull();
    expect(discountValueError("PERCENT", 100)).toBeNull();
    expect(discountValueError("PERCENT", 100.01)).toMatch(/100/);
    expect(discountValueError("PERCENT", 0)).not.toBeNull();
    expect(discountValueError("FIXED", 5000)).toBeNull();
    expect(discountValueError("FIXED", -1)).not.toBeNull();
    expect(discountValueError("FIXED", MAX_PROMO_AMOUNT + 1)).not.toBeNull();
    expect(discountValueError("FIXED", Number.NaN)).not.toBeNull();
  });
});

describe("upsertDiscountPresetSchema", () => {
  it("accepts a percent and a fixed preset", () => {
    expect(
      upsertDiscountPresetSchema.parse({ name: " Member ", type: "PERCENT", value: 10 })
    ).toMatchObject({
      name: "Member",
      type: "PERCENT",
      value: 10,
    });
    expect(
      upsertDiscountPresetSchema.safeParse({ name: "5 off", type: "FIXED", value: 5 }).success
    ).toBe(true);
  });

  it("rejects a percent over 100 on the value field", () => {
    const r = upsertDiscountPresetSchema.safeParse({ name: "x", type: "PERCENT", value: 150 });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(["value"]);
  });

  it("rejects a blank name, a zero value and >2 decimals", () => {
    expect(
      upsertDiscountPresetSchema.safeParse({ name: " ", type: "FIXED", value: 5 }).success
    ).toBe(false);
    expect(
      upsertDiscountPresetSchema.safeParse({ name: "x", type: "FIXED", value: 0 }).success
    ).toBe(false);
    expect(
      upsertDiscountPresetSchema.safeParse({ name: "x", type: "FIXED", value: 1.234 }).success
    ).toBe(false);
  });
});

describe("updateDiscountPresetSchema", () => {
  it("is partial but not empty", () => {
    expect(updateDiscountPresetSchema.safeParse({ isActive: false }).success).toBe(true);
    expect(updateDiscountPresetSchema.safeParse({}).success).toBe(false);
  });

  it("cross-checks type against value only when both arrive", () => {
    expect(updateDiscountPresetSchema.safeParse({ type: "PERCENT", value: 500 }).success).toBe(
      false
    );
    // A lone value can't be judged here — the service checks it against the stored type.
    expect(updateDiscountPresetSchema.safeParse({ value: 500 }).success).toBe(true);
  });
});

describe("createCouponSchema", () => {
  const base = { code: "save10", type: "PERCENT", value: 10 } as const;

  it("uppercases and trims the code", () => {
    expect(createCouponSchema.parse({ ...base, code: "  save-10  " }).code).toBe("SAVE-10");
  });

  it("rejects codes outside [A-Z0-9_-]{2,32}", () => {
    for (const bad of ["a", "has space", "café", "x".repeat(33), "no!"]) {
      expect(createCouponSchema.safeParse({ ...base, code: bad }).success, bad).toBe(false);
    }
  });

  it("turns date strings into Dates, and null/'' into null", () => {
    const parsed = createCouponSchema.parse({
      ...base,
      validFrom: "2026-10-01T00:00:00.000Z",
      validUntil: "",
      minSubtotal: null,
      maxUses: null,
    });
    expect(parsed.validFrom).toEqual(new Date("2026-10-01T00:00:00.000Z"));
    expect(parsed.validUntil).toBeNull();
    expect(parsed.minSubtotal).toBeNull();
    expect(parsed.maxUses).toBeNull();
  });

  it("requires validUntil to be after validFrom", () => {
    const r = createCouponSchema.safeParse({
      ...base,
      validFrom: "2026-10-02T00:00:00.000Z",
      validUntil: "2026-10-01T00:00:00.000Z",
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(["validUntil"]);
  });

  it("bounds maxUses to a positive integer and minSubtotal to non-negative", () => {
    expect(createCouponSchema.safeParse({ ...base, maxUses: 0 }).success).toBe(false);
    expect(createCouponSchema.safeParse({ ...base, maxUses: 1.5 }).success).toBe(false);
    expect(createCouponSchema.safeParse({ ...base, minSubtotal: -1 }).success).toBe(false);
    expect(createCouponSchema.safeParse({ ...base, minSubtotal: 0 }).success).toBe(true);
  });
});

describe("updateCouponSchema", () => {
  it("rejects a body that tries to change the code — it is immutable", () => {
    const r = updateCouponSchema.safeParse({ code: "NEWCODE", value: 5 });
    expect(r.success).toBe(false);
  });

  it("accepts a partial update and null to clear a bound", () => {
    const parsed = updateCouponSchema.parse({ isActive: false, maxUses: null, validUntil: null });
    expect(parsed).toEqual({ isActive: false, maxUses: null, validUntil: null });
  });

  it("refuses an empty patch", () => {
    expect(updateCouponSchema.safeParse({}).success).toBe(false);
  });
});

describe("validateCouponSchema", () => {
  it("is lenient about the code — a mistyped one must come back valid:false, not a 400", () => {
    expect(validateCouponSchema.parse({ code: " save 10!! ", itemsTotal: 20 }).code).toBe(
      "SAVE 10!!"
    );
  });
  it("still needs a code and a non-negative total", () => {
    expect(validateCouponSchema.safeParse({ code: "", itemsTotal: 1 }).success).toBe(false);
    expect(validateCouponSchema.safeParse({ code: "A", itemsTotal: -1 }).success).toBe(false);
    expect(validateCouponSchema.safeParse({ code: "A" }).success).toBe(false);
  });
});
