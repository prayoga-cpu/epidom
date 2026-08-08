"use client";

import type React from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { enUS, fr, id as idLocale, type Locale as DateFnsLocale } from "date-fns/locale";
import { translations } from "@/locales";
import { getLanguagePreference, setLanguagePreference } from "@/lib/cookie-consent";
import {
  formatDate as formatDateWithLocale,
  formatDateTime as formatDateTimeWithLocale,
  formatDateOnly as formatDateOnlyWithLocale,
  formatTimeOnly as formatTimeOnlyWithLocale,
  formatRelativeTime as formatRelativeTimeWithLocale,
} from "@/lib/utils/formatting";

export type Locale = "en" | "fr" | "id";

/** date-fns `Locale` object for the given app locale — for call sites that
 * need to invoke `date-fns`'s `format()`/`formatDistanceToNow()` directly
 * (e.g. building a custom format string) rather than through the bound
 * helpers below. */
export const DATE_FNS_LOCALES: Record<Locale, DateFnsLocale> = { en: enUS, fr, id: idLocale };

/** `Intl` locale tag for the given app locale — for `Intl.DateTimeFormat`/
 * `Intl.NumberFormat` call sites. */
export const INTL_LOCALES: Record<Locale, string> = { en: "en-US", fr: "fr-FR", id: "id-ID" };

type I18nContextType = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
  /** Locale-bound date formatters — always use these (or the raw exports
   * from `date-fns`/`Intl` seeded with `dateLocale`/`intlLocale` below) over
   * `@/lib/utils/format-date` or a bare `.toLocaleDateString()`, which
   * either hardcode English or silently default to it. */
  formatDate: (date: Date | string | null | undefined, formatStr?: string) => string;
  formatDateTime: (date: Date | string | null | undefined) => string;
  formatDateOnly: (date: Date | string | null | undefined) => string;
  formatTimeOnly: (date: Date | string | null | undefined) => string;
  formatRelativeTime: (date: Date | string | null | undefined) => string;
  /** The current locale's `date-fns` `Locale` object, for call sites that
   * need to call `date-fns`'s `format()` themselves with a custom pattern. */
  dateLocale: DateFnsLocale;
  /** The current locale's `Intl` tag (e.g. "id-ID"), for `Intl.DateTimeFormat`. */
  intlLocale: string;
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

type TranslationValue = string | number | ((arg: number) => string);
type TranslationObject = { [key: string]: TranslationValue | TranslationObject };

function get(obj: TranslationObject, path: string): TranslationValue | undefined {
  return path
    .split(".")
    .reduce(
      (acc: TranslationObject | TranslationValue | undefined, key) =>
        acc && typeof acc === "object" && !Array.isArray(acc) ? acc[key] : undefined,
      obj
    ) as TranslationValue | undefined;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    // Get language preference from cookie consent system (with fallback to legacy storage)
    const preferredLanguage = getLanguagePreference();
    setLocaleState(preferredLanguage);

    if (typeof document !== "undefined") {
      document.documentElement.lang = preferredLanguage;
    }

    // Listen for language changes from cookie consent
    const handleConsentUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.language) {
        setLocaleState(customEvent.detail.language);
        if (typeof document !== "undefined") {
          document.documentElement.lang = customEvent.detail.language;
        }
      }
    };

    window.addEventListener("cookie-consent-updated", handleConsentUpdate);

    return () => {
      window.removeEventListener("cookie-consent-updated", handleConsentUpdate);
    };
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);

    // Save to cookie consent system
    setLanguagePreference(l);

    // Also update legacy storage for backward compatibility
    try {
      window.localStorage.setItem("locale", l);
      window.localStorage.setItem("lang", l);
    } catch {}

    if (typeof document !== "undefined") {
      document.documentElement.lang = l;
    }
  }, []);

  const t = useCallback(
    (key: string) => {
      let value = get(translations[locale], key);

      // Fallback to English if key is missing
      if (value === undefined && locale !== "en") {
        value = get(translations["en"], key);
      }

      // Support function values like footer.rights(year)
      if (typeof value === "function") {
        return value(new Date().getFullYear());
      }
      // Only return strings or numbers, not objects
      if (typeof value === "string" || typeof value === "number") {
        return String(value);
      }
      // If value is still undefined, return the key so it never crashes!
      return key;
    },
    [locale]
  );

  const formatDate = useCallback(
    (date: Date | string | null | undefined, formatStr?: string) =>
      formatDateWithLocale(date, formatStr, locale),
    [locale]
  );
  const formatDateTime = useCallback(
    (date: Date | string | null | undefined) => formatDateTimeWithLocale(date, locale),
    [locale]
  );
  const formatDateOnly = useCallback(
    (date: Date | string | null | undefined) => formatDateOnlyWithLocale(date, locale),
    [locale]
  );
  const formatTimeOnly = useCallback(
    (date: Date | string | null | undefined) => formatTimeOnlyWithLocale(date, locale),
    [locale]
  );
  const formatRelativeTime = useCallback(
    (date: Date | string | null | undefined) => formatRelativeTimeWithLocale(date, locale),
    [locale]
  );
  const dateLocale = DATE_FNS_LOCALES[locale];
  const intlLocale = INTL_LOCALES[locale];

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
      formatDate,
      formatDateTime,
      formatDateOnly,
      formatTimeOnly,
      formatRelativeTime,
      dateLocale,
      intlLocale,
    }),
    [
      locale,
      setLocale,
      t,
      formatDate,
      formatDateTime,
      formatDateOnly,
      formatTimeOnly,
      formatRelativeTime,
      dateLocale,
      intlLocale,
    ]
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
