"use client";

import { useSyncExternalStore } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import { guessCountryCode } from "@/lib/onboarding/markets";

/** The browser's IANA timezone, or undefined on the server / when Intl can't tell. */
export function getBrowserTimezone(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

// Neither value changes while the page is open, so there is nothing to subscribe to.
const noopSubscribe = () => () => {};
const serverSnapshot = () => undefined;

/**
 * The browser's timezone, SSR-safe: undefined in the server render (and the
 * hydration pass that matches it), then the real zone. Pass it to
 * <MarketSummary browserTimezone> and as `browserTimezone` in the onboarding
 * store-step body.
 */
export function useBrowserTimezone(): string | undefined {
  return useSyncExternalStore(noopSubscribe, getBrowserTimezone, serverSnapshot);
}

/**
 * Best first guess for the country picker (see guessCountryCode): the country
 * whose zones include the browser's timezone, else the UI language's primary
 * market (fr → FR, id → ID), else "Other" (OTHER_COUNTRY_CODE).
 *
 * SSR-safe: undefined in the server render and the hydration pass, so markup
 * never mismatches; the guess arrives on the client right after. Always a
 * suggestion only — never overwrite a country the owner (or saved data)
 * already chose.
 */
export function useDefaultCountryCode(): string | undefined {
  const { locale } = useI18n();
  return useSyncExternalStore(
    noopSubscribe,
    () => guessCountryCode({ browserTimezone: getBrowserTimezone(), uiLocale: locale }),
    serverSnapshot
  );
}
