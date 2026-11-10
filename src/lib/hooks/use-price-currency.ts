"use client";

import { useCallback, useEffect, useState } from "react";
import type { Locale } from "@/components/lang/i18n-provider";
import {
  LOCALE_PRICE_CURRENCY,
  PRICE_CURRENCIES,
  type PriceCurrency,
} from "@/lib/constants/plan-pricing";
import { guessCountryCode, resolveMarketDefaults } from "@/lib/onboarding/markets";

const STORAGE_KEY = "epidom:price-currency";

function isPriceCurrency(value: unknown): value is PriceCurrency {
  return PRICE_CURRENCIES.includes(value as PriceCurrency);
}

/** The currency of the visitor's country, from the device's time zone, when Epidom quotes it. */
export function detectPriceCurrency(locale: Locale): PriceCurrency {
  const fallback = LOCALE_PRICE_CURRENCY[locale];
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const countryCode = guessCountryCode({ browserTimezone: timezone, uiLocale: locale });
    const currency = resolveMarketDefaults({ countryCode, browserTimezone: timezone }).currency;
    return countryCode !== "ZZ" && isPriceCurrency(currency) ? currency : fallback;
  } catch {
    return fallback;
  }
}

/**
 * The currency plans are quoted in on a page where the visitor can change it.
 * First render (and the server's) is the language's currency; right after
 * mount it becomes the one the visitor chose before (remembered on this
 * device), else the one detected from where they are. Changing it is
 * remembered.
 */
export function usePriceCurrency(locale: Locale): [PriceCurrency, (c: PriceCurrency) => void] {
  const [currency, setCurrencyState] = useState<PriceCurrency>(LOCALE_PRICE_CURRENCY[locale]);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      stored = null;
    }
    setCurrencyState(isPriceCurrency(stored) ? stored : detectPriceCurrency(locale));
  }, [locale]);

  const setCurrency = useCallback((next: PriceCurrency) => {
    setCurrencyState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not remembered; the choice still applies to this visit.
    }
  }, []);

  return [currency, setCurrency];
}
