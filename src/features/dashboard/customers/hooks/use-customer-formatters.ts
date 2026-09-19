"use client";

import { useMemo } from "react";
import { useI18n } from "@/components/lang/i18n-provider";

/** Shown for a date that doesn't exist yet (never ordered, never earned points). */
export const EMPTY_VALUE = "—";

/**
 * Locale-bound date and number formatting for the Customers page. Built on
 * `Intl` with the app's `intlLocale` (not a bare toLocaleDateString(), which
 * silently falls back to the browser's language). Money is NOT formatted here:
 * it goes through useCurrency() with the store's currency passed explicitly.
 */
export function useCustomerFormatters() {
  const { intlLocale } = useI18n();

  return useMemo(() => {
    const dateFormat = new Intl.DateTimeFormat(intlLocale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const dateTimeFormat = new Intl.DateTimeFormat(intlLocale, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const numberFormat = new Intl.NumberFormat(intlLocale);
    // "+50" / "-50" for the ledger; zero (which the API never stores) stays bare.
    const signedFormat = new Intl.NumberFormat(intlLocale, { signDisplay: "exceptZero" });

    const format = (formatter: Intl.DateTimeFormat, iso: string | null | undefined) => {
      if (!iso) return EMPTY_VALUE;
      const date = new Date(iso);
      return Number.isNaN(date.getTime()) ? EMPTY_VALUE : formatter.format(date);
    };

    return {
      date: (iso: string | null | undefined) => format(dateFormat, iso),
      dateTime: (iso: string | null | undefined) => format(dateTimeFormat, iso),
      number: (value: number) => numberFormat.format(value),
      signed: (value: number) => signedFormat.format(value),
    };
  }, [intlLocale]);
}
