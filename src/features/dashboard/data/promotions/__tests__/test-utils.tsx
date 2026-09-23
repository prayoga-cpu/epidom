/**
 * Shared harness for the Promotions tests (a helper, not a test file — it does
 * not match vitest's `*.test.*` include).
 *
 * The suites mock `useI18n` and `useCurrency` the way the rest of the repo does
 * (`t` returns the key), with two additions that matter here:
 *
 *  - `translate` knows the English wording of the few keys whose tests assert on
 *    an INTERPOLATED result ("Edit {name}", the loyalty summary), so a broken
 *    `.replace("{amount}", …)` is caught rather than hidden behind a bare key.
 *  - `currencyValue` reproduces CurrencyProvider's real conversion rule: a
 *    formatPrice(value) with no second argument is read as IDR and converted.
 *    Forgetting to pass the store currency is a recurring shipped bug, and this is
 *    what makes a test fail when someone does — and `convertToBase` throws, so a
 *    write path that runs a literal amount through it cannot pass.
 */
import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils/formatting";

const COPY: Record<string, string> = {
  "promotions.presets.edit": "Edit {name}",
  "promotions.presets.delete": "Delete {name}",
  "promotions.presets.toggle": "Turn {name} on or off",
  "promotions.presets.deleteDescription": "“{name}” will no longer be offered.",
  "promotions.coupons.edit": "Edit {code}",
  "promotions.coupons.toggle": "Turn {code} on or off",
  "promotions.coupons.validFrom": "From {date}",
  "promotions.coupons.validUntil": "Until {date}",
  "promotions.coupons.validAlways": "No time limit",
  "promotions.coupons.dialog.maxUsesUsedHint": "Already used {count} times.",
  "promotions.loyalty.summaryEarn": "Spend {amount} to earn 1 point",
  "promotions.loyalty.summaryValue": "1 point is worth {amount}",
  "promotions.loyalty.summaryMinRedeem": "minimum redeem {count} points",
  "promotions.loyalty.summaryNoMinimum": "no minimum to redeem",
  "promotions.loyalty.dialog.suggestedHint":
    "Fills in {spend} to earn a point and {value} per point.",
  "promotions.presets.dialog.valueFixedHint": "Taken off the bill, in {currency}.",
  "promotions.coupons.dialog.minSubtotalHint": "Needed, in {currency}.",
};

export function translate(key: string): string {
  return COPY[key] ?? key;
}

export function i18nMock() {
  return {
    useI18n: () => ({
      t: translate,
      locale: "en" as const,
      intlLocale: "en-US",
      // Deterministic and timezone-free: "2026-10-01T09:00:00.000Z" -> "2026-10-01".
      formatDateTime: (date: Date | string | null | undefined) =>
        date ? String(date).slice(0, 10) : "",
    }),
  };
}

/** Mirrors CurrencyProvider's value; see the file comment for why. */
export function currencyValue(currency: string) {
  const idrToDisplayRate = 0.00006;
  return {
    currency,
    exchangeRate: idrToDisplayRate,
    isLoading: false,
    error: null,
    formatPrice: (value: number | null | undefined, fromCurrency: string = "IDR") => {
      const safe = value ?? 0;
      const converted =
        fromCurrency === currency ? safe : Math.round(safe * idrToDisplayRate * 100) / 100;
      return formatCurrency(converted, currency, "en-US");
    },
    convertPrice: (value: number) => value,
    convertToBase: () => {
      throw new Error("convertToBase must never touch a promotion amount (they are literal)");
    },
    refreshExchangeRate: async () => {},
  };
}

export function currencyMock(getCurrency: () => string) {
  return { useCurrency: () => currencyValue(getCurrency()) };
}

/** Radix's Switch/RadioGroup measure themselves with ResizeObserver, which jsdom lacks. */
export function stubResizeObserver() {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
}

export function renderWithQuery(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return { client, ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>) };
}
