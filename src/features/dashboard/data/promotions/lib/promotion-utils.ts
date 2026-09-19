import { ApiClientError } from "@/lib/api/client";
import { checkCouponEligibility } from "@/lib/finance/discounts";
import { getCurrencySymbol } from "@/lib/utils/formatting";
import type { CouponDto, DiscountKindDto } from "@/types/api/cashier";

// ─── Plan gate ───────────────────────────────────────────────────────────────

/** `ApiErrorCode.SUBSCRIPTION_FEATURE_LOCKED` — every promotions route answers 403 with it below OPERATIONS. */
const FEATURE_LOCKED_CODE = "SUBSCRIPTION_FEATURE_LOCKED";

/**
 * True when the server refused because the plan is below OPERATIONS.
 *
 * Matches on the error CODE, not on "any 403": a 403 can also mean the caller
 * isn't a manager/owner, and showing an upgrade prompt to someone whose plan is
 * fine would be wrong.
 */
export function isFeatureLockedError(error: unknown): boolean {
  return error instanceof ApiClientError && error.response.error.code === FEATURE_LOCKED_CODE;
}

// ─── Coupon status ───────────────────────────────────────────────────────────

export type CouponStatus = "active" | "inactive" | "scheduled" | "expired" | "usedUp";

/**
 * The badge a coupon row shows. Delegates to `checkCouponEligibility` — the same
 * function the till and the server use — so the Back Office can never call a
 * coupon "Active" that the cashier's checkout would reject (precedence
 * included: an inactive coupon reads Inactive even if it has also expired).
 *
 * `minSubtotal` is passed as null because it only depends on a basket, not on
 * the coupon's own state.
 */
export function couponStatus(coupon: CouponDto, now: Date = new Date()): CouponStatus {
  const rejection = checkCouponEligibility(
    {
      isActive: coupon.isActive,
      validFrom: coupon.validFrom ? new Date(coupon.validFrom) : null,
      validUntil: coupon.validUntil ? new Date(coupon.validUntil) : null,
      maxUses: coupon.maxUses,
      usedCount: coupon.usedCount,
      minSubtotal: null,
    },
    0,
    now
  );

  switch (rejection) {
    case "INACTIVE":
      return "inactive";
    case "NOT_STARTED":
      return "scheduled";
    case "EXPIRED":
      return "expired";
    case "USED_UP":
      return "usedUp";
    default:
      return "active";
  }
}

// ─── Money & percent formatting ──────────────────────────────────────────────

/**
 * Formats a LITERAL amount in the store's currency.
 *
 * `formatPrice` is the CurrencyProvider's, and the `currency` second argument is
 * what stops it treating the number as IDR and converting it (a recurring
 * shipped bug — see the currency rule in the cashier contract).
 *
 * The provider rounds to the currency's own precision (2 decimals; 0 for IDR).
 * A point value can legitimately carry 4 (`0.0125`), and printing that as
 * "€0.01" would tell the owner something untrue about their own setting, so when
 * rounding would change the number we show the exact figure instead.
 */
export function formatLiteralAmount(
  value: number,
  currency: string,
  formatPrice: (value: number, fromCurrency?: string) => string
): string {
  const formatted = formatPrice(value, currency);
  // The provider always formats with en-US digits ("€1,234.50"), so the first
  // numeric run is the number it actually printed.
  const printedText = formatted.match(/\d[\d,]*(?:\.\d+)?/)?.[0];
  const printed = printedText === undefined ? NaN : Number(printedText.replace(/,/g, ""));
  if (Number.isFinite(printed) && Math.abs(printed - value) < 1e-9) return formatted;
  return `${getCurrencySymbol(currency)}${Number(value.toFixed(4))}`;
}

/**
 * "10%" for a percent rule, the money format for a fixed one. Percent uses Intl
 * so a French owner reads "12,5 %" — money is deliberately fixed en-US by the
 * provider (hydration determinism), percent has no such constraint.
 */
export function formatDiscountValue(
  rule: { type: DiscountKindDto; value: number },
  ctx: { formatMoney: (value: number) => string; intlLocale?: string }
): string {
  if (rule.type === "PERCENT") {
    return new Intl.NumberFormat(ctx.intlLocale, {
      style: "percent",
      maximumFractionDigits: 2,
    }).format(rule.value / 100);
  }
  return ctx.formatMoney(rule.value);
}

// ─── datetime-local <-> ISO ──────────────────────────────────────────────────

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * ISO instant -> the "YYYY-MM-DDTHH:mm" string a native datetime-local input
 * wants, in the viewer's local time. Empty string (never null) when unset, since
 * that is what a controlled input needs.
 */
export function toLocalInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return (
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}` +
    `T${pad2(date.getHours())}:${pad2(date.getMinutes())}`
  );
}

/**
 * Local input value -> ISO instant, or null to clear the bound. `new Date` reads
 * a zone-less "YYYY-MM-DDTHH:mm" as LOCAL time, which is what the owner meant
 * ("valid until 6pm" is 6pm on their clock, not in UTC).
 */
export function fromLocalInputValue(local: string | null | undefined): string | null {
  if (!local) return null;
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
