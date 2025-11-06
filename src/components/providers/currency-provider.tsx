"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useUser } from "@/lib/auth-client";

export type Currency = "EUR" | "USD";

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
  formatPrice: (priceInEur: number | null | undefined) => string;
  convertPrice: (priceInEur: number) => number;
  convertToBase: (priceInUserCurrency: number) => number;
  refreshExchangeRate: () => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined);

interface CurrencyProviderProps {
  children: ReactNode;
}

/**
 * Currency Provider
 *
 * Provides currency context throughout the application
 * - Reads user's currency preference from profile
 * - Fetches EUR to USD exchange rate from API
 * - Provides formatPrice() helper for automatic conversion and formatting
 * - Caches exchange rate to minimize API calls
 */
export function CurrencyProvider({ children }: CurrencyProviderProps) {
  const { user, loading: userLoading } = useUser();
  const [exchangeRate, setExchangeRate] = useState<number>(1.1); // Default fallback
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Get user's currency preference (default to EUR)
  const currency: Currency = (user?.currency as Currency) || "EUR";

  // Fetch exchange rate on mount and when currency changes
  useEffect(() => {
    // If user hasn't loaded yet, wait
    if (userLoading) {
      return;
    }

    console.log("CurrencyProvider - Currency changed to:", currency, "User:", user?.email);

    // If user prefers EUR, no need to fetch exchange rate
    if (currency === "EUR") {
      setExchangeRate(1.0);
      setIsLoading(false);
      return;
    }

    // Fetch EUR to USD exchange rate
    fetchExchangeRate();
  }, [currency, userLoading]);

  const fetchExchangeRate = async () => {
    try {
      console.log("[CurrencyProvider] Fetching exchange rate from API...");
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/exchange-rates");
      console.log("[CurrencyProvider] API response status:", response.status);

      const result = await response.json();
      console.log("[CurrencyProvider] API response data:", result);

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to fetch exchange rate");
      }

      const rateData: ExchangeRateData = result.data;
      console.log("[CurrencyProvider] Setting exchange rate:", rateData.rate);
      setExchangeRate(rateData.rate);
    } catch (err) {
      console.error("[CurrencyProvider] Error fetching exchange rate:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch exchange rate");
      // Keep using fallback rate (1.1)
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Convert price from EUR to user's currency
   */
  const convertPrice = (priceInEur: number): number => {
    if (currency === "EUR") {
      return priceInEur;
    }
    return priceInEur * exchangeRate;
  };

  /**
   * Convert price from user's currency back to EUR (base currency)
   * Used when saving prices entered in USD
   */
  const convertToBase = (priceInUserCurrency: number): number => {
    if (currency === "EUR") {
      return priceInUserCurrency;
    }
    return priceInUserCurrency / exchangeRate;
  };

  /**
   * Format price with currency symbol and conversion
   * Automatically converts EUR to USD if needed
   */
  const formatPrice = (priceInEur: number | null | undefined): string => {
    if (priceInEur === null || priceInEur === undefined || isNaN(priceInEur)) {
      return currency === "EUR" ? "€0.00" : "$0.00";
    }

    const convertedPrice = convertPrice(priceInEur);

    // Map currency to locale for proper formatting
    const locale = currency === "EUR" ? "fr-FR" : "en-US";

    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(convertedPrice);
  };

  /**
   * Manually refresh exchange rate
   */
  const refreshExchangeRate = async () => {
    await fetchExchangeRate();
  };

  const value: CurrencyContextValue = {
    currency,
    exchangeRate,
    isLoading,
    error,
    formatPrice,
    convertPrice,
    convertToBase,
    refreshExchangeRate,
  };

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

/**
 * Hook to use currency context
 */
export function useCurrency(): CurrencyContextValue {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
}
