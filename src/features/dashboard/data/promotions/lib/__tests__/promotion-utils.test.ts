import { describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@/lib/api/client";
import { ApiErrorCode } from "@/types/api/responses";
import type { CouponDto } from "@/types/api/cashier";
import { formatCurrency } from "@/lib/utils/formatting";
import { currencyValue } from "../../__tests__/test-utils";
import {
  couponStatus,
  formatDiscountValue,
  formatLiteralAmount,
  fromLocalInputValue,
  isFeatureLockedError,
  toLocalInputValue,
} from "../promotion-utils";

const NOW = new Date("2026-10-15T12:00:00.000Z");

function coupon(overrides: Partial<CouponDto> = {}): CouponDto {
  return {
    id: "c1",
    code: "SUMMER10",
    name: null,
    type: "PERCENT",
    value: 10,
    minSubtotal: null,
    maxUses: null,
    usedCount: 0,
    validFrom: null,
    validUntil: null,
    isActive: true,
    ...overrides,
  };
}

function apiError(status: number, code: ApiErrorCode) {
  return new ApiClientError({ success: false, error: { code, message: "nope" } }, status);
}

describe("couponStatus", () => {
  it("is active for an open-ended active coupon", () => {
    expect(couponStatus(coupon(), NOW)).toBe("active");
  });

  it("is inactive when switched off", () => {
    expect(couponStatus(coupon({ isActive: false }), NOW)).toBe("inactive");
  });

  it("is scheduled before validFrom", () => {
    expect(couponStatus(coupon({ validFrom: "2026-11-01T00:00:00.000Z" }), NOW)).toBe("scheduled");
  });

  it("is expired after validUntil", () => {
    expect(couponStatus(coupon({ validUntil: "2026-10-01T00:00:00.000Z" }), NOW)).toBe("expired");
  });

  it("is used up once usedCount reaches maxUses", () => {
    expect(couponStatus(coupon({ maxUses: 5, usedCount: 4 }), NOW)).toBe("active");
    expect(couponStatus(coupon({ maxUses: 5, usedCount: 5 }), NOW)).toBe("usedUp");
    expect(couponStatus(coupon({ maxUses: 5, usedCount: 9 }), NOW)).toBe("usedUp");
  });

  it("is active inside its window", () => {
    expect(
      couponStatus(
        coupon({ validFrom: "2026-10-01T00:00:00.000Z", validUntil: "2026-10-31T00:00:00.000Z" }),
        NOW
      )
    ).toBe("active");
  });

  it("follows the till's precedence: inactive beats expired, expired beats used up", () => {
    const past = "2026-10-01T00:00:00.000Z";
    expect(couponStatus(coupon({ isActive: false, validUntil: past }), NOW)).toBe("inactive");
    expect(couponStatus(coupon({ validUntil: past, maxUses: 1, usedCount: 1 }), NOW)).toBe(
      "expired"
    );
  });

  it("is never held back by a minimum spend, which depends on the basket rather than the coupon", () => {
    expect(couponStatus(coupon({ minSubtotal: 1_000_000 }), NOW)).toBe("active");
  });
});

describe("isFeatureLockedError", () => {
  it("recognizes the OPERATIONS gate by its error code", () => {
    expect(isFeatureLockedError(apiError(403, ApiErrorCode.SUBSCRIPTION_FEATURE_LOCKED))).toBe(
      true
    );
  });

  it("does not treat any other 403 as an upgrade prompt", () => {
    expect(isFeatureLockedError(apiError(403, ApiErrorCode.FORBIDDEN))).toBe(false);
  });

  it("ignores every other error shape", () => {
    expect(isFeatureLockedError(apiError(500, ApiErrorCode.INTERNAL_ERROR))).toBe(false);
    expect(isFeatureLockedError(new Error("boom"))).toBe(false);
    expect(isFeatureLockedError(null)).toBe(false);
  });
});

describe("formatLiteralAmount", () => {
  const eur = currencyValue("EUR");
  const idr = currencyValue("IDR");

  it("formats a EUR amount literally — the currency argument stops IDR conversion", () => {
    expect(formatLiteralAmount(5, "EUR", eur.formatPrice)).toBe("€5.00");
    expect(formatLiteralAmount(0.05, "EUR", eur.formatPrice)).toBe("€0.05");
    // The trap this guards: without the 2nd argument the provider reads 5 as IDR 5.
    expect(eur.formatPrice(5)).not.toBe("€5.00");
  });

  it("formats IDR without decimals and with grouping", () => {
    const formatted = formatLiteralAmount(10_000, "IDR", idr.formatPrice);
    // Whatever the platform's IDR symbol spelling, it is the provider's own format of 10,000.
    expect(formatted).toBe(formatCurrency(10_000, "IDR", "en-US"));
    expect(formatted).toMatch(/10,000$/);
  });

  it("passes the store currency as the provider's second argument", () => {
    const formatPrice = vi.fn((value: number, from?: string) => `${from}:${value}`);
    formatLiteralAmount(7, "EUR", formatPrice);
    expect(formatPrice).toHaveBeenCalledWith(7, "EUR");
  });

  it("shows the exact figure when the currency's precision would round a 4-decimal point value", () => {
    expect(formatLiteralAmount(0.0125, "EUR", eur.formatPrice)).toBe("€0.0125");
    expect(formatLiteralAmount(0.005, "EUR", eur.formatPrice)).toBe("€0.005");
  });

  it("keeps grouping for large amounts that round-trip cleanly", () => {
    expect(formatLiteralAmount(1234.5, "EUR", eur.formatPrice)).toBe("€1,234.50");
  });
});

describe("formatDiscountValue", () => {
  const formatMoney = (value: number) => `€${value.toFixed(2)}`;

  it("renders a percentage as 10%", () => {
    expect(
      formatDiscountValue({ type: "PERCENT", value: 10 }, { formatMoney, intlLocale: "en-US" })
    ).toBe("10%");
    expect(
      formatDiscountValue({ type: "PERCENT", value: 12.5 }, { formatMoney, intlLocale: "en-US" })
    ).toBe("12.5%");
  });

  it("uses the locale's percent convention", () => {
    const french = formatDiscountValue(
      { type: "PERCENT", value: 12.5 },
      { formatMoney, intlLocale: "fr-FR" }
    );
    expect(french.replace(/\s/g, " ")).toBe("12,5 %");
  });

  it("renders a fixed discount through the money formatter", () => {
    expect(formatDiscountValue({ type: "FIXED", value: 5 }, { formatMoney })).toBe("€5.00");
  });
});

describe("datetime-local conversion", () => {
  it("round-trips a local time through ISO", () => {
    const iso = fromLocalInputValue("2026-10-01T09:30");
    expect(iso).toBe(new Date(2026, 9, 1, 9, 30).toISOString());
    expect(toLocalInputValue(iso)).toBe("2026-10-01T09:30");
  });

  it("maps empty and invalid input to null / empty", () => {
    expect(fromLocalInputValue("")).toBeNull();
    expect(fromLocalInputValue(null)).toBeNull();
    expect(fromLocalInputValue("not a date")).toBeNull();
    expect(toLocalInputValue(null)).toBe("");
    expect(toLocalInputValue("garbage")).toBe("");
  });
});
