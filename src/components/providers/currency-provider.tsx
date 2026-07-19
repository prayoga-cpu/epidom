"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@/lib/auth-client";
import { formatCurrency, type Currency } from "@/lib/utils/formatting";
import { CURRENCIES } from "@/lib/constants/currencies";

export type { Currency };

/**
 * Every price-bearing entity in this schema defaults to IDR when it has no
 * currency field of its own (Material/Product costs) or hasn't been changed
 * from the platform default (MenuItem, User, Business). Treating IDR as the
 * base/storage currency lets conversion generalize to any display currency
 * without threading a "from" currency through every call site.
 */
const BASE_CURRENCY = "IDR";

interface ExchangeRateData {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  fetchedAt: string;
  expiresAt: string;
}

interface CurrencyContextValue {
  currency: Currency;
  exchangeRate: number;
  isLoading: boolean;
  error: string | null;
  formatPrice: (value: number | null | undefined, fromCurrency?: string) => string;
  convertPrice: (value: number, fromCurrency?: string) => number;
  convertToBase: (valueInUserCurrency: number, toCurrency?: string) => number;
  refreshExchangeRate: () => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { user, loading: userLoading } = useUser();
  const [userCurrency, setUserCurrency] = useState<Currency>(BASE_CURRENCY);
  const [exchangeRate, setExchangeRate] = useState<number>(1.0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Use the same query key as use-profile.ts so this reads from the shared
  // cache and re-runs when the profile is invalidated after a currency update.
  // select() extracts just the currency regardless of what shape the cache
  // holds (full profile object vs. raw API envelope).
  const { data: currencyFromProfile } = useQuery<any, Error, string | undefined>({
    queryKey: ["profile", user?.id],
    queryFn: () =>
      fetch("/api/user/profile")
        .then((r) => r.json())
        .then((d) => (d?.success && d?.data ? d.data : d)),
    enabled: !!user?.id && !userLoading,
    staleTime: 5 * 60 * 1000,
    select: (data: any): string | undefined => {
      // data can be: full profile object { currency, ... }
      //           or API envelope        { success, data: { currency, ... } }
      //           or just a string       "EUR" (legacy cache entry)
      if (typeof data === "string") return data;
      if (data?.currency) return data.currency as string;
      if (data?.data?.currency) return data.data.currency as string;
      return undefined;
    },
  });

  useEffect(() => {
    if (!currencyFromProfile) return;
    if (CURRENCIES.some((c) => c.code === currencyFromProfile)) {
      setUserCurrency(currencyFromProfile);
    }
  }, [currencyFromProfile]);

  // Fetch the BASE_CURRENCY -> userCurrency rate whenever the display
  // currency actually differs from the base — for any currency, not just USD.
  useEffect(() => {
    if (userLoading) return;
    if (userCurrency === BASE_CURRENCY) {
      setExchangeRate(1.0);
      setIsLoading(false);
      return;
    }
    fetchExchangeRate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userCurrency, userLoading]);

  const fetchExchangeRate = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/exchange-rates?from=${BASE_CURRENCY}&to=${userCurrency}`);
      const result = await response.json();
      if (!response.ok || !result.success)
        throw new Error(result.error || "Failed to fetch exchange rate");
      const rateData: ExchangeRateData = result.data;
      setExchangeRate(rateData.rate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch exchange rate");
      setExchangeRate(1.0);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Convert a stored value to the user's display currency. `fromCurrency`
   * is the currency the value is actually stored in (defaults to the
   * platform base, IDR). Only IDR <-> userCurrency pairs are backed by a
   * live rate today — a value already stored in a third currency is
   * returned unconverted rather than applying a rate for the wrong pair.
   */
  const convertPrice = (value: number, fromCurrency: string = BASE_CURRENCY): number => {
    if (fromCurrency === userCurrency) return value;
    if (fromCurrency === BASE_CURRENCY) return value * exchangeRate;
    return value;
  };

  const convertToBase = (
    valueInUserCurrency: number,
    toCurrency: string = BASE_CURRENCY
  ): number => {
    if (toCurrency === userCurrency) return valueInUserCurrency;
    if (toCurrency === BASE_CURRENCY) return valueInUserCurrency / exchangeRate;
    return valueInUserCurrency;
  };

  const formatPrice = (
    value: number | null | undefined,
    fromCurrency: string = BASE_CURRENCY
  ): string => {
    const safeValue = value === null || value === undefined || isNaN(value) ? 0 : value;
    const converted = convertPrice(safeValue, fromCurrency);
    // Fixed "en-US" locale (not the browser's) keeps digit grouping
    // deterministic between server and client render, avoiding a
    // hydration mismatch. Delegates to formatCurrency so both formatting
    // paths share the same fraction-digit rules (e.g. IDR's 0 decimals).
    return formatCurrency(converted, userCurrency, "en-US");
  };

  return (
    <CurrencyContext.Provider
      value={{
        currency: userCurrency,
        exchangeRate,
        isLoading,
        error,
        formatPrice,
        convertPrice,
        convertToBase,
        refreshExchangeRate: fetchExchangeRate,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextValue {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error("useCurrency must be used within a CurrencyProvider");
  return context;
}
