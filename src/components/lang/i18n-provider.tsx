"use client";

import type React from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { translations } from "@/locales";
import { getLanguagePreference, setLanguagePreference } from "@/lib/cookie-consent";

export type Locale = "en" | "fr" | "id";

type I18nContextType = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
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
      const value = get(translations[locale], key);
      // Support function values like footer.rights(year)
      if (typeof value === "function") {
        return value(new Date().getFullYear());
      }
      // Only return strings or numbers, not objects
      if (typeof value === "string" || typeof value === "number") {
        return String(value);
      }
      // If value is an object or undefined, return undefined so fallback works
      /**
       * Type assertion needed because function must return string | undefined
       * but TypeScript cannot infer that undefined is valid return type
       * Actual type: undefined
       * TODO: Improve type inference or use explicit return type
       */
      return undefined as any;
    },
    [locale]
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
