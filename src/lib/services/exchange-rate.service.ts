import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * Exchange Rate Service
 *
 * Fetches and caches EUR to USD exchange rates from exchangerate-api.io
 * Rates are cached for 1 hour to minimize API calls
 */

const EXCHANGE_RATE_API_URL =
  process.env.EXCHANGE_RATE_API_URL || "https://v6.exchangerate-api.com/v6";
const API_KEY = process.env.EXCHANGE_RATE_API_KEY || ""; // Free tier: 1,500 requests/month
const CACHE_DURATION_HOURS = 6; // Cache rates for 6 hours
const BASE_CURRENCY = "EUR";
const TARGET_CURRENCY = "USD";

export interface ExchangeRateData {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  fetchedAt: Date;
  expiresAt: Date;
}

/**
 * Get the current EUR to USD exchange rate
 * Returns cached rate if available and not expired
 * Otherwise fetches fresh rate from API and caches it
 */
export async function getExchangeRate(): Promise<ExchangeRateData> {
  try {
    // Try to get cached rate
    const cachedRate = await getCachedExchangeRate();

    if (cachedRate && new Date() < cachedRate.expiresAt) {
      logger.info("Using cached exchange rate", { rate: cachedRate.rate });
      return {
        fromCurrency: cachedRate.fromCurrency,
        toCurrency: cachedRate.toCurrency,
        rate: Number(cachedRate.rate),
        fetchedAt: cachedRate.fetchedAt,
        expiresAt: cachedRate.expiresAt,
      };
    }

    // Fetch fresh rate from API
    logger.info("Fetching fresh exchange rate from API");
    const freshRate = await fetchExchangeRateFromAPI();

    // Cache the new rate
    await cacheExchangeRate(freshRate);

    return freshRate;
  } catch (error) {
    logger.error("Error getting exchange rate", error);

    // If API fails, try to return expired cached rate as fallback
    const cachedRate = await getCachedExchangeRate();
    if (cachedRate) {
      logger.warn("Using expired cached rate as fallback", { rate: cachedRate.rate });
      return {
        fromCurrency: cachedRate.fromCurrency,
        toCurrency: cachedRate.toCurrency,
        rate: Number(cachedRate.rate),
        fetchedAt: cachedRate.fetchedAt,
        expiresAt: cachedRate.expiresAt,
      };
    }

    // Final fallback: return fixed rate (1 EUR = 1.10 USD)
    logger.warn("Using fixed fallback rate: 1 EUR = 1.10 USD");
    return {
      fromCurrency: BASE_CURRENCY,
      toCurrency: TARGET_CURRENCY,
      rate: 1.1,
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + CACHE_DURATION_HOURS * 60 * 60 * 1000),
    };
  }
}

/**
 * Fetch exchange rate from exchangerate-api.io
 */
async function fetchExchangeRateFromAPI(): Promise<ExchangeRateData> {
  if (!API_KEY) {
    throw new Error("EXCHANGE_RATE_API_KEY environment variable is not set");
  }

  const url = `${EXCHANGE_RATE_API_URL}/${API_KEY}/pair/${BASE_CURRENCY}/${TARGET_CURRENCY}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Exchange rate API returned status ${response.status}`);
  }

  const data = await response.json();

  if (data.result !== "success") {
    throw new Error(`Exchange rate API error: ${data["error-type"]}`);
  }

  const rate = data.conversion_rate;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_DURATION_HOURS * 60 * 60 * 1000);

  return {
    fromCurrency: BASE_CURRENCY,
    toCurrency: TARGET_CURRENCY,
    rate,
    fetchedAt: now,
    expiresAt,
  };
}

/**
 * Get cached exchange rate from database
 */
async function getCachedExchangeRate() {
  return await prisma.exchangeRate.findUnique({
    where: {
      fromCurrency_toCurrency: {
        fromCurrency: BASE_CURRENCY,
        toCurrency: TARGET_CURRENCY,
      },
    },
  });
}

/**
 * Cache exchange rate in database
 */
async function cacheExchangeRate(rateData: ExchangeRateData) {
  const result = await prisma.exchangeRate.upsert({
    where: {
      fromCurrency_toCurrency: {
        fromCurrency: rateData.fromCurrency,
        toCurrency: rateData.toCurrency,
      },
    },
    update: {
      rate: rateData.rate,
      fetchedAt: rateData.fetchedAt,
      expiresAt: rateData.expiresAt,
      updatedAt: new Date(),
    },
    create: {
      fromCurrency: rateData.fromCurrency,
      toCurrency: rateData.toCurrency,
      rate: rateData.rate,
      fetchedAt: rateData.fetchedAt,
      expiresAt: rateData.expiresAt,
    },
  });

  return result;
}

/**
 * Convert price from EUR to USD
 */
export function convertPrice(priceInEur: number, exchangeRate: number): number {
  return priceInEur * exchangeRate;
}

/**
 * Manually refresh the exchange rate (admin function)
 */
export async function refreshExchangeRate(): Promise<ExchangeRateData> {
  logger.info("Manually refreshing exchange rate");
  const freshRate = await fetchExchangeRateFromAPI();
  await cacheExchangeRate(freshRate);
  return freshRate;
}

/**
 * Clean up expired exchange rates (maintenance function)
 */
export async function cleanupExpiredRates(): Promise<number> {
  const result = await prisma.exchangeRate.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Older than 7 days
      },
    },
  });

  logger.info(`Cleaned up ${result.count} expired exchange rates`);
  return result.count;
}
