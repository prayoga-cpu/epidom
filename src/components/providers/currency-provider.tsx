"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@/lib/auth-client";
import type { Currency } from "@/lib/utils/formatting";

export type { Currency };

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
  formatPrice: (value: number | null | undefined) => string;
  convertPrice: (value: number) => number;
  convertToBase: (valueInUserCurrency: number) => number;
  refreshExchangeRate: () => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined);

const FRACTION_DIGITS: Record<Currency, number> = {
  EUR: 2,
  USD: 2,
  IDR: 0,
};

const CURRENCY_LOCALE: Record<Currency, string> = {
  EUR: "fr-FR",
  USD: "en-US",
  IDR: "id-ID",
};

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { user, loading: userLoading } = useUser();
  const [userCurrency, setUserCurrency] = useState<Currency>("IDR");
  const [exchangeRate, setExchangeRate] = useState<number>(1.0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Use React Query with the same key as useProfile so cache invalidation
  // on profile update (e.g. currency change) propagates here automatically.
  const { data: profileData } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () =>
      fetch("/api/user/profile")
        .then((r) => r.json())
        .then((d) => d?.data?.currency as string | undefined),
    enabled: !!user?.id && !userLoading,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!profileData) return;
    if (profileData === "EUR" || profileData === "USD" || profileData === "IDR") {
      setUserCurrency(profileData);
    }
  }, [profileData]);

  // Fetch exchange rate only for USD
  useEffect(() => {
    if (userLoading) return;
    if (userCurrency !== "USD") {
      setExchangeRate(1.0);
      setIsLoading(false);
      return;
    }
    fetchExchangeRate();
  }, [userCurrency, userLoading]);

  const fetchExchangeRate = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/exchange-rates");
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Failed to fetch exchange rate");
      const rateData: ExchangeRateData = result.data;
      setExchangeRate(rateData.rate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch exchange rate");
      setExchangeRate(1.1);
    } finally {
      setIsLoading(false);
    }
  };

  /** Convert stored value to display currency. IDR and EUR are stored as-is. */
  const convertPrice = (value: number): number => {
    if (userCurrency === "USD") return value * exchangeRate;
    return value;
  };

  const convertToBase = (valueInUserCurrency: number): number => {
    if (userCurrency === "USD") return valueInUserCurrency / exchangeRate;
    return valueInUserCurrency;
  };

  const formatPrice = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) {
      const fd = FRACTION_DIGITS[userCurrency];
      return new Intl.NumberFormat(CURRENCY_LOCALE[userCurrency], {
        style: "currency",
        currency: userCurrency,
        minimumFractionDigits: fd,
        maximumFractionDigits: fd,
      }).format(0);
    }
    const converted = convertPrice(value);
    const fd = FRACTION_DIGITS[userCurrency];
    return new Intl.NumberFormat(CURRENCY_LOCALE[userCurrency], {
      style: "currency",
      currency: userCurrency,
      minimumFractionDigits: fd,
      maximumFractionDigits: fd,
    }).format(converted);
  };

  return (
    <CurrencyContext.Provider value={{
      currency: userCurrency,
      exchangeRate,
      isLoading,
      error,
      formatPrice,
      convertPrice,
      convertToBase,
      refreshExchangeRate: fetchExchangeRate,
    }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextValue {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error("useCurrency must be used within a CurrencyProvider");
  return context;
}
